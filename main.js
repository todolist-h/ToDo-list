const db = firebase.firestore();

new Vue({
  el: '#app',
  data: {
    todos: [],
    newTodo: '',
    newDate: '',
    user: null
  },
  methods: {
    // 1. ログイン
    login() {
      const provider = new firebase.auth.GoogleAuthProvider();
      firebase.auth().signInWithPopup(provider);
    },

    // 2. ログアウト
    logout() {
      firebase.auth().signOut();
    },

    // 3. 期限チェック（ここを login の外に出しました）
    isUrgent(dueDate) {
      if (!dueDate) return false;
      const today = new Date();
      today.setHours(0, 0, 0, 0); // 今日（0時0分）
      const targetDate = new Date(dueDate);
      targetDate.setHours(0, 0, 0, 0); // 期限日（0時0分）

      return targetDate <= today; // 今日、または今日より前なら true
    },

    // 4. 追加
  doAdd() {
  // 1. まずログインしているかチェック
  if (!this.user) {
    alert('タスクを追加するには、まずGoogleでログインしてください。');
    return; // ログインしていないので、ここで処理を中断
  }

  // 2. タスク入力があるかチェック
  if (!this.newTodo) return;

  // 3. データベースに追加
  db.collection('todos').add({
    comment: this.newTodo,
    dueDate: this.newDate,
    state: '作業中',
    uid: this.user.uid
  });

  // 4. 入力欄をリセット
  this.newTodo = '';
  this.newDate = '';
},

    // 5. 削除
    doRemove(item) {
      db.collection('todos').doc(item.id).delete();
    },

    // 6. 状態変更
    doChangeState(item) {
      const newState = item.state === '作業中' ? '完了' : '作業中';
      db.collection('todos').doc(item.id).update({ state: newState });
    }
  },
  created() {
    firebase.auth().onAuthStateChanged(user => {
      this.user = user;
      if (user) {
        db.collection('todos').where('uid', '==', user.uid).onSnapshot(snapshot => {
          this.todos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        });
      } else {
        this.todos = [];
      }
    });
  }
});

