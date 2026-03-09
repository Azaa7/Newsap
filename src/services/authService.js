import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  signInWithCredential,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { firebaseAuth, firestoreDb } from '../config/firebase';
import { validateAuthForm } from '../utils/validators';

// Google Sign-In — native module тул lazy import (build хийхгүйгээр crash хийхгүй)
let GoogleSignin = null;
try {
  GoogleSignin = require('@react-native-google-signin/google-signin').GoogleSignin;
  GoogleSignin.configure({
    webClientId: '105698041768-hu2vu2h0omcrdhcopjhvs1u5h8qdrul2.apps.googleusercontent.com',
  });
} catch {
  console.warn('[AUTH] Google Sign-In native module not available — need new build');
}

const ADMIN_EMAILS = ['b.bazarragchaa0810@gmail.com'];

const isAdminEmail = (email = '') =>
  ADMIN_EMAILS.includes(String(email).trim().toLowerCase());

const toSession = (authUser, profile = {}) => ({
  token: authUser?.uid || '',
  user: {
    id: authUser.uid,
    email: authUser.email,
    name: profile.name || authUser.displayName || 'User',
    interests: profile.interests || [],
    language: profile.language || 'mn',
    role: profile.isAdmin ? 'admin' : 'user',
  },
});

const getUserProfile = async (uid) => {
  const snapshot = await getDoc(doc(firestoreDb, 'users', uid));
  return snapshot.exists() ? snapshot.data() : null;
};

const syncUserProfile = async (authUser, profile = {}) => {
  const email = authUser.email || profile.email || '';
  const nextProfile = {
    name: profile.name || authUser.displayName || 'User',
    email,
    interests: profile.interests || [],
    language: profile.language || 'mn',
    isAdmin: isAdminEmail(email),
    updatedAt: serverTimestamp(),
  };

  if (!profile.createdAt) {
    nextProfile.createdAt = serverTimestamp();
  }

  await setDoc(doc(firestoreDb, 'users', authUser.uid), nextProfile, { merge: true });
  return nextProfile;
};

export const authService = {
  async restoreSession() {
    const authUser = firebaseAuth.currentUser;
    if (!authUser) {
      return null;
    }

    const profile = await getUserProfile(authUser.uid);
    const syncedProfile = await syncUserProfile(authUser, profile || {});
    return toSession(authUser, syncedProfile);
  },

  async signIn(email, password) {
    const validationError = validateAuthForm({ email, password, mode: 'signin' });
    if (validationError) {
      throw new Error(validationError);
    }

    const credential = await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
    const profile = await getUserProfile(credential.user.uid);
    const syncedProfile = await syncUserProfile(credential.user, profile || {});

    return toSession(credential.user, syncedProfile);
  },

  async signUp({ name, email, password }) {
    const validationError = validateAuthForm({ email, password, mode: 'signup' });
    if (validationError) {
      throw new Error(validationError);
    }

    if (!name?.trim()) {
      throw new Error('Name is required.');
    }

    const credential = await createUserWithEmailAndPassword(firebaseAuth, email.trim(), password);
    const profile = {
      name: name.trim(),
      email: email.trim(),
      interests: [],
      language: 'mn',
      isAdmin: isAdminEmail(email),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    await setDoc(doc(firestoreDb, 'users', credential.user.uid), profile, { merge: true });

    return toSession(credential.user, profile);
  },

  async signOut() {
    try {
      await GoogleSignin.signOut();
    } catch {}
    await firebaseSignOut(firebaseAuth);
  },

  async signInWithGoogle() {
    if (!GoogleSignin) {
      throw new Error('Google Sign-In ашиглахын тулд шинэ build хийх шаардлагатай. (eas build --platform android --profile development)');
    }

    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const signInResult = await GoogleSignin.signIn();
      const idToken = signInResult?.data?.idToken;

      if (!idToken) {
        throw new Error('Google Sign-In: idToken олдсонгүй');
      }

      // Firebase credential үүсгэх
      const googleCredential = GoogleAuthProvider.credential(idToken);
      const userCredential = await signInWithCredential(firebaseAuth, googleCredential);
      const authUser = userCredential.user;

      // Firestore profile синклэх
      const existingProfile = await getUserProfile(authUser.uid);
      const profile = await syncUserProfile(authUser, existingProfile || {
        name: authUser.displayName || 'Google User',
        email: authUser.email || '',
      });

      return toSession(authUser, profile);
    } catch (err) {
      console.error('[AUTH] Google Sign-In error:', err);
      throw new Error(err?.message || 'Google нэвтрэх амжилтгүй боллоо.');
    }
  },
};
