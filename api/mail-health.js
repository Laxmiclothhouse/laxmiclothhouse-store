// ─────────────────────────────────────────────────────────────
// api/mail-health.js — GET /api/mail-health
// Diagnoses why order e-mails may not be reaching customers.
//
// The most common cause: MAIL_FROM is still Resend's shared
// onboarding@resend.dev address. Resend only delivers that address
// to the Resend account owner, so real customers get nothing until
// a domain you own is verified at https://resend.com/domains.
//
// The API key itself is never returned.
// ─────────────────────────────────────────────────────────────

const KEY = process.env.RESEND_API_KEY || '';
const MAIL_FROM = (process.env.MAIL_FROM || 'onboarding@resend.dev').trim();
const MERCHANT_EMAIL = (process.env.MERCHANT_EMAIL || '').trim();
const STORE_NAME = process.env.STORE_NAME || '';
const APP_ORIGIN = process.env.APP_ORIGIN || '';

export default async function handler(req, res) {
  const fromDomain = String(MAIL_FROM).split('@')[1] || '';
  const sandbox = /resend\.dev$/i.test(fromDomain);

  const report = {
    resendKeyConfigured: Boolean(KEY),
    mailFrom: MAIL_FROM,
    storeName: STORE_NAME || null,
    appOrigin: APP_ORIGIN || null,
    merchantEmailConfigured: Boolean(MERCHANT_EMAIL),
    mailFromIsResendSandbox: sandbox,
    readyToEmailCustomers: false,
    problems: [],
    hint: '',
  };

  if (!KEY) {
    report.problems.push(
      'RESEND_API_KEY is not set — every order e-mail is skipped. ' +
      'Add it in Vercel → Project → Settings → Environment Variables, then redeploy.'
    );
  }

  if (sandbox) {
    report.problems.push(
      'MAIL_FROM is the shared resend.dev sandbox address. Resend only delivers it to the ' +
      'Resend account owner, so customer addresses are rejected with HTTP 403.'
    );
    report.hint =
      'Verify a domain at https://resend.com/domains, then set MAIL_FROM to an address on it ' +
      '(e.g. orders@houselaxmicloth.store) and redeploy.';
  }

  // When the key is present, ask Resend which domains are actually verified.
  if (KEY) {
    try {
      const resp = await fetch('https://api.resend.com/domains', {
        headers: { Authorization: `Bearer ${KEY}` },
      });
      if (!resp.ok) {
        report.problems.push(`Resend rejected the API key (HTTP ${resp.status}).`);
      } else {
        const json = await resp.json().catch(() => ({}));
        const domains = Array.isArray(json?.data) ? json.data : [];
        report.verifiedDomains = domains
          .filter((d) => d && d.status === 'verified')
          .map((d) => d.name);
        report.anyVerifiedDomain = report.verifiedDomains.length > 0;

        const fromDomainVerified = domains.some(
          (d) => d && d.status === 'verified' && String(d.name).toLowerCase() === fromDomain.toLowerCase()
        );
        report.mailFromDomainVerified = fromDomainVerified;

        if (!fromDomainVerified && !sandbox) {
          report.problems.push(
            `The domain in MAIL_FROM ("${fromDomain}") is not verified in Resend. ` +
            'Sends from an unverified domain are rejected.'
          );
        }
        report.readyToEmailCustomers = report.resendKeyConfigured && fromDomainVerified;
      }
    } catch (err) {
      report.problems.push('Could not reach the Resend API: ' + err.message);
    }
  }

  if (!MERCHANT_EMAIL) {
    report.problems.push(
      'MERCHANT_EMAIL is not set — no store-owner copy of order e-mails will be sent.'
    );
  }

  res.status(200).json(report);
}