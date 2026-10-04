// WhatsApp Cloud API webhook — delivery receipts + incoming messages.
//
// GET  /api/whatsapp-webhook  -> Meta verification handshake.
// POST /api/whatsapp-webhook  -> Meta event pushes (statuses + messages).
//
// After deploy, subscribe in Meta App Dashboard:
//   WhatsApp -> Configuration -> Webhook -> Callback URL + Verify token.
// Env: WHATSAPP_VERIFY_TOKEN (must match the token pasted in Meta).

const VERIFY_TOKEN = String(
  process.env.WHATSAPP_VERIFY_TOKEN || 'laxmi-wa-verify-7X9k2Q8m'
).trim();

function logStatus(s) {
  const id = s?.id || s?.message_id || '?';
  const st = s?.status || '?';
  const to = s?.recipient_id || '?';
  const ts = s?.timestamp ? new Date(Number(s.timestamp) * 1000).toISOString() : '';
  const err = s?.errors?.[0];
  console.log(
    `[whatsapp-webhook] status=${st} msgId=${id} to=${to} ${ts}` +
      (err ? ` ERROR ${err.code} ${err.title || ''} ${err.message || err.error_data?.details || ''}` : '')
  );
}

function logMessage(m) {
  const from = m?.from || '?';
  const type = m?.type || '?';
  const ts = m?.timestamp ? new Date(Number(m.timestamp) * 1000).toISOString() : '';
  const text = m?.text?.body || m?.button?.text || m?.interactive?.button_reply?.title || '';
  console.log(`[whatsapp-webhook] inbound type=${type} from=${from} ${ts} text=${JSON.stringify(text)}`);
}

export default async function handler(req, res) {
  // ---- Verification handshake (Meta calls this once on Subscribe) ----
  if (req.method === 'GET') {
    const q = req.query || {};
    const mode = q['hub.mode'];
    const token = q['hub.verify_token'];
    const challenge = q['hub.challenge'];
    if (mode === 'subscribe' && token === VERIFY_TOKEN && challenge) {
      console.log('[whatsapp-webhook] verified OK');
      res.setHeader('Content-Type', 'text/plain');
      return res.status(200).send(challenge);
    }
    console.log('[whatsapp-webhook] verify FAILED (token mismatch)');
    return res.status(403).send('Forbidden');
  }

  // ---- Event notifications ----
  if (req.method === 'POST') {
    try {
      let body = req.body;
      // Vercel usually parses JSON already; handle raw string just in case.
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch { body = {}; }
      }
      const entries = body?.entry || [];
      for (const e of entries) {
        for (const c of e?.changes || []) {
          const v = c?.value || {};
          for (const s of v?.statuses || []) logStatus(s);
          for (const m of v?.messages || []) logMessage(m);
          if (!v?.statuses?.length && !v?.messages?.length) {
            console.log('[whatsapp-webhook] event:', JSON.stringify(v).slice(0, 500));
          }
        }
      }
    } catch (err) {
      console.error('[whatsapp-webhook] parse error:', err?.message || err);
    }
    // Always 200 fast — Meta retries on anything else.
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
