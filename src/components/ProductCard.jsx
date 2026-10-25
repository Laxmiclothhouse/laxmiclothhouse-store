import React from 'react';
import { Link } from 'react-router-dom';
import { formatINR } from '../utils/format.js';
import { useData } from '../context/DataContext.jsx';
import { displayImage } from '../utils/colors.js';

export default function ProductCard({ product }) {
  const { getSalePrice } = useData();
  const sale = getSalePrice(product);
  const onSale = sale.hasSale;
  const imgSrc = displayImage(product);
  const [failedSrc, setFailedSrc] = React.useState(null);
  const hasImage = Boolean(imgSrc) && failedSrc !== imgSrc;

  return (
    <div className="product-card">
      <div className="pc-imgwrap">
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
        </Link>
      </div>
      <div className="pc-body">
        <h3>
          <Link to={`/product/${product.id}`}>{product.name}</Link>
        </h3>
        <div className="pc-price">
          <span className="price">{formatINR(onSale ? sale.price : product.price)}</span>
        </div>
      </div>
    </div>
  );
}
