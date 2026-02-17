/**
 * Firebase configuration
 * 1. Go to https://console.firebase.google.com/
 * 2. Create a project (or use existing)
 * 3. Add a Web app and copy the config below
 * 4. Enable Authentication → Sign-in method → Email/Password
 * 5. Create Firestore Database and set rules (see firestore.rules)
 */
  const firebaseConfig = {
    apiKey: "AIzaSyAvnZPXxhlQjSBLtjuReg8JDv5TbPgKgOo",
    authDomain: "savinggoal-b7848.firebaseapp.com",
    projectId: "savinggoal-b7848",
    storageBucket: "savinggoal-b7848.firebasestorage.app",
    messagingSenderId: "203636021035",
    appId: "1:203636021035:web:d84673ee827fe5fe53d76e",
    measurementId: "G-C236P18ZBT"
  };

// Initialize Firebase (only if config is filled in)
let db = null;
let auth = null;

if (firebaseConfig.apiKey && firebaseConfig.apiKey !== "YOUR_API_KEY") {
  firebase.initializeApp(firebaseConfig);
  db = firebase.firestore();
  auth = firebase.auth();
}

window.firebaseDb = db;
window.firebaseAuth = auth;
