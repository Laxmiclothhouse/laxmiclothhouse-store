import React from 'react';
import { Link } from 'react-router-dom';
import { useData } from '../context/DataContext.jsx';
import ProductCard from '../components/ProductCard.jsx';
import { formatINR } from '../utils/format.js';

const CATS = [
  { name: 'Suits', emoji: '👗', blurb: '2D & 3D designer suits' },
  { name: 'Ethnic', emoji: '🌸', blurb: 'Anarkalis & festive wear' },
  { name: 'Lehenga', emoji: '✨', blurb: 'Party & bridal sets' },
  { name: 'Saree', emoji: '🥻', blurb: 'Silk & woven sarees' },
];

export default function Home() {
  const { products, settings, getSalePrice } = useData();
  const featured = products.filter((p) => p.featured);

  const saleProducts = products
    .map((p) => ({ product: p, sale: getSalePrice(p) }))
    .filter(({ product, sale }) => sale.price < (sale.originalPrice || product.price))
    .sort((a, b) => {
      const aPct = a.sale.originalPrice ? ((a.sale.originalPrice - a.sale.price) / a.sale.originalPrice) : 0;
      const bPct = b.sale.originalPrice ? ((b.sale.originalPrice - b.sale.price) / b.sale.originalPrice) : 0;
      return bPct - aPct;
    })
    .slice(0, 8)
    .map(({ product, sale }) => ({ product, sale }));

  return (
    <main>
      {/* hero */}
      <section className="hero">
        <div className="hero-inner">
          <p className="eyebrow">New season · Hand-crafted in India</p>
          <h1>
            {settings.heroHeading}
          </h1>
          <p className="lead">
            {settings.heroSubheading}
          </p>
          <div className="hero-cta">
            <Link to="/catalog" className="btn btn-gold">Shop the collection</Link>
            <Link to="/track" className="btn btn-ghost">Track your order</Link>
          </div>
        </div>
      </section>

      {/* categories */}
      <section className="section">
        <div className="section-head">
          <p className="eyebrow">Shop by category</p>
          <h2>Categories</h2>
        </div>
        <div className="cat-grid">
          {CATS.map((c) => (
            <Link to={`/catalog?cat=${c.name}`} key={c.name} className="cat-card">
              <span className="cat-emoji">{c.emoji}</span>
              <strong>{c.name}</strong>
              <span>{c.blurb}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* featured */}
      <section className="section cream">
        <div className="section-head">
          <p className="eyebrow">Handpicked for you</p>
          <h2>Featured Products</h2>
        </div>
        <div className="product-grid">
          {featured.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
        <div className="center">
          <Link to="/catalog" className="btn btn-dark">View all products</Link>
        </div>
      </section>

      {/* sale section */}
      {saleProducts.length > 0 && (
        <section className="section sale-section">
          <div className="section-head">
            <p className="eyebrow">Limited time offers</p>
            <h2>🔥 Sale — Shop Now & Save</h2>
          </div>
          <div className="sale-grid">
            {saleProducts.map(({ product, sale }) => (
              <Link to={`/catalog?sale=${product.id}`} key={product.id} className="sale-card">
                <div className="sale-card-badge">
                  {sale.saleLabel || `${Math.round(((sale.originalPrice - sale.price) / sale.originalPrice) * 100)}% off`}
                </div>
                <div className="sale-card-img">
                  <img src={product.images?.[0] || product.image} alt={product.name} loading="lazy" />
                </div>
                <div className="sale-card-body">
                  <h4>{product.name}</h4>
                  <div className="sale-card-price">
                    <span className="current">{formatINR(sale.price)}</span>
                    <span className="original">{formatINR(sale.originalPrice)}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
          <div className="center" style={{ marginTop: 16 }}>
            <Link to="/catalog" className="btn btn-dark">View all sale products</Link>
          </div>
        </section>
      )}

      {/* features strip */}
      <section className="features">
        <div className="feat">
          <span>🚚</span>
          <strong>Fast Delivery</strong>
          <p>Pan-India doorstep delivery</p>
        </div>
        <div className="feat">
          <span>💳</span>
          <strong>Easy Payments</strong>
          <p>UPI · Cards · Cash on Delivery</p>
        </div>
        <div className="feat">
          <span>↩️</span>
          <strong>Easy Returns</strong>
          <p>7-day hassle-free returns</p>
        </div>
        <div className="feat">
          <span>📞</span>
          <strong>Support</strong>
          <p>We're here to help you</p>
        </div>
      </section>
    </main>
  );
}