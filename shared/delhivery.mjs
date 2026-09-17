// ─────────────────────────────────────────────────────────────
// shared/delhivery.mjs — Delhivery API client (token-ready).
//
// ACTIVATION: set these env vars in Vercel and the integration
// switches on with zero code changes:
//   DELHIVERY_API_TOKEN      — the API token from Delhivery (required)
//   DELHIVERY_PICKUP_NAME    — registered warehouse/pickup name (optional;
//                              defaults to the account's default pickup)
//   DELHIVERY_WEBHOOK_SECRET — shared secret for /api/delhivery/webhook
//
// Until DELHIVERY_API_TOKEN exists, every endpoint reports
// { configured: false } and the UI falls back to manual AWB entry.
// ─────────────────────────────────────────────────────────────

// Production: https://track.delhivery.com
// Sandbox/demo (when Delhivery issues a staging token): usually
// https://staging.track.delhivery.com — set DELHIVERY_API_BASE to it
// while testing, and remove it when going live.
const BASE = String(process.env.DELHIVERY_API_BASE || 'https://track.delhivery.com').replace(/\/+$/, '');

/** Delhivery API base URL — exported so route handlers can reuse it. */
export const API_BASE = BASE;

export function isDemo() {
  const d = String(process.env.DELHIVERY_DEMO || '').trim().toLowerCase();
  return d === '1' || d === 'true' || d === 'yes';
}

export function isConfigured() {
  return isDemo() || Boolean(String(process.env.DELHIVERY_API_TOKEN || '').trim());
}

function authHeaders(extra = {}) {
  return {
    Authorization: `Token ${String(process.env.DELHIVERY_API_TOKEN || '').trim()}`,
    Accept: 'application/json',
    ...extra,
  };
}

function authFetch(url, options = {}) {
  return fetch(url, { ...options, headers: authHeaders(options.headers) });
}

export async function createShipment(order, pickup = {}) {
  if (!isConfigured()) return { ok: false, error: 'Delhivery API token not configured' };

  // DEMO MODE — simulated waybill, no Delhivery account needed.
  // Waybill embeds its creation time so demo tracking can progress.
  if (isDemo()) {
    const waybill = 'DEMO' + Date.now().toString(36).toUpperCase() + String(Math.floor(Math.random() * 90) + 10);
    return { ok: true, waybill, labelUrl: '', demo: true };
  }

  const ship = order.shipping || {};
  const items = (order.items || []).map((it) => `${it.name} x${it.qty}`).join(', ');
  const isCod = String(order.payment?.mode || '').toLowerCase() === 'cod' && order.payment?.status !== 'paid';

  const shipment = {
    name: order.customer?.name || 'Customer',
    add: ship.address || '',
    pin: String(ship.pincode || '').slice(0, 6),
    city: ship.city || '',
    state: ship.state || '',
    country: 'India',
    phone: String(order.customer?.phone || '').replace(/\D/g, '').slice(-10),
    order: order.id,
    payment_mode: isCod ? 'COD' : 'Prepaid',
    total_amount: String(order.total || 0),
    cod_amount: isCod ? String(order.total || 0) : '0',
    products_desc: (items || 'Apparel').slice(0, 180),
    quantity: Math.max(1, (order.items || []).reduce((s, it) => s + (Number(it.qty) || 1), 0)),
    shipment_width: '30',
    shipment_height: '5',
    shipment_length: '25',
    weight: '500', // grams — adjust per product later if needed
    seller_name: pickup.sellerName || order.storeName || 'Store',
  };

  const payload = {
    shipments: [shipment],
    pickup_location: {
      name: pickup.name || String(process.env.DELHIVERY_PICKUP_NAME || 'Primary'),
      add: pickup.address || ship.address || '',
      city: pickup.city || ship.city || '',
      pin_code: pickup.pincode || String(ship.pincode || '').slice(0, 6),
      country: 'India',
      phone: pickup.phone || shipment.phone,
    },
  };

  try {
    const body = new URLSearchParams({ format: 'json', data: JSON.stringify(payload) });
    const res = await authFetch(`${BASE}/api/cmu/create.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = raw?.rmk || raw?.error || raw?.message || `HTTP ${res.status}`;
      return { ok: false, error: `Delhivery rejected the shipment: ${msg}`, raw };
    }
    const pkg = Array.isArray(raw) ? raw[0] : raw?.packages?.[0] || raw;
    const waybill = pkg?.waybill || raw?.waybill || '';
    if (!waybill) return { ok: false, error: 'Delhivery returned no waybill', raw };
    return {
      ok: true,
      waybill: String(waybill),
      labelUrl: pkg?.label_url || raw?.label_url || '',
      raw,
    };
  } catch (err) {
    return { ok: false, error: err.message || 'Network error calling Delhivery' };
  }
}

// ── Book a REVERSE pickup (customer return) ──────────────────
// ret: { id, orderId, customerName, phone, items:[{name,qty,size}],
//        reason, note, shipping:{address,city,state,pincode} }
// Returns { ok, waybill, demo, error }.
export async function createReversePickup(ret = {}) {
  if (!isConfigured()) return { ok: false, error: 'Delhivery API token not configured' };

  // DEMO MODE — simulated reverse AWB so the flow is testable end-to-end.
  if (isDemo()) {
    const waybill = 'RVP' + Date.now().toString(36).toUpperCase() + String(Math.floor(Math.random() * 90) + 10);
    return { ok: true, waybill, demo: true };
  }

  const ship = ret.shipping || {};
  const items = (ret.items || [])
    .map((it) => `${it.name}${it.size ? ` (${it.size})` : ''} x${it.qty}`)
    .join(', ');
  const isCod = String(ret.paymentMode || '').toLowerCase() === 'cod';

  const shipment = {
    name: ret.customerName || 'Customer',
    add: ship.address || '',
    pin: String(ship.pincode || '').slice(0, 6),
    city: ship.city || '',
    state: ship.state || '',
    country: 'India',
    phone: String(ret.phone || '').replace(/\D/g, '').slice(-10),
    order: ret.id,
    ref_number: ret.orderId,
    payment_mode: isCod ? 'COD' : 'Prepaid',
    total_amount: '0',
    cod_amount: '0',
    products_desc: (items || 'Return').slice(0, 180),
    quantity: Math.max(1, (ret.items || []).reduce((s, it) => s + (Number(it.qty) || 1), 0)),
    shipment_width: '30',
    shipment_height: '5',
    shipment_length: '25',
    weight: '500',
    is_reverse: '1', // reverse pickup / return shipment
  };

  const payload = {
    format: 'json',
    data: {
      shipments: [shipment],
      pickup_location: {
        name: ret.pickupName || process.env.DELHIVERY_PICKUP_NAME || 'Warehouse',
        add: 'Default pickup address',
        city: 'Default city',
        country: 'India',
      },
    },
  };

  try {
    const res = await authFetch(`${BASE}/api/cmu/create.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const raw = await res.json().catch(() => ({}));
    if (!res.ok || (raw.Shipments == null && raw.shipments == null && raw.Error != null)) {
      console.error('[delhivery] reverse pickup failed:', res.status, JSON.stringify(raw).slice(0, 400));
      return { ok: false, error: raw.Error || `Delhivery HTTP ${res.status}` };
    }
    const list = raw.Shipments || raw.shipments || [];
    const first = list[0] || {};
    const waybill = first.Waybill || first.AWB || raw.Waybill || '';
    if (!waybill) return { ok: false, error: 'Reverse pickup booked but no AWB returned' };
    return { ok: true, waybill };
  } catch (err) {
    return { ok: false, error: err.message || 'Network error calling Delhivery' };
  }
}

// ── Track by AWB ─────────────────────────────────────────────
// Returns { ok, awb, status, storeStatus, scans, lastScan } .
export async function trackByAwb(awb) {
  const wbn = String(awb || '').trim();
  if (!wbn) return { ok: false, error: 'awb required' };

  // DEMO MODE — simulated scan progression keyed to the waybill's
  // booking time (30h from booking to delivery), so the same demo
  // parcel advances Manifested → Picked Up → In Transit → Out for
  // Delivery → Delivered in real time.
  if (isDemo()) return demoTrack(wbn);

  if (!isConfigured()) return { ok: false, error: 'Delhivery API token not configured', configured: false };

  try {
    let raw = null;
    // Newer shipments endpoint first, fall back to legacy packages endpoint.
    let res = await authFetch(`${BASE}/track/v1/shipments/?awbs=${encodeURIComponent(wbn)}&format=json`);
    if (res.ok) raw = await res.json().catch(() => null);
    if (!raw || !(raw.ShipmentData || raw.shipment_data)) {
      res = await authFetch(`${BASE}/api/v1/packages/json/?wbn=${encodeURIComponent(wbn)}`);
      raw = res.ok ? await res.json().catch(() => null) : null;
    }
    if (!raw) return { ok: false, error: `Delhivery tracking unavailable (HTTP ${res.status})` };

    const shipment = raw.ShipmentData?.[0]?.Shipment || raw.shipment_data?.[0]?.Shipment || null;
    if (!shipment) return { ok: false, error: 'No shipment found for this AWB' };

    const scans = normalizeScans(shipment);
    const current = shipment.Status || shipment.StatusDetails || {};
    const statusText = current.Status || current.StatusInformation || shipment.status || '';
    return {
      ok: true,
      awb: shipment.Waybill || wbn,
      status: String(statusText),
      storeStatus: mapToStoreStatus(statusText),
      ndr: /undeliver/i.test(String(statusText)) && !/rto/i.test(String(statusText)),
      scans,
      lastScan: scans[0] || null,
      expectedDelivery: shipment.ExpectedDeliveryDate || shipment.Expected_delivery_date || null,
    };
  } catch (err) {
    return { ok: false, error: err.message || 'Network error calling Delhivery' };
  }
}

// ── Demo tracker (DELHIVERY_DEMO=1) ──────────────────────────
function demoTrack(wbn) {
  const raw = String(wbn || '');
  const created = raw.toUpperCase().startsWith('DEMO')
    ? parseInt(raw.slice(4, -2), 36)
    : NaN;
  const t0 = Number.isFinite(created) && created > 1e12 ? created : Date.now();
  const h = 3600 * 1000;
  const stages = [
    [0, 'Manifested', 'Shipment booked — awaiting pickup', 'Jaipur, Rajasthan'],
    [0.5 * h, 'Picked Up', 'Shipment picked up by Delhivery executive', 'Jaipur, Rajasthan'],
    [2 * h, 'In Transit', 'Departed origin hub', 'Jaipur Hub, Rajasthan'],
    [8 * h, 'In Transit', 'Arrived at transit hub', 'Delhi Hub, Delhi'],
    [20 * h, 'Out for Delivery', 'Out for delivery — delivery executive assigned', 'Destination City'],
    [30 * h, 'Delivered', 'Shipment delivered successfully', 'Destination City'],
  ];
  const now = Date.now();
  const scans = stages
    .map(([off, status, detail, location]) => ({
      status,
      detail,
      location,
      time: new Date(t0 + off).toISOString(),
    }))
    .filter((s) => new Date(s.time).getTime() <= now);
  if (!scans.length) {
    scans.push({ status: 'Manifested', detail: 'Shipment booked — awaiting pickup', location: 'Jaipur, Rajasthan', time: new Date(t0).toISOString() });
  }
  scans.sort((a, b) => new Date(b.time) - new Date(a.time)); // newest first
  const latest = scans[0];
  return {
    ok: true,
    awb: raw,
    status: latest.status,
    storeStatus: mapToStoreStatus(latest.status),
    ndr: false,
    scans,
    lastScan: latest,
    expectedDelivery: new Date(t0 + 30 * h).toISOString(),
    demo: true,
  };
}

// ── Normalizers / mapping ────────────────────────────────────
function normalizeScans(shipment) {
  const rawScans = shipment.Scans || shipment.scans || [];
  const list = rawScans.map((s) => {
    const sc = s.Scan || s.scan || s;
    const detail = sc.ScanDetail || sc.scan_detail || {};
    return {
      status: sc.ScanType || sc.scan_type || sc.ScanStatus || sc.scan_status || sc.Status || '',
      detail: sc.Scan || sc.scan || detail.Instruction || detail.Remark || '',
      location: detail.ScannedLocation || detail.scanned_location || sc.ScannedLocation || '',
      time: detail.ScannedAt || detail.scanned_at || sc.ScannedAt || sc.Time || '',
    };
  });
  // Most recent first.
  return list.sort((a, b) => new Date(b.time || 0) - new Date(a.time || 0));
}

/**
 * Map a Delhivery status string to our canonical pipeline.
 * Returns 'delivered' | 'returned' | 'shipped' (anything in-flight is
 * still "shipped" from the store's point of view).
 */
export function mapToStoreStatus(raw) {
  const s = String(raw || '').toLowerCase();
  if (s.includes('rto') && s.includes('deliver')) return 'returned';
  if (s.includes('lost') || s.includes('damaged')) return 'returned';
  if (s.includes('delivered') && !s.includes('rto')) return 'delivered';
  if (s.includes('rto')) return 'returned';
  return 'shipped';
}

// ── Pincode serviceability (READ-ONLY) ───────────────────────
/**
 * Check whether Delhivery serves a destination pincode.
 *
 * Uses the read-only lookup endpoint:
 *   GET {BASE}/cmu/pin-codes/json/?filter_codes=<PIN>
 *
 * SAFE TO CALL FROM CHECKOUT — it never creates a shipment, never
 * allocates a waybill and never bills the account. (Booking is done
 * exclusively by /api/delhivery?action=create-shipment.)
 *
 * Returns { ok, serviceable, city, state, cod, prepaid, expectedDays }.
 * Never throws.
 */
export async function checkServiceability(pincode) {
  const pin = String(pincode || '').replace(/\D/g, '').slice(0, 6);
  if (!/^\d{6}$/.test(pin)) {
    return { ok: false, serviceable: false, error: 'pincode must be 6 digits' };
  }

  // DEMO MODE — assume everything in India is serviceable.
  if (isDemo()) {
    return {
      ok: true,
      serviceable: true,
      demo: true,
      city: '',
      state: '',
      district: '',
      cod: true,
      prepaid: true,
      pickup: true,
      expectedDays: null,
    };
  }

  if (!isConfigured()) {
    return {
      ok: false,
      serviceable: false,
      configured: false,
      error: 'Delhivery API token not configured',
    };
  }

  try {
    const resp = await fetch(
      `${BASE}/cmu/pin-codes/json/?filter_codes=${encodeURIComponent(pin)}`,
      { headers: authHeaders() }
    );
    if (!resp.ok) {
      return { ok: false, serviceable: false, error: `Delhivery API ${resp.status}` };
    }
    const body = await resp.json().catch(() => ({}));
    const entry = (body && body.delivery_codes ? body.delivery_codes : [])[0];
    const pc = entry && (entry.postal_code || entry.postalCode);
    if (!pc) {
      // A 200 with no entry means Delhivery does not serve this pincode.
      return { ok: true, serviceable: false, error: 'pincode not serviced by Delhivery' };
    }
    const yes = (v) => String(v === undefined || v === null ? '' : v).trim().toUpperCase() === 'Y';
    const days = Number(String(pc.days === undefined ? '' : pc.days).replace(/\D/g, ''));
    return {
      ok: true,
      serviceable: true,
      city: pc.city || '',
      district: pc.district || '',
      state: pc.state_code || pc.state || '',
      cod: yes(pc.cash) || yes(pc.cod),
      prepaid: yes(pc.pre_paid) || yes(pc.prepaid),
      pickup: yes(pc.pickup),
      expectedDays: Number.isFinite(days) && days > 0 ? days : null,
    };
  } catch (err) {
    return { ok: false, serviceable: false, error: err.message || 'Network error calling Delhivery' };
  }
}

// ── Shipping cost from a Delhivery rate card (pure function) ──
/**
 * Compute the shipping charge for a parcel from a Delhivery-style rate
 * card. Pure + synchronous so the client can recompute instantly when
 * the cart, pincode or payment mode changes — no round trip needed.
 *
 * rateCard: {
 *   zones: {
 *     <zoneKey>: {
 *       same?: number,        // charge when a matching zone bucket applies
 *       per500g?: number,     // charge per slab, by cart weight
 *       codExtra?: number,    // added when payment mode is COD
 *       minCharge?: number,   // floor
 *       freeAbove?: number,   // free shipping above this order value
 *     }
 *   }
 * }
 * zoneKey is resolved as: pincode prefix bucket -> state bucket -> 'default'.
 * Pincode prefix buckets are written as `pin:123`, `pin:1234`, `pin:12345`.
 *
 * Returns { cost, zone, slabs, free, cod, breakdown } — cost is in rupees.
 * Never throws; returns { cost: 0, unknown: true } for an unusable rate card.
 */
export function calcShippingCost(rateCard, opts = {}) {
  try {
    const pincode = String(opts.pincode || '').replace(/\D/g, '');
    const state = String(opts.state || '').trim().toLowerCase();
    const cod = String(opts.paymentMode || '').trim().toLowerCase() === 'cod';
    const weightGrams = Math.max(0, Number(opts.weightGrams) || 0);
    const orderValue = Math.max(0, Number(opts.orderValue) || 0);

    const zones = rateCard && rateCard.zones ? rateCard.zones : null;
    if (!zones || typeof zones !== 'object') {
      return { cost: 0, unknown: true, breakdown: 'no rate card configured' };
    }

    // Longest pincode prefix wins, then state, then 'default'.
    let zoneKey = null;
    let matched = 0;
    if (/^\d{6}$/.test(pincode)) {
      for (const key of Object.keys(zones)) {
        const m = /^pin:(\d+)$/.exec(key);
        if (!m) continue;
        const prefix = m[1];
        if (pincode.startsWith(prefix) && prefix.length > matched) {
          zoneKey = key;
          matched = prefix.length;
        }
      }
    }
    if (!zoneKey && state && zones[state]) zoneKey = state;
    if (!zoneKey && zones.default) zoneKey = 'default';

    const zone = zoneKey ? zones[zoneKey] : null;
    if (!zone || typeof zone !== 'object') {
      return { cost: 0, unknown: true, breakdown: `no rate for zone ${zoneKey || '(none)'}` };
    }

    if (Number(zone.freeAbove) > 0 && orderValue >= Number(zone.freeAbove)) {
      return { cost: 0, zone: zoneKey, free: true, cod, slabs: 0, breakdown: `free above ${zone.freeAbove}` };
    }

    let cost = Number(zone.same) || 0;
    let slabs = 0;
    const per500g = Number(zone.per500g) || 0;
    if (per500g > 0 && weightGrams > 0) {
      slabs = Math.max(1, Math.ceil(weightGrams / 500));
      cost += per500g * slabs;
    }

    let codFee = 0;
    if (cod && Number(zone.codExtra) > 0) {
      codFee = Number(zone.codExtra);
      cost += codFee;
    }

    const minCharge = Number(zone.minCharge) || 0;
    if (minCharge > 0) cost = Math.max(cost, minCharge);

    return {
      cost: Math.max(0, Math.round(cost)),
      zone: zoneKey,
      slabs,
      cod,
      codFee,
      breakdown: `${zoneKey}: base ${Number(zone.same) || 0}${slabs ? ` + ${slabs}x${per500g}` : ''}${codFee ? ` + COD ${codFee}` : ''}${minCharge ? ` (min ${minCharge})` : ''}`,
    };
  } catch (err) {
    return { cost: 0, unknown: true, breakdown: err.message };
  }
}

