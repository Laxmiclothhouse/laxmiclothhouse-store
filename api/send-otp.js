// api/send-otp.js - Sends a 6-digit OTP via Fast2SMS.
const FAST2SMS_KEY = process.env.FAST2SMS_KEY || "";

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function normalizePhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length === 10) return "91" + digits;
  if (digits.length === 12 && digits.startsWith("91")) return digits;
  return digits;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const { phone } = req.body || {};
    const fullPhone = normalizePhone(phone);
    if (!fullPhone || fullPhone.length < 12) return res.status(400).json({ error: "Invalid phone number" });
    const otp = generateOtp();
    if (!FAST2SMS_KEY) {
      console.log("[otp] skipped (no FAST2SMS_KEY): " + fullPhone + " OTP " + otp);
      return res.json({ ok: true, skipped: true, demoOtp: otp });
    }
    const message = "Your OTP for Houselaxmicloth login is " + otp + ". Valid for 5 minutes. Do not share.";
    const url = "https://www.fast2sms.com/dev/bulkV2?authorization=" + FAST2SMS_KEY + "&sender_id=FSTSMS&message=" + encodeURIComponent(message) + "&language=english&route=p&numbers=" + fullPhone;
    const resp = await fetch(url, { method: "GET" });
    const data = await resp.json();
    if (data.return === true || resp.ok) {
      return res.json({ ok: true, otp });
    } else {
      console.error("[otp] fast2sms error:", data);
      return res.status(500).json({ error: "Failed to send OTP" });
    }
  } catch (err) {
    console.error("[otp] send error:", err.message);
    return res.status(500).json({ error: "Failed to send OTP" });
  }
}
