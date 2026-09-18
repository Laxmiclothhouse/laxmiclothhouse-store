// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// shared/mail.mjs â€” Transactional order e-mails (Resend.com).
// Lives OUTSIDE api/ so Vercel never treats it as a function.
// Sends only if RESEND_API_KEY is configured â€” otherwise it logs
// and skips, so the store keeps working until you add the key.
//
// Design: Laxmiclothhouse brand â€” maroon #9b1c3d, gold #c9a24b,
// cream #faf6f0. Solid colors only (email clients strip CSS
// gradients); tables + inline styles for maximum client support.
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const KEY = process.env.RESEND_API_KEY || '';
const FROM_EMAIL = process.env.MAIL_FROM || 'onboarding@resend.dev';

const MERCHANT_EMAIL = process.env.MERCHANT_EMAIL || '';
const APP_ORIGIN = process.env.APP_ORIGIN || 'https://laxmiclothhouse-store.vercel.app';
const STORE_NAME = process.env.STORE_NAME || 'Laxmiclothhouse Suit Collection';

const money = (n) => "â‚¹" + Number(n || 0).toLocaleString("en-IN");

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// â”€â”€ Shared brand blocks â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const C = {
  brand: '#9b1c3d',
  brandDark: '#6e1430',
  brandSoft: '#f5e6ec',
  gold: '#c9a24b',
  goldDark: '#a97f2f',
  cream: '#faf6f0',
  ink: '#2b2226',
  muted: '#7c6f72',
  line: '#eadfd6',
};

function brandHeader() {
  return `
    <tr>
      <td style="padding:28px 40px;background:${C.brand};text-align:center">
        <div style="font-family:Georgia,'Times New Roman',serif;font-size:26px;font-weight:700;color:#ffffff;letter-spacing:3px">LAXMICLOTHHOUSE</div>
        <div style="font-size:11px;letter-spacing:4px;color:${C.gold};margin-top:6px">TIMELESS &middot; ELEGANT &middot; YOU</div>
      </td>
    </tr>`;
}

function brandFooter() {
  return `
    <tr>
      <td style="background:${C.brandSoft};padding:22px 40px;text-align:center">
        <p style="margin:0;font-size:13px;color:${C.brandDark}">Questions? Just reply to this email â€” we always answer.</p>
        <p style="margin:8px 0 0 0;font-size:11px;color:#9a8f93">&copy; ${esc(STORE_NAME)} &middot; Crafted with care for you</p>
      </td>
    </tr>`;
}

// Status ribbon: icon + label on a full-width colored strip.
const STATUS_STYLE = {
  placed:    { icon: 'ðŸ›’', label: 'ORDER PLACED',        bg: '#c9a24b' },
  confirmed: { icon: 'âœ…', label: 'ORDER CONFIRMED',     bg: '#1e7d43' },
  packed:    { icon: 'ðŸ“¦', label: 'ORDER PACKED',        bg: '#2f6fb1' },
  shipped:   { icon: 'ðŸšš', label: 'ORDER SHIPPED',       bg: '#2f6fb1' },
  delivered: { icon: 'ðŸŽ‰', label: 'ORDER DELIVERED',     bg: '#1e7d43' },
  cancelled: { icon: 'âŒ', label: 'ORDER CANCELLED',     bg: '#b3261e' },
  returned:  { icon: 'â†©ï¸', label: 'RETURN PROCESSED',    bg: '#b06d16' },
};

function statusRibbon(type) {
  const s = STATUS_STYLE[type] || STATUS_STYLE.confirmed;
  return `
    <tr>
      <td style="background:${s.bg};padding:12px 40px;text-align:center">
        <span style="color:#ffffff;font-size:14px;font-weight:700;letter-spacing:1.5px">${s.icon} ${s.label}</span>
      </td>
    </tr>`;
}

