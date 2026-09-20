import React, { useEffect, useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function Login() {
  const { login, sendPasswordReset, user, loading } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [form, setForm] = useState({ email: "", password: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const from = loc.state?.from || "/";
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  // Already signed in? A refresh on a guarded page used to drop the visitor
  // here while Firebase was still restoring the session — send them straight
  // on to where they were headed instead of showing the login form again.
  useEffect(() => {
    if (loading || !user) return;
    nav(from && from !== "/login" ? from : "/", { replace: true });
  }, [loading, user, from, nav]);

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

  return (
    <main className="page auth">
      <div className="auth-card">
        <h1>Welcome</h1>
        <p className="muted">Log in or sign up to continue shopping</p>

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

        <p className="muted center">New here? <Link to="/signup">Create an account</Link></p>
      </div>
    </main>
  );
}
