import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, type Auth } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, type Firestore } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator, type Functions } from 'firebase/functions';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? 'demo-api-key',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? 'demo-lms-saas',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
};

const useEmulators = process.env.NEXT_PUBLIC_USE_EMULATORS === 'true';

let emulatorsConnected = false;

export function getFirebaseApp(): FirebaseApp {
  if (getApps().length === 0) {
    return initializeApp(firebaseConfig);
  }
  return getApp();
}

function connectEmulatorsOnce(auth: Auth, db: Firestore, functions: Functions): void {
  if (!useEmulators || emulatorsConnected) {
    return;
  }
  connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, 'localhost', 8080);
  connectFunctionsEmulator(functions, 'localhost', 5001);
  emulatorsConnected = true;
}

export function getFirebaseAuth(): Auth {
  const app = getFirebaseApp();
  const auth = getAuth(app);
  connectEmulatorsOnce(auth, getFirestore(app), getFunctions(app));
  return auth;
}

export function getFirebaseFirestore(): Firestore {
  const app = getFirebaseApp();
  const db = getFirestore(app);
  connectEmulatorsOnce(getAuth(app), db, getFunctions(app));
  return db;
}

export function getFirebaseFunctions(): Functions {
  const app = getFirebaseApp();
  const functions = getFunctions(app);
  connectEmulatorsOnce(getAuth(app), getFirestore(app), functions);
  return functions;
}