// â”€â”€ Order details blocks (items + totals) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function itemsTable(items) {
  const list = Array.isArray(items) ? items : [];
  if (!list.length) return '';
  const rows = list.map((it) => {
    const name = esc(it.name || 'Item');
    const size = it.size ? ` <span style="color:#9a8f93">(${esc(it.size)})</span>` : '';
    const qty = Number(it.qty) || 1;
    const line = it.price != null ? money(Number(it.price) * qty) : '';
    return `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #f0e6d8;font-size:14px;color:${C.ink}">${name}${size} <span style="color:#9a8f93">&times; ${qty}</span></td>
        <td style="padding:10px 0;border-bottom:1px solid #f0e6d8;font-size:14px;color:${C.ink};text-align:right;white-space:nowrap">${line}</td>
      </tr>`;
  }).join('');
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:18px 0 6px 0">
      <tr>
        <td style="padding:0 0 6px 0;font-size:11px;letter-spacing:2px;color:${C.goldDark};font-weight:700">YOUR ITEMS</td>
      </tr>
      ${rows}
    </table>`;
}

function totalsTable(o) {
  const has = (v) => v != null && v !== '' && !Number.isNaN(Number(v));
  const rows = [];
  if (has(o.subtotal)) rows.push(['Subtotal', money(o.subtotal), false]);
  if (has(o.shippingFee)) rows.push(['Shipping', Number(o.shippingFee) === 0 ? 'FREE' : money(o.shippingFee), false]);
  if (has(o.discount) && Number(o.discount) > 0) {
    rows.push([`Discount${o.couponCode ? ` (${esc(o.couponCode)})` : ''}`, 'âˆ’ ' + money(o.discount), 'green']);
  }
  if (!rows.length && !has(o.total)) return '';
  const totalRow = has(o.total)
    ? `<tr>
         <td style="padding:10px 0 0 0;font-size:15px;font-weight:700;color:${C.brand};border-top:2px solid ${C.gold};padding-top:10px">TOTAL</td>
         <td style="padding:10px 0 0 0;font-size:15px;font-weight:700;color:${C.brand};text-align:right;border-top:2px solid ${C.gold};padding-top:10px">${money(o.total)}</td>
       </tr>`
    : '';
  const body = rows.map(([label, value, green]) => `
      <tr>
        <td style="padding:4px 0;font-size:13.5px;color:${C.muted}">${label}</td>
        <td style="padding:4px 0;font-size:13.5px;color:${green === 'green' ? '#1e7d43' : C.ink};text-align:right">${value}</td>
      </tr>`).join('');
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:6px 0 0 0">
      ${body}
      ${totalRow}
    </table>`;
}

