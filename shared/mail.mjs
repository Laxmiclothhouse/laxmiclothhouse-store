// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// shared/mail.mjs â€” Transactional order e-mails (Resend.com).
// Lives OUTSIDE api/ so Vercel never treats it as a function.
// Sends only if RESEND_API_KEY is configured â€” otherwise it logs
// and skips, so the store keeps working until you add the key.
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const KEY = process.env.RESEND_API_KEY || '';
const FROM_EMAIL = process.env.MAIL_FROM || 'onboarding@resend.dev';

const MERCHANT_EMAIL = process.env.MERCHANT_EMAIL || '';
const APP_ORIGIN = process.env.APP_ORIGIN || 'https://online-store-sigma-three.vercel.app';
const STORE_NAME = process.env.STORE_NAME || 'Houselaxmicloth Suit Collection';

const money = (n) => "â‚¹" + Number(n || 0).toLocaleString("en-IN");

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Compose subject + HTML body for a given mail type. */
export function renderOrderMail(type, orderRaw) {
  const o = orderRaw || {};
  const id = esc(o.id);
  const name = esc(o.customerName || 'there');
  const track = `${APP_ORIGIN}/#/order-manage/${encodeURIComponent(o.id || '')}`;
  const total = money(o.total);
  const mode = esc(o.paymentMode || 'online');
  const tracking = o.trackingNo ? `${esc(o.courier || 'Courier')} Â· ${esc(o.trackingNo)}` : '';

  const COPY = {
    placed: {
      subject: `🛒 Order placed — ${o.id}`,
      title: 'Your order has been placed',
      body: `Hi${name === 'there' ? '' : `, ${name}`}! Thank you for your order <strong>${id}</strong>. We'll process it shortly.`,
      extra: `Payment method: <strong>${mode}</strong> · Order total: <strong>${total}</strong>`,
    },
    confirmed: {
      subject: `âœ… Order confirmed â€” ${o.id}`,
      title: 'Your order is confirmed',
      body: `Thanks for shopping with us${name === 'there' ? '' : `, ${name}`}! We have received your order <strong>${id}</strong> and will start packing it shortly.`,
      extra: `Payment method: <strong>${mode}</strong> Â· Order total: <strong>${total}</strong>`,
    },
    packed: {
      subject: `📦 Order packed — ${o.id}`,
      title: 'Your order is packed and ready',
      body: `Great news${name === 'there' ? '' : ', ' + name}! Your order <strong>${id}</strong> has been packed and will ship soon.`,
      extra: 'We will send you a tracking link once it ships.',
    },
    shipped: {
      subject: `ðŸšš Your order has shipped â€” ${o.id}`,
      title: 'Your order is on the way!',
      body: `Great news${name === 'there' ? '' : `, ${name}`} â€” your order <strong>${id}</strong> is out for delivery.`,
      extra: tracking ? `Tracking: <strong>${tracking}</strong>` : `Track your order to see live status.`,
    },
    delivered: {
      subject: `ðŸ“¦ Order delivered â€” ${o.id}`,
      title: 'Your order has been delivered',
      body: `Hi${name === 'there' ? '' : ` ${name}`}, your order <strong>${id}</strong> was delivered. We hope you love it!`,
      extra: 'If anything is missing or damaged, reply to this email and we will help.',
    },
    cancelled: {
      subject: `Order cancelled â€” ${o.id}`,
      title: 'Your order was cancelled',
      body: `Hi${name === 'there' ? '' : ` ${name}`}, your order <strong>${id}</strong> has been cancelled. Any paid amount will be refunded to the original payment method.`,
      extra: 'Questions? Reply to this email and our team will assist you.',
    },
    returned: {
      subject: `↩️ Return processed — ${o.id}`,
      title: 'Your return has been processed',
      body: `Hi${name === 'there' ? '' : ', ' + name}, your return for order <strong>${id}</strong> has been received and processed.`,
      extra: 'Once we receive the item, we will initiate your refund to the original payment method.',
    },
  };

  // Special-day wish (birthday / anniversary gift code) â€” its own layout.
  if (type === 'specialday') {
    const giftCode = esc(o.code || 'GIFT');
    const specialType = esc(o.specialType || 'Birthday');
    const subject = `ğŸŽ‰ Happy ${specialType}! A gift inside from ${STORE_NAME}`;
    const html = `<!doctype html>
<html>
<body style="font-family:Arial,Helvetica,sans-serif;background:#faf6f0;padding:24px;max-width:600px;margin:0 auto">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#ffffff;border-radius:14px;border:1px solid #eadfd6;overflow:hidden">
    <tr>
      <td style="padding:22px 28px;background:#9b1c3d;color:#fff">
        <div style="font-size:20px;font-weight:700">${esc(STORE_NAME)}</div>
        <div style="font-size:13px;opacity:.85">Ethnic fashion store</div>
      </td>
    </tr>
    <tr>
      <td style="padding:26px 28px;text-align:center">
        <div style="font-size:44px;line-height:1">ğŸŽ‚ğŸŽ</div>
        <h1 style="font-size:21px;margin:10px 0 12px">Happy ${specialType}${name === 'there' ? '' : `, ${name}`}!</h1>
        <p style="font-size:15px;line-height:1.6;margin:0 0 18px">On your special day, we have a little gift for you â€” a discount code to celebrate in style.</p>
        <div style="display:inline-block;background:#fdf0f4;border:2px dashed #9b1c3d;color:#9b1c3d;font-size:24px;font-weight:800;letter-spacing:3px;padding:12px 28px;border-radius:12px">${giftCode}</div>
        <p style="font-size:13px;color:#7c6f72;margin:14px 0 20px">Enter this code at checkout. Valid during your special month.</p>
        <a href="${APP_ORIGIN}/#/catalog" style="display:inline-block;background:#9b1c3d;color:#fff;text-decoration:none;padding:11px 22px;border-radius:30px;font-size:14px">Shop with your gift â†’</a>
        <p style="font-size:12px;color:#7c6f72;margin:22px 0 0">This is a system-generated email. No reply is monitored.</p>
      </td>
    </tr>
  </table>
</body>
</html>`;
    return { subject, html };
  }

  const c = COPY[type] || COPY.confirmed;
  const html = `<!doctype html>
<html>
<body style="font-family:Arial,Helvetica,sans-serif;background:#faf6f0;padding:24px;max-width:600px;margin:0 auto">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#ffffff;border-radius:14px;border:1px solid #eadfd6;overflow:hidden">
    <tr>
      <td style="padding:22px 28px;background:#9b1c3d;color:#fff">
        <div style="font-size:20px;font-weight:700">${esc(STORE_NAME)}</div>
        <div style="font-size:13px;opacity:.85">Ethnic fashion store</div>
      </td>
    </tr>
    <tr>
      <td style="padding:26px 28px">
        <h1 style="font-size:21px;margin:0 0 12px">${c.title}</h1>
        <p style="font-size:15px;line-height:1.6;margin:0 0 14px">${c.body}</p>
        <p style="font-size:14px;margin:0 0 18px">${c.extra}</p>
        <a href="${track}" style="display:inline-block;background:#9b1c3d;color:#fff;text-decoration:none;padding:11px 22px;border-radius:30px;font-size:14px">Track your order</a>
        <p style="font-size:12px;color:#7c6f72;margin:22px 0 0">Order total: <strong>${total}</strong> Â· This is a system-generated email. No reply is monitored.</p>
      </td>
    </tr>
  </table>
</body>
</html>`;
  return { subject: c.subject, html };
}

