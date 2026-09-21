// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// shared/whatsapp.mjs â€” WhatsApp order notifications.
//
// Channel 1 (preferred): META WHATSAPP CLOUD API (direct, no
// middleman, ~â‚¹0.11/utility message in India).
//   Env vars (set in Vercel):
//     WHATSAPP_ACCESS_TOKEN    â€” permanent System User token
//     WHATSAPP_PHONE_NUMBER_ID â€” from Meta App â†’ API Setup
//     WHATSAPP_TEMPLATE_NAME   â€” approved template (default: order_update)
//     WHATSAPP_GRAPH_VERSION   â€” Graph API version (default: v23.0)
//
// Channel 2 (fallback): Twilio WhatsApp â€” used automatically when
//   the Meta env vars are absent but Twilio's are present:
//     TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_WHATSAPP_FROM
//
// If neither channel is configured, sending skips gracefully.
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const META_TOKEN      = String(process.env.WHATSAPP_ACCESS_TOKEN || '').trim();
const META_PHONE_ID   = String(process.env.WHATSAPP_PHONE_NUMBER_ID || '').trim();
const TEMPLATE_NAME   = String(process.env.WHATSAPP_TEMPLATE_NAME || 'order_update').trim();
const GRAPH_VERSION   = String(process.env.WHATSAPP_GRAPH_VERSION || 'v23.0').trim();
const APP_ORIGIN      = process.env.APP_ORIGIN || 'https://laxmiclothhouse-store.vercel.app';

const TWILIO_SID      = process.env.TWILIO_ACCOUNT_SID || '';
const TWILIO_TOKEN    = process.env.TWILIO_AUTH_TOKEN || '';
const TWILIO_FROM     = process.env.TWILIO_WHATSAPP_FROM || '';

const money = (n) => 'Rs. ' + Number(n || 0).toLocaleString('en-IN');

export function buildWhatsAppLink(text, phone = '') {
  const msg = encodeURIComponent(String(text || ''));
  if (phone) {
    const p = String(phone).replace(/\D/g, '');
    return `https://wa.me/${p}?text=${msg}`;
  }
  return `https://wa.me/?text=${msg}`;
}

export function productShareText(product) {
  const name  = product.name || 'this product';
  const price = money(product.price || 0);
  return `Check out "${name}" (â‚¹${price}) at Laxmiclothhouse: ${APP_ORIGIN}/#/product/${product.id || ''}`;
}

// â”€â”€ Meta Cloud API helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const STATUS_WORD = {
  placed: 'placed', confirmed: 'confirmed', packed: 'packed',
  shipped: 'shipped', delivered: 'delivered', cancelled: 'cancelled',
  returned: 'returned',
};

function metaTemplatePayload(type, order, toE164) {
  const o = order || {};
  const id = o.id || '';
  const name = o.customerName || 'there';
  const track = `${APP_ORIGIN}/#/track?order=${encodeURIComponent(id)}`;

  // {{4}} â€” a short context line per status (never empty: template
  // variables must all be filled for Meta to accept the message).
  let extra = `Track: ${track}`;
  if (type === 'placed') extra = `Total: ${money(o.total)} Â· Payment: ${o.paymentMode || 'online'}. ${track}`;
  else if (type === 'confirmed') extra = `Total: ${money(o.total)}. We start packing soon.`;
  else if (type === 'packed') extra = `It will ship soon. ${track}`;
  else if (type === 'shipped' && o.trackingNo) extra = `Tracking (${o.courier || 'courier'}): ${o.trackingNo}. ${track}`;
  else if (type === 'delivered') extra = 'Thanks for shopping with us!';
  else if (type === 'cancelled') extra = 'If this was unexpected, just reply to this message.';
  else if (type === 'returned') extra = 'Your refund is on its way.';

  return {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: toE164,
    type: 'template',
    template: {
      name: TEMPLATE_NAME,
      language: { code: 'en' },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: name },
            { type: 'text', text: id },
            { type: 'text', text: STATUS_WORD[type] || 'updated' },
            { type: 'text', text: extra },
          ],
        },
      ],
    },
  };
}

async function sendViaMeta(type, order, phone) {
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${META_PHONE_ID}/messages`;
  const payload = metaTemplatePayload(type, order, phone);
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${META_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      const msg = data?.error?.message || `HTTP ${resp.status}`;
      console.error('[whatsapp] META ERROR:', resp.status, msg);
      return { ok: false, error: 'meta-send-failed', details: msg };
    }
    const msgId = data?.messages?.[0]?.id || '';
    console.log('[whatsapp] META SUCCESS:', { msgId, type, to: phone });
    return { ok: true, result: { msgId, status: 'accepted', channel: 'meta' } };
  } catch (err) {
    console.error('[whatsapp] META ERROR:', err.message);
    return { ok: false, error: 'meta-send-failed', details: err.message };
  }
}

// â”€â”€ Twilio fallback (kept from the original version) â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function sendViaTwilio(type, order, phone) {
  const { default: twilio } = await import('twilio');
  const client = twilio(TWILIO_SID, TWILIO_TOKEN);
  const message = renderWhatsApp(type, order);
  try {
    const messageObj = await client.messages.create({
      from: TWILIO_FROM,           // e.g. "whatsapp:+14155229999"
      to: `whatsapp:+${phone}`,
      body: message,
    });
    console.log('[whatsapp] TWILIO SUCCESS:', { sid: messageObj.sid, type });
    return { ok: true, result: { msgId: messageObj.sid, status: messageObj.status, channel: 'twilio' } };
  } catch (err) {
    console.error('[whatsapp] TWILIO ERROR:', err.message);
    return { ok: false, error: 'twilio-send-failed', details: err.message || String(err) };
  }
}

// â”€â”€ Plain-text templates (Twilio path) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function renderWhatsApp(type, orderRaw) {
  const o  = orderRaw || {};
  const id = o.id || '';
  const name = o.customerName || 'there';
  const total = money(o.total);
  const mode  = o.paymentMode || 'online';
  const track = `${APP_ORIGIN}/#/track?order=${encodeURIComponent(id || '')}`;

  const COPY = {
    placed:    `Order Placed - ${id}\n\nHi ${name}! We have received your order.\n\nTotal: ${total}\nPayment: ${mode}\n\nTrack: ${track}`,
    confirmed: `Order Confirmed - ${id}\n\nHi ${name}! Your order has been confirmed.\n\nTotal: ${total}`,
    packed:    `Order Packed - ${id}\n\nHi ${name}! Your order has been packed and will ship soon.`,
    shipped:   `Order Shipped - ${id}\n\nHi ${name}! Your order is on the way!${o.trackingNo ? `\nTracking: ${o.trackingNo}` : ''}`,
    delivered: `Order Delivered - ${id}\n\nHi ${name}! Your order has been delivered.`,
    cancelled: `Order Cancelled - ${id}\n\nHi ${name}, your order has been cancelled.`,
    returned:  `Return Processed - ${id}\n\nHi ${name}, your return has been processed.`,
  };

  return COPY[type] || COPY.placed;
}

// â”€â”€ Core send function â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function sendWhatsApp({ to, type, order }) {
  const phone = String(to || '').replace(/\D/g, '');
  if (!phone || phone.length < 10) {
    console.log('[whatsapp] FAIL: invalid phone', phone);
    return { ok: false, error: 'invalid-phone' };
  }

  // E.164: Indian numbers get the 91 prefix.
  const fullPhone = phone.startsWith('91') && phone.length === 12 ? phone : '91' + phone;

  // Channel 1 â€” Meta Cloud API when configured.
  if (META_TOKEN && META_PHONE_ID) {
    return sendViaMeta(type, order, `+${fullPhone}`);
  }

  // Channel 2 â€” Twilio fallback.
  if (TWILIO_SID && TWILIO_TOKEN && TWILIO_FROM) {
    console.log('[whatsapp] Meta not configured â€” falling back to Twilio');
    return sendViaTwilio(type, order, fullPhone);
  }

  console.log('[whatsapp] FAIL: no WhatsApp channel configured (set WHATSAPP_ACCESS_TOKEN + WHATSAPP_PHONE_NUMBER_ID)');
  return { ok: false, error: 'no-whatsapp-channel' };
}
