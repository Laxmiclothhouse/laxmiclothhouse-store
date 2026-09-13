// ─────────────────────────────────────────────────────────────
// src/utils/delhivery.js — Client-side helpers for the Delhivery
// integration. All courier lookups go through our own API so the
// DELHIVERY_API_TOKEN never reaches the browser.
// ─────────────────────────────────────────────────────────────

/**
 * Fetch live Delhivery tracking for an AWB.
 * Returns { ok, configured, status, storeStatus, scans, lastScan, error }.
 */
export async function fetchDelhiveryTrack(awb) {
  try {
    const res = await fetch(`/api/delhivery?action=track&awb=${encodeURIComponent(String(awb || '').trim())}`);
    const data = await res.json();
    return { ...data, http: res.status };
  } catch {
    return { ok: false, configured: true, error: 'Network error while fetching tracking' };
  }
}

/**
 * Book a Delhivery shipment for an order (admin/staff).
 * Returns { ok, configured, waybill, labelUrl, error }.
 */
export async function bookDelhiveryShipment(order) {
  try {
    const res = await fetch('/api/delhivery?action=create-shipment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order }),
    });
    const data = await res.json();
    return { ...data, http: res.status };
  } catch {
    return { ok: false, configured: true, error: 'Network error while booking the shipment' };
  }
}

/**
 * Book a Delhivery REVERSE pickup for a customer return.
 * Returns { ok, configured, waybill, error }.
 */
export async function bookReversePickup(ret) {
  try {
    const res = await fetch('/api/delhivery?action=reverse-pickup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ret }),
    });
    const data = await res.json();
    return { ...data, http: res.status };
  } catch {
    return { ok: false, configured: true, error: 'Network error while booking the pickup' };
  }
}

/** True when the order was shipped through Delhivery. */
export function isDelhiveryOrder(order) {
  const o = order || {};
  return /delhivery/i.test(String(o.courier || '')) || Boolean(o.delhivery?.awb);
}

/** A scan list is "fresh enough" if synced in the last 10 minutes. */
export function scansStale(order) {
  const t = order?.delhivery?.lastSyncedAt;
  if (!t) return true;
  return Date.now() - new Date(t).getTime() > 10 * 60 * 1000;
}
