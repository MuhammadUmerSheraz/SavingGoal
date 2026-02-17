/**
 * Firebase configuration template
 * 1. Copy this file to firebase-config.js
 * 2. Go to https://console.firebase.google.com/
 * 3. Create a project (or use existing) and add a Web app
 * 4. Copy your config values below
 * 5. Enable Authentication → Sign-in method → Email/Password
 * 6. Create Firestore Database and set rules (see firestore.rules)
 */
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
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
