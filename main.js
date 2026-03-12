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
    // 設定関連
    notificationEnabled: localStorage.getItem('notify') === 'true',
    effectEnabled: localStorage.getItem('effect') !== 'false',
    
    // 編集機能用のデータ
    editingId: null,      // 現在編集中のタスクのID（nullなら通常モード）
    editComment: '',      // 編集用の一時的なテキスト
    editDate: ''          // 編集用の一時的な日付
  },
  computed: {
    // 進行中のタスクをフィルタリング
    activeTodos() {
      return this.todos.filter(item => item.state !== '完了');
    },
    // 完了済みのタスクをフィルタリング
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

    // 3. 期限チェック
    isUrgent(dueDate) {
      if (!dueDate) return false;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const targetDate = new Date(dueDate);
      targetDate.setHours(0, 0, 0, 0);
      return targetDate <= today;
    },

    // 4. 通知設定保存
    toggleNotification() {
      localStorage.setItem('notify', this.notificationEnabled);
      if (this.notificationEnabled && Notification.permission !== 'granted') {
        Notification.requestPermission();
      }
    },

    // 5. エフェクト設定保存
    toggleEffect() {
      localStorage.setItem('effect', this.effectEnabled);
    },

    // 6. 期限切れ通知実行
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

    // 7. タスクの追加
    doAdd() {
      if (!this.user) {
        alert('ログインしてください');
        return;
      }
      if (!this.newTodo) return;
      
      db.collection('todos').add({
        comment: this.newTodo,
        dueDate: this.newDate,
        state: '作業中',
        isStarred: false,
        uid: this.user.uid,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      this.newTodo = '';
      this.newDate = '';
    },

    // 8. タスクの削除
    doRemove(item) {
      if (confirm('本当に削除しますか？')) {
        db.collection('todos').doc(item.id).delete();
      }
    },

    // 9. 状態の変更（完了/戻す）
    doChangeState(item) {
      const newState = item.state === '作業中' ? '完了' : '作業中';
      
      if (newState === '完了' && this.effectEnabled) {
        this.runConfetti();
      }

      db.collection('todos').doc(item.id).update({ state: newState });
    },

    // 10. スターの切り替え
    doToggleStar(item) {
      const newStarred = !item.isStarred;
      db.collection('todos').doc(item.id).update({ isStarred: newStarred });
    },

    // 11. 編集開始
    startEdit(item) {
      this.editingId = item.id;
      this.editComment = item.comment;
      this.editDate = item.dueDate;
    },

    // 12. 編集キャンセル
    cancelEdit() {
      this.editingId = null;
      this.editComment = '';
      this.editDate = '';
    },

    // 13. データの更新保存
    doUpdate(item) {
      if (!this.editComment) return;
      
      db.collection('todos').doc(item.id).update({
        comment: this.editComment,
        dueDate: this.editDate
      }).then(() => {
        this.editingId = null; // 編集モード終了
      }).catch(error => {
        console.error("更新エラー:", error);
        alert("保存に失敗しました。");
      });
    },

    // 14. 紙吹雪演出
    runConfetti() {
      if (typeof confetti === 'function') {
        confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#ffeb3b', '#ff9800', '#f44336', '#e91e63', '#9c27b0']
        });
      }
    }
  },

  created() {
    firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL);

    let unsubscribe = null;

    firebase.auth().onAuthStateChanged(user => {
      // 認証状態が変わったら以前のリスナーを解除
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }

      this.user = user;

      if (user) {
        // ログイン時：Firestoreのリアルタイム監視を開始
        unsubscribe = db.collection('todos')
          .where('uid', '==', user.uid)
          .orderBy('isStarred', 'desc')
          .orderBy('createdAt', 'desc')
          .onSnapshot(snapshot => {
            this.todos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            this.checkDeadlines();
          }, (error) => {
            console.error("Firestoreリスナーエラー:", error);
          });
      } else {
        // ログアウト時
        this.todos = [];
      }
    });

    if (!localStorage.getItem('hasSeenTerms')) {
      this.showTerms = true;
      localStorage.setItem('hasSeenTerms', 'true');
    }
  }
});
