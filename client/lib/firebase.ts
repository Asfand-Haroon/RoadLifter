import { getApp, getApps, initializeApp } from '@firebase/app';
import { getAuth, GoogleAuthProvider } from '@firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const getFirebaseAuth = () => {
  if (Object.values(firebaseConfig).some((value) => !value)) {
    throw new Error('Google sign-in is not configured. Set the Firebase client environment variables.');
  }

  const app = getApps().some((item) => item.name === 'roadlifter')
    ? getApp('roadlifter')
    : initializeApp(firebaseConfig, 'roadlifter');
  return getAuth(app);
};

export const googleProvider = new GoogleAuthProvider();
