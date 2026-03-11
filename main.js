const db = firebase.firestore();

new Vue({
  el: '#app',
  data: {
    todos: [],
    newTodo: '',
    newDate: '',
    user: null,
    isMenuOpen: false,           // サイドメニューの開閉状態
    notificationEnabled: true    // 通知スイッチの状態
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

    // 3. 期限が今日以前かチェックする（CSSクラス用）
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
      if (this.notificationEnabled && Notification.permission !== 'granted') {
        Notification.requestPermission();
      }
    },

    // 5. 期限切れタスクをチェックしてブラウザ通知を出す
    checkDeadlines() {
      if (!this.notificationEnabled) return; // スイッチがオフなら何もしない

      const todayStr = new Date().toISOString().split('T')[0];
      const urgentTasks = this.todos.filter(t => t.state !== '完了' && t.dueDate === todayStr);

      if (urgentTasks.length > 0 && Notification.permission === 'granted') {
        new Notification("ToDoリスト", {
          body: `今日が期限のタスクが ${urgentTasks.length} 件あります！`
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
        uid: this.user.uid,
        createdAt: firebase.firestore.FieldValue.serverTimestamp() // 作成日時（念のため）
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

    // 8. 状態（作業中/完了）の変更
    doChangeState(item) {
      const newState = item.state === '作業中' ? '完了' : '作業中';
      db.collection('todos').doc(item.id).update({ state: newState });
    }
  },

  created() {
    firebase.auth().onAuthStateChanged(user => {
      this.user = user;
      if (user) {
        // Firestoreからデータを取得（並び替え：状態が「作業中」が上 ＆ 期限が近い順）
        db.collection('todos')
          .where('uid', '==', user.uid)
          .orderBy('state', 'desc') 
          .orderBy('dueDate', 'asc')
          .onSnapshot(snapshot => {
            this.todos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            // データが更新されるたびに期限をチェック
            this.checkDeadlines();
          });
      } else {
        this.todos = [];
      }
    });
  }
});