/** Send a status e-mail. Always returns { ok } â€” never throws. */
export async function sendOrderMail({ type, to, order }) {
  const email = String(to || order?.customerEmail || order?.customer?.email || '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { ok: false, error: 'invalid recipient', customerSent: false, merchantSent: false };
  }
  if (!KEY) {
    console.log(`[mail] skipped (no RESEND_API_KEY): ${type} â†’ ${email}`);
    return { ok: true, skipped: true, customerSent: false, merchantSent: false };
  }
  const { subject, html } = renderOrderMail(type, order);

  // Resend's shared onboarding@resend.dev address can ONLY deliver to the
  // Resend account owner. Without a domain you own + verify, every other
  // customer address is rejected (HTTP 403). Warn loudly in the logs so this
  // misconfiguration is obvious instead of silently losing customer e-mails.
  if (/@resend\.dev$/i.test(String(FROM_EMAIL).trim())) {
    console.warn(
      '[mail] MAIL_FROM is still the shared resend.dev sandbox address. Resend will only ' +
      'deliver to the account owner — real customers get nothing. Verify a domain at ' +
      'https://resend.com/domains and set MAIL_FROM to an address on it ' +
      '(e.g. orders@yourdomain.com).'
    );
  }

  let customerResult;
  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${STORE_NAME} <${FROM_EMAIL}>`,
        to: [email],
        subject,
        html,
      }),
    });
    if (!resp.ok) {
      const text = await resp.text();
      console.error('[mail] resend error', resp.status, text.slice(0, 300));
      customerResult = { ok: false, error: `resend ${resp.status}: ${text.slice(0, 200)}` };
    } else {
      customerResult = { ok: true };
    }

    // Send a merchant (store-owner) copy of every order status e-mail.
    let merchantResult = { ok: false, skipped: true };
    if (MERCHANT_EMAIL && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(MERCHANT_EMAIL)) {
      // `o` is the order snapshot handed to THIS function. renderOrderMail()
      // has its own scoped `o`; referencing that one from here threw
      // "ReferenceError: o is not defined" and aborted the whole send.
      const o = order || {};
      const mTotal = money(o.total);
      const mTrack = o.trackingNo ? `${esc(o.courier || 'Courier')} ${esc(o.trackingNo)}` : '';
      const mSubject = `[Merchant] ${subject}`;
      const mHtml = `<!doctype html>
<html style="font-family:Arial,Helvetica,sans-serif;background:#faf6f0;padding:24px">
<body style="max-width:600px;margin:0 auto">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#fff;border-radius:14px;border:1px solid #eadfd6;overflow:hidden">
    <tr>
      <td style="padding:22px 28px;background:#222;color:#fff">
        <div style="font-size:20px;font-weight:700">${esc(STORE_NAME)} — Order Notification</div>
        <div style="font-size:13px;opacity:.85">Internal copy · Do not reply</div>
      </td>
    </tr>
    <tr>
      <td style="padding:26px 28px">
        <h1 style="font-size:21px;margin:0 0 12px">${subject}</h1>
        <p style="font-size:14px;margin:0 0 6px"><strong>Customer:</strong> ${esc(o.customerName || '—')}</p>
        <p style="font-size:14px;margin:0 0 6px"><strong>Customer email:</strong> ${esc(o.customerEmail || '—')}</p>
        <p style="font-size:14px;margin:0 0 6px"><strong>Order total:</strong> ${mTotal}</p>
        <p style="font-size:14px;margin:0 0 6px"><strong>Payment:</strong> ${esc(o.paymentMode || '—')}</p>
        ${mTrack ? `<p style="font-size:14px;margin:0 0 6px"><strong>Tracking:</strong> ${mTrack}</p>` : ''}
         <a href="${APP_ORIGIN}/#/order-manage/${encodeURIComponent(o.id || '')}" style="display:inline-block;background:#9b1c3d;color:#fff;text-decoration:none;padding:11px 22px;border-radius:30px;font-size:14px;margin-top:6px">View order →</a>
        <p style="font-size:12px;color:#7c6f72;margin:22px 0 0">This is a system-generated internal notification.</p>
      </td>
    </tr>
  </table>
</body>
</html>`;
      try {
        const mResp = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: `${STORE_NAME} <${FROM_EMAIL}>`,
            to: [MERCHANT_EMAIL],
            subject: mSubject,
            html: mHtml,
          }),
        });
        if (!mResp.ok) {
          const mText = await mResp.text();
          console.error('[mail] merchant resend error', mResp.status, mText.slice(0, 300));
          merchantResult = { ok: false, error: `resend ${mResp.status}: ${mText.slice(0, 200)}` };
        } else {
          merchantResult = { ok: true };
        }
      } catch (mErr) {
        merchantResult = { ok: false, error: mErr.message };
        console.error('[mail] merchant copy error:', mErr.message);
      }
    }
    return {
      ok: customerResult.ok,
      customerSent: customerResult.ok,
      merchantSent: merchantResult.ok,
      error: customerResult.error || null,
      merchantError: merchantResult.error || null,
    };
  } catch (err) {
    console.error('[mail] send error:', err.message);
    return { ok: false, error: err.message };
  }
}