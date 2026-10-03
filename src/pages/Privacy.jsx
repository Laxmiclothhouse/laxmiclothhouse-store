import React from 'react';
import { useData } from '../context/DataContext.jsx';

export default function Privacy() {
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
        <h1>Privacy Policy</h1>
        <p>How {name} collects, uses and protects your information. Last updated {updated}</p>
      </div>

      <section className="card-box about">
        <h2>1. Who we are</h2>
        <p>
          {name} ("we", "us") operates this online ethnic-wear store from {address}.
          Reach us at <a href={`mailto:${email}`}>{email}</a> or{' '}
          <a href={`tel:${phone}`}>{phone}</a>.
        </p>

        <h2>2. Information we collect</h2>
        <ul className="about-list">
          <li>Account and contact details - name, phone, email and delivery address you give at signup or checkout.</li>
          <li>Order details - items, amounts, coupon usage, payment method and delivery status.</li>
          <li>Payment information - processed securely by Razorpay (UPI, cards, netbanking). We never see or store card numbers, UPI PINs or bank credentials, only the payment reference and status.</li>
          <li>Communication preferences - whether you opted in to WhatsApp order updates and sale alerts at checkout.</li>
          <li>Technical data - device, browser and basic usage data needed to keep the store working (cart, session, preferences).</li>
        </ul>

        <h2>3. How we use your information</h2>
        <ul className="about-list">
          <li>Process, pack, ship and deliver your orders, and show live tracking.</li>
          <li>Contact you about your order (confirmation, dispatch, delivery, refunds).</li>
          <li>Send WhatsApp and email updates only if you opted in at checkout.</li>
          <li>Prevent fraud, handle returns and refunds, and provide support.</li>
          <li>Improve the catalogue, pricing and shopping experience.</li>
        </ul>
        <p>We do not sell your personal information to anyone.</p>

        <h2>4. WhatsApp messages</h2>
        <p>
          If you tick the WhatsApp opt-in box at checkout, we send order updates
          (placed, confirmed, packed, shipped, delivered, cancelled) and occasional
          sale alerts to that number via the WhatsApp Business Platform. Opt out any
          time by replying STOP or writing to <a href={`mailto:${email}`}>{email}</a>.
        </p>

        <h2>5. Sharing of information</h2>
        <ul className="about-list">
          <li>Razorpay - secure online payment processing.</li>
          <li>Delivery partners (e.g. Delhivery) - name, phone, address and parcel details for shipping.</li>
          <li>Meta (WhatsApp) - only the phone number and message content needed for updates you opted into.</li>
          <li>Email provider - to send order and sale emails.</li>
        </ul>
        <p>We may also disclose information if required by Indian law or a lawful government request.</p>

        <h2>6. Cookies and local storage</h2>
        <p>
          The store uses browser local storage (cart, wishlist, session) and basic
          cookies so the site remembers you. No third-party advertising trackers.
          Clear site data in your browser any time; the cart and login simply reset.
        </p>

        <h2>7. Data retention</h2>
        <p>
          Order records are kept as required for accounts, tax and warranty. You may
          ask us to delete your account profile data any time; order history needed
          for legal records is retained in anonymised form.
        </p>

        <h2>8. Your rights</h2>
        <ul className="about-list">
          <li>Ask what personal data we hold about you.</li>
          <li>Correct inaccurate details (Profile page, or write to us).</li>
          <li>Withdraw WhatsApp and email marketing consent any time.</li>
          <li>Request deletion of your account data, subject to legal retention.</li>
        </ul>
        <p>Write to <a href={`mailto:${email}`}>{email}</a> - we reply within 7 days.</p>

        <h2>9. Children</h2>
        <p>This store is meant for adults. If you are under 18, please shop with a parent or guardian.</p>

        <h2>10. Changes to this policy</h2>
        <p>Material changes will be posted here with a revised date. Continued use of the store means you accept the updated policy.</p>

        <h2>11. Grievance contact</h2>
        <p>
          {name} - {address}
          <br />
          Email: <a href={`mailto:${email}`}>{email}</a> - Phone:{' '}
          <a href={`tel:${phone}`}>{phone}</a>
        </p>
      </section>
    </main>
  );
}
