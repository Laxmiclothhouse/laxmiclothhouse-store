import React, { useEffect, useState } from 'react';

// Flash sale banner with a live countdown. Shown on every page below the
// top strip. Auto-expires: once settings.flashSale.endsAt passes, it hides
// itself for everyone (no admin action needed).
function parts(msLeft) {
  const s = Math.max(0, Math.floor(msLeft / 1000));
  return {
    d: Math.floor(s / 86400),
    h: Math.floor((s % 86400) / 3600),
    m: Math.floor((s % 3600) / 60),
    s: s % 60,
  };
}

export default function FlashBanner({ flashSale }) {
  const fs = flashSale || {};
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!fs.active) return undefined;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [fs.active]);

  if (!fs.active) return null;
  // A promotion must actually be written down: an "active" flag left on with
  // no message (or a stale one in the database) must never show a sale
  // banner that the admin did not create.
  const message = String(fs.message || '').trim();
  if (!message) return null;
  const ends = fs.endsAt ? new Date(fs.endsAt).getTime() : 0;
  if (!ends || ends <= now) return null; // expired — gone on every screen

  const left = parts(ends - now);
  const pad = (n) => String(n).padStart(2, '0');

  return (
    <div className="flash-banner" role="status">
      <span className="flash-msg">🔥 {message}</span>
      <span className="flash-timer" aria-label="Time remaining">
        {left.d > 0 && `${left.d}d `}
        {pad(left.h)}:{pad(left.m)}:{pad(left.s)}
      </span>
    </div>
  );
}