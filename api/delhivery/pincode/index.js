// ─────────────────────────────────────────────────────────────
// api/delhivery/pincode/index.js
//
// POST /api/delhivery/pincode
//   Body: { pincode, weightGrams, state, paymentMode, orderValue,
//           rateCard, deliveryMinDays, deliveryMaxDays }
//   →    { ok, serviceable, shippingCost, expectedDelivery, city,
//          state, via, detail }
// GET  /api/delhivery/pincode → health ping
//
// READ-ONLY. Serviceability comes from Delhivery's pin-code lookup
// endpoint (shared/delhivery.mjs → checkServiceability). This route
// NEVER creates a shipment and never consumes a waybill — real booking
// happens only in /api/delhivery?action=create-shipment.
//
// Shipping cost, in priority order:
//   1. the admin rate card passed in as `rateCard` (Delhivery-style zones)
//   2. the built-in ZONE_TABLE fallback below
// Delhivery has no public unauthenticated rate API and its rate card is
// account-specific (from the contract/rate-card PDF), so the store keeps
// its own card in Admin → Settings and this route simply applies it.
// ─────────────────────────────────────────────────────────────
import {
  checkServiceability,
  calcShippingCost,
  isConfigured,
} from '../../../shared/delhivery.mjs';

// ZONE_TABLE — fallback rates used only when no admin rate card is set.
// Entries: 'pincodePrefix:ratePer500g:extraDays'. Coarse 2-digit prefixes.
const ZONE_TABLE = [
  '11:99:0 12:99:0 13:99:0 14:120:1 15:120:1 16:120:1 17:120:1 18:120:1 19:120:1 20:99:0',
  '21:99:0 22:99:0 23:120:1 24:120:1 25:120:1 26:120:1 27:120:1 28:120:1 29:120:1 30:120:1',
  '31:120:1 32:120:1 33:120:1 34:120:1 35:120:1 36:120:1 37:120:1 38:120:1 39:120:1 40:120:1',
  '41:120:1 42:120:1 43:120:1 44:120:1 45:120:1 46:120:1 47:120:1 48:120:1 49:120:1 50:120:1',
  '51:120:1 52:120:1 53:120:1 54:120:1 55:120:1 56:120:1 57:120:1 58:120:1 59:120:1 60:120:1',
  '61:120:1 62:120:1 63:120:1 64:120:1 65:120:1 66:120:1 67:120:1 68:120:1 69:120:1 70:120:1',
  '71:120:1 72:120:1 73:120:1 74:120:1 75:120:1 76:120:1 77:120:1 78:120:1 79:120:1 80:120:1',
  '81:120:1 82:120:1 83:120:1 84:120:1 85:120:1 86:120:1 87:120:1 88:120:1 89:120:1 90:120:1',
  '91:120:1 92:120:1 93:120:1 94:120:1 95:120:1 96:120:1 97:120:1 98:120:1 99:120:1',
];

/** Fallback rate for a pincode when no admin rate card is configured. */
function tableRateForPin(pin, weightGrams) {
  const grams = Math.max(1, Number(weightGrams) || 500);
  const digits = String(pin || '');
  for (const spec of ZONE_TABLE) {
    for (const entry of spec.split(' ')) {
      const [prefix, base, extra] = entry.split(':');
      if (digits.startsWith(prefix)) {
        return { rate: Math.max(99, Math.round(Number(base) * (grams / 500))), extraDays: Number(extra) };
      }
    }
  }
  // Unknown prefix — treat as the most distant zone.
  return { rate: Math.max(99, Math.round(150 * (grams / 500))), extraDays: 2 };
}

/** ISO (YYYY-MM-DD) date `days` from today. */
function isoInDays(days) {
  return new Date(Date.now() + Math.max(0, Number(days) || 0) * 86400000)
    .toISOString()
    .slice(0, 10);
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return res.json({ ok: true, service: 'delhivery-pincode', configured: isConfigured() });
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body || {};
  const pincode = String(body.pincode || '').trim();
  // Distinguish "not supplied" (default 500 g) from an explicit 0/negative,
  // which must be rejected rather than silently coerced to 500.
  const weightGrams = body.weightGrams === undefined || body.weightGrams === null || body.weightGrams === ''
    ? 500
    : Number(body.weightGrams);
  const state = String(body.state || '').trim();
  const paymentMode = String(body.paymentMode || 'prepaid').trim().toLowerCase();
  const orderValue = Number(body.orderValue) || 0;
  const rateCard = body.rateCard && typeof body.rateCard === 'object' ? body.rateCard : null;
  const minD = Math.max(1, Number(body.deliveryMinDays) || 4);
  const maxD = Math.max(minD, Number(body.deliveryMaxDays) || 7);

  if (!/^\d{6}$/.test(pincode)) {
    return res.status(400).json({ ok: false, error: 'pincode must be 6 digits' });
  }
  if (!Number.isFinite(weightGrams) || weightGrams <= 0) {
    return res.status(400).json({ ok: false, error: 'weightGrams must be positive' });
  }

  const configured = isConfigured();

  // 1) Serviceability — read-only Delhivery pin-code lookup.
  let svc;
  try {
    svc = await checkServiceability(pincode);
  } catch (err) {
    svc = { ok: false, serviceable: false, error: err.message };
  }

  const byApi = svc.ok === true;
  const zoneFallback = tableRateForPin(pincode, weightGrams);

  // If the token is missing or the API call failed we cannot prove the
  // pincode is unserviceable, so fall back to the local table and let the
  // order through rather than blocking a real customer.
  const serviceable = byApi ? svc.serviceable === true : true;
  const via = byApi ? (svc.demo ? 'delhivery-demo' : 'delhivery') : 'table-fallback';

  // 2) Shipping cost — admin rate card first, then the fallback table.
  let shippingCost = zoneFallback.rate;
  let costBreakdown = 'zone-table';
  if (rateCard) {
    const quoted = calcShippingCost(rateCard, {
      pincode,
      state,
      paymentMode,
      weightGrams,
      orderValue,
    });
    if (!quoted.unknown) {
      shippingCost = quoted.cost;
      costBreakdown = quoted.breakdown;
    }
  }

  // 3) Delivery promise — Delhivery's own transit estimate when it gives
  //    one, otherwise the store window plus this zone's extra days.
  const zoneExtra = byApi ? 0 : zoneFallback.extraDays;
  const api = Number(svc.expectedDays) > 0 ? Number(svc.expectedDays) : null;
  const from = api ? isoInDays(api) : isoInDays(minD + zoneExtra);
  const to = api ? isoInDays(api + Math.max(0, maxD - minD)) : isoInDays(maxD + zoneExtra);

  return res.json({
    ok: true,
    via,
    configured,
    serviceable,
    shippingCost: serviceable ? Math.max(0, Math.round(shippingCost)) : null,
    expectedDelivery: serviceable ? from + ' .. ' + to : null,
    city: svc.city || '',
    state: svc.district && !svc.state ? svc.district : svc.state || '',
    // null means "unknown" (unconfigured / API error) — never claim COD is
    // unavailable just because we could not reach Delhivery.
    cod: byApi ? svc.cod === true : null,
    prepaid: byApi ? svc.prepaid === true : null,
    estimatedDays: api,
    detail: {
      error: svc.error || null,
      costBreakdown,
      zoneExtraDays: zoneExtra,
      weightGrams,
      paymentMode,
      demo: svc.demo === true,
    },
  });
}
