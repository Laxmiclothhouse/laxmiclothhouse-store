import React, { useEffect, useState } from 'react';

// Site-wide alert announcing a sale that starts in the future. Admin sets
// the message + start time in Settings → "Sale start alert". Auto-hides once
// the start time has passed (on every visitor's screen, no admin action).
function parts(msLeft) {
  const s = Math.max(0, Math.floor(msLeft / 1000));
  return {
    d: Math.floor(s / 86400),
    h: Math.floor((s % 86400) / 3600),
    m: Math.floor((s % 3600) / 60),
    s: s % 60,
  };
}

export default function SaleStartBanner({ alert }) {
  const a = alert || {};
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!a.active) return undefined;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [a.active]);

  if (!a.active) return null;
  const message = String(a.message || '').trim();
  if (!message) return null;
  const starts = a.startsAt ? new Date(a.startsAt).getTime() : 0;
  if (!starts || starts <= now) return null;

  const left = parts(starts - now);
  const pad = (n) => String(n).padStart(2, '0');

  return (
    <div className="sale-start-banner" role="status">
      <span className="sale-start-msg">🗓️ {message}</span>
      <span className="sale-start-timer" aria-label="Time until sale starts">
        Starts in {left.d > 0 && `${left.d}d `}{pad(left.h)}:{pad(left.m)}:{pad(left.s)}
      </span>
    </div>
  );
}
