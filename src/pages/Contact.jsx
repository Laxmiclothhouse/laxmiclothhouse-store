import React from 'react';
import { Link } from 'react-router-dom';
import { useData } from '../context/DataContext.jsx';

export default function Contact() {
  const { settings } = useData();
  const name = settings.storeName || 'our store';

  return (
    <main className="page">
      <div className="page-head">
        <h1>Contact Us</h1>
        <p>We're always happy to help — reach us anytime, no form needed</p>
      </div>

      <div className="contact-grid">
        <aside className="card-box contact-info">
          <h2>Reach us directly</h2>
          <p><strong>📞 Phone / WhatsApp</strong><br />
            <a href={`tel:${settings.contactPhone}`}>{settings.contactPhone}</a>
            <span className="muted tiny"> — fastest way to get an answer</span>
          </p>
          <p><strong>✉️ Email</strong><br />
            <a href={`mailto:${settings.contactEmail}`}>{settings.contactEmail}</a>
            <span className="muted tiny"> — we reply within 24 hours</span>
          </p>
          <p><strong>📍 Visit the store</strong><br />{settings.contactAddress}</p>
          <p><strong>🕘 Opening hours</strong><br />Mon – Sat · 10:00 AM – 8:00 PM<br />Sunday · Closed</p>
        </aside>

        <div>
          <section className="card-box">
            <h2>How can we help?</h2>
            <ul className="help-list">
              <li><strong>Order status &amp; tracking</strong> — use the Track Order page with your order ID, or call us with your order number.</li>
              <li><strong>Product questions</strong> — sizing, fabric, colour availability — we know every piece in the store.</li>
              <li><strong>Bulk &amp; occasion orders</strong> — weddings, festivals, family functions — ask about special pricing.</li>
            </ul>
          </section>

          <section className="card-box">
            <h2>Quick answers</h2>
            <details>
              <summary>How do I track my order?</summary>
              <p className="muted">Go to the Track Order page and enter the order ID from your confirmation. You'll see live status — placed, confirmed, shipped, delivered.</p>
            </details>
            <details>
              <summary>What payment methods do you accept?</summary>
              <p className="muted">{name} accepts UPI, all major cards, and Cash on Delivery (where available). Payments are processed securely.</p>
            </details>
            <details>
              <summary>Do you ship across India?</summary>
              <p className="muted">Yes, we ship pan-India. Shipping is free on orders above ₹{settings.freeShippingThreshold || 1499}.</p>
            </details>
          </section>

          <section className="card-box contact-cta">
            <h2>Ready to shop?</h2>
            <p className="muted">Browse the latest arrivals at {name} — new pieces added regularly.</p>
            <div className="contact-cta-btns">
              <Link className="btn btn-gold" to="/catalog">Shop the collection</Link>
              <Link className="btn btn-ghost" to="/track">Track an order</Link>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
