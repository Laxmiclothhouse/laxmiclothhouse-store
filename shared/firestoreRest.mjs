// ─────────────────────────────────────────────────────────────
// shared/firestoreRest.mjs — Minimal Firestore REST read/patch
// for server-side functions (no service account needed).
//
// The store keeps orders as ONE document: store/orders → { data: [...], updatedAt }.
// Server functions (e.g. the Delhivery webhook) use this to merge
// courier scan data into that document. Uses the public web API key
// (the same one already shipped in the client bundle), so writes only
// succeed if Firestore rules allow them — failures degrade gracefully.
// ─────────────────────────────────────────────────────────────

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'laxmiclothhouse-store';
const API_KEY = process.env.FIREBASE_WEB_API_KEY || 'AIzaSyD-ICgenL_WQ8z0mfyvtPseOJUPbVMsxNs';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

// ── Decode Firestore REST typed values → plain JS ────────────
function decode(value) {
  if (!value || typeof value !== 'object') return null;
  if ('nullValue' in value) return null;
  if ('booleanValue' in value) return value.booleanValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return Number(value.doubleValue);
  if ('timestampValue' in value) return value.timestampValue;
  if ('stringValue' in value) return value.stringValue;
  if ('bytesValue' in value) return value.bytesValue;
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(decode);
  if ('mapValue' in value) return decodeMap(value.mapValue.fields);
  return null;
}

function decodeMap(fields = {}) {
  const out = {};
  for (const [k, v] of Object.entries(fields)) out[k] = decode(v);
  return out;
}

// ── Encode plain JS → Firestore REST typed values ────────────
function encode(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (Number.isInteger(value)) return { integerValue: String(value) };
  if (typeof value === 'number') return { doubleValue: value };
  if (typeof value === 'string') return { stringValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encode) } };
  if (typeof value === 'object') return { mapValue: { fields: encodeMap(value) } };
  return { stringValue: String(value) };
}

function encodeMap(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj)) fields[k] = encode(v);
  return fields;
}

/** Read the orders document. Returns { ok, data (array), updateTime } . */
export async function getOrdersDoc() {
  try {
    const res = await fetch(`${BASE}/store/orders?key=${API_KEY}`);
    if (!res.ok) return { ok: false, error: `Firestore read failed (HTTP ${res.status})` };
    const json = await res.json();
    return {
      ok: true,
      data: decodeMap(json.fields || {}).data || [],
      updateTime: json.updateTime,
    };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/** Patch the orders document with a new array. Returns { ok, written } . */
export async function patchOrdersDoc(data) {
  try {
    const mask = ['data', 'updatedAt']
      .map((f) => `updateMask.fieldPaths=${f}`)
      .join('&');
    const res = await fetch(`${BASE}/store/orders?key=${API_KEY}&${mask}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: {
          data: encode(data),
          updatedAt: { integerValue: String(Date.now()) },
        },
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return { ok: false, written: false, error: `Firestore write failed (HTTP ${res.status}) ${body.slice(0, 200)}` };
    }
    return { ok: true, written: true };
  } catch (err) {
    return { ok: false, written: false, error: err.message };
  }
}
