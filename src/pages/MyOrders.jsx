import React from 'react';
import { Navigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useData } from '../context/DataContext.jsx';
import { formatINR, formatDateTime } from '../utils/format.js';

export default function MyOrders() {
  const { user } = useAuth();
  const { orders, canCancel } = useData();
  const location = useLocation();
  const justCancelled = location.state?.cancelledOrder;
  const justRefund = location.state?.refundInfo;

  if (!user) {
    return <Navigate to="/login" replace state={{ from: '/orders' }} />;
  }

  const mine = orders.filter(
    (o) =>
      o.userId === user.id ||
      (o.customerEmail &&
        o.customerEmail.toLowerCase() === user.email.toLowerCase())
  );

  return (
    <main className="page">
      <div className="page-head">
        <h1>My Orders</h1>
        <p>Your complete order history</p>
        {justCancelled && (
          <div className='card-box' style={{ borderLeft: '4px solid var(--ok)', marginTop: 12 }}>
            <p><strong>Order {justCancelled} cancelled.</strong></p>
            {justRefund?.type === 'razorpay_refund' ? (
              <p className='muted'>Refund initiated{justRefund.refundId ? ` (ID: ${justRefund.refundId})` : ''}. The money will be credited back to the same account or payment method you used for this order in 5-7 working days.</p>
            ) : (
              <p className='muted'>No online payment was made for this order, so no refund was needed.</p>
            )}
          </div>
        )}
      </div>

      {mine.length === 0 ? (
        <div className="center empty">
          <p>You haven't placed any orders yet.</p>
          <Link to="/catalog" className="btn btn-gold">Start shopping</Link>
        </div>
      ) : (
        <div className="orders-list">
          {mine.map((o) => {
            const eligible = o && canCancel(o);
            return (
              <div className="order-row" key={o.id}>
                <div className="ord-head">
                  <strong>Order {o.id}</strong>
                  <span className="muted">{formatDateTime(o.orderDate)}</span>
                  <span className={`status-badge ${o.status}`}>{o.status.toUpperCase()}</span>
                  <span className="ord-total">{formatINR(o.total)} · {o.payment.mode}</span>
                </div>
                <div className="ord-body">
                  <div>
                    <ul className="sum-items">
                      {o.items.map((it) => (
                        <li key={it.id}><span>{it.name} × {it.qty}</span><span>{formatINR(it.price * it.qty)}</span></li>
                      ))}
                    </ul>
                    <p className="muted">
                      Shipped to {o.shipping?.address}, {o.shipping?.city} — {o.shipping?.pincode}
                    </p>
                  </div>
                  <div className="ord-actions">
                    <Link to={`/track?order=${o.id}`} className="btn btn-sm">Track order</Link>
                    {eligible ? (
                      <Link to={`/track?order=${o.id}`} className="btn btn-sm btn-ghost">Cancel / refund</Link>
                    ) : o.status === 'cancelled' ? null : (
                      <span className="muted tiny">Can't cancel</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}