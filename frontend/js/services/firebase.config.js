import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

// ⚠️ DEBES PEGAR TUS CLAVES REALES AQUÍ. SI DEJAS "TU_API_KEY...", EL LOGIN FALLARÁ.
const firebaseConfig = {
  apiKey: "PEGA_TU_API_KEY_REAL_AQUI",
  authDomain: "funebrero.firebaseapp.com",
  projectId: "funebrero",
  storageBucket: "funebrero.appspot.com",
  messagingSenderId: "PEGA_TU_SENDER_ID_REAL_AQUI",
  appId: "PEGA_TU_APP_ID_REAL_AQUI"
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, "funebrero");
export const auth = getAuth(app);
export const storage = getStorage(app);