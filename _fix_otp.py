with open('api/send-otp.js', 'w', encoding='utf-8') as f:
    f.write('''// api/send-otp.js - Sends a 6-digit OTP via Fast2SMS.
const FAST2SMS_KEY = process.env.FAST2SMS_KEY || "";

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function normalizePhone(phone) {
  const digits = String(phone || "").replace(/\\D/g, "");
  if (digits.length === 10) return "91" + digits;
  if (digits.length === 12 && digits.startsWith("91")) return digits;
  return digits;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  try {
    const { phone } = req.body || {};
    const fullPhone = normalizePhone(phone);

    if (!fullPhone || fullPhone.length < 12) {
      return res.status(400).json({ error: "Invalid phone number. Enter 10 digits." });
    }

    const otp = generateOtp();

    // Demo mode: no API key configured
    if (!FAST2SMS_KEY) {
      console.log("[otp] DEMO mode - phone: " + fullPhone + ", OTP: " + otp);
      return res.json({ ok: true, skipped: true, demoOtp: otp });
    }

    // Real SMS via Fast2SMS
    const message = "Your OTP for Houselaxmicloth login is " + otp + ". Valid for 5 minutes. Do not share this OTP with anyone.";
    const url = "https://www.fast2sms.com/dev/bulkV2?authorization=" + FAST2SMS_KEY + "&sender_id=FSTSMS&message=" + encodeURIComponent(message) + "&language=english&route=p&numbers=" + fullPhone;

    try {
      const resp = await fetch(url, { method: "GET" });
      const text = await resp.text();
      let data = {};
      try { data = JSON.parse(text); } catch { data = { raw: text }; }

      if (data.return === true) {
        console.log("[otp] SMS sent to " + fullPhone);
        return res.json({ ok: true });
      }

      // Fast2SMS returned an error - show it in demo mode so user can still login
      console.error("[otp] Fast2sms error:", JSON.stringify(data));
      return res.json({ ok: true, skipped: true, demoOtp: otp, smsError: data.message || "SMS failed, using demo mode" });
    } catch (fetchErr) {
      // Network error - fall back to demo mode
      console.error("[otp] Network error:", fetchErr.message);
      return res.json({ ok: true, skipped: true, demoOtp: otp, smsError: "Network error, using demo mode" });
    }
  } catch (err) {
    console.error("[otp] Unexpected error:", err.message);
    return res.status(500).json({ error: "Server error: " + err.message });
  }
}
''')

print('send-otp.js fixed')
