// api/delhivery/index.js - Single router for all Delhivery operations.
// Routes by action: create-shipment, track, webhook
import { createShipment, trackByAwb, isConfigured, mapToStoreStatus } from "../../shared/delhivery.mjs";
import { getOrdersDoc, patchOrdersDoc } from "../../shared/firestoreRest.mjs";
import { sendOrderMail } from "../../shared/mail.mjs";

const readBody = async (req) => {
  try { return req.body || {}; } catch {}
  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    return JSON.parse(Buffer.concat(chunks).toString("utf8").replace(/^\uFEFF/, "") || "{}");
  } catch { return {}; }
};

async function handleShipment(req, res) {
  const { order, pickup } = await readBody(req);
  if (!order?.id) return res.status(400).json({ error: "order required" });
  if (!order.shipping?.pincode || !order.customer?.phone) return res.status(400).json({ error: "pincode + phone required" });
  if (!isConfigured()) return res.json({ ok: false, configured: false, error: "Delhivery not connected" });
  try {
    const result = await createShipment(order, pickup || {});
    if (!result.ok) return res.status(502).json({ ok: false, configured: true, error: result.error });
    return res.json({ ok: true, configured: true, waybill: result.waybill, labelUrl: result.labelUrl });
  } catch (err) { return res.status(500).json({ ok: false, error: "Failed" }); }
}

async function handleTrack(req, res) {
  const awb = String(req.query.awb || "").trim();
  if (!awb) return res.status(400).json({ ok: false, error: "awb required" });
  if (!isConfigured()) return res.json({ ok: false, configured: false, error: "Delhivery not connected" });
  try {
    const result = await trackByAwb(awb);
    if (!result.ok) return res.status(404).json(result);
    return res.json(result);
  } catch (err) { return res.status(500).json({ ok: false, error: "Tracking failed" }); }
}

async function handleWebhook(req, res) {
  const expected = String(process.env.DELHIVERY_WEBHOOK_SECRET || "").trim();
  if (expected) {
    const given = String(req.query.secret || "") || String(req.headers["x-delhivery-signature"] || req.headers["x-webhook-secret"] || "");
    if (given !== expected) return res.status(401).json({ error: "Invalid secret" });
  }
  try {
    let body = await readBody(req);
    const waybill = String(body.waybill || body.wbn || body.awb || "").trim();
    const status = String(body.current_status || body.Status || "").trim();
    if (!waybill) return res.json({ ok: true, ignored: "no waybill" });
    if (!isConfigured()) return res.json({ ok: true, ignored: "not configured" });
    const track = await trackByAwb(waybill);
    const ordersDoc = await getOrdersDoc();
    if (!ordersDoc.ok) return res.json({ ok: true, ignored: "no orders doc" });
    const orders = ordersDoc.data || [];
    const idx = orders.findIndex((o) => String(o.trackingNo || "").trim() === waybill || o.delhivery?.awb === waybill);
    if (idx === -1) return res.json({ ok: true, ignored: "order not found" });
    const order = orders[idx];
    const now = new Date().toISOString();
    const scans = track.ok ? track.scans : [];
    const target = track.ok ? track.storeStatus : mapToStoreStatus(status);
    const next = [...orders];
    const updated = { ...order, courier: order.courier || "Delhivery", delhivery: { ...(order.delhivery || {}), awb: waybill, status: track.ok ? track.status : status, scans: scans.length ? scans : order.delhivery?.scans || [], lastSyncedAt: now } };
    if (target === "delivered" && order.status !== target) {
      updated.status = target;
      updated.statusHistory = [...(order.statusHistory || []), { status: target, label: "Delivered", by: { name: "Delhivery (auto)", role: "courier" }, note: "Auto-synced", at: now }];
    }
    next[idx] = updated;
    const write = await patchOrdersDoc(next);
    return res.json({ ok: true, order: order.id, status: updated.status, written: write.written });
  } catch (err) { return res.json({ ok: true, ignored: "error" }); }
}

export default async function handler(req, res) {
  const action = String(req.query.action || "").toLowerCase();
  if (req.method === "GET" && action === "track") return handleTrack(req, res);
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  switch (action) {
    case "create-shipment": return handleShipment(req, res);
    case "webhook": return handleWebhook(req, res);
    default: return res.status(400).json({ error: "Unknown action" });
  }
}
