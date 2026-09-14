// ─────────────────────────────────────────────────────────────
// shared/whatsapp.mjs — WhatsApp order notifications via WATI.
// ─────────────────────────────────────────────────────────────

const KEY = process.env.WHATSAPP_API_KEY || '';
// WATI endpoint: your tenant URL (e.g. "live.wati.io" or "live.wati.io/10250078")
const WATI_ENDPOINT = process.env.WATI_ENDPOINT || ''; // e.g. "live.wati.io"
const APP_ORIGIN = process.env.APP_ORIGIN || 'https://online-store-sigma-three.vercel.app';

const money = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');

export function renderWhatsApp(type, orderRaw) {
  const o = orderRaw || {};
  const id = o.id || '';
  const name = o.customerName || 'there';
  const total = money(o.total);
  const mode = o.paymentMode || 'online';
  const track = `${APP_ORIGIN}/#/order-manage/${encodeURIComponent(id || '')}`;

  const COPY = {
    placed: `Order Placed - ${id}\n\nHi ${name}! We have received your order.\n\nTotal: ${total}\nPayment: ${mode}\n\nTrack: ${track}`,
    confirmed: `Order Confirmed - ${id}\n\nHi ${name}! Your order has been confirmed.\n\nTotal: ${total}`,
    packed: `Order Packed - ${id}\n\nHi ${name}! Your order has been packed and will ship soon.`,
    shipped: `Order Shipped - ${id}\n\nHi ${name}! Your order is on the way!${o.trackingNo ? `\nTracking: ${o.trackingNo}` : ''}`,
    delivered: `Order Delivered - ${id}\n\nHi ${name}! Your order has been delivered.`,
    cancelled: `Order Cancelled - ${id}\n\nHi ${name}, your order has been cancelled.`,
    returned: `Return Processed - ${id}\n\nHi ${name}, your return has been processed.`,
  };

  return COPY[type] || COPY.placed;
}

export async function sendWhatsApp({ to, type, order }) {
  const phone = String(to || '').replace(/\D/g, '');
  if (!phone || phone.length < 10) {
    console.log('[whatsapp] FAIL: invalid phone', phone);
    return { ok: false, error: 'invalid-phone' };
  }
  const fullPhone = phone.startsWith('91') && phone.length === 12 ? phone : '91' + phone;

  if (!KEY) {
    console.log('[whatsapp] FAIL: no WHATSAPP_API_KEY set');
    return { ok: false, error: 'no-api-key' };
  }

  if (!WATI_ENDPOINT) {
    console.log('[whatsapp] FAIL: no WATI_ENDPOINT set (or invalid endpoint)');
    return { ok: false, error: 'no-wati-endpoint' };
  }

  const message = renderWhatsApp(type, order);

  // Build WATI URL: https://live.wati.io/api/v1/sendSessionMessage/{phone}
  const baseUrl = WATI_ENDPOINT.startsWith('http') ? WATI_ENDPOINT.replace(/\/+$/, '') : `https://${WATI_ENDPOINT.replace(/^\/+/, '').replace(/\/.*$/, '')}`;
  const WATI_URL = `${baseUrl}/api/v1/sendSessionMessage/${fullPhone}`;

  console.log('[whatsapp] ATTEMPT:', { type, phone: fullPhone, endpoint: WATI_ENDPOINT, keyLength: KEY.length });
  console.log('[whatsapp] URL:', WATI_URL);

  try {
    const formData = new URLSearchParams();
    formData.append('messageText', message);

    const resp = await fetch(WATI_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${KEY}`,
      },
      body: formData,
    });

    const text = await resp.text();
    console.log('[whatsapp] RESPONSE STATUS:', resp.status);
    console.log('[whatsapp] RESPONSE BODY:', text);

    if (!resp.ok) {
      return { ok: false, error: `http-${resp.status}`, details: text };
    }

    let result = {};
    try { result = JSON.parse(text); } catch { result = { raw: text }; }
    console.log('[whatsapp] SUCCESS:', JSON.stringify(result));
    return { ok: true, result };
  } catch (err) {
    console.error('[whatsapp] NETWORK ERROR:', err.message);
    return { ok: false, error: 'network', details: err.message };
  }
}

export function buildWhatsAppLink(text, phone = '') {
  const msg = encodeURIComponent(String(text || ''));
  if (phone) {
    const p = String(phone).replace(/\D/g, '');
    return `https://wa.me/${p}?text=${msg}`;
  }
  return `https://wa.me/?text=${msg}`;
}

export function productShareText(product) {
  const name = product.name || 'this product';
  const price = money(product.price || 0);
  const url = `${APP_ORIGIN}/#/product/${product.id || ''}`;
  return `Check out ${name} (${price}): ${url}`;
}

export function orderShareText(order) {
  const id = order.id || '';
  const url = `${APP_ORIGIN}/#/order-status?order=${encodeURIComponent(id)}`;
  return `My order ${id}: ${url}`;
}
