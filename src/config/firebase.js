import { getApp, getApps, initializeApp } from 'firebase/app';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import { getAuth, getReactNativePersistence, initializeAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

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

// In React Native, calling `getAuth()` without specifying persistence falls back to
// in-memory storage and prints a warning. `initializeAuth` with AsyncStorage fixes that.
export const firebaseAuth = (() => {
  try {
    return initializeAuth(firebaseApp, {
      persistence: getReactNativePersistence(ReactNativeAsyncStorage),
    });
  } catch (error) {
    // If Auth was already initialized (e.g., Fast Refresh), reuse the existing instance.
    return getAuth(firebaseApp);
  }
})();

export const firestoreDb = getFirestore(firebaseApp);
export const firebaseStorage = getStorage(firebaseApp);
