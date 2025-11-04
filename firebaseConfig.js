import Constants from 'expo-constants';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = Constants?.expoConfig?.extra?.firebase;
export const isFirebaseConfigured = Boolean(firebaseConfig?.apiKey);

if (!isFirebaseConfigured) {
  console.warn(
    'Firebase config is missing. Add your credentials to app.json -> expo.extra.firebase.',
  );
}

const app = getApps().length ? getApp() : initializeApp(firebaseConfig || {});

export const db = getFirestore(app);
