import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { formatINR } from '../utils/format.js';
import Stars from './Stars.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useWishlist } from '../context/WishlistContext.jsx';
import { useData } from '../context/DataContext.jsx';

export default function ProductCard({ product }) {
  const soldOut = product.stock <= 0;
  const { user } = useAuth();
  const { isWishlisted, toggle } = useWishlist();
  const { ratingFor, getSalePrice } = useData();
  const nav = useNavigate();
  const saved = isWishlisted(product.id);
  const rating = ratingFor(product.id);
  const sale = getSalePrice(product);
  // Only an admin-created sale counts as "on sale" — a struck-through MRP
  // above the selling price is ordinary shop pricing, not a running sale.
  const onSale = sale.hasSale;

  // First usable image URL (older rows only carry "image"; some entries are
  // blank). failedSrc remembers which URL failed to load so we swap in the
  // "No image" placeholder instead of a broken-image icon.
  const imgSrc =
    (Array.isArray(product.images)
      ? product.images.find((s) => typeof s === 'string' && s.trim())
      : null) ||
    (typeof product.image === 'string' && product.image.trim()) ||
    '';
  const [failedSrc, setFailedSrc] = React.useState(null);
  // The admin auto-fills a generated gradient letter-tile (data:image/svg+xml
  // SVG from db.js productImage()) whenever a product has no uploaded photo.
  // Customers consider that "no image" — so render the placeholder for it
  // instead of the synthetic tile.
  const isGeneratedTile = (src) => {
    if (!src || !src.startsWith('data:image/svg+xml')) return false;
    try {
      return decodeURIComponent(src).includes('Georgia, serif');
    } catch {
      return true;
    }
  };
  const hasImage = Boolean(imgSrc) && failedSrc !== imgSrc && !isGeneratedTile(imgSrc);
  // One diagonal sash per card — "Sold out" wins if both states apply.
  const band = soldOut ? 'Sold out' : hasImage ? '' : 'No image';

  const onWish = () => {
    if (!user) {
      nav('/login');
      return;
    }
    toggle(product.id);
  };

  return (
    <div className="product-card">
      <div className={`pc-imgwrap${soldOut ? ' is-soldout' : ''}`}>
        <Link to={`/product/${product.id}`} className="pc-imglink">
          {hasImage ? (
            <img
              src={imgSrc}
              alt={product.name}
              loading="lazy"
              onError={() => setFailedSrc(imgSrc)}
            />
          ) : (
            <span className="pc-noimg" role="img" aria-label="No image">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="4.5" width="18" height="15" rx="2.5" />
                <circle cx="8.5" cy="10" r="1.6" />
                <path d="M3.5 16.5 9 11.5l3.5 3.5 3-3 5 5" />
              </svg>
            </span>
          )}
          {band && (
            <span className="soldout-band" role="status">
              <span className="soldout-band-inner">{band}</span>
            </span>
          )}
          {!soldOut && onSale && <span className="ribbon sale">{sale.saleLabel || 'SALE'}</span>}
          {!soldOut && !onSale && product.shippingCost === 0 && <span className="ribbon free">Free ship</span>}
        </Link>
        <button
          className={`wish-btn ${saved ? 'active' : ''}`}
          onClick={onWish}
          aria-label={saved ? 'Remove from wishlist' : 'Add to wishlist'}
          title={saved ? 'Saved' : 'Save to wishlist'}
        >
          {saved ? '♥' : '♡'}
        </button>
      </div>
      <div className="pc-body">
        <h3>
          <Link to={`/product/${product.id}`}>{product.name}</Link>
        </h3>
        <div className="pc-price">
          {onSale ? (
            <>
              <span className="price sale-price">{formatINR(sale.price)}</span>
              <span className="mrp">{formatINR(sale.originalPrice)}</span>
              <span className="sale-pct">
                {sale.originalPrice > sale.price
                  ? `${Math.round(((sale.originalPrice - sale.price) / sale.originalPrice) * 100)}% off`
                  : ''}
              </span>
            </>
          ) : (
            <>
              <span className="price">{formatINR(product.price)}</span>
              {product.mrp > product.price && (
                <span className="mrp">{formatINR(product.mrp)}</span>
              )}
            </>
          )}
        </div>
        {product.shippingCost === 0 && (
          <div className="pc-meta-row">
            <span className="ship-badge">Free ship</span>
          </div>
        )}
        {rating.count > 0 && (
          <div className="pc-rating">
            <Stars value={rating.avg} count={rating.count} size={13} />
          </div>
        )}
      </div>
    </div>
  );
}
