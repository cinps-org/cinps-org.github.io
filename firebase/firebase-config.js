// firebase/firebase-config.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

// Your Firebase configuration
const firebaseConfig = {
 apiKey: "AIzaSyA-gf_fB9JJGv4Zi6AKCFWZBT3cWAWIUhk",
  authDomain: "cinps-student-corner.firebaseapp.com",
  projectId: "cinps-student-corner",
  storageBucket: "cinps-student-corner.firebasestorage.app",
  messagingSenderId: "678888220602",
  appId: "1:678888220602:web:84e3b511d8946e4cf5df83"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

export { app };
