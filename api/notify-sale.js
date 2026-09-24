// Send a sale promotion by email to registered customer accounts.
// The caller must be a signed-in Firebase user whose users/{uid} profile is admin.
import { getUserDoc, listUserDocs, getStoreDoc } from '../shared/firestoreRest.mjs';
import { sendSaleMail } from '../shared/mail.mjs';

const FIREBASE_API_KEY = process.env.FIREBASE_WEB_API_KEY || 'AIzaSyBq2vkuVE8HjCAwZjaP9WG_OkMZ6L8c-VQ';
const IDENTITY_URL = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`;
const MAX_SALE_NAME = 120;
const SALE_TYPES = new Set(['product', 'category', 'storewide', 'flash']);

function bearerToken(req) {
  const header = String(req.headers?.authorization || req.headers?.Authorization || '');
  return header.replace(/^Bearer\s+/i, '').trim();
}

async function verifyAdmin(idToken) {
  if (!idToken) return { ok: false, status: 401, error: 'Authentication required.' };
  const response = await fetch(IDENTITY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });
  const data = await response.json().catch(() => ({}));
  const identity = data.users && data.users[0];
  if (!response.ok || !identity?.localId) {
    return { ok: false, status: 401, error: 'Invalid or expired login.' };
  }
  const profile = await getUserDoc(identity.localId, idToken);
  if (!profile.ok || profile.data?.role !== 'admin') {
    return { ok: false, status: 403, error: 'Only the store admin can notify customers.' };
  }
  return { ok: true, uid: identity.localId };
}

function cleanSale(raw) {
  const s = raw && typeof raw === 'object' ? raw : {};
  const type = SALE_TYPES.has(String(s.type)) ? String(s.type) : 'storewide';
  const discountType = s.discountType === 'flat' ? 'flat' : 'percent';
  const value = Math.max(0, Number(s.value) || 0);
  return {
    id: String(s.id || '').slice(0, 80),
    name: String(s.name || 'Special sale').trim().slice(0, MAX_SALE_NAME) || 'Special sale',
    type,
    discountType,
    value: discountType === 'percent' ? Math.min(100, value) : value,
    category: String(s.category || '').trim().slice(0, 80),
    productId: String(s.productId || '').trim().slice(0, 100),
    startsAt: s.startsAt || null,
    endsAt: s.endsAt || null,
    active: s.active !== false,
  };
}

function customerContact(user) {
  return {
    uid: String(user.uid || ''),
    name: String(user.name || '').trim(),
    email: String(user.email || '').trim().toLowerCase(),
    phone: String(user.phone || '').trim(),
    role: String(user.role || 'customer'),
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const admin = await verifyAdmin(bearerToken(req));
    if (!admin.ok) return res.status(admin.status).json({ error: admin.error });

    const requestedSale = cleanSale(req.body?.sale);
    if (!requestedSale.id) return res.status(400).json({ error: 'Saved sale id is required.' });

    const salesResult = await getStoreDoc('sales', bearerToken(req));
    const savedSale = salesResult.ok
      ? (Array.isArray(salesResult.data?.data) ? salesResult.data.data : []).find((item) => item?.id === requestedSale.id)
      : null;
    const sale = cleanSale(savedSale || requestedSale);

    const customerEmails = new Map();
    const usersResult = await listUserDocs(bearerToken(req));
    if (usersResult.ok) {
      for (const entry of usersResult.data || []) {
        const c = customerContact(entry);
        if ((!c.role || c.role === 'customer') && c.email && !customerEmails.has(c.email)) {
          customerEmails.set(c.email, c.name || '');
        }
      }
    }

    // The store also keeps a compact customers cache in store/users, so merge
    // those contacts too. That cache is exactly what the admin profile list
    // writes to, while users/{uid} docs stay admin-restricted.
    const storeUsersResult = await getStoreDoc('users', bearerToken(req));
    if (storeUsersResult.ok) {
      const cached = Array.isArray(storeUsersResult.data?.data) ? storeUsersResult.data.data : [];
      for (const entry of cached) {
        const c = customerContact(entry);
        if ((!c.role || c.role === 'customer') && c.email && !customerEmails.has(c.email)) {
          customerEmails.set(c.email, c.name || '');
        }
      }
    }

    // Order rows also carry the email typed at checkout, so include past
    // buyers even if their profile lookup is stale or missing.
    const ordersResult = await getStoreDoc('orders', bearerToken(req));
    if (ordersResult.ok) {
      const rows = Array.isArray(ordersResult.data?.data) ? ordersResult.data.data : [];
      for (const row of rows) {
        const email = String(row?.customerEmail || row?.customer?.email || '').trim().toLowerCase();
        const name = String(row?.customer?.name || '').trim();
        if (email && !customerEmails.has(email)) customerEmails.set(email, name);
      }
    }

    if (customerEmails.size === 0 && !usersResult.ok) {
      return res.status(503).json({ error: `Could not load customer accounts: ${usersResult.error}` });
    }

    const customers = [...customerEmails.entries()].map(([email, name]) => ({ email, name }));
    const results = [];

    // Keep provider calls bounded so a large account list cannot create an
    // unbounded burst of requests in a serverless function.
    const concurrency = 4;
    let next = 0;
    const worker = async () => {
      while (next < customers.length) {
        const customer = customers[next++];
        const mail = await sendSaleMail({ to: customer.email, sale, customerName: customer.name || 'there' });
        results.push({
          email: customer.email,
          name: customer.name,
          emailSent: mail.sent === true,
          emailSkipped: mail.skipped === true,
          emailError: mail.error || null,
        });
      }
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, customers.length) }, worker));

    return res.json({
      ok: true,
      sale: { id: sale.id, name: sale.name },
      recipients: customers.length,
      emailSent: results.filter((r) => r.emailSent).length,
      emailSkipped: results.filter((r) => r.emailSkipped).length,
      emailFailed: results.filter((r) => !r.emailSent && !r.emailSkipped).length,
      results,
    });
  } catch (err) {
    console.error('notify-sale error:', err);
    return res.status(500).json({ error: err.message || 'Failed to notify customers.' });
  }
}
