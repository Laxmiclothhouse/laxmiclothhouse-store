import React from 'react';
import { Navigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useData } from '../context/DataContext.jsx';
import { formatINR, formatDateTime } from '../utils/format.js';
import { FLOW, payMeta, roleQueueScope } from '../orderFlow.js';

// Step 3 of the portal plan: the live staff dashboard.
// Real-time counters (via the existing Firestore-backed DataContext)
// so packers/shippers always see their queue at a glance.
export default function StaffDashboard() {
  const { user, isStaff } = useAuth();
  const { orders } = useData();

  if (!user) return <Navigate to="/login" replace state={{ from: '/dashboard' }} />;
  if (!isStaff) return <Navigate to="/" replace />;

  const list = orders || [];
  const scope = roleQueueScope(user?.role);
  const byStatus = {};
  list.forEach((o) => { byStatus[o.status] = (byStatus[o.status] || 0) + 1; });
  const unpaid = list.filter((o) => !payMeta(o).paid).length;
  const today = new Date().toISOString().slice(0, 10);
  const todayOrders = list.filter((o) => String(o.orderDate || '').slice(0, 10) === today).length;
  const revenue = list
    .filter((o) => o.status !== 'cancelled' && payMeta(o).paid)
    .reduce((sum, o) => sum + (Number(o.total) || 0), 0);

  const cards = [
    // Role-scoped hero cards: packers see "to pack", shippers "to ship".
    ...(scope
      ? [{
          key: 'mine',
          num: list.filter((o) => scope.statuses.includes(o.status)).length,
          lbl: scope.title,
          hero: true,
        }]
      : []),
    ...FLOW.map((s) => ({ key: s.status, num: byStatus[s.status] || 0, lbl: s.label })),
    { key: 'cancelled', num: byStatus.cancelled || 0, lbl: 'Cancelled' },
    { key: 'unpaid', num: unpaid, lbl: 'Payment pending', warn: true },
    { key: 'today', num: todayOrders, lbl: 'Orders today' },
  ];

  // Role-scoped recent list: packers see confirmed orders, shippers packed ones.
  const recent = (scope ? list.filter((o) => scope.statuses.includes(o.status)) : list)
    .sort((a, b) => String(b.orderDate || '').localeCompare(String(a.orderDate || '')))
    .slice(0, 8);

  return (
    <main className="page">
      <div className="page-head">
        <h1>Live order board</h1>
        <p>
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
          {' · '}Paid revenue to date: <strong>{formatINR(revenue)}</strong>
        </p>
      </div>

      <div className="dash-grid">
        {cards.map((c) => (
          <div key={c.key} className={`stat-card${c.warn ? ' warn' : ''}${c.hero ? ' hero' : ''}`}>
            <div className="num">{c.num}</div>
            <div className="lbl">{c.lbl}</div>
          </div>
        ))}
      </div>

      <section className="card-box">
        <h2>{scope ? scope.title : 'Recent orders'}</h2>
        {recent.length === 0 ? (
          <p className="muted">
            {scope ? scope.empty : 'No orders yet. New orders will appear here in real time.'}
          </p>
        ) : (
          <div className="orders-list">
            {recent.map((o) => {
              const pay = payMeta(o);
              return (
                <div className="order-row" key={o.id}>
                  <div className="ord-head">
                    <Link to={`/order-manage/${o.id}`} className="linklike" style={{ fontWeight: 700 }}>
                      {o.id}
                    </Link>
                    <span className="muted">{formatDateTime(o.orderDate)}</span>
                    <span className={`status-badge ${o.status}`}>{o.status}</span>
                    <span className={`pay-badge ${pay.cls}`}>{pay.label}</span>
                    <span className="ord-total">{formatINR(o.total)}</span>
                  </div>
                  <div className="ord-body">
                    <div>
                      <p className="muted">
                        {o.customer?.name}{o.customer?.phone ? ` · ${o.customer.phone}` : ''}
                      </p>
                      {o.trackingNo && (
                        <p className="muted tiny">📦 {o.courier || 'Courier'} · {o.trackingNo}</p>
                      )}
                    </div>
                    <div className="ord-actions">
                      <Link to={`/order-manage/${o.id}`} className="linklike">Open →</Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div className="row-gap" style={{ marginTop: 14 }}>
          <Link to="/admin" className="btn btn-gold">Open the orders queue →</Link>
        </div>
      </section>
    </main>
  );
}
