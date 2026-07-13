import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  projectId: "gen-lang-client-0648365532",
  appId: "1:743761611534:web:b637c9e6097af6b057255f",
  apiKey: "AIzaSyAFzPHCF7gFQ3Sdh95e0klcxc2RzYK8JI0",
  authDomain: "gen-lang-client-0648365532.firebaseapp.com",
  storageBucket: "gen-lang-client-0648365532.firebasestorage.app",
  messagingSenderId: "743761611534"
};

// Inisialisasi Firebase App
const app = initializeApp(firebaseConfig);

// Inisialisasi Firestore dengan Database ID kustom yang dialokasikan oleh AI Studio
const db = getFirestore(app, "ai-studio-41e3c325-1ef7-4c09-899c-24b354095751");

// Inisialisasi Firebase Auth
const auth = getAuth(app);

export { app, db, auth };
