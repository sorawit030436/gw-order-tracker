import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBu45nvGj9-K3dffGlC4UKf4oNKcI_6tXU",
  authDomain: "gw-order-tracker.firebaseapp.com",
  projectId: "gw-order-tracker",
  storageBucket: "gw-order-tracker.firebasestorage.app",
  messagingSenderId: "57013202107",
  appId: "1:57013202107:web:bf219b72fec244dc90cd9e"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
