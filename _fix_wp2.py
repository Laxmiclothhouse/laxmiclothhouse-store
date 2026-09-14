with open('shared/whatsapp.mjs', 'w', encoding='utf-8') as f:
    f.write('''// ─────────────────────────────────────────────────────────────
// shared/whatsapp.mjs — WhatsApp order notifications via WATI.
// Sends only if WHATSAPP_API_KEY is configured — otherwise logs and skips.
// ─────────────────────────────────────────────────────────────

const KEY = process.env.WHATSAPP_API_KEY || '';
const PHONE_ID = process.env.WHATSAPP_PHONE_ID || '';
// WATI custom endpoint (e.g., live-server-xxxx.wati.io) — find in WATI dashboard > API Docs
const WATI_ENDPOINT = process.env.WATI_ENDPOINT || '';
const APP_ORIGIN = process.env.APP_ORIGIN || 'https://online-store-sigma-three.vercel.app';

const money = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');

/** Compose message text for a given type. */
export function renderWhatsApp(type, orderRaw) {
  const o = orderRaw || {};
  const id = o.id || '';
  const name = o.customerName || 'there';
  const total = money(o.total);
  const mode = o.paymentMode || 'online';
  const track = `${APP_ORIGIN}/#/order-manage/${encodeURIComponent(id || '')}`;

  const COPY = {
    placed: `📋 *Order Placed — ${id}*\\n\\nHi ${name}! We have received your order.\\n\\nTotal: ${total}\\nPayment: ${mode}\\n\\nTrack your order:\\n${track}`,
    confirmed: `✅ *Order Confirmed — ${id}*\\n\\nHi ${name}! Your order has been confirmed and we'll start packing it shortly.\\n\\nTotal: ${total}\\n\\nTrack: ${track}`,
    packed: `📦 *Order Packed — ${id}*\\n\\nGreat news ${name}! Your order has been carefully packed and will be shipped soon.\\n\\nTrack: ${track}`,
    shipped: `🚚 *Order Shipped — ${id}*\\n\\nHi ${name}! Your order is on the way!${
      o.trackingNo
        ? `\\n\\nTracking: ${o.courier || 'Courier'} · ${o.trackingNo}\\n\\nTrack live: https://delhivery.com/track/package/${o.trackingNo}`
        : `\\n\\nTrack: ${track}`
    }`,
    delivered: `🎉 *Order Delivered — ${id}*\\n\\nHi ${name}! Your order has been delivered. We hope you love it!\\n\\nIf anything is missing or damaged, reply to this message.`,
    cancelled: `❌ *Order Cancelled — ${id}*\\n\\nHi ${name}, your order has been cancelled. Any paid amount will be refunded to the original payment method.\\n\\nQuestions? Reply to this message.`,
    returned: `↩️ *Return Processed — ${id}*\\n\\nHi ${name}, your return has been processed successfully.\\n\\nRefund of ${total} will be credited to your original payment method within 5-7 working days.`,
  };

  return COPY[type] || COPY.placed;
}

/**
 * Send a WhatsApp text message via WATI.
 * @param {object} opts
 * @param {string} opts.to — phone number (e.g. "919876543210")
 * @param {string} opts.type — status type (e.g. "placed")
 * @param {object} opts.order — order data
 * @returns {Promise<{ok: boolean, error?: string, skipped?: boolean}>}
 */
export async function sendWhatsApp({ to, type, order }) {
  const phone = String(to || '').replace(/\\D/g, '');
  if (!phone || phone.length < 10) return { ok: false, error: 'invalid phone' };
  const fullPhone = phone.startsWith('91') && phone.length === 12 ? phone : '91' + phone;

  if (!KEY) {
    console.log(`[whatsapp] skipped (no WHATSAPP_API_KEY): ${type} → ${fullPhone}`);
    return { ok: true, skipped: true, reason: 'no-api-key' };
  }

  if (!WATI_ENDPOINT) {
    console.log(`[whatsapp] skipped (no WATI_ENDPOINT): ${type} → ${fullPhone}`);
    return { ok: true, skipped: true, reason: 'no-wati-endpoint' };
  }

  const message = renderWhatsApp(type, order);
  try {
    // WATI API: send session message (form data, not JSON)
    const formData = new URLSearchParams();
    formData.append('messageText', message);

    const url = `https://${WATI_ENDPOINT}/api/v1/sendSessionMessage/${fullPhone}`;
    console.log(`[whatsapp] sending to WATI: ${url}`);

    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${KEY}`,
      },
      body: formData,
    });

    const text = await resp.text();
    console.log(`[whatsapp] WATI response ${resp.status}: ${text.slice(0, 300)}`);

    if (!resp.ok) {
      return { ok: false, error: `wati ${resp.status}: ${text.slice(0, 200)}` };
    }

    return { ok: true };
  } catch (err) {
    console.error('[whatsapp] send error:', err.message);
    return { ok: false, error: err.message };
  }
}

/**
 * Build a WhatsApp deep link for sharing (no API needed).
 * @param {string} text — message to pre-fill
 * @param {string} phone — optional recipient (E.164, no +)
 * @returns {string} — wa.me URL
 */
export function buildWhatsAppLink(text, phone = '') {
  const msg = encodeURIComponent(String(text || ''));
  if (phone) {
    const p = String(phone).replace(/\\D/g, '');
    return `https://wa.me/${p}?text=${msg}`;
  }
  return `https://wa.me/?text=${msg}`;
}

/**
 * Compose the share text for a product.
 */
export function productShareText(product) {
  const name = product.name || 'this product';
  const price = money(product.price || 0);
  const url = `${APP_ORIGIN}/#/product/${product.id || ''}`;
  return `Check out ${name} (${price}) at ${STORE_NAME}:\\n${url}`;
}

/**
 * Compose the share text for an order.
 */
export function orderShareText(order) {
  const id = order.id || '';
  const url = `${APP_ORIGIN}/#/order-status?order=${encodeURIComponent(id)}`;
  return `My order ${id} from ${STORE_NAME}:\\n${url}`;
}
''')

print('whatsapp.mjs fixed for WATI API v1')
