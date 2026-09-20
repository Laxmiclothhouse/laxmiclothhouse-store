import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useWishlist } from '../context/WishlistContext.jsx';
import { formatINR, formatDate } from '../utils/format.js';
import Stars from '../components/Stars.jsx';
import ProductCard from '../components/ProductCard.jsx';
import SizeGuide from '../components/SizeGuide.jsx';

export default function ProductDetail() {
  const { id } = useParams();
  const { products, reviewsFor, ratingFor, addReview, settings, getSalePrice } = useData();
  const { addItem, cart } = useCart();
  const { user } = useAuth();
  const { isWishlisted, toggle } = useWishlist();
  const nav = useNavigate();
  const [qty, setQty] = useState(1);
  const [size, setSize] = useState('');
  const [toast, setToast] = useState('');
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [ratingMsg, setRatingMsg] = useState('');

  // Currently selected gallery image index (moves with the arrows).
  const [activeIndex, setActiveIndex] = useState(0);
  const [sizeGuideOpen, setSizeGuideOpen] = useState(false);
  const [shareMsg, setShareMsg] = useState('');

  const product = products.find((p) => p.id === id);
  const sale = product ? getSalePrice(product) : { price: 0, originalPrice: 0, saleLabel: null, hasSale: false };
  // Only an admin-created sale counts as "on sale" — a struck-through MRP
  // above the selling price is ordinary shop pricing, not a running sale.
  const onSale = Boolean(product && sale.hasSale);

  // All images for this product; older products only have "image" (single).
  const images =
    product && Array.isArray(product.images) && product.images.length > 0
      ? product.images.filter((img) => img && img.trim() !== '')
      : product
        ? [product.image].filter((img) => img && img.trim() !== '')
        : [];
  // Always show the first image by default; the arrows move through the rest.
  const safeIndex = activeIndex < images.length ? activeIndex : 0;
  const mainImg = images[safeIndex] || images[0];

  const prevImage = () => {
    if (images.length < 2) return;
    setActiveIndex((i) => (i - 1 + images.length) % images.length);
  };
  const nextImage = () => {
    if (images.length < 2) return;
    setActiveIndex((i) => (i + 1) % images.length);
  };

  // Reset the gallery, qty and size when opening a different product.
  useEffect(() => {
    setActiveIndex(0);
    setQty(1);
    setSize('');
  }, [id]);

  if (!product) {
    return (
      <main className="page center">
        <p>Product not found.</p>
        <Link to="/catalog" className="btn btn-dark">Back to catalog</Link>
      </main>
    );
  }

  const soldOut = !product || product.stock <= 0;
  const inCart = product ? cart.some((c) => c.id === product.id) : false;
  const saved = isWishlisted(product.id);
  const related = products.filter(
    (p) => p.category === product.category && p.id !== product.id
  ).slice(0, 4);

  const productReviews = reviewsFor(product.id);
  const summary = ratingFor(product.id);
  const myReview =
    user &&
    productReviews.find((r) => r.userId === user.id);

  const onAdd = () => {
    if (!user) {
      nav('/login');
      return;
    }
    if (product.sizes && product.sizes.length > 0 && !size) {
      setToast('Please select a size first');
      setTimeout(() => setToast(''), 1800);
      return;
    }
    if (user && typeof product.stock === 'number' && qty > product.stock) {
      setToast(`Only ${product.stock} left in stock`);
      setTimeout(() => setToast(''), 1800);
      return;
    }
    addItem(product, qty, size, onSale ? sale.price : null);
    setToast('✓ Added to cart' + (size ? ` (Size ${size})` : '') + (onSale ? ' — sale price applied!' : ''));
    setTimeout(() => setToast(''), 1800);
  };

  const onWish = () => {
    if (!user) {
      nav('/login');
      return;
    }
    toggle(product.id);
    setToast(saved ? '✓ Removed from wishlist' : '♥ Added to wishlist');
    setTimeout(() => setToast(''), 1800);
  };

  // ── Share: copy link so the user can paste it anywhere ──────
  const productUrl = () =>
    `${window.location.origin}${window.location.pathname}#/product/${product.id}`;

  const flash = (t) => {
    setToast(t);
    setTimeout(() => setToast(''), 1800);
  };

  const copyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(productUrl());
      flash('✓ Link copied — paste it in WhatsApp or Instagram to share');
    } catch {
      flash('Could not copy — long-press the address bar to copy the link');
    }
  };

  const onReview = (e) => {
    e.preventDefault();
    if (rating === 0) {
      setRatingMsg('Please select a star rating.');
      return;
    }
    addReview({
      productId: product.id,
      userId: user.id,
      userName: user.name,
      rating,
      comment: comment.trim(),
    });
    setRating(0);
    setComment('');
    setRatingMsg('Thanks for your review!');
    setTimeout(() => setRatingMsg(''), 2200);
  };

  return (
    <main className="page">
      {toast && <div className="toast">{toast}</div>}
      <div className="detail">
                        <div className="detail-img">
          <img src={mainImg} alt={product.name} className="detail-main-img" loading="lazy" />
          {images.length > 1 && (
            <>
              <button type="button" className="gallery-arrow gallery-prev" onClick={prevImage} aria-label="Previous image">
                <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
              </button>
              <button type="button" className="gallery-arrow gallery-next" onClick={nextImage} aria-label="Next image">
                <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
              </button>
              <span className="gallery-count">{safeIndex + 1} / {images.length}</span>
            </>
          )}
        </div>


        <div className="detail-info">
          <p className="cat-line">{product.category}</p>
          <h1>{product.name}</h1>
          <p className="lead">{product.description}</p>
          {summary.count > 0 && (
            <div className="pc-rating">
              <Stars value={summary.avg} count={summary.count} size={17} />
            </div>
          )}
          <div className="pc-price">
            {onSale ? (
              <>
                <span className="price big sale-price">{formatINR(sale.price)}</span>
                <span className="mrp">{formatINR(sale.originalPrice)}</span>
                <span className="sale-pct big">
                  {sale.originalPrice > sale.price
                    ? `${Math.round(((sale.originalPrice - sale.price) / sale.originalPrice) * 100)}% off`
                    : ''}
                </span>
                <p className="sale-label">{sale.saleLabel}</p>
              </>
            ) : (
              <>
                <span className="price big">{formatINR(product.price)}</span>
                {product.mrp > product.price && (
                  <span className="mrp">{formatINR(product.mrp)}</span>
                )}
              </>
            )}
          </div>
          <p className={`stock-line ${soldOut ? 'out' : ''}`}>
            {soldOut ? 'Currently out of stock' : `In stock · ${product.stock} available`}
          </p>

          <div className="buy-row">
            <div className="qty-stepper">
              <button disabled={qty <= 1} onClick={() => setQty(qty - 1)}>−</button>
              <span>{qty}</span>
              <button onClick={() => setQty(qty + 1)}>+</button>
            </div>
            <button className="btn btn-gold" disabled={soldOut} onClick={onAdd} style={inCart ? { background: 'var(--ok)', borderColor: 'var(--ok)' } : undefined}>
              {soldOut ? 'Sold out' : inCart ? '✓ Added' : 'Add to cart'}
            </button>
            <button className={`btn btn-wish ${saved ? 'active' : ''}`} onClick={onWish}>
              {saved ? '♥ Saved' : '♡ Save'}
            </button>
          </div>

          {/* ── Size picker (only when admin set sizes) ────────── */}
          {product.sizes && product.sizes.length > 0 && (
            <div className="size-picker">
              <span className="size-label">Size:</span>
              {product.sizes.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`size-opt${size === s ? ' active' : ''}`}
                  onClick={() => setSize(s)}
                  aria-pressed={size === s}
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* ── Size guide + share (copy link) ──────────────────── */}
          <div className="buy-extras">
            <button type="button" className="linklike" onClick={() => setSizeGuideOpen(true)}>
              📏 Size guide
            </button>
            <span className="muted">·</span>
            <button
              type="button"
              className="share-icon-btn"
              onClick={copyShareLink}
              title="Copy product link"
              aria-label="Copy product link to share"
            >
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="8.6" />
                <circle cx="9.2" cy="10.5" r="2.1" />
                <circle cx="14.6" cy="10.5" r="2.1" />
                <path d="M9.5 15.5c1.5 1.5 4.5 1.5 6 0" />
              </svg>
              Share
            </button>
          </div>

          <div className="perks">
            {(product.paymentMethods || []).includes('cod') && (
              <p>✔ Cash on Delivery available</p>
            )}
            {['upi', 'card'].filter((m) => (product.paymentMethods || []).includes(m)).length > 0 && (
              <p>✔ Pay via {['upi', 'card'].filter((m) => (product.paymentMethods || []).includes(m)).map((m) => m === 'upi' ? 'UPI' : 'Card').join(' & ')} at checkout</p>
            )}
            <p>✔ Shipping: {product.shippingCost === 0 ? 'FREE' : `₹${product.shippingCost} per unit`}</p>
            {product.returnsAccepted ? (
              <p>✔ {product.returnDays}-day easy returns</p>
            ) : (
              <p>✘ No returns on this product</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Reviews & ratings ─────────────────────────────── */}
      <div className="detail">
        <div className="card-box rev-form">
          <h2>Write a review</h2>
          {user ? (
            <form onSubmit={onReview} className="form">
              <div className="rev-pick">
                <span>Your rating</span>
                <Stars value={rating} size={26} onChange={setRating} />
              </div>
              <textarea
                rows="3"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="How was this product? (optional)"
              />
              {myReview && (
                <p className="muted tiny">
                  You've already reviewed this product — submitting again will update it.
                </p>
              )}
              <button className="btn btn-gold" type="submit">Submit review</button>
              {ratingMsg && <p className="ok">{ratingMsg}</p>}
            </form>
          ) : (
            <p className="muted">
              <Link to="/login">Log in</Link> to rate and review this product.
            </p>
          )}
        </div>

        <div className="card-box rev-list">
          <h2>Ratings &amp; reviews</h2>
          {summary.count > 0 ? (
            <>
              <div className="rev-summary">
                <span className="rev-avg">{summary.avg.toFixed(1)}</span>
                <Stars value={summary.avg} size={18} />
                <span className="muted">&nbsp;based on {summary.count} review{summary.count > 1 ? 's' : ''}</span>
              </div>
              <ul className="rev-items">
                {productReviews.map((r) => (
                  <li key={r.id} className="rev-item">
                    <div className="rev-avatar">{r.userName.trim()[0].toUpperCase()}</div>
                    <div className="rev-body">
                      <div className="rev-head">
                        <strong>{r.userName}</strong>
                        <Stars value={r.rating} size={13} />
                        <span className="muted tiny">{formatDate(r.date)}</span>
                      </div>
                      {r.comment ? <p>{r.comment}</p> : <p className="muted tiny">No written review.</p>}
                    </div>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="muted">No reviews yet. Be the first to review this product!</p>
          )}
        </div>
      </div>

      {related.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2>You may also like</h2>
          </div>
          <div className="product-grid">
            {related.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </section>
      )}

      {sizeGuideOpen && (
        <SizeGuide category={product.category} onClose={() => setSizeGuideOpen(false)} />
      )}
    </main>
  );
}
