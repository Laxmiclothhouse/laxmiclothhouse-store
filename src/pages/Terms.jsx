import React from 'react';
import { Link } from 'react-router-dom';
import { useData } from '../context/DataContext.jsx';

export default function Terms() {
  const { settings } = useData();
  const name = (settings.storeName || 'Laxmiclothhouse').trim();
  const email = settings.contactEmail || 'support@laxmiclothhouse.com';
  const phone = settings.contactPhone || '+91 85699 27004';
  const address =
    settings.contactAddress ||
    'Najafgarh Road, Near Balour More, Opp. Sector 9, Bahadurgarh - 124507';
  const updated = new Date().toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <main className="page">
      <div className="page-head">
        <h1>Terms and Conditions</h1>
        <p>The rules that govern your use of {name}. Last updated {updated}</p>
      </div>

      <section className="card-box about">
        <p>
          These Terms and Conditions ("Terms") govern your access to and use of the{' '}
          {name} website and any orders you place with us. By browsing, creating an
          account or ordering, you agree to these Terms. Please read them together
          with our <Link to="/privacy">Privacy Policy</Link>,{' '}
          <Link to="/cancellation-refund">Cancellation &amp; Refund</Link> and{' '}
          <Link to="/shipping-exchange">Shipping &amp; Exchange</Link> policies.
        </p>

        <h2>1. Use of the website</h2>
        <p>
          You agree to use this store only for lawful purposes and to provide
          accurate information. We may update these Terms at any time; changes are
          posted here with a new date, and your continued use means you accept the
          updated Terms.
        </p>

        <h2>2. Eligibility and accounts</h2>
        <ul className="about-list">
          <li>You must be at least 18 years old (or shopping with a parent/guardian) to place an order.</li>
          <li>Keep your login details secure; activity under your account is your responsibility.</li>
          <li>We may suspend accounts involved in fraud, abuse or repeated policy violations.</li>
        </ul>

        <h2>3. Products, prices and orders</h2>
        <ul className="about-list">
          <li>All orders are subject to stock availability and acceptance by us.</li>
          <li>Prices are shown in Indian Rupees (&#8377;) and include applicable taxes unless stated otherwise.</li>
          <li>Product photos are for representation; slight variations in colour, fabric and embroidery are natural to handcrafted ethnic wear.</li>
          <li>We may correct pricing or listing errors and will inform you before dispatching if an order is affected.</li>
        </ul>

        <h2>4. Payment</h2>
        <p>
          We accept UPI, credit/debit cards, netbanking and Cash on Delivery where
          available. Online payments are processed securely by our payment partner
          (Razorpay); we never see or store your card number, UPI PIN or bank
          credentials.
        </p>

        <h2>5. Delivery</h2>
        <p>
          Delivery timelines depend on stock, payment method and the address you
          provide. Please see our{' '}
          <Link to="/shipping-exchange">Shipping &amp; Exchange</Link> page for
          details on charges, timelines and delivery areas.
        </p>

        <h2>6. Cancellation, returns and refunds</h2>
        <p>
          Orders may be cancelled, returned or exchanged only as described in our{' '}
          <Link to="/cancellation-refund">Cancellation &amp; Refund</Link> policy,
          subject to the product condition and the original payment method.
        </p>

        <h2>7. Intellectual property</h2>
        <p>
          All content on this website &mdash; product photographs, text, design,
          logos and graphics &mdash; belongs to {name} and is protected by copyright.
          You may not copy, reproduce or redistribute it without our written consent.
        </p>

        <h2>8. Limitation of liability</h2>
        <p>
          {name} is not liable for any indirect, incidental or consequential loss, or
          for minor differences between product images and the delivered item
          arising from the handcrafted nature of the garments. Our liability in any
          case is limited to the amount paid for the affected order.
        </p>

        <h2>9. Governing law</h2>
        <p>
          These Terms are governed by the laws of India. Any dispute is subject to
          the exclusive jurisdiction of the courts at Bahadurgarh, Haryana.
        </p>

        <h2>10. Contact</h2>
        <p>
          Questions about these Terms? Reach us at{' '}
          <a href={`mailto:${email}`}>{email}</a> or{' '}
          <a href={`tel:${phone}`}>{phone}</a>, or visit us at {address}. You can also
          use our <Link to="/contact">Contact Us</Link> page.
        </p>
      </section>
    </main>
  );
}