/** Compose subject + HTML body for a given mail type. */
export function renderOrderMail(type, orderRaw) {
  const o = orderRaw || {};
  const id = esc(o.id);
  const name = esc(o.customerName || 'there');
  const greet = name === 'there' ? 'Hello!' : `Hi ${name},`;
  const track = `${APP_ORIGIN}/#/track?order=${encodeURIComponent(o.id || '')}`;
  const total = money(o.total);
  const mode = esc(o.paymentMode || 'online');
  const tracking = o.trackingNo ? `${esc(o.courier || 'Courier')} Â· ${esc(o.trackingNo)}` : '';

  const COPY = {
    placed: {
      subject: `ðŸ›’ Order placed â€” ${o.id}`,
      title: 'Thank you for your order!',
      body: `${greet} We have received your order <strong>${id}</strong> and will start processing it shortly. Here is everything you ordered:`,
      extra: '',
    },
    confirmed: {
      subject: `âœ… Order confirmed â€” ${o.id}`,
      title: 'Your order is confirmed',
      body: `${greet} We have received your order <strong>${id}</strong> and will start packing it shortly.`,
      extra: 'We will email you again the moment it ships.',
    },
    packed: {
      subject: `ðŸ“¦ Order packed â€” ${o.id}`,
      title: 'Your order is packed and ready',
      body: `${greet} Great news â€” your order <strong>${id}</strong> has been packed with care and will ship soon.`,
      extra: 'You will get a tracking link the moment it leaves our warehouse.',
    },
    shipped: {
      subject: `ðŸšš Your order has shipped â€” ${o.id}`,
      title: 'Your order is on the way!',
      body: `${greet} Exciting news â€” your order <strong>${id}</strong> is out for delivery!`,
      extra: tracking ? `Tracking: <strong>${tracking}</strong>` : 'Track your order to see live status.',
    },
    delivered: {
      subject: `ðŸŽ‰ Order delivered â€” ${o.id}`,
      title: 'Your order has been delivered',
      body: `${greet} Your order <strong>${id}</strong> has been delivered. We hope you love every piece!`,
      extra: 'If anything is missing or damaged, just reply to this email and we will make it right.',
    },
    cancelled: {
      subject: `Order cancelled â€” ${o.id}`,
      title: 'Your order was cancelled',
      body: `${greet} your order <strong>${id}</strong> has been cancelled. Any paid amount will be refunded to the original payment method.`,
      extra: 'Questions? Reply to this email and our team will assist you.',
    },
    returned: {
      subject: `â†©ï¸ Return processed â€” ${o.id}`,
      title: 'Your return has been processed',
      body: `${greet} your return for order <strong>${id}</strong> has been received and processed.`,
      extra: 'Once we receive the item, we will initiate your refund to the original payment method.',
    },
  };

  // Special-day wish (birthday / anniversary gift code) â€” own layout.
  if (type === 'specialday') {
    const giftCode = esc(o.code || 'GIFT');
    const specialType = esc(o.specialType || 'Birthday');
    const subject = `ðŸŽ‰ Happy ${specialType}! A gift inside from ${STORE_NAME}`;
    const html = `<!doctype html>
<html>
<body style="font-family:'Segoe UI',Arial,Helvetica,sans-serif;background:${C.cream};padding:24px;max-width:640px;margin:0 auto">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#ffffff;border-radius:18px;border:1px solid ${C.line};overflow:hidden">
    ${brandHeader()}
    <tr>
      <td style="background:${C.gold};padding:12px 40px;text-align:center">
        <span style="color:#ffffff;font-size:14px;font-weight:700;letter-spacing:1.5px">ðŸŽ‚ A GIFT FOR YOU</span>
      </td>
    </tr>
    <tr>
      <td style="padding:34px 40px;text-align:center">
        <div style="font-size:46px;line-height:1">ðŸŽ‚ðŸŽ</div>
        <h1 style="font-family:Georgia,serif;font-size:23px;color:${C.ink};margin:14px 0 12px">Happy ${specialType}${name === 'there' ? '' : `, ${name}`}!</h1>
        <p style="font-size:15px;line-height:1.7;color:#6b5f63;margin:0 0 20px">On your special day, we have a little gift for you â€” a discount code to celebrate in style.</p>
        <div style="display:inline-block;background:#fdf0f4;border:2px dashed ${C.brand};color:${C.brand};font-size:24px;font-weight:800;letter-spacing:3px;padding:12px 28px;border-radius:12px">${giftCode}</div>
        <p style="font-size:13px;color:${C.muted};margin:14px 0 22px">Enter this code at checkout. Valid during your special month.</p>
        <a href="${APP_ORIGIN}/#/catalog" style="display:inline-block;background:${C.gold};color:#fff;text-decoration:none;padding:13px 34px;border-radius:50px;font-size:14px;font-weight:600;letter-spacing:0.5px">SHOP WITH YOUR GIFT â†’</a>
      </td>
    </tr>
    ${brandFooter()}
  </table>
</body>
</html>`;
    return { subject, html };
  }

  const c = COPY[type] || COPY.confirmed;
  const metaRow = `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${C.cream};border-radius:10px;margin:18px 0 0 0">
      <tr>
        <td style="padding:12px 16px;font-size:13px;color:#6b5f63">
          <strong style="color:${C.ink}">Order:</strong> ${id} &nbsp;Â·&nbsp; <strong style="color:${C.ink}">Payment:</strong> ${mode}${o.orderDate ? ` &nbsp;Â·&nbsp; <strong style="color:${C.ink}">Placed:</strong> ${esc(o.orderDate)}` : ''}
        </td>
      </tr>
    </table>`;

  const html = `<!doctype html>
<html>
<body style="font-family:'Segoe UI',Arial,Helvetica,sans-serif;background:${C.cream};padding:24px;max-width:640px;margin:0 auto">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#ffffff;border-radius:18px;border:1px solid ${C.line};overflow:hidden">
    ${brandHeader()}
    ${statusRibbon(type)}
    <tr>
      <td style="padding:30px 40px 26px 40px">
        <h1 style="font-family:Georgia,serif;font-size:22px;color:${C.ink};margin:0 0 12px">${c.title}</h1>
        <p style="font-size:15px;line-height:1.7;color:#6b5f63;margin:0 0 14px">${c.body}</p>
        ${itemsTable(o.items)}
        ${totalsTable(o)}
        ${metaRow}
        ${c.extra ? `<p style="font-size:14px;line-height:1.6;color:#6b5f63;margin:16px 0 0 0">${c.extra}</p>` : ''}
        <div style="text-align:center;margin:26px 0 6px 0">
          <a href="${track}" style="display:inline-block;background:${C.gold};color:#ffffff;text-decoration:none;padding:14px 40px;border-radius:50px;font-size:14px;font-weight:600;letter-spacing:0.5px;box-shadow:0 6px 18px rgba(201,162,75,0.35)">TRACK MY ORDER</a>
        </div>
      </td>
    </tr>
    ${brandFooter()}
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
      'deliver to the account owner â€” real customers get nothing. Verify a domain at ' +
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

    // â”€â”€ Merchant (store-owner) copy â€” branded summary â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    let merchantResult = { ok: false, skipped: true };
    if (MERCHANT_EMAIL && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(MERCHANT_EMAIL)) {
      const o = order || {};
      const mTrack = o.trackingNo ? `${esc(o.courier || 'Courier')} ${esc(o.trackingNo)}` : '';
      const mItems = (Array.isArray(o.items) ? o.items : [])
        .map((it) => `<li style="padding:3px 0">${esc(it.name || 'Item')}${it.size ? ` (${esc(it.size)})` : ''} &times; ${Number(it.qty) || 1}</li>`)
        .join('');
      const mSubject = `[Merchant] ${subject}`;

      const mHtml = `<!doctype html>
<html>
<body style="font-family:'Segoe UI',Arial,Helvetica,sans-serif;background:${C.cream};padding:24px;max-width:640px;margin:0 auto">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#ffffff;border-radius:18px;border:1px solid ${C.line};overflow:hidden">
    ${brandHeader()}
    ${statusRibbon(type)}
    <tr>
      <td style="padding:26px 36px">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-size:14px;color:${C.ink}">
          <tr><td style="padding:5px 0;width:150px;color:${C.muted}">Order</td><td style="padding:5px 0;font-weight:700">${esc(o.id || 'â€”')}</td></tr>
          <tr><td style="padding:5px 0;color:${C.muted}">Customer</td><td style="padding:5px 0">${esc(o.customerName || 'â€”')}</td></tr>
          <tr><td style="padding:5px 0;color:${C.muted}">Email</td><td style="padding:5px 0">${esc(o.customerEmail || 'â€”')}</td></tr>
          ${o.customerPhone ? `<tr><td style="padding:5px 0;color:${C.muted}">Phone</td><td style="padding:5px 0">${esc(o.customerPhone)}</td></tr>` : ''}
          <tr><td style="padding:5px 0;color:${C.muted}">Total</td><td style="padding:5px 0;font-weight:700;color:${C.brand}">${money(o.total)}</td></tr>
          <tr><td style="padding:5px 0;color:${C.muted}">Payment</td><td style="padding:5px 0">${esc(o.paymentMode || 'â€”')}</td></tr>
          ${o.orderDate ? `<tr><td style="padding:5px 0;color:${C.muted}">Placed</td><td style="padding:5px 0">${esc(o.orderDate)}</td></tr>` : ''}
          ${mTrack ? `<tr><td style="padding:5px 0;color:${C.muted}">Tracking</td><td style="padding:5px 0">${mTrack}</td></tr>` : ''}
        </table>
        ${mItems ? `
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${C.cream};border-radius:10px;margin:16px 0 0 0">
          <tr><td style="padding:12px 16px">
            <div style="font-size:11px;letter-spacing:2px;color:${C.goldDark};font-weight:700;margin-bottom:6px">ITEMS</div>
            <ul style="margin:0;padding-left:18px;font-size:13.5px;color:${C.ink}">${mItems}</ul>
          </td></tr>
        </table>` : ''}
        <div style="text-align:center;margin:24px 0 4px 0">
          <a href="${APP_ORIGIN}/#/order-manage/${encodeURIComponent(o.id || '')}" style="display:inline-block;background:${C.brand};color:#fff;text-decoration:none;padding:12px 34px;border-radius:50px;font-size:13px;font-weight:600;letter-spacing:0.5px">OPEN ORDER â†’</a>
        </div>
      </td>
    </tr>
    <tr>
      <td style="background:${C.brandSoft};padding:18px 40px;text-align:center">
        <p style="margin:0;font-size:11px;color:#9a8f93">Internal notification Â· ${esc(STORE_NAME)}</p>
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
