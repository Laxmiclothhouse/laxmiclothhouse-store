import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import { useWishlist } from '../context/WishlistContext.jsx';
import { useData } from '../context/DataContext.jsx';
import Logo from './Logo.jsx';
import AccountIcon from './AccountIcon.jsx';
import AlertBanner from './AlertBanner.jsx';

const links = [
  { to: '/', label: 'Home' },
  { to: '/catalog', label: 'Catalog' },
  { to: '/track', label: 'Track Order' },
  { to: '/about', label: 'About Us' },
  { to: '/contact', label: 'Contact' },
];

export default function Navbar({ onCartOpen }) {
  const { user, isAdmin, isStaff, logout } = useAuth();
  const { totalItems } = useCart();
  const { count: savedCount } = useWishlist();
  const { settings, alerts } = useData();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();

  const closeMenu = () => setMenuOpen(false);
  const submitSearch = (e) => {
    e.preventDefault();
    const q = searchTerm.trim();
    if (q) navigate(`/catalog?q=${encodeURIComponent(q)}`);
    setSearchOpen(false);
  };

  return (
    <header className="navbar">
      {/* top strip */}
      <div className="topstrip">
        <span>{settings.announcement}</span>
      </div>

      <AlertBanner alerts={alerts} />

      <nav className="nav-inner">
                <Link to="/" className="brand" onClick={closeMenu}>
          <Logo />
          <span className="brand-text">
            {settings.storeName} <em>{settings.tagline}</em>
          </span>
        </Link>

        <ul className="nav-links">
          {links.map((l) => (
            <li key={l.to}>
              <Link to={l.to}>{l.label}</Link>
            </li>
          ))}
          {user && (
            <li>
              <Link to="/orders">My Orders</Link>
            </li>
          )}
          {user && (
            <li>
              <Link to="/wishlist">Saved{savedCount ? ` (${savedCount})` : ''}</Link>
            </li>
          )}
          {isAdmin && (
            <li>
              <Link to="/admin">Admin</Link>
            </li>
          )}
          {isStaff && (
            <li>
              <Link to="/dashboard">Live board</Link>
            </li>
          )}
        </ul>

        <div className="nav-actions">
          {user ? (
            <>
              <Link to="/profile" className="account-link" onClick={closeMenu} aria-label="My account">
                <AccountIcon size={22} />
              </Link>
              <button className="linklike logout-desktop" onClick={() => { logout(); }} aria-label="Logout">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </button>
            </>
          ) : (
            <Link to="/login" className="btn btn-ghost btn-sm">
              Log in
            </Link>
          )}
          <button
            className="menu-btn"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
          >
            {menuOpen ? '✕' : '☰'}
          </button>
          <div className="nav-search">
            {searchOpen && (
              <form onSubmit={submitSearch} className="nav-search-form">
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search products..."
                  className="nav-search-input"
                  autoFocus
                />
              </form>
            )}
            <button
              className="nav-search-btn"
              onClick={() => setSearchOpen((v) => !v)}
              aria-label="Search"
              title="Search"
            >
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </button>
          </div>
          <button className="cart-btn" onClick={onCartOpen} aria-label="Open cart">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none"
              stroke="currentColor" strokeWidth="1.8">
              <path d="M6 6h15l-1.5 9h-12L5 3H2" />
              <circle cx="9" cy="20" r="1.6" />
              <circle cx="18" cy="20" r="1.6" />
            </svg>
            <span className="badge">{totalItems}</span>
          </button>
        </div>
      </nav>

      {/* mobile menu */}
      <div className={"mobile-menu" + (menuOpen ? ' open' : '')}>
        {links.map((l) => (
          <Link key={l.to} to={l.to} onClick={closeMenu}>{l.label}</Link>
        ))}
        {user && <Link to="/orders" onClick={closeMenu}>My Orders</Link>}
        {user && <Link to="/wishlist" onClick={closeMenu}>Saved{savedCount ? ` (${savedCount})` : ''}</Link>}
        {isAdmin && <Link to="/admin" onClick={closeMenu}>Admin</Link>}
        {isStaff && <Link to="/dashboard" onClick={closeMenu}>Live board</Link>}
        {user ? (
          <button className="linklike mobile-logout" onClick={() => { logout(); closeMenu(); }}>
            Logout
          </button>
        ) : (
          <Link to="/login" onClick={closeMenu}>Log in</Link>
        )}
      </div>
    </header>
  );
}