import React, { createContext, useContext, useState, useEffect } from 'react';
import { db } from '../db.js';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, EmailAuthProvider, reauthenticateWithCredential, updatePassword, sendPasswordResetEmail } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { app } from '../firebase.js';
import { STAFF_ROLES, ROLE_LABELS, isStaffRole } from '../orderFlow.js';

const AuthContext = createContext(null);
const auth = getAuth(app);
const firestore = getFirestore(app);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Listen to Firebase Auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Get additional user data from Firestore
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
        setUser(session);
        db.saveSession(session);
      } else {
        setUser(null);
        db.clearSession();
      }
      setLoading(false);
    });

    return () => unsubscribe();
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

      // Email (and identity/role) can never be changed from the profile page.
      // Strip them so even a crafted call cannot overwrite the login email.
      const { email, id, role, ...safeData } = data || {};
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