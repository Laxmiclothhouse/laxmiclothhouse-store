import React from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext.jsx';
import { useData } from '../context/DataContext.jsx';
import { formatINR } from '../utils/format.js';

export default function CartDrawer({ open, onClose }) {
  const { cart, updateQty, removeItem, subtotal } = useCart();
  const { products, settings } = useData();

  const rawShipping = cart.reduce((sum, c) => {
    const p = products.find((x) => x.id === c.id);
    const perUnit = p && typeof p.shippingCost === 'number' ? p.shippingCost : 99;
    return sum + perUnit * c.qty;
  }, 0);

  const threshold = settings.freeShippingThreshold || 0;
  const qualifiesFree = threshold > 0 && subtotal >= threshold;
  const shippingFee = qualifiesFree ? 0 : rawShipping;

  return (
    <div className={`drawer-scrim ${open ? 'open' : ''}`} onClick={onClose}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()}>
        <header className="drawer-head">
          <h2>Your Cart</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>

        {cart.length === 0 ? (
          <div className="drawer-empty">
            <p>Your cart is empty.</p>
            <Link to="/catalog" className="btn btn-dark" onClick={onClose}>
              Browse products
            </Link>
          </div>
        ) : (
          <>
            <ul className="drawer-items">
              {cart.map((c) => {
                const pc = products.find((x) => x.id === c.id);
                const over = pc && typeof pc.stock === 'number' && c.qty > pc.stock;
                const left = pc && typeof pc.stock === 'number' ? pc.stock : null;
                return (
                <li key={c.key} className="drawer-item">
                  <img src={c.image} alt={c.name} />
                  <div className="di-info">
                    <p className="di-name">
                      {c.name}{(c.colorName || c.color) ? ` · ${c.colorName || c.color}` : ''}{c.size ? ` · Size ${c.size}` : ''}
                    </p>
                    {over && <p className="di-stock-warn">Only {left} left — reduce quantity</p>}
                    {!over && left !== null && left <= 3 && c.qty <= left && (
                      <p className="di-stock-low">Only {left} left in stock</p>
                    )}
                    <div className="di-qty">
                      <button onClick={() => updateQty(c.key, c.qty - 1)}>−</button>
                      <span>{c.qty}</span>
                      <button onClick={() => updateQty(c.key, c.qty + 1)}>+</button>
                    </div>
                  </div>
                  <div className="di-right">
                    <p>{formatINR(c.price * c.qty)}</p>
                    <button className="linklike" onClick={() => removeItem(c.key)}>
                      Remove
                    </button>
                  </div>
                </li>
                );
              })}
            </ul>
            <footer className="drawer-foot">
              <div className="subtotal">
                <span>Subtotal</span>
                <strong>{formatINR(subtotal)}</strong>
              </div>
              <div className="subtotal shipping">
                <span>Shipping</span>
                <strong>{shippingFee === 0 ? 'FREE' : formatINR(shippingFee)}</strong>
              </div>
              <div className="subtotal total">
                <span>Total</span>
                <strong>{formatINR(subtotal + shippingFee)}</strong>
              </div>
              <Link to="/checkout" className="btn btn-gold btn-block" onClick={onClose}>
                Checkout →
              </Link>
              <button className="linklike center" onClick={onClose}>
                or continue shopping
              </button>
            </footer>
          </>
        )}
      </aside>
    </div>
  );
}