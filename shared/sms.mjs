// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// shared/sms.mjs â€” SMS order notifications via Twilio SMS.
// Lives OUTSIDE api/ so Vercel never treats it as a function.
// Mirrors shared/whatsapp.mjs: sends only when Twilio SMS env
// vars are configured â€” otherwise logs and skips so the store
// keeps working until the credentials are added.
//
// Env vars (set in Vercel):
//   TWILIO_ACCOUNT_SID  â€” from Twilio Console (starts with AC...)
//   TWILIO_AUTH_TOKEN   â€” from Twilio Console
//   TWILIO_SMS_FROM     â€” your Twilio SMS sender number (e.g. +14155239999)
//   APP_ORIGIN          â€” your app URL (default below)
//
// NOTE for India: transactional SMS to Indian numbers requires a
// DLT-registered sender ID + templates (TRAI regulation). Configure
// the DLT entity/sender in Twilio (or a DLT-connected provider)
// before going live; delivery failures are logged and skipped.
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

import twilio from 'twilio';

const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || '';
const AUTH_TOKEN  = process.env.TWILIO_AUTH_TOKEN  || '';
const FROM_NUMBER = process.env.TWILIO_SMS_FROM    || '';
const APP_ORIGIN  = process.env.APP_ORIGIN || 'https://laxmiclothhouse-store.vercel.app';

// Init lazily-tolerant: twilio('', '') would throw at request time,
// so only create the client when credentials exist.
const client = ACCOUNT_SID && AUTH_TOKEN ? twilio(ACCOUNT_SID, AUTH_TOKEN) : null;

const money = (n) => 'â‚¹' + Number(n || 0).toLocaleString('en-IN');

// â”€â”€ Message templates (plain text; SMS has no HTML) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function renderSms(type, orderRaw) {
  const o = orderRaw || {};
  const id = o.id || '';
  const name = o.customerName || 'there';
  const total = money(o.total);
  const mode = o.paymentMode || 'online';
  const track = `${APP_ORIGIN}/#/track?order=${encodeURIComponent(id || '')}`;

  const COPY = {
    placed:    `Laxmiclothhouse: Order ${id} placed. Hi ${name}, we received your order. Total ${total} (${mode}). Track: ${track}`,
    confirmed: `Laxmiclothhouse: Order ${id} confirmed! Hi ${name}, we start packing soon. Total ${total}.`,
    packed:    `Laxmiclothhouse: Order ${id} packed and ready to ship, ${name}!`,
    shipped:   `Laxmiclothhouse: Order ${id} shipped!${o.trackingNo ? ` Tracking (${o.courier || 'courier'}): ${o.trackingNo}.` : ''} Track: ${track}`,
    delivered: `Laxmiclothhouse: Order ${id} delivered. Thanks for shopping with us, ${name}!`,
    cancelled: `Laxmiclothhouse: Order ${id} has been cancelled. Reply to this message if you have questions.`,
    returned:  `Laxmiclothhouse: Return for order ${id} processed. Refund is on its way.`,
  };

  return COPY[type] || COPY.placed;
}

// â”€â”€ Core send function â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function isSmsConfigured() {
  return Boolean(ACCOUNT_SID && AUTH_TOKEN && FROM_NUMBER);
}

export async function sendSms({ to, type, order }) {
  const phone = String(to || '').replace(/\D/g, '');
  if (!phone || phone.length < 10) {
    console.log('[sms] FAIL: invalid phone', phone);
    return { ok: false, error: 'invalid-phone' };
  }

  if (!ACCOUNT_SID) return { ok: false, error: 'no-account-sid' };
  if (!AUTH_TOKEN)  return { ok: false, error: 'no-auth-token' };
  if (!FROM_NUMBER) return { ok: false, error: 'no-from-number' };
  if (!client)      return { ok: false, error: 'no-client' };

  // Twilio wants E.164: +<country><number>. Indian numbers get 91.
  const fullPhone = phone.startsWith('91') && phone.length === 12 ? phone : '91' + phone;

  const message = renderSms(type, order);

  console.log('[sms] ATTEMPT:', { type, to: `+${fullPhone}`, from: FROM_NUMBER });

  try {
    const messageObj = await client.messages.create({
      from: FROM_NUMBER,
      to: `+${fullPhone}`,
      body: message,
    });

    console.log('[sms] SUCCESS:', {
      sid: messageObj.sid,
      status: messageObj.status,
      dateSent: messageObj.dateSent,
    });

    return {
      ok: true,
      result: {
        msgId: messageObj.sid,
        status: messageObj.status,
      },
    };
  } catch (err) {
    console.error('[sms] TWILIO ERROR:', err.message);
    return { ok: false, error: 'twilio-send-failed', details: err.message || String(err) };
  }
}