import React from 'react';
import { Link } from 'react-router-dom';
import { useData } from '../context/DataContext.jsx';

export default function Policies() {
  const { settings } = useData();
  const name = (settings.storeName || 'Laxmiclothhouse').trim();
  const updated = new Date().toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const items = [
    {
      to: '/terms',
      icon: '📜',
      title: 'Terms & Conditions',
      desc: 'The rules for using our store, placing orders and your account.',
    },
    {
      to: '/privacy',
      icon: '🔒',
      title: 'Privacy Policy',
      desc: 'What we collect, how we use it, and how we protect your data.',
    },
    {
      to: '/cancellation-refund',
      icon: '↩️',
      title: 'Cancellation & Refund',
      desc: 'How to cancel an order and how refunds are processed.',
    },
    {
      to: '/shipping-exchange',
      icon: '🚚',
      title: 'Shipping & Exchange',
      desc: 'Delivery areas, timelines, charges and how exchanges work.',
    },
    {
      to: '/contact',
      icon: '📞',
      title: 'Contact Us',
      desc: 'Reach our team for help with any order or question.',
    },
  ];

  return (
    <main className="page">
      <div className="page-head">
        <h1>Policies</h1>
        <p>
          Everything you need to know about shopping with {name} — all our store
          policies in one place. Last updated {updated}
        </p>
      </div>

      <section className="card-box about">
        <ul className="policy-list">
          {items.map((it) => (
            <li key={it.to}>
              <Link to={it.to} className="policy-card">
                <span className="policy-icon" aria-hidden="true">{it.icon}</span>
                <span className="policy-body">
                  <strong>{it.title}</strong>
                  <span className="muted">{it.desc}</span>
                </span>
                <span className="policy-arrow" aria-hidden="true">›</span>
              </Link>
            </li>
          ))}
        </ul>
        <p className="muted">
          Questions about any of these? <Link to="/contact">Contact us</Link> and
          we'll be happy to help.
        </p>
      </section>
    </main>
  );
}
