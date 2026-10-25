import React from 'react';
import { Link } from 'react-router-dom';
import { formatINR } from '../utils/format.js';
import { useData } from '../context/DataContext.jsx';
import { displayImage } from '../utils/colors.js';
import { normalizeColors } from '../utils/colors.js';
import { normalizeSizes } from '../utils/sizes.js';
import { getTotalVariantStock } from '../utils/stock.js';

export default function ProductCard({ product }) {
  const colorOptions = normalizeColors(product);
  const sizeOptions = normalizeSizes(product);
  const colorNames = colorOptions.map((c) => c.name);
  const totalStock = (colorOptions.length > 0 || sizeOptions.length > 0)
    ? getTotalVariantStock(product, colorNames, sizeOptions)
    : product.stock;
  const soldOut = totalStock <= 0;

  const { getSalePrice } = useData();
  const sale = getSalePrice(product);
  const onSale = sale.hasSale;

  const imgSrc = displayImage(product);
  const [failedSrc, setFailedSrc] = React.useState(null);
  const hasImage = Boolean(imgSrc) && failedSrc !== imgSrc;

  const band = soldOut ? 'Sold out' : hasImage ? '' : 'No image';

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
          {!soldOut && onSale && (
            <span className="ribbon sale">
              {sale.saleLabel || 'SALE'}
              {sale.originalPrice > sale.price && (
                <span className="ribbon-pct">
                  {Math.round(((sale.originalPrice - sale.price) / sale.originalPrice) * 100)}% OFF
                </span>
              )}
            </span>
          )}
          {!soldOut && !onSale && product.shippingCost === 0 && <span className="ribbon free">Free ship</span>}
        </Link>
      </div>
      <div className="pc-body">
        <h3>
          <Link to={`/product/${product.id}`}>{product.name}</Link>
        </h3>
        <div className="pc-price">
          <span className="price">{formatINR(onSale ? sale.price : product.price)}</span>
          {onSale && sale.originalPrice > sale.price && (
            <span className="mrp">{formatINR(sale.originalPrice)}</span>
          )}
        </div>
      </div>
    </div>
  );
}
