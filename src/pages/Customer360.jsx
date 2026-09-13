import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useData } from '../context/DataContext.jsx';
import { formatINR, formatDateTime } from '../utils/format.js';
import { Navigate, Link } from 'react-router-dom';

export default function Customer360() {
  const { user, isStaff } = useAuth();
  const { orders, returns } = useData();
  const [query, setQuery] = useState('');
  const [customer, setCustomer] = useState(null);

  if (!user || !isStaff) {
    return <Navigate to="/admin" replace />;
  }

  const search = (e) => {
    e.preventDefault();
    const q = query.trim().toLowerCase();
    if (!q) return;
    const matches = orders.filter((o) => {
      const email = (o.customerEmail || o.customer?.email || '').toLowerCase();
      const phone = (o.phone || o.customer?.phone || '').replace(/\D/g, '');
      return email === q || (phone && phone === q.replace(/\D/g, ''));
    });
    if (matches.length === 0) {
      setCustomer({ error: 'No customer found with that email or phone.' });
      return;
    }
    const totalSpent = matches.reduce((s, o) => s + (o.total || 0), 0);
    const orderCount = matches.length;
    const returnsCount = matches.filter((o) => returns.some((r) => r.orderId === o.id)).length;
    const lastOrder = matches.sort((a, b) => new Date(b.orderDate) - new Date(a.orderDate))[0];
    setCustomer({
      name: lastOrder.customer?.name || lastOrder.customerName || 'Unknown',
      email: lastOrder.customerEmail || lastOrder.customer?.email || 'N/A',
      phone: lastOrder.phone || lastOrder.customer?.phone || 'N/A',
      totalSpent, orderCount, returnsCount,
      avgOrder: orderCount > 0 ? totalSpent / orderCount : 0,
      orders: matches.sort((a, b) => new Date(b.orderDate) - new Date(a.orderDate)),
    });
  };

  return (
    <main className="admin-main">
      <div className="admin-header">
        <h1>Customer 360</h1>
        <Link to="/admin" className="chip"> Back to admin</Link>
      </div>
      <section className="card-box">
        <h2>Search customer</h2>
        <form onSubmit={search} className="cust-search">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Enter customer email or phone number" />
          <button type="submit" className="btn btn-gold">Search</button>
        </form>
      </section>
      {customer?.error && <section className="card-box"><p className="error">{customer.error}</p></section>}
      {customer && !customer.error && (
        <>
          <section className="card-box">
            <h2>Customer profile</h2>
            <div className="cust-profile">
              <div className="cust-field"><span className="cust-label">Name</span><span className="cust-value">{customer.name}</span></div>
              <div className="cust-field"><span className="cust-label">Email</span><span className="cust-value">{customer.email}</span></div>
              <div className="cust-field"><span className="cust-label">Phone</span><span className="cust-value">{customer.phone}</span></div>
              <div className="cust-field"><span className="cust-label">Total spent</span><span className="cust-value">{formatINR(customer.totalSpent)}</span></div>
              <div className="cust-field"><span className="cust-label">Orders</span><span className="cust-value">{customer.orderCount}</span></div>
              <div className="cust-field"><span className="cust-label">Avg. order</span><span className="cust-value">{formatINR(customer.avgOrder)}</span></div>
              <div className="cust-field"><span className="cust-label">Returns</span><span className="cust-value">{customer.returnsCount}</span></div>
            </div>
          </section>
          <section className="card-box">
            <h2>Order history ({customer.orders.length})</h2>
            <div className="table-scroll">
              <table className="table">
                <thead><tr><th>Order</th><th>Date</th><th>Status</th><th>Total</th><th>Payment</th></tr></thead>
                <tbody>
                  {customer.orders.map((o) => (
                    <tr key={o.id}>
                      <td><Link to={`/order-manage/${o.id}`} className="linklike">{o.id}</Link></td>
                      <td>{formatDateTime(o.orderDate)}</td>
                      <td>{o.status}</td>
                      <td>{formatINR(o.total)}</td>
                      <td>{o.payment?.mode || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
