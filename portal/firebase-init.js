// Firebase Modular SDK (v10+)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// 🔐 Firebase configuration (PASTE YOUR REAL VALUES)
const firebaseConfig = {
 apiKey: "AIzaSyA-gf_fB9JJGv4Zi6AKCFWZBT3cWAWIUhk",
  authDomain: "cinps-student-corner.firebaseapp.com",
  projectId: "cinps-student-corner",
  storageBucket: "cinps-student-corner.firebasestorage.app",
  messagingSenderId: "678888220602",
  appId: "1:678888220602:web:567b074c3e148221f5df83"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Services
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();
export const db = getFirestore(app);
