// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDdEQ5UsRCS3HiDN-MqzDxwLeWb6cQD8Ak",
  authDomain: "myproject-a3088.firebaseapp.com",
  databaseURL: "https://myproject-a3088-default-rtdb.firebaseio.com",
  projectId: "myproject-a3088",
  storageBucket: "myproject-a3088.firebasestorage.app",
  messagingSenderId: "575417075577",
  appId: "1:575417075577:web:07233968ce3ae33a1151a8",
  measurementId: "G-VJYJJ6DPFX"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);