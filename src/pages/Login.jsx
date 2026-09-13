import React, { useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

const DEMO = [
  { label: "Admin", email: "admin@houselaxmicloth.store", pass: "admin123" },
];

export default function Login() {
  const { login, loginWithPhone, sendOtp, sendPasswordReset } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [tab, setTab] = useState("phone");
  const [form, setForm] = useState({ email: "", password: "", phone: "", name: "" });
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpTimer, setOtpTimer] = useState(0);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [demoOtp, setDemoOtp] = useState("");
  const [showForgot, setShowForgot] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const from = loc.state?.from || "/";
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (!form.phone || form.phone.length < 10) { setErr("Enter a valid 10-digit phone"); return; }
    setErr(""); setBusy(true);
    try {
      const res = await sendOtp(form.phone);
      setOtpSent(true); setOtpTimer(30);
      if (res.demoOtp) setDemoOtp(res.demoOtp);
      const interval = setInterval(() => {
        setOtpTimer((t) => { if (t <= 1) { clearInterval(interval); return 0; } return t - 1; });
      }, 1000);
    } catch (ex) { setErr(ex.message); } finally { setBusy(false); }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!otp || otp.length !== 6) { setErr("Enter the 6-digit OTP"); return; }
    setErr(""); setBusy(true);
    try { await loginWithPhone(form.phone, form.name); nav(from, { replace: true }); }
    catch (ex) { setErr(ex.message); } finally { setBusy(false); }
  };

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    if (busy) return; setErr(""); setBusy(true);
    try { await login({ email: form.email, password: form.password }); nav(from, { replace: true }); }
    catch (ex) { setErr(ex.message); } finally { setBusy(false); }
  };

    const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!form.email) { setErr("Enter your email address"); return; }
    setErr(""); setBusy(true);
    try {
      await sendPasswordReset(form.email);
      setResetSent(true);
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setBusy(false);
    }
  };

  const fill = (email, pass) => { setForm({ ...form, email, password: pass }); setTab("email"); };

  return (
    <main className="page auth">
      <div className="auth-card">
        <h1>Welcome</h1>
        <p className="muted">Log in or sign up to continue shopping</p>
        <div className="auth-tabs">
          <button className={tab === "phone" ? "chip active" : "chip"} onClick={() => { setTab("phone"); setErr(""); }}>
            Phone OTP
          </button>
          <button className={tab === "email" ? "chip active" : "chip"} onClick={() => { setTab("email"); setErr(""); }}>
            Email
          </button>
        </div>

        {tab === "phone" && (
          <>
            {!otpSent ? (
              <form onSubmit={handleSendOtp} className="form">
                <label>Phone number
                  <input type="tel" required value={form.phone} onChange={set("phone")} placeholder="9876543210" maxLength={10} />
                </label>
                <label>Your name (optional)
                  <input type="text" value={form.name} onChange={set("name")} placeholder="e.g. Priya" />
                </label>
                {err && <p className="error">{err}</p>}
                <button className="btn btn-gold btn-block" type="submit" disabled={busy}>
                  {busy ? "Sending..." : "Send OTP"}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="form">
                <p className="muted center">OTP sent to <strong>{form.phone}</strong></p>
                {demoOtp && <p className="otp-demo">Demo OTP: <strong>{demoOtp}</strong></p>}
                <label>Enter 6-digit OTP
                  <input type="text" required value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="------" maxLength={6} className="otp-input" />
                </label>
                {err && <p className="error">{err}</p>}
                <button className="btn btn-gold btn-block" type="submit" disabled={busy}>
                  {busy ? "Verifying..." : "Verify & Login"}
                </button>
                <div className="otp-resend">
                  {otpTimer > 0 ? <span className="muted">Resend in {otpTimer}s</span> : <button type="button" className="linklike" onClick={handleSendOtp}>Resend OTP</button>}
                </div>
              </form>
            )}
          </>
        )}

        {tab === "email" && (
          <>
            {!showForgot ? (
              <form onSubmit={handleEmailLogin} className="form">
                <label>Email
                  <input type="email" required value={form.email} onChange={set("email")} placeholder="you@example.com" />
                </label>
                <label>Password
                  <input type="password" required value={form.password} onChange={set("password")} placeholder="........" />
                </label>
                {err && <p className="error">{err}</p>}
                <button className="btn btn-gold btn-block" type="submit" disabled={busy}>
                  {busy ? "Logging in..." : "Log in"}
                </button>
                <div className="forgot-row">
                  <button type="button" className="linklike" onClick={() => { setShowForgot(true); setErr(""); }}>
                    Forgot password?
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleForgotPassword} className="form">
                {!resetSent ? (
                  <>
                    <p className="muted center">Enter your email and we'll send you a reset link</p>
                    <label>Email
                      <input type="email" required value={form.email} onChange={set("email")} placeholder="you@example.com" />
                    </label>
                    {err && <p className="error">{err}</p>}
                    <button className="btn btn-gold btn-block" type="submit" disabled={busy}>
                      {busy ? "Sending..." : "Send reset link"}
                    </button>
                  </>
                ) : (
                  <>
                    <p className="ok center">Reset link sent! Check your email inbox.</p>
                    <p className="muted center small">Click the link in the email to reset your password, then come back here to log in.</p>
                  </>
                )}
                <div className="forgot-row">
                  <button type="button" className="linklike" onClick={() => { setShowForgot(false); setResetSent(false); setErr(""); }}>
                    Back to login
                  </button>
                </div>
              </form>
            )}
          </>
        )}

        <p className="muted center">New here? <Link to="/signup">Create an account</Link></p>

        <div className="demo-row">
          <span>Demo:</span>
          {DEMO.map((d) => (
            <button key={d.email} className="chip" disabled={busy} onClick={() => fill(d.email, d.pass)}>{d.label}</button>
          ))}
        </div>
      </div>
    </main>
  );
}
