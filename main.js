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
    login() {
      const provider = new firebase.auth.GoogleAuthProvider();
      firebase.auth().signInWithPopup(provider);
    },
    logout() {
      firebase.auth().signOut();
    },
    doAdd() {
      if(!this.newTodo) return;
      db.collection('todos').add({
        comment: this.newTodo,
        dueDate: this.newDate,
        state: '作業中',
        uid: this.user.uid
      });
      this.newTodo = '';
    },
    doRemove(item) {
      db.collection('todos').doc(item.id).delete();
    },
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