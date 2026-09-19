// ─────────────────────────────────────────────────────────────
// api/pincode/index.js
//
// GET  /api/pincode                     → health ping
// GET  /api/pincode?pin=124507          → city / district / state + areas
// GET  /api/pincode?q=Rohtak            → pincodes matching an area name
// POST /api/pincode  { pin } | { q }    → same as GET
//
// Backed by shared/pincode.mjs (Department of Posts data via
// api.postalpincode.in — free, no API key). READ-ONLY and safe to
// call from checkout: it never touches the store's own data and
// never rates or books anything. Failure to reach the upstream
// service returns ok:false so the UI can fall back to manual entry.
// ─────────────────────────────────────────────────────────────
import { lookupPincode, searchByArea, isPincode } from '../../shared/pincode.mjs';

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const src = req.method === 'POST' ? (req.body || {}) : (req.query || {});
  const pin = String(src.pin || '').trim();
  const q = String(src.q || src.area || '').trim();

  // /api/pincode with no arguments doubles as a health ping.
  if (!pin && !q) {
    return res.json({ ok: true, service: 'pincode' });
  }

  if (pin) {
    if (!isPincode(pin)) {
      return res.status(400).json({ ok: false, error: 'pincode must be 6 digits' });
    }
    const out = await lookupPincode(pin);
    return res.status(out.ok ? 200 : 502).json(out);
  }

  // A 1–2 character search cannot match anything, so it is a client error
  // rather than an upstream failure.
  if (q.length < 3) {
    return res.status(400).json({ ok: false, error: 'type at least 3 characters of the area name' });
  }

  const out = await searchByArea(q);
  return res.status(out.ok ? 200 : 502).json(out);
}