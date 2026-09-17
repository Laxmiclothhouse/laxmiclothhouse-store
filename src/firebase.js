import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';

// Firebase configuration - Replace with your own Firebase project credentials
// Get these from: https://console.firebase.google.com → Project Settings → General → Your apps
const firebaseConfig = {
  apiKey: "AIzaSyBq2vkuVE8HjCAwZjaP9WG_OkMZ6L8c-VQ",
  authDomain: "laxmiclothhouse-store.firebaseapp.com",
  projectId: "laxmiclothhouse-store",
  storageBucket: "laxmiclothhouse-store.firebasestorage.app",
  messagingSenderId: "743100785287",
  appId: "1:743100785287:web:a0cf377a9f9c20dda70e22",
  measurementId: "G-4P5Z648LPH"
};

let app = null;
let db = null;
let initialized = false;

export function initFirebase() {
  if (initialized) return { app, db };
  try {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    initialized = true;
  } catch (err) {
    console.warn('Firebase init failed:', err.message);
  }
  return { app, db };
}

export function isFirebaseReady() {
  return initialized && db !== null;
}

// Firestore helpers
export async function firestoreGet(collection, docId) {
  if (!db) return null;
  try {
    const snap = await getDoc(doc(db, collection, docId));
    return snap.exists() ? snap.data() : null;
  } catch (err) {
    console.warn('firestoreGet error:', err.message);
    return null;
  }
}

// Recursively strip Firestore-invalid values (undefined → null, NaN → null).
// Firestore accepts null but throws "Unsupported field value: undefined".
function sanitizeForFirestore(value) {
  if (value === undefined || value === null) return null;
  if (typeof value === 'number' && !Number.isFinite(value)) return null;
  if (Array.isArray(value)) return value.map(sanitizeForFirestore);
  if (typeof value === 'object') {
    const out = {};
    for (const k of Object.keys(value)) {
      out[k] = sanitizeForFirestore(value[k]);
    }
    return out;
  }
  return value;
}

export async function firestoreSet(collection, docId, data) {
  if (!db) return false;
  try {
    await setDoc(doc(db, collection, docId), sanitizeForFirestore(data), { merge: true });
    return true;
  } catch (err) {
    console.warn('firestoreSet error:', err.message);
    return false;
  }
}

export function firestoreListen(collection, docId, callback) {
  if (!db) return () => {};
  try {
    return onSnapshot(doc(db, collection, docId), (snap) => {
      if (snap.exists()) {
        callback(snap.data());
      }
    });
  } catch (err) {
    console.warn('firestoreListen error:', err.message);
    return () => {};
  }
}

export { db, app };
