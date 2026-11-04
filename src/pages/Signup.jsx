import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Signup() {
  const { signup } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', confirm: '', specialDate: '', specialDateType: 'Birthday' });
  const [err, setErr] = useState('');

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    if (form.password !== form.confirm) {
      setErr('Passwords do not match.');
      return;
    }
    if (form.password.length < 6) {
      setErr('Password must be at least 6 characters.');
      return;
    }
    try {
      await signup(form);
      nav('/', { replace: true });
    } catch (ex) {
      setErr(ex.message);
    }
  };

  return (
    <main className="page auth">
      <div className="auth-card">
        <h1>Create account</h1>
        <p className="muted">Join us and start shopping</p>

        <form onSubmit={submit} className="form">
          <label>
            Full name
            <input type="text" required value={form.name}
              onChange={set('name')} placeholder="Your name" />
          </label>
          <label>
            Email
            <input type="email" required value={form.email}
              onChange={set('email')} placeholder="you@example.com" />
          </label>
          <label>
            Phone
            <input type="tel" value={form.phone}
              onChange={set('phone')} placeholder="+91 98765 43210" />
          </label>
         

          <label>
            Password
            <input type="password" required value={form.password}
              onChange={set('password')} placeholder="Min. 6 characters" />
          </label>
          <label>
            Confirm password
            <input type="password" required value={form.confirm}
              onChange={set('confirm')} placeholder="Repeat password" />
          </label>

          {err && <p className="error">{err}</p>}

          <button className="btn btn-gold btn-block" type="submit">Sign up</button>
        </form>

        <p className="muted center">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </div>
    </main>
  );
}