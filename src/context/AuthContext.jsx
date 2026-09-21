import React, { createContext, useContext, useState, useEffect } from 'react';
import { db } from '../db.js';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, EmailAuthProvider, reauthenticateWithCredential, updatePassword, sendPasswordResetEmail } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, updateDoc, collection, getDocs, query, limit } from 'firebase/firestore';
import { app } from '../firebase.js';
import { STAFF_ROLES, ROLE_LABELS, isStaffRole } from '../orderFlow.js';

const AuthContext = createContext(null);
const auth = getAuth(app);
const firestore = getFirestore(app);

// ── Firestore `users` directory cache (module scope so it survives re-renders) ──
// Doc id = Firebase UID. Refreshed at most once per minute.
let _usersDirCache = null;
let _usersDirAt = 0;
const USERS_DIR_TTL = 60 * 1000;

export function AuthProvider({ children }) {
  // Start from the cached session so a refresh paints instantly, then let
  // Firebase confirm it in the effect below (the listener always wins).
  const [user, setUser] = useState(() => {
    const cached = db.getSession();
    return cached && cached.id ? cached : null;
  });
  const [loading, setLoading] = useState(true);

  // Listen to Firebase Auth state changes
  useEffect(() => {
    let alive = true;
    // Safety net: if Firebase never answers (offline, blocked, misconfigured)
    // the app must not sit on the "checking session" screen forever.
    const failsafe = setTimeout(() => {
      if (alive) setLoading(false);
    }, 10000);

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // The profile lives in Firestore. That read may fail (offline, rules,
        // a transient error) and must never leave the app stuck on the
        // "checking session" screen — fall back to the cached session.
        const cachedSession = db.getSession();
        const cachedRole =
          cachedSession && cachedSession.id === firebaseUser.uid ? cachedSession.role : '';
        let userData = {};
        try {
          const userDoc = await getDoc(doc(firestore, 'users', firebaseUser.uid));
          userData = userDoc.data() || {};
        } catch (error) {
          console.warn('[auth] user profile unavailable — using the cached session:', error?.message || error);
        }
        if (!alive) return;
        
                const session = {
          id: firebaseUser.uid,
          name: firebaseUser.displayName || userData.name || cachedSession?.name || '',
          email: firebaseUser.email,
          phone: userData.phone || cachedSession?.phone || '',
          address: userData.address || cachedSession?.address || '',
          role: userData.role || cachedRole || 'customer',
          specialDate: userData.specialDate || cachedSession?.specialDate || '',
          specialDateType: userData.specialDateType || cachedSession?.specialDateType || 'Birthday',
        };
        setUser(session);
        db.saveSession(session);
      } else {
        if (!alive) return;
        setUser(null);
        db.clearSession();
      }
      if (!alive) return;
      setLoading(false);
    });

    return () => {
      alive = false;
      clearTimeout(failsafe);
      unsubscribe();
    };
  }, []);

  const signup = async ({ name, email, password, phone, specialDate, specialDateType }) => {
    try {
      // Create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;

      // Save additional user data to Firestore
      const userData = {
        name: name || '',
        email: email.toLowerCase(),
        phone: phone || '',
        role: 'customer',
        specialDate: specialDate || '',
        specialDateType: specialDateType || 'Birthday',
        createdAt: new Date().toISOString(),
      };
      await setDoc(doc(firestore, 'users', firebaseUser.uid), userData);

            const session = {
        id: firebaseUser.uid,
        name: name || '',
        email: email.toLowerCase(),
        phone: phone || '',
        address: '',
        role: 'customer',
        specialDate: specialDate || '',
        specialDateType: specialDateType || 'Birthday',
      };
      db.saveSession(session);
      setUser(session);
      return session;
    } catch (error) {
      if (error.code === 'auth/email-already-in-use') {
        throw new Error('An account with this email already exists. Please log in.');
      } else if (error.code === 'auth/weak-password') {
        throw new Error('Password should be at least 6 characters.');
      } else if (error.code === 'auth/invalid-email') {
        throw new Error('Please enter a valid email address.');
      }
      throw new Error(error.message);
    }
  };

  const login = async ({ email, password }) => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;

      // Get user data from Firestore
      const userDoc = await getDoc(doc(firestore, 'users', firebaseUser.uid));
      const userData = userDoc.data() || {};

            const session = {
        id: firebaseUser.uid,
        name: firebaseUser.displayName || userData.name || '',
        email: firebaseUser.email,
        phone: userData.phone || '',
        address: userData.address || '',
        role: userData.role || 'customer',
        specialDate: userData.specialDate || '',
        specialDateType: userData.specialDateType || 'Birthday',
      };
      db.saveSession(session);
      setUser(session);
      return session;
    } catch (error) {
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        throw new Error('Invalid email or password.');
      } else if (error.code === 'auth/too-many-requests') {
        throw new Error('Too many failed attempts. Please try again later.');
      }
      throw new Error(error.message);
    }
  };

    const logout = async () => {
    try {
      await signOut(auth);
      db.clearSession();
      setUser(null);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // ── Password change helpers ──────────────────────────────

  // 1) Change password by verifying the current password first.
  const changePasswordWithCurrent = async (currentPassword, newPassword) => {
    try {
      const firebaseUser = auth.currentUser;
      if (!firebaseUser || !firebaseUser.email) throw new Error('No authenticated user.');

      const credential = EmailAuthProvider.credential(
        firebaseUser.email,
        currentPassword
      );
      await reauthenticateWithCredential(firebaseUser, credential);
      await updatePassword(firebaseUser, newPassword);
      return { success: true };
    } catch (error) {
      if (
        error.code === 'auth/wrong-password' ||
        error.code === 'auth/invalid-credential' ||
        error.code === 'auth/invalid-verification-code'
      ) {
        throw new Error('Current password is incorrect.');
      }
      throw new Error(error.message || 'Failed to change password.');
    }
  };

  // ── Profile update helper ──────────────────────────────
  const updateUserProfile = async (data) => {
    try {
      const firebaseUser = auth.currentUser;
      if (!firebaseUser) throw new Error('No authenticated user.');

      // Identity fields (login email, UID/role) can never be changed from the
      // profile page. Phone is also identity-bound: it is set at signup /
      // OTP login and can never be edited afterwards, so strip it too — even
      // a crafted call cannot overwrite the account phone number.
      const { email, id, role, phone, ...safeData } = data || {};
      await setDoc(doc(firestore, 'users', firebaseUser.uid), safeData, { merge: true });

      const updated = { ...user, ...safeData };
      setUser(updated);
      db.saveSession(updated);
      return updated;
    } catch (error) {
      throw new Error(error.message || 'Failed to update profile.');
    }
  };

  // ── Password reset ───────────────────────────────────────
  const sendPasswordReset = async (email) => {
    try {
      const { sendPasswordResetEmail } = await import('firebase/auth');
      await sendPasswordResetEmail(auth, email);
      return { ok: true };
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        throw new Error('No account found with this email.');
      }
      throw new Error(error.message || 'Failed to send reset email.');
    }
  };

  const isAdmin = user?.role === 'admin';
  const isStaff = isStaffRole(user?.role);

  // Admin-only: promote a Firebase user to a staff role by their UID.
  // (UID visible in Firebase console → Authentication → Users.)
  // ── Find a user's UID from Firestore by name / email / phone ──
  // Client-side lookup over the `users` collection (doc id = UID).
  // We keep a small in-memory cache so repeated admin searches don't
  // re-download the directory every keystroke. The collection is read
  // in small pages (never the whole DB) and matched locally so a
  // partial name / email / phone finds the account.
  // Returns: [{ uid, name, email, phone, role }]
  const readUsersDirectory = async () => {
    const now = Date.now();
    if (_usersDirCache && now - _usersDirAt < USERS_DIR_TTL) return _usersDirCache;
    try {
      const q = query(collection(firestore, 'users'), limit(500));
      const snap = await getDocs(q);
      const list = [];
      snap.forEach((d) => {
        const v = d.data() || {};
        list.push({
          uid: d.id,
          name: v.name || '',
          email: v.email || '',
          phone: v.phone || '',
          role: v.role || 'customer',
        });
      });
      _usersDirCache = list;
      _usersDirAt = now;
      return list;
    } catch (error) {
      // Firestore rules often block list for non-admins — surface a clear error
      // so the Admin UI can explain it (and fall back to orders below).
      throw new Error(error.message || 'Failed to read users directory.');
    }
  };

  // Search users by name / email / phone and return matching UIDs.
  // Used in Admin → Staff so the admin never has to open the Firebase
  // console: type a name, email or phone → pick the account → UID fills in.
  const searchUsers = async (text) => {
    const raw = String(text || '').trim();
    if (raw.length < 2) return [];
    const q = raw.toLowerCase();
    const digits = raw.replace(/\D/g, '');
    // 1) try the Firestore `users` directory first (real UID source)
    try {
      const dir = await readUsersDirectory();
      const hits = dir.filter((u) => {
        const name = String(u.name || '').toLowerCase();
        const email = String(u.email || '').toLowerCase();
        const phone = String(u.phone || '').replace(/\D/g, '');
        return (
          (name && name.includes(q)) ||
          (email && email.includes(q)) ||
          (u.uid && u.uid.toLowerCase() === q) ||
          (digits && phone && phone.includes(digits))
        );
      });
      if (hits.length) return hits.slice(0, 20);
    } catch {
      // fall through to the orders fallback below
    }
    // 2) fallback: match against recent orders (works even when `users`
    //    list is locked by security rules). Order rows carry userId (= UID)
    //    plus the name/email/phone typed at checkout.
    try {
      const orders = db.getOrders() || [];
      const seen = new Map();
      for (const o of orders) {
        const name = String(o.customer?.name || '');
        const email = String(o.customerEmail || o.customer?.email || '');
        const phone = String(o.phone || o.customer?.phone || '');
        const uid = o.userId || null;
        if (!uid) continue;
        const ok =
          (name && name.toLowerCase().includes(q)) ||
          (email && email.toLowerCase().includes(q)) ||
          (digits && phone.replace(/\D/g, '').includes(digits)) ||
          (uid && String(uid).toLowerCase() === q);
        if (ok && !seen.has(uid)) {
          seen.set(uid, { uid, name, email, phone, role: '', fromOrders: true });
        }
        if (seen.size >= 20) break;
      }
      return [...seen.values()];
    } catch {
      return [];
    }
  };

  // Fetch one user's profile doc by UID (for the Staff UID preview card).
  const fetchUserByUid = async (uid) => {
    const id = String(uid || '').trim();
    if (!id) throw new Error('Enter a UID.');
    try {
      const snap = await getDoc(doc(firestore, 'users', id));
      if (!snap.exists()) throw new Error('No profile found for this UID yet (they must log in on the site once).');
      return { uid: id, ...(snap.data() || {}) };
    } catch (error) {
      throw new Error(error.message || 'Failed to read that user.');
    }
  };
  const setUserRole = async (uid, role) => {
    try {
      const firebaseUser = auth.currentUser;
      if (!firebaseUser) throw new Error('No authenticated user.');
      if (!isAdmin) throw new Error('Only the admin can manage staff roles.');
      if (!STAFF_ROLES.includes(role) && role !== 'customer') {
        throw new Error('Unknown role.');
      }
      // setDoc+merge (not updateDoc) so promoting a user created directly in
      // the Firebase console — who has no users/{uid} doc yet — also works.
      await setDoc(doc(firestore, 'users', String(uid).trim()), { role }, { merge: true });
      return { ok: true };
    } catch (error) {
      if (error?.code === 'permission-denied' || /missing or insufficient permissions/i.test(error?.message || '')) {
        throw new Error(
          'Missing or insufficient permissions: your Firestore rules block this write. ' +
          'In Firebase console → Firestore → Rules, allow an admin to update the "role" field on users/{uid} ' +
          '(e.g. get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == "admin"), ' +
          'then Publish. Also confirm you are logged in as the admin account (the one whose users/{uid} doc has role "admin").'
        );
      }
      throw new Error(error.message || 'Failed to update role.');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAdmin,
        isStaff,
        setUserRole,
        searchUsers,
        fetchUserByUid,
        STAFF_ROLES,
        ROLE_LABELS,
        signup,
        login,
        sendPasswordReset,
        logout,
        loading,
        changePasswordWithCurrent,
        updateUserProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}