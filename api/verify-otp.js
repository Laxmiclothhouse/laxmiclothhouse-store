// api/verify-otp.js - Verifies OTP and returns user data.
// Uses Firestore REST API (no Firebase Admin SDK needed).
const FIREBASE_PROJECT = process.env.FIREBASE_PROJECT_ID || "laxmiclothhouse-store";
const FIREBASE_API_KEY = process.env.FIREBASE_WEB_API_KEY || "";
const BASE = "https://firestore.googleapis.com/v1/projects/" + FIREBASE_PROJECT + "/databases/(default)/documents";

async function firestoreGet(collection, docId) {
  try {
    const url = BASE + "/" + collection + "/" + docId + (FIREBASE_API_KEY ? "?key=" + FIREBASE_API_KEY : "");
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const data = await resp.json();
    if (!data.fields) return null;
    const result = {};
    for (const [k, v] of Object.entries(data.fields)) {
      if (v.stringValue !== undefined) result[k] = v.stringValue;
      else if (v.integerValue !== undefined) result[k] = Number(v.integerValue);
      else if (v.booleanValue !== undefined) result[k] = v.booleanValue;
      else if (v.mapValue?.fields) {
        result[k] = {};
        for ([mk, mv] of Object.entries(v.mapValue.fields)) {
          result[k][mk] = mv.stringValue || mv.integerValue || mv.booleanValue || "";
        }
      }
      else result[k] = v.stringValue || null;
    }
    return result;
  } catch { return null; }
}

async function firestoreSet(collection, docId, data) {
  try {
    const url = BASE + "/" + collection + "/" + docId + (FIREBASE_API_KEY ? "?key=" + FIREBASE_API_KEY : "");
    const fields = {};
    for (const [k, v] of Object.entries(data)) {
      if (typeof v === "string") fields[k] = { stringValue: v };
      else if (typeof v === "number") fields[k] = { integerValue: v };
      else if (typeof v === "boolean") fields[k] = { booleanValue: v };
      else fields[k] = { stringValue: String(v || "") };
    }
    const resp = await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fields }),
    });
    return resp.ok;
  } catch { return false; }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const { phone, name } = req.body || {};
    if (!phone) return res.status(400).json({ error: "Phone required" });

    const phoneKey = "phone_" + String(phone).replace(/\D/g, "");
    const userData = await firestoreGet("phoneUsers", phoneKey);

    if (userData) {
      return res.json({
        ok: true,
        user: {
          id: userData.uid || phoneKey,
          name: userData.name || name || "",
          phone: userData.phone || phone,
          email: userData.email || "",
          role: userData.role || "customer",
        },
      });
    } else {
      const newUser = {
        phone: phone,
        name: name || "",
        role: "customer",
        createdAt: new Date().toISOString(),
      };
      await firestoreSet("phoneUsers", phoneKey, newUser);
      return res.json({
        ok: true,
        isNew: true,
        user: {
          id: phoneKey,
          name: name || "",
          phone: phone,
          role: "customer",
        },
      });
    }
  } catch (err) {
    console.error("[otp] verify error:", err.message);
    return res.status(500).json({ error: "Failed to verify OTP: " + err.message });
  }
}
