import React, { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useData } from '../context/DataContext.jsx';
import { formatINR, formatDateTime } from '../utils/format.js';
import { Navigate, Link } from 'react-router-dom';
import Paginator from '../components/Paginator.jsx';

export default function Customer360() {
  const { user, isStaff } = useAuth();
  const { orders } = useData();
  const [query, setQuery] = useState('');
  const [customer, setCustomer] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const buildProfile = (matches) => {
    const sorted = [...matches].sort((a, b) => new Date(b.orderDate) - new Date(a.orderDate));
    const lastOrder = sorted[0];
    const totalSpent = matches.reduce((s, o) => s + (o.total || 0), 0);
    const orderCount = matches.length;
    return {
      name: lastOrder.customer?.name || lastOrder.customerName || 'Unknown',
      email: lastOrder.customerEmail || lastOrder.customer?.email || 'N/A',
      phone: lastOrder.phone || lastOrder.customer?.phone || 'N/A',
      totalSpent,
      orderCount,
      avgOrder: orderCount > 0 ? totalSpent / orderCount : 0,
      orders: sorted,
    };
  };

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
    setCustomer(buildProfile(matches));
  };

  // Build a unique list of all customers from orders, with basic stats.
  const allCustomers = useMemo(() => {
    const map = new Map();
    for (const o of orders || []) {
      const email = (o.customerEmail || o.customer?.email || '').trim().toLowerCase();
      const phone = (o.phone || o.customer?.phone || '').replace(/\D/g, '');
      const key = email || phone || o.customer?.name || o.id;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(o);
    }
    return [...map.entries()]
      .map(([key, matches]) => {
        const sorted = [...matches].sort((a, b) => new Date(b.orderDate) - new Date(a.orderDate));
        const last = sorted[0];
        const totalSpent = matches.reduce((s, o) => s + (o.total || 0), 0);
        return {
          key,
          name: last.customer?.name || last.customerName || 'Unknown',
          email: last.customerEmail || last.customer?.email || 'N/A',
          phone: last.phone || last.customer?.phone || 'N/A',
          orderCount: matches.length,
          totalSpent,
          lastOrderDate: last.orderDate,
          orders: sorted,
        };
      })
      .sort((a, b) => new Date(b.lastOrderDate) - new Date(a.lastOrderDate));
  }, [orders]);

  const pages = Math.max(1, Math.ceil(allCustomers.length / pageSize));
  const safePage = Math.min(page, pages);
  const pagedCustomers = allCustomers.slice((safePage - 1) * pageSize, safePage * pageSize);

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

      <section className="card-box">
        <h2>All customers ({allCustomers.length})</h2>
        {allCustomers.length === 0 ? (
          <p className="muted">No customers yet.</p>
        ) : (
          <>
            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Orders</th>
                    <th>Total spent</th>
                    <th>Last order</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {pagedCustomers.map((c) => (
                    <tr key={c.key}>
                      <td>{c.name}</td>
                      <td>{c.email}</td>
                      <td>{c.phone}</td>
                      <td>{c.orderCount}</td>
                      <td>{formatINR(c.totalSpent)}</td>
                      <td>{formatDateTime(c.lastOrderDate)}</td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-sm"
                          onClick={() => setCustomer(buildProfile(c.orders))}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Paginator
              total={allCustomers.length}
              page={safePage}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={(n) => { setPageSize(n); setPage(1); }}
              unit="customers"
            />
          </>
        )}
      </section>
    </main>
  );
}
