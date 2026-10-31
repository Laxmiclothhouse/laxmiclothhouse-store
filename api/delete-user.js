// api/delete-user.js — Server-side full account deletion.
import admin from 'firebase-admin';

function initAdmin() {
  if (admin.apps.length) return;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT is not configured');
  const cred = JSON.parse(raw);
  admin.initializeApp({ credential: admin.credential.cert(cred) });
}

async function readStoreDoc(db, name) {
  const snap = await db.collection('store').doc(name).get();
  if (!snap.exists) return null;
  const d = snap.data() || {};
  return Array.isArray(d.data) ? d.data : (Array.isArray(d) ? d : []);
}

async function writeStoreDoc(db, name, data) {
  await db.collection('store').doc(name).set({ data, updatedAt: Date.now() }, { merge: true });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    initAdmin();
    const db = admin.firestore();
    const auth = admin.auth();

    const { uid, email: bodyEmail, idToken } = req.body || {};
    if ((!uid && !bodyEmail) || !idToken) {
      return res.status(400).json({ error: 'uid/email and idToken are required' });
    }

    const decoded = await auth.verifyIdToken(idToken);
    const adminDoc = await db.collection('users').doc(decoded.uid).get();
    if (!adminDoc.exists || adminDoc.data()?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const targetUid = String(uid || '').trim();
    if (targetUid && decoded.uid === targetUid) {
      return res.status(400).json({ error: 'You cannot delete your own admin account' });
    }

    let userData = {};
    if (targetUid) {
      const userDoc = await db.collection('users').doc(targetUid).get();
      userData = userDoc.exists ? (userDoc.data() || {}) : {};
    }
    const email = String(userData.email || bodyEmail || '').toLowerCase();

    const orders = (await readStoreDoc(db, 'orders')) || [];
    const deletedOrderIds = new Set();
    const remainingOrders = orders.filter((o) => {
      const ouid = String(o.userId || o.customer?.uid || '').trim();
      const oemail = String(o.customerEmail || o.customer?.email || '').toLowerCase();
      const match = (targetUid && ouid === targetUid) || (email && oemail === email);
      if (match) deletedOrderIds.add(String(o.id));
      return !match;
    });

    const payments = (await readStoreDoc(db, 'payments')) || [];
    const remainingPayments = payments.filter((p) => {
      const oid = String(p.orderId || p.order_id || '');
      return !deletedOrderIds.has(oid);
    });

    const reviews = (await readStoreDoc(db, 'reviews')) || [];
    const remainingReviews = reviews.filter((r) => {
      const ruid = String(r.userId || '').trim();
      const remail = String(r.userEmail || '').toLowerCase();
      return !(targetUid && ruid === targetUid) && !(email && remail === email);
    });

    await writeStoreDoc(db, 'orders', remainingOrders);
    await writeStoreDoc(db, 'payments', remainingPayments);
    await writeStoreDoc(db, 'reviews', remainingReviews);

    if (targetUid) {
      const userDoc = await db.collection('users').doc(targetUid).get();
      if (userDoc.exists) await db.collection('users').doc(targetUid).delete();
      try {
        await auth.deleteUser(targetUid);
      } catch (e) {
        if (e?.code !== 'auth/user-not-found') throw e;
      }
    }

    return res.json({ ok: true, deletedOrders: deletedOrderIds.size, deletedReviews: reviews.length - remainingReviews.length });
  } catch (err) {
    console.error('delete-user error:', err);
    return res.status(500).json({ error: err.message || 'Failed to delete user' });
  }
}
