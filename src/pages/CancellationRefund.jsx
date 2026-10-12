import React from 'react';
import { Link } from 'react-router-dom';
import { useData } from '../context/DataContext.jsx';

export default function CancellationRefund() {
  const { settings } = useData();
  const name = (settings.storeName || 'Laxmiclothhouse').trim();
  const email = settings.contactEmail || 'support@laxmiclothhouse.com';
  const phone = settings.contactPhone || '+91 85699 27004';
  const updated = new Date().toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <main className="page">
      <div className="page-head">
        <h1>Cancellation &amp; Refund Policy</h1>
        <p>How to cancel an order, request a refund, and how we handle returns. Last updated {updated}</p>
      </div>

      <section className="card-box about">
        <h2>1. Cancelling your order</h2>
        <ul className="about-list">
          <li>You can cancel free of charge any time <strong>before the order is dispatched</strong> (status shows Confirmed or earlier).</li>
          <li>To cancel, open your order from <Link to="/orders">My Orders</Link> and tap Cancel, or contact us with your order ID.</li>
          <li>Once the status is Packed, Shipped or Out for delivery, the parcel can no longer be cancelled — but you can still refuse it on arrival or request a return after delivery.</li>
        </ul>

        <h2>2. Cancellation charges</h2>
        <ul className="about-list">
          <li>Cancelling before dispatch: <strong>no charge</strong>.</li>
          <li>Cash on Delivery orders cancelled after we have packed/shipped: we may deduct the actual courier charges already incurred.</li>
        </ul>

        <h2>3. Returns and exchange window</h2>
        <p>
          If you change your mind, you may request a return or exchange within{' '}
          <strong>7 days of delivery</strong>. To be eligible, the item must be
          unused, unwashed, undamaged, with all original tags and packaging intact,
          and it must not be a made-to-order or custom-stitched piece. See our{' '}
          <Link to="/shipping-exchange">Shipping &amp; Exchange</Link> page for the
          full process.
        </p>

        <h2>4. When a refund is issued</h2>
        <ul className="about-list">
          <li>You cancelled before dispatch.</li>
          <li>The item was defective, damaged, or we shipped the wrong product/size.</li>
          <li>Your approved return is received back at our warehouse and passes a quality check.</li>
        </ul>

        <h2>5. Refund method and timeline</h2>
        <ul className="about-list">
          <li>Prepaid orders (UPI, cards, netbanking): refunded to the <strong>original payment method</strong> within 5–7 working days after the return is approved.</li>
          <li>Cash on Delivery orders: refunded via bank transfer/UPI to an account you provide, within 7 working days of approval.</li>
          <li>Bank/payment-provider processing time is outside our control; once we initiate the refund, your bank may take a few days to credit it.</li>
        </ul>

        <h2>6. What is not refundable</h2>
        <ul className="about-list">
          <li>Items returned without original tags, or damaged/altered after delivery.</li>
          <li>Custom, made-to-order or personalised pieces (unless faulty).</li>
          <li>Return shipping for change-of-mind returns (see Shipping &amp; Exchange).</li>
        </ul>

        <h2>7. How to start a cancellation or refund</h2>
        <p>
          Email <a href={`mailto:${email}`}>{email}</a> or call{' '}
          <a href={`tel:${phone}`}>{phone}</a> with your order ID and reason. You can
          also use <Link to="/contact">Contact Us</Link>. We acknowledge every
          request within 24 hours.
        </p>

        <p className="muted">
          This policy is part of our <Link to="/terms">Terms and Conditions</Link> and
          is governed by the laws of India.
        </p>
      </section>
    </main>
  );
}

