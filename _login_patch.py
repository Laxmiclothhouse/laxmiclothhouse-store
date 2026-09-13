with open('src/pages/Login.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add sendPasswordReset to useAuth destructure
content = content.replace(
    'const { login, loginWithPhone, sendOtp } = useAuth();',
    'const { login, loginWithPhone, sendOtp, sendPasswordReset } = useAuth();'
)

# 2. Add forgot password state variables
content = content.replace(
    'const [demoOtp, setDemoOtp] = useState("");',
    'const [demoOtp, setDemoOtp] = useState("");\n  const [showForgot, setShowForgot] = useState(false);\n  const [resetSent, setResetSent] = useState(false);'
)

# 3. Add handleForgotPassword function before the fill function
forgot_fn = '''  const handleForgotPassword = async (e) => {
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

  const fill = (email, pass) => { setForm({ ...form, email, password: pass }); setTab("email"); };'''

content = content.replace(
    'const fill = (email, pass) => { setForm({ ...form, email, password: pass }); setTab("email"); };',
    forgot_fn
)

# 4. Replace the email tab section with forgot password flow
old_email_tab = '''        {tab === "email" && (
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
          </form>
        )}'''

new_email_tab = '''        {tab === "email" && (
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
        )}'''

content = content.replace(old_email_tab, new_email_tab)

with open('src/pages/Login.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print('Login.jsx patched with forgot password')
