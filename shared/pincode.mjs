// ─────────────────────────────────────────────────────────────
// shared/pincode.mjs — Indian pincode ↔ city / district / state.
//
// Data source: https://api.postalpincode.in — the Department of
// Posts "Find Post Office" service. FREE: no account, no API key.
//   GET /pincode/{6-digit}   → every post office under that pincode
//   GET /postoffice/{name}   → every post office matching a name
//
// Answers are memoised in module memory (best effort on serverless —
// a cold start simply re-fetches). Nothing here ever throws: every
// failure comes back as { ok:false, error } so the checkout can fall
// back to manual entry. The lookup is a convenience, never a gate.
//
//   PINCODE_API_BASE        — override the endpoint (optional)
//   PINCODE_API_TIMEOUT_MS  — request timeout, default 6000
// ─────────────────────────────────────────────────────────────

const BASE = String(process.env.PINCODE_API_BASE || 'https://api.postalpincode.in').replace(/\/+$/, '');
const TIMEOUT_MS = Math.max(1000, Number(process.env.PINCODE_API_TIMEOUT_MS) || 6000);
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // pincode data is effectively static
const MAX_CACHE = 500;

/** key → result. Map keeps insertion order, so the oldest key is first. */
const cache = new Map();

function cacheGet(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expires) {
    cache.delete(key);
    return null;
  }
  return hit.value;
}

function cacheSet(key, value) {
  if (cache.size >= MAX_CACHE) {
    const oldest = cache.keys().next();
    if (!oldest.done) cache.delete(oldest.value);
  }
  cache.set(key, { value, expires: Date.now() + CACHE_TTL_MS });
}

/** True for a 6-digit Indian pincode. */
export function isPincode(value) {
  return /^\d{6}$/.test(String(value == null ? '' : value).trim());
}

const clean = (v) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim();

/** One raw /pincode or /postoffice call. Throws on transport failure. */
async function apiGet(path) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const resp = await fetch(BASE + path, {
      headers: { Accept: 'application/json' },
      signal: ctrl.signal,
    });
    if (!resp.ok) throw new Error(`pincode API HTTP ${resp.status}`);
    const body = await resp.json().catch(() => null);
    const first = Array.isArray(body) ? body[0] : body;
    if (!first || typeof first !== 'object') throw new Error('unexpected pincode API response');
    return {
      status: clean(first.Status),
      message: clean(first.Message),
      list: Array.isArray(first.PostOffice) ? first.PostOffice : [],
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Normalise one raw PostOffice entry into the shape the UI uses. */
function toOffice(raw) {
  const o = raw && typeof raw === 'object' ? raw : {};
  return {
    area: clean(o.Name),
    branchType: clean(o.BranchType),
    delivery: clean(o.DeliveryStatus).toLowerCase() === 'delivery',
    district: clean(o.District),
    division: clean(o.Division),
    state: clean(o.State),
    pincode: clean(o.Pincode),
  };
}

const uniq = (list) => [...new Set(list.filter(Boolean))];

/** Best display name for a group of offices: a delivery office, else the first. */
function primaryOffice(offices) {
  return offices.find((o) => o.delivery) || offices[0] || {};
}

/**
 * Look up a single pincode.
 *
 * Returns one of:
 *   { ok:true,  found:true,  pincode, city, district, state, headArea, areas[], officeCount }
 *   { ok:true,  found:false, pincode, message }   — pincode does not exist
 *   { ok:false, error }                           — service/network failure
 *
 * `city` is the DISTRICT, not a post-office name: a pincode can cover many
 * post offices and the head office is often a building rather than a town
 * (e.g. 110001 → head office "Sansad Marg"), while the district is what a
 * courier expects in the city field. The individual post-office names are
 * returned in `areas` so the UI can show the customer their locality.
 */
export async function lookupPincode(pincode) {
  const pin = clean(pincode);
  if (!isPincode(pin)) return { ok: false, error: 'pincode must be 6 digits' };

  const key = 'pin:' + pin;
  const cached = cacheGet(key);
  if (cached) return cached;

  let out;
  try {
    const { status, message, list } = await apiGet(`/pincode/${pin}`);
    const offices = list.map(toOffice);
    if (status.toLowerCase() !== 'success' || offices.length === 0) {
      out = { ok: true, found: false, pincode: pin, message: message || 'Pincode not found' };
    } else {
      const head = primaryOffice(offices);
      out = {
        ok: true,
        found: true,
        pincode: pin,
        city: offices.map((o) => o.district).find(Boolean) || '',
        district: offices.map((o) => o.district).find(Boolean) || '',
        state: offices.map((o) => o.state).find(Boolean) || '',
        headArea: head.area || '',
        areas: uniq(offices.map((o) => o.area)).slice(0, 10),
        deliveryAreas: uniq(offices.filter((o) => o.delivery).map((o) => o.area)).slice(0, 10),
        officeCount: offices.length,
        message,
      };
    }
  } catch (err) {
    // Never cached — a transient failure must not stick for 24 h.
    return { ok: false, error: err.message || 'pincode service unreachable' };
  }

  cacheSet(key, out);
  return out;
}

/**
 * Search post offices by area / city name (e.g. "Rohtak").
 *
 * Returns { ok:true, results:[{ pincode, area, district, state, areas[],
 * officeCount }] } — one entry per pincode, capped at 30, sorted by pincode.
 * { ok:false, error } on bad input or transport failure.
 */
export async function searchByArea(query) {
  const q = clean(query);
  if (q.length < 3) return { ok: false, error: 'type at least 3 characters' };

  const key = 'area:' + q.toLowerCase();
  const cached = cacheGet(key);
  if (cached) return cached;

  let out;
  try {
    const { status, list } = await apiGet(`/postoffice/${encodeURIComponent(q)}`);
    const offices = list.map(toOffice).filter((o) => o.pincode);
    if (status.toLowerCase() !== 'success' || offices.length === 0) {
      out = { ok: true, results: [] };
    } else {
      const byPin = new Map();
      for (const o of offices) {
        if (!byPin.has(o.pincode)) byPin.set(o.pincode, []);
        byPin.get(o.pincode).push(o);
      }
      const results = [...byPin.entries()]
        .map(([pin, group]) => {
          const head = primaryOffice(group);
          return {
            pincode: pin,
            area: head.area || '',
            district: group.map((o) => o.district).find(Boolean) || '',
            state: group.map((o) => o.state).find(Boolean) || '',
            areas: uniq(group.map((o) => o.area)).slice(0, 5),
            officeCount: group.length,
          };
        })
        .sort((a, b) => a.pincode.localeCompare(b.pincode))
        .slice(0, 30);
      out = { ok: true, results };
    }
  } catch (err) {
    return { ok: false, error: err.message || 'pincode service unreachable' };
  }

  cacheSet(key, out);
  return out;
}