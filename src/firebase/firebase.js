import { initializeApp } from 'firebase/app';
import {
  getFirestore, doc, setDoc, getDoc, deleteDoc,
  collection, writeBatch, getDocs, onSnapshot,
} from 'firebase/firestore';
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signOut,
  createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged,
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyAOHECF4A8UIgS8M4GFy_Bnt2sk1xFhKpo',
  authDomain: 'protlife.vercel.app',
  projectId: 'protlife-3dd56',
  storageBucket: 'protlife-3dd56.firebasestorage.app',
  messagingSenderId: '811944642664',
  appId: '1:811944642664:web:92f1b8cc244ac6cc2413dd',
};

let app, db, auth, googleProvider;

try {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  auth = getAuth(app);
  googleProvider = new GoogleAuthProvider();
  googleProvider.setCustomParameters({ prompt: 'select_account' });
} catch (e) {
  console.warn('Firebase init failed (app works in offline/localStorage mode):', e.message);
}

// ─── Auth helpers ───

export function onAuthChange(callback) {
  if (!auth) return () => {};
  return onAuthStateChanged(auth, callback);
}

// Detect iOS PWA / standalone mode (home screen app)
const isStandalone = () => {
  return window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true;
};

export async function signInWithGoogle() {
  if (!auth || !googleProvider) throw new Error('Firebase not initialized');
  // iOS Safari PWA blocks popups — use redirect instead
  if (isStandalone()) {
    await signInWithRedirect(auth, googleProvider);
    return null; // redirecting, won't return here
  }
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function getGoogleRedirectResult() {
  if (!auth) return null;
  try {
    const result = await getRedirectResult(auth);
    return result?.user || null;
  } catch (e) {
    console.warn('getRedirectResult error:', e.code, e.message);
    return null;
  }
}

export async function signInWithEmail(email, password) {
  if (!auth) throw new Error('Firebase not initialized');
  const result = await signInWithEmailAndPassword(auth, email, password);
  return result.user;
}

export async function signUpWithEmail(email, password) {
  if (!auth) throw new Error('Firebase not initialized');
  const result = await createUserWithEmailAndPassword(auth, email, password);
  return result.user;
}

export async function signOutUser() {
  if (!auth) return;
  await signOut(auth);
}

// ─── Firestore sync helpers ───

const COLLECTIONS = ['people', 'events', 'memories', 'places', 'groups'];

export async function syncToFirestore(userId, data) {
  if (!db) throw new Error('Firebase not initialized');
  const batch = writeBatch(db);
  for (const coll of COLLECTIONS) {
    const collData = data[coll] || [];
    // Read existing docs to find what needs deleting
    const existingSnapshot = await getDocs(collection(db, `users/${userId}/${coll}`));
    const existingIds = new Set(existingSnapshot.docs.map(d => d.id));
    const incomingIds = new Set(collData.map(d => d.id));
    // Delete docs removed from local state
    for (const id of existingIds) {
      if (!incomingIds.has(id)) {
        batch.delete(doc(db, `users/${userId}/${coll}`, id));
      }
    }
    // Write current docs
    for (const docData of collData) {
      const ref = doc(db, `users/${userId}/${coll}`, docData.id);
      batch.set(ref, docData);
    }
  }
  await batch.commit();
}

export async function loadFromFirestore(userId) {
  if (!db) throw new Error('Firebase not initialized');
  const result = {};
  for (const coll of COLLECTIONS) {
    const snapshot = await getDocs(collection(db, `users/${userId}/${coll}`));
    result[coll] = snapshot.docs.map(d => ({ ...d.data(), id: d.id }));
  }
  return result;
}

export function subscribeToFirestore(userId, callback) {
  if (!db) return () => {};
  const unsubscribes = [];
  for (const coll of COLLECTIONS) {
    const unsub = onSnapshot(collection(db, `users/${userId}/${coll}`), (snapshot) => {
      const data = snapshot.docs.map(d => ({ ...d.data(), id: d.id }));
      callback(coll, data);
    }, (err) => {
      console.warn('Firestore onSnapshot error:', coll, err.message);
    });
    unsubscribes.push(unsub);
  }
  return () => unsubscribes.forEach(u => u());
}

export async function syncTagsToFirestore(userId, tags) {
  if (!db) return;
  const ref = doc(db, `users/${userId}/settings/tags`);
  await setDoc(ref, { tags });
}

export async function loadTagsFromFirestore(userId) {
  if (!db) return null;
  const ref = doc(db, `users/${userId}/settings/tags`);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data().tags : null;
}

export { db, auth, googleProvider };
export default app;
