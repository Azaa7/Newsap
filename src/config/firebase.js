import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyC3F8uHbXvUHrTFrG4eY0P9emoQPp73_ag',
  authDomain: 'newsap-c16ac.firebaseapp.com',
  projectId: 'newsap-c16ac',
  storageBucket: 'newsap-c16ac.firebasestorage.app',
  messagingSenderId: '105698041768',
  appId: '1:105698041768:web:33fb7c155662494935479d',
  measurementId: 'G-XXGF9RGJGW',
};

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const firebaseAuth = getAuth(firebaseApp);
export const firestoreDb = getFirestore(firebaseApp);
