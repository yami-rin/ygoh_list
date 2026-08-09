import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
    applyActionCode,
    browserLocalPersistence,
    createUserWithEmailAndPassword,
    deleteUser,
    getAuth,
    onAuthStateChanged,
    sendEmailVerification,
    setPersistence,
    signInWithEmailAndPassword,
    signOut,
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyAOYKalLUb2hbghrjQUS8AWzxpLExBT7aU",
    authDomain: "ygoh-9bcf6.firebaseapp.com",
    projectId: "ygoh-9bcf6",
    storageBucket: "ygoh-9bcf6.firebasestorage.app",
    messagingSenderId: "515041224138",
    appId: "1:515041224138:web:8de47b38ed9cc1bb8afd37",
    measurementId: "G-ZGSRE8MHZ2",
};

let auth;

export function initializeCardListAuth() {
    if (auth) return auth;
    const app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    setPersistence(auth, browserLocalPersistence).catch(() => {});
    return auth;
}

export {
    applyActionCode,
    createUserWithEmailAndPassword,
    deleteUser,
    onAuthStateChanged,
    sendEmailVerification,
    signInWithEmailAndPassword,
    signOut,
};
