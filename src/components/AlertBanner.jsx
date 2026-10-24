import React, { useEffect, useState } from 'react';

function parts(msLeft) {
  const s = Math.max(0, Math.floor(msLeft / 1000));
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), sec: s % 60 };
}
function pad(n) { return String(n).padStart(2, '0'); }
function fmt(p) {
  if (p.d > 0) return `${p.d}d ${pad(p.h)}:${pad(p.m)}:${pad(p.sec)}`;
  return `${pad(p.h)}:${pad(p.m)}:${pad(p.sec)}`;
}

const TYPE_STYLE = {
  announcement: 'linear-gradient(90deg,#0f766e,#0ea5e9)',
  sale_start: 'linear-gradient(90deg,#2563eb,#7c3aed)',
  flash_sale: 'linear-gradient(90deg,#dc2626,#f59e0b)',
  maintenance: 'linear-gradient(90deg,#374151,#6b7280)',
  new_arrival: 'linear-gradient(90deg,#16a34a,#14b8a6)',
};

export default function AlertBanner({ alerts = [] }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((x) => x + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const now = Date.now();
  const visible = (alerts || []).filter((a) => {
    if (a.active === false) return false;
    if (a.endsAt && new Date(a.endsAt).getTime() <= now) return false;
    return true;
  });

  if (!visible.length) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {visible.map((a) => {
        const startMs = a.startsAt ? new Date(a.startsAt).getTime() - now : 0;
        const endMs = a.endsAt ? new Date(a.endsAt).getTime() - now : 0;
        const upcoming = a.startsAt && new Date(a.startsAt).getTime() > now;
        const targetMs = upcoming ? startMs : (a.endsAt ? endMs : 0);
        const showTimer = (upcoming || a.endsAt) && targetMs > 0;
        const label = upcoming ? 'Starts in' : (a.endsAt ? 'Ends in' : '');
        return (
          <div
            key={a.id}
            className="alert-banner"
            style={{ background: TYPE_STYLE[a.type] || TYPE_STYLE.announcement }}
          >
            <span className="alert-banner-msg">{a.message}</span>
            {showTimer && (
              <span className="alert-banner-timer">
                {label}: {fmt(parts(targetMs))}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
