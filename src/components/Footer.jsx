import React from 'react';
import { Link } from 'react-router-dom';
import { useData } from '../context/DataContext.jsx';

export default function Footer() {
  const { settings } = useData();
  return (
    <footer className="footer">
      <div className="footer-grid">
        <div className="f-col">
          <h3>{settings.storeName}</h3>
          <p>
            {settings.heroSubheading}
          </p>
        </div>
        <div className="f-col">
          <h4>Quick Links</h4>
          <ul>
            <li><Link to="/catalog">Catalog</Link></li>
            <li><Link to="/track">Track Order</Link></li>
            <li><Link to="/about">About Us</Link></li>
            <li><Link to="/privacy">Privacy Policy</Link></li>
            <li><Link to="/contact">Contact</Link></li>
          </ul>
        </div>
        <div className="f-col">
          <h4>Categories</h4>
          <ul>
            <li><Link to="/catalog?cat=Suits">Suits</Link></li>
            <li><Link to="/catalog?cat=Ethnic">Ethnic</Link></li>
            <li><Link to="/catalog?cat=Lehenga">Lehenga</Link></li>
            <li><Link to="/catalog?cat=Saree">Saree</Link></li>
          </ul>
        </div>
        <div className="f-col">
          <h4>Stay Connected</h4>
          <p>Follow us on social media for new drops and offers.</p>
          <div className="socials">
            <a
              href="https://www.instagram.com/houselaxmicloth?stkn=MTQ4amZycDF3MG5xNg%3D%3D&utm_source=qr"
              target="_blank"
              rel="noreferrer"
              aria-label="Follow us on Instagram"
              className="social-link"
              title="Follow us on Instagram"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M12 2.2c3.2 0 3.6 0 4.8.1 1.2.1 1.8.2 2.2.4.6.2 1 .5 1.4.9.4.4.7.8.9 1.4.2.4.4 1 .4 2.2.1 1.2.1 1.6.1 4.8s0 3.6-.1 4.8c-.1 1.2-.2 1.8-.4 2.2-.2.6-.5 1-.9 1.4-.4.4-.8.7-1.4.9-.4.2-1 .4-2.2.4-1.2.1-1.6.1-4.8.1s-3.6 0-4.8-.1c-1.2-.1-1.8-.2-2.2-.4-.6-.2-1-.5-1.4-.9-.4-.4-.7-.8-.9-1.4-.2-.4-.4-1-.4-2.2C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.8c.1-1.2.2-1.8.4-2.2.2-.6.5-1 .9-1.4.4-.4.8-.7 1.4-.9.4-.2 1-.4 2.2-.4C8.4 2.2 8.8 2.2 12 2.2zm0 1.8c-3.1 0-3.5 0-4.7.1-1.1.1-1.5.2-1.9.3-.5.2-.8.4-1.1.7-.3.3-.5.6-.7 1.1-.1.4-.3.8-.3 1.9-.1 1.2-.1 1.6-.1 4.7s0 3.5.1 4.7c.1 1.1.2 1.5.3 1.9.2.5.4.8.7 1.1.3.3.6.5 1.1.7.4.1.8.3 1.9.3 1.2.1 1.6.1 4.7.1s3.5 0 4.7-.1c1.1-.1 1.5-.2 1.9-.3.5-.2.8-.4 1.1-.7.3-.3.5-.6.7-1.1.1-.4.3-.8.3-1.9.1-1.2.1-1.6.1-4.7s0-3.5-.1-4.7c-.1-1.1-.2-1.5-.3-1.9-.2-.5-.4-.8-.7-1.1-.3-.3-.6-.5-1.1-.7-.4-.1-.8-.3-1.9-.3-1.2-.1-1.6-.1-4.7-.1zm0 3.1a4.9 4.9 0 1 1 0 9.8 4.9 4.9 0 0 1 0-9.8zm0 1.8a3.1 3.1 0 1 0 0 6.2 3.1 3.1 0 0 0 0-6.2zm5.1-2.9a1.1 1.1 0 1 1 0 2.3 1.1 1.1 0 0 1 0-2.3z"/></svg>
              <span>Instagram</span>
            </a>
          </div>
        </div>
      </div>
      <div className="footer-bottom">
        <p>Payment methods: UPI · Credit/Debit Cards · Cash on Delivery</p>
        <p>© {new Date().getFullYear()} {settings.storeName}. All rights reserved.</p>
      </div>
    </footer>
  );
}