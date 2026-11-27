import React, { useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useData } from '../context/DataContext.jsx';
import { useWishlist } from '../context/WishlistContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import ProductCard from '../components/ProductCard.jsx';

export default function Wishlist() {
  const { user } = useAuth();
  const { products } = useData();
  const { ids, count, remove } = useWishlist();
  const { addItem } = useCart();
  const [moved, setMoved] = useState(false);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const items = products.filter((p) => ids.includes(p.id));

  const moveAll = () => {
    items.forEach((p) => { addItem(p, 1); remove(p.id); });
    setMoved(true);
    setTimeout(() => setMoved(false), 2500);
  };

  return (
    <main className="page">
      <div className="page-head">
        <h1>My Wishlist</h1>
        <p>{count === 0 ? "You haven't saved anything yet." : `${count} saved item${count > 1 ? 's' : ''}`}</p>
      </div>

      {items.length === 0 ? (
        <div className="center empty">
          <p>Tap the ♡ on any product to save it here for later.</p>
          <Link to="/catalog" className="btn btn-gold">Browse products</Link>
        </div>
      ) : (
        <>
          <div className="wish-actions">
            <button className="btn btn-gold btn-sm" onClick={moveAll}>
              Move all to cart
            </button>
            {moved && <span className="ok">✓ All items added to your cart!</span>}
          </div>
          <div className="product-grid">
            {items.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </>
      )}
    </main>
  );
}