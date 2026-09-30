// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBXiiMjA2vNRuuJ_GwA7VBIgrN7RAtxqKo",
  authDomain: "funebrero.firebaseapp.com",
  databaseURL: "https://funebrero-default-rtdb.firebaseio.com",
  projectId: "funebrero",
  storageBucket: "funebrero.firebasestorage.app",
  messagingSenderId: "6897282754",
  appId: "1:6897282754:web:479a27c2a36e4b94d4d55b",
  measurementId: "G-JTF498WM40"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);