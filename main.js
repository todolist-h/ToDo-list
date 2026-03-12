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
    isEditMode: false,
    editingId: null,
    editComment: '',
    editDate: ''
  },
  computed: {
    // 【修正版】確実に並び替えるためのロジック
    activeTodos() {
      // 1. まず配列をフィルタリング
      const list = this.todos.filter(item => item.state !== '完了');
      
      // 2. 配列のコピーを作成してからソートする
      return [...list].sort((a, b) => {
        // 星の比較
        if (a.isStarred !== b.isStarred) {
          return a.isStarred ? -1 : 1;
        }
        
        // 期限の比較
        const dateA = a.dueDate ? new Date(a.dueDate).getTime() : null;
        const dateB = b.dueDate ? new Date(b.dueDate).getTime() : null;
        
        if (!dateA && !dateB) return 0;
        if (!dateA) return 1;
        if (!dateB) return -1;
        return dateA - dateB;
      });
    },
    archivedTodos() {
      const list = this.todos.filter(item => item.state === '完了');
      return [...list].sort((a, b) => {
        return new Date(b.dueDate || 0) - new Date(a.dueDate || 0);
      });
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
        dueDate: this.newDate || null,
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
        dueDate: this.editDate || null
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
          .onSnapshot(snapshot => {
            // Firestoreのデータを配列へ変換
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
