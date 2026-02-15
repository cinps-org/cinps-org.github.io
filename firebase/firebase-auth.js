// firebase/firebase-auth.js

import { getAuth, GoogleAuthProvider } 
from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import { app } from "./firebase-config.js";

const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

export { auth, googleProvider };
