import React from 'react';
import { Link } from 'react-router-dom';
import { useData } from '../context/DataContext.jsx';

export default function ShippingExchange() {
  const { settings } = useData();
  const name = (settings.storeName || 'Laxmiclothhouse').trim();
  const email = settings.contactEmail || 'support@laxmiclothhouse.com';
  const phone = settings.contactPhone || '+91 85699 27004';
  const freeThreshold = settings.freeShippingThreshold || 1499;
  const updated = new Date().toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <main className="page">
      <div className="page-head">
        <h1>Shipping &amp; Exchange Policy</h1>
        <p>Where we deliver, how long it takes, and how exchanges work. Last updated {updated}</p>
      </div>

      <section className="card-box about">
        <h2>1. Where we ship</h2>
        <p>
          We ship across India through our delivery partners (e.g. Delhivery). If you
          are unsure whether we deliver to your pin code, check at checkout or ask us
          before ordering.
        </p>

        <h2>2. Shipping charges</h2>
        <ul className="about-list">
          <li><strong>Free shipping</strong> on prepaid orders above &#8377;{freeThreshold}.</li>
          <li>A flat shipping fee applies to smaller orders and is shown clearly at checkout before you pay.</li>
          <li>Cash on Delivery may carry a small handling fee where available.</li>
        </ul>

        <h2>3. Dispatch and delivery time</h2>
        <ul className="about-list">
          <li>Orders are usually dispatched within <strong>2–4 working days</strong>.</li>
          <li>Delivery typically takes <strong>3–7 working days</strong> after dispatch, depending on your location.</li>
          <li>Metro cities are generally faster than remote pin codes.</li>
          <li>During festivals and sales, processing may take a little longer — we'll keep you updated.</li>
        </ul>

        <h2>4. Tracking your order</h2>
        <p>
          Once dispatched, you'll receive a tracking update. You can follow live
          status any time on the <Link to="/track">Track Order</Link> page using your
          order ID.
        </p>

        <h2>5. Exchanges</h2>
        <ul className="about-list">
          <li>Wrong size or fit? You can request an <strong>exchange for a different size or colour</strong> within <strong>7 days of delivery</strong>, subject to stock.</li>
          <li>The item must be unused, unwashed and undamaged, with all original tags and packaging.</li>
          <li>Size/fit exchanges for change-of-mind are subject to a two-way shipping charge; exchanges due to our error or a defect are free.</li>
        </ul>

        <h2>6. How to request an exchange or return</h2>
        <p>
          Email <a href={`mailto:${email}`}>{email}</a> or call{' '}
          <a href={`tel:${phone}`}>{phone}</a> with your order ID and what you need. We'll
          share return instructions and the pickup/return address. Please do not ship
          anything back before we confirm.
        </p>

        <h2>7. Damaged or wrong item received</h2>
        <p>
          If your parcel arrives damaged or you receive the wrong product, contact us
          within <strong>48 hours of delivery</strong> with photos. We'll arrange a
          free replacement or a full refund. See our{' '}
          <Link to="/cancellation-refund">Cancellation &amp; Refund</Link> policy for
          refund timelines.
        </p>

        <p className="muted">
          This policy is part of our <Link to="/terms">Terms and Conditions</Link> and
          is governed by the laws of India. Questions? Use our{' '}
          <Link to="/contact">Contact Us</Link> page.
        </p>
      </section>
    </main>
  );
}

