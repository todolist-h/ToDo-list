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
    
    // 編集・モード管理用データ
    isEditMode: false,    // 編集モード自体のON/OFF
    editingId: null,      // 編集中のタスクID
    editComment: '',      // 編集用の一時的なテキスト
    editDate: ''          // 編集用の一時的な日付
  },
  computed: {
    activeTodos() {
      return this.todos.filter(item => item.state !== '完了');
    },
    archivedTodos() {
      return this.todos.filter(item => item.state === '完了');
    }
  },
  methods: {
    login() {
      const provider = new firebase.auth.GoogleAuthProvider();
      firebase.auth().signInWithPopup(provider);
    },
    logout() {
      firebase.auth().signOut();
    },
    isUrgent(dueDate) {
      if (!dueDate) return false;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const targetDate = new Date(dueDate);
      targetDate.setHours(0, 0, 0, 0);
      return targetDate <= today;
    },
    toggleNotification() {
      localStorage.setItem('notify', this.notificationEnabled);
      if (this.notificationEnabled && Notification.permission !== 'granted') {
        Notification.requestPermission();
      }
    },
    toggleEffect() {
      localStorage.setItem('effect', this.effectEnabled);
    },
    toggleEditMode() {
      // 編集モードを抜けるときは編集中の内容をクリア
      if (!this.isEditMode) {
        this.cancelEdit();
      }
    },
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
    doAdd() {
      if (!this.user || !this.newTodo) return;
      
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
    doRemove(item) {
      if (confirm('本当に削除しますか？')) {
        db.collection('todos').doc(item.id).delete();
      }
    },
    doChangeState(item) {
      const newState = item.state === '作業中' ? '完了' : '作業中';
      if (newState === '完了' && this.effectEnabled) this.runConfetti();
      db.collection('todos').doc(item.id).update({ state: newState });
    },
    doToggleStar(item) {
      db.collection('todos').doc(item.id).update({ isStarred: !item.isStarred });
    },
    startEdit(item) {
      this.editingId = item.id;
      this.editComment = item.comment;
      this.editDate = item.dueDate;
    },
    cancelEdit() {
      this.editingId = null;
      this.editComment = '';
      this.editDate = '';
    },
    doUpdate(item) {
      if (!this.editComment) return;
      db.collection('todos').doc(item.id).update({
        comment: this.editComment,
        dueDate: this.editDate
      }).then(() => this.cancelEdit());
    },
    runConfetti() {
      if (typeof confetti === 'function') {
        confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
      }
    }
  },
  created() {
    firebase.auth().onAuthStateChanged(user => {
      this.user = user;
      if (user) {
        db.collection('todos').where('uid', '==', user.uid)
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
