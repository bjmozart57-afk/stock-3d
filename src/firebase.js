import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyCnDLCoIuRtXSpmKHThsI9DFqUPe7_f36w",
  authDomain: "stock-filament.firebaseapp.com",
  projectId: "stock-filament",
  storageBucket: "stock-filament.firebasestorage.app",
  messagingSenderId: "848153479971",
  appId: "1:848153479971:web:392658e739d5695eed5a96",
  databaseURL: "https://stock-filament-default-rtdb.europe-west1.firebasedatabase.app"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

export { database };
export default app;