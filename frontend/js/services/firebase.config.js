import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "TU_API_KEY_FUNEBRERO",
  authDomain: "funebrero.firebaseapp.com",
  projectId: "funebrero",
  storageBucket: "funebrero.appspot.com",
  messagingSenderId: "TU_SENDER_ID",
  appId: "TU_APP_ID"
};

export const app = initializeApp(firebaseConfig);
// Aquí le indicamos explícitamente el nombre de tu base de datos
export const db = getFirestore(app, "funebrero");
export const auth = getAuth(app);
export const storage = getStorage(app);