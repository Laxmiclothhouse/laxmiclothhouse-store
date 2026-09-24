import React from 'react';
import { Link } from 'react-router-dom';
import { useData } from '../context/DataContext.jsx';
import ProductCard from '../components/ProductCard.jsx';

const CATS = [
  { name: 'Suits', emoji: '👗', blurb: '2D & 3D designer suits' },
  { name: 'Ethnic', emoji: '🌸', blurb: 'Anarkalis & festive wear' },
  { name: 'Lehenga', emoji: '✨', blurb: 'Party & bridal sets' },
  { name: 'Saree', emoji: '🥻', blurb: 'Silk & woven sarees' },
];

export default function Home() {
  const { products, settings, sales, getSalePrice } = useData();
  const featured = products.filter((p) => p.featured);

  const saleProducts = products
    .map((p) => ({ product: p, sale: getSalePrice(p) }))
    .filter(({ sale }) => sale.hasSale)
    .sort((a, b) => {
      const aPct = a.sale.originalPrice ? ((a.sale.originalPrice - a.sale.price) / a.sale.originalPrice) : 0;
      const bPct = b.sale.originalPrice ? ((b.sale.originalPrice - b.sale.price) / b.sale.originalPrice) : 0;
      return bPct - aPct;
    })
    .slice(0, 8)
    .map(({ product, sale }) => ({ product, sale }));

  // Optional artwork for a running sale: shown on the home page as a
  // clickable banner that leads to that sale's products. No image on the
  // sale → nothing is rendered (the feature is entirely optional).
  const bannerSale = React.useMemo(() => {
    const now = Date.now();
    const usable = sales.filter(
      (s) =>
        s.active !== false &&
        s.imageUrl &&
        (!s.startsAt || new Date(s.startsAt).getTime() <= now) &&
        (!s.endsAt || new Date(s.endsAt).getTime() > now)
    );
    return usable.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))[0] || null;
  }, [sales]);

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

      {/* optional sale banner — rendered only when the admin attached an
          image to a running sale; clicking it opens that sale's products */}
      {bannerSale && (
        <section className="sale-banner-wrap">
          <Link
            to={`/catalog?sale=${encodeURIComponent(bannerSale.id)}`}
            className="sale-banner"
            title={bannerSale.name ? `Shop ${bannerSale.name}` : 'Shop the sale'}
          >
            <img src={bannerSale.imageUrl} alt={bannerSale.name || 'Sale'} />
            {bannerSale.name && <span className="sale-banner-pill">{bannerSale.name} →</span>}
          </Link>
        </section>
      )}

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
        <section className="section cream">
          <div className="section-head">
            <p className="eyebrow">Limited time offers</p>
            <h2>🔥 Sale — Shop Now & Save</h2>
          </div>
          <div className="product-grid">
            {saleProducts.map(({ product }) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
          <div className="center">
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
          <span>📞</span>
          <strong>Support</strong>
          <p>We're here to help you</p>
        </div>
      </section>
    </main>
  );
}