// ─────────────────────────────────────────────────────────────
// RequireAuth — gate for pages that need a signed-in visitor.
//
// Firebase restores the session asynchronously, so right after a page
// refresh `user` is null for a moment. Redirecting during that window
// bounced signed-in customers to /login; this gate waits for the
// AuthContext `loading` flag to settle first, then either renders the
// page or sends the visitor to /login with a `from` so they land back
// where they were once they sign in.
// ─────────────────────────────────────────────────────────────
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <main className="page">
        <div className="loading-screen">Checking your session…</div>
      </main>
    );
  }

  if (!user) {
    return (
      <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
    );
  }

  return children;
}