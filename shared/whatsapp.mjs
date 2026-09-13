// ─────────────────────────────────────────────────────────────
// shared/whatsapp.mjs — WhatsApp order notifications (WhatsApp Business API).
// Lives OUTSIDE api/ so Vercel never treats it as a function.
// Sends only if WHATSAPP_API_KEY is configured — otherwise logs and skips.
// ─────────────────────────────────────────────────────────────

const KEY = process.env.WHATSAPP_API_KEY || '';
const PHONE_ID = process.env.WHATSAPP_PHONE_ID || '';
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
    placed: `📋 *Order Placed — ${id}*\n\nHi ${name}! We have received your order.\n\nTotal: ${total}\nPayment: ${mode}\n\nTrack your order:\n${track}`,
    confirmed: `✅ *Order Confirmed — ${id}*\n\nHi ${name}! Your order has been confirmed and we'll start packing it shortly.\n\nTotal: ${total}\n\nTrack: ${track}`,
    packed: `📦 *Order Packed — ${id}*\n\nGreat news ${name}! Your order has been carefully packed and will be shipped soon.\n\nTrack: ${track}`,
    shipped: `🚚 *Order Shipped — ${id}*\n\nHi ${name}! Your order is on the way!${
      o.trackingNo
        ? `\n\nTracking: ${o.courier || 'Courier'} · ${o.trackingNo}\n\nTrack live: https://delhivery.com/track/package/${o.trackingNo}`
        : `\n\nTrack: ${track}`
    }`,
    delivered: `🎉 *Order Delivered — ${id}*\n\nHi ${name}! Your order has been delivered. We hope you love it!\n\nIf anything is missing or damaged, reply to this message.`,
    cancelled: `❌ *Order Cancelled — ${id}*\n\nHi ${name}, your order has been cancelled. Any paid amount will be refunded to the original payment method.\n\nQuestions? Reply to this message.`,
    returned: `↩️ *Return Processed — ${id}*\n\nHi ${name}, your return has been processed successfully.\n\nRefund of ${total} will be credited to your original payment method within 5-7 working days.`,
  };

  return COPY[type] || COPY.placed;
}

/** Send a WhatsApp message. Always returns { ok } — never throws. */
export async function sendWhatsApp({ to, type, order }) {
  const phone = String(to || '').replace(/\D/g, '');
  if (!phone || phone.length < 10) return { ok: false, error: 'invalid phone' };
  const fullPhone = phone.length === 10 ? '91' + phone : phone;

  if (!KEY || !PHONE_ID) {
    console.log(`[whatsapp] skipped (no WHATSAPP_API_KEY/PHONE_ID): ${type} → ${fullPhone}`);
    return { ok: true, skipped: true };
  }

  const message = renderWhatsApp(type, order);
  try {
    const resp = await fetch(`https://graph.facebook.com/v18.0/${PHONE_ID}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: fullPhone,
        type: 'text',
        text: { body: message },
      }),
    });
    if (!resp.ok) {
      const text = await resp.text();
      console.error('[whatsapp] error', resp.status, text.slice(0, 300));
      return { ok: false, error: `whatsapp ${resp.status}` };
    }
    return { ok: true };
  } catch (err) {
    console.error('[whatsapp] send error:', err.message);
    return { ok: false, error: err.message };
  }
}

/** Build a WhatsApp deep-link for sharing (no API needed). */
export function whatsappShareLink(phone, text) {
  const msg = encodeURIComponent(text);
  const phonePart = phone ? `?phone=${String(phone).replace(/\D/g, '')}` : '';
  return `https://wa.me/${phonePart}&text=${msg}`;
}

// ─────────────────────────────────────────────────────────────
// shared/whatsapp.mjs — WhatsApp order notifications (Cloud API).
// Sends via Meta's WhatsApp Business Cloud API when configured.
// Without credentials it logs and skips — store keeps working.
// ─────────────────────────────────────────────────────────────

const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN || '';
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_ID || '';
const APP_ORIGIN = process.env.APP_ORIGIN || 'https://online-store-sigma-three.vercel.app';
const STORE_NAME = process.env.STORE_NAME || 'Houselaxmicloth Suit Collection';

const money = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');

/**
 * Send a WhatsApp message using a pre-approved template.
 * @param {string} to — E.164 phone number (e.g. "919876543210")
 * @param {string} template — template name (e.g. "order_placed")
 * @param {object} params — { id, name, total, mode, tracking, courier, items }
 */
export async function sendWhatsApp({ to, template, params = {} }) {
  const phone = String(to || '').replace(/\D/g, '');
  if (!phone || phone.length < 10) return { ok: false, error: 'invalid phone' };
  const fullPhone = phone.startsWith('91') && phone.length === 12 ? phone : '91' + phone;

  if (!ACCESS_TOKEN || !PHONE_NUMBER_ID) {
    console.log(`[whatsapp] skipped (no credentials): ${template} → ${fullPhone}`);
    return { ok: true, skipped: true };
  }

  const o = params || {};
  const components = [
    {
      type: 'body',
      parameters: [
        { type: 'text', text: String(o.name || 'there') },
        { type: 'text', text: String(o.id || '') },
        { type: 'text', text: money(o.total || 0) },
        { type: 'text', text: String(o.mode || 'online') },
        { type: 'text', text: String(o.tracking || '') },
        { type: 'text', text: String(o.courier || '') },
        { type: 'text', text: String(o.items || '') },
      ],
    },
  ];

  try {
    const resp = await fetch(`https://graph.facebook.com/v17.0/${PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: fullPhone,
        type: 'template',
        template: {
          name: template,
          language: { code: 'en' },
          components,
        },
      }),
    });
    if (!resp.ok) {
      const text = await resp.text();
      console.error('[whatsapp] error', resp.status, text.slice(0, 300));
      return { ok: false, error: `whatsapp ${resp.status}` };
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
    const p = String(phone).replace(/\D/g, '');
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
  return `Check out ${name} (${price}) at ${STORE_NAME}:\n${url}`;
}

/**
 * Compose the share text for an order.
 */
export function orderShareText(order) {
  const id = order.id || '';
  const url = `${APP_ORIGIN}/#/order-status?order=${encodeURIComponent(id)}`;
  return `My order ${id} from ${STORE_NAME}:\n${url}`;
}

// Template names per status (must be approved in Meta Business Manager).
export const WHATSAPP_TEMPLATES = {
  placed: 'order_placed',
  confirmed: 'order_confirmed',
  packed: 'order_packed',
  shipped: 'order_shipped',
  delivered: 'order_delivered',
  cancelled: 'order_cancelled',
  returned: 'order_returned',
};
