const db = firebase.firestore();

new Vue({
  el: '#app',
  data: {
    todos: [],
    newTodo: '',
    newDate: '',
    user: null,
    isMenuOpen: false,
    showTerms: false,
    // localStorageから設定を読み込む
    notificationEnabled: localStorage.getItem('notify') === 'true'
  },
  computed: {
    // 進行中のタスクをフィルタリング
    activeTodos() {
      return this.todos.filter(item => item.state !== '完了');
    },
    // 完了済みのタスク（アーカイブ）をフィルタリング
    archivedTodos() {
      return this.todos.filter(item => item.state === '完了');
    }
  },
  methods: {
    // 1. Googleログイン
    login() {
      const provider = new firebase.auth.GoogleAuthProvider();
      firebase.auth().signInWithPopup(provider);
    },

    // 2. ログアウト
    logout() {
      firebase.auth().signOut();
    },

    // 3. 期限が今日以前かチェックする
    isUrgent(dueDate) {
      if (!dueDate) return false;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const targetDate = new Date(dueDate);
      targetDate.setHours(0, 0, 0, 0);
      return targetDate <= today;
    },

    // 4. 通知スイッチの切り替え処理
    toggleNotification() {
      localStorage.setItem('notify', this.notificationEnabled);
      
      if (this.notificationEnabled && Notification.permission !== 'granted') {
        Notification.requestPermission();
      }
    },

    // 5. 期限切れタスクをチェック
    checkDeadlines() {
      if (!this.notificationEnabled) return;

      const todayStr = new Date().toISOString().split('T')[0];
      const urgentTasks = this.todos.filter(t => t.state !== '完了' && t.dueDate === todayStr);

      if (urgentTasks.length > 0 && Notification.permission === 'granted') {
        const taskList = urgentTasks.map(t => `・${t.comment}`).join('\n');
        
        new Notification("今日のToDo", {
          body: `期限のタスクが ${urgentTasks.length} 件あります！\n\n${taskList}`
        });
      }
    },

    // 6. タスクの追加
    doAdd() {
      if (!this.user) {
        alert('タスクを追加するには、まずGoogleでログインしてください。');
        return;
      }
      if (!this.newTodo) return;
      
      db.collection('todos').add({
        comment: this.newTodo,
        dueDate: this.newDate,
        state: '作業中',
        isStarred: false, // 追加時にデフォルトでスターなしに設定
        uid: this.user.uid,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      this.newTodo = '';
      this.newDate = '';
    },

    // 7. タスクの削除
    doRemove(item) {
      if (confirm('本当に削除しますか？')) {
        db.collection('todos').doc(item.id).delete();
      }
    },

    // 8. 状態の変更
    doChangeState(item) {
      const newState = item.state === '作業中' ? '完了' : '作業中';
      db.collection('todos').doc(item.id).update({ state: newState });
    },

    // 9. スターの切り替え
    doToggleStar(item) {
      const newStarred = !item.isStarred;
      db.collection('todos').doc(item.id).update({ isStarred: newStarred });
    }
  },

  created() {
    firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL);

    firebase.auth().onAuthStateChanged(user => {
      this.user = user;
      if (user) {
        // スター付き(true)を上にし、その次に作成日時が新しい順に取得
        db.collection('todos')
          .where('uid', '==', user.uid)
          .orderBy('isStarred', 'desc')
          .orderBy('createdAt', 'desc')
          .onSnapshot(snapshot => {
            this.todos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            this.checkDeadlines();
          });
      } else {
        this.todos = [];
      }
    });

    if (!localStorage.getItem('hasSeenTerms')) {
      this.showTerms = true;
      localStorage.setItem('hasSeenTerms', 'true');
    }
  }
});
