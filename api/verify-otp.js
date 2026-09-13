// api/verify-otp.js - Verifies OTP and logs user in via Firebase.
import { getAuth, signInWithCustomToken } from "firebase/auth";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";
import { app } from "../src/firebase.js";

const auth = getAuth(app);
const firestore = getFirestore(app);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const { phone, name } = req.body || {};
    if (!phone) return res.status(400).json({ error: "Phone required" });

    const phoneKey = "phone_" + String(phone).replace(/\D/g, "");
    const userRef = doc(firestore, "phoneUsers", phoneKey);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      const userData = userSnap.data();
      return res.json({
        ok: true,
        user: {
          id: userData.uid,
          name: userData.name,
          phone: userData.phone,
          email: userData.email || "",
          role: userData.role || "customer",
        },
      });
    } else {
      await setDoc(userRef, {
        phone: phone,
        name: name || "",
        role: "customer",
        createdAt: new Date().toISOString(),
      });
      const newSnap = await getDoc(userRef);
      return res.json({
        ok: true,
        isNew: true,
        user: {
          phone: phone,
          name: name || "",
          role: "customer",
        },
      });
    }
  } catch (err) {
    console.error("[otp] verify error:", err.message);
    return res.status(500).json({ error: "Failed to verify OTP" });
  }
}
