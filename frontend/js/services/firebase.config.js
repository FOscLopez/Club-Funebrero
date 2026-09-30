import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyBXiiMjA2vNRuuJ_GwA7VBIgrN7RAtxqKo",
  authDomain: "funebrero.firebaseapp.com",
  projectId: "funebrero",
  storageBucket: "funebrero.firebasestorage.app",
  messagingSenderId: "6897282754",
  appId: "1:6897282754:web:479a27c2a36e4b94d4d55b"
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, "funebrero");
export const auth = getAuth(app);
export const storage = getStorage(app);