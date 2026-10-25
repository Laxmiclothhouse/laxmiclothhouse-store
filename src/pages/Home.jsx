
import React from "react";
import { Link } from "react-router-dom";
import { useData } from "../context/DataContext.jsx";
import ProductCard from "../components/ProductCard.jsx";

const CATS = [
  { name: "Suits", emoji: "Suits", blurb: "2D & 3D designer suits" },
  { name: "Ethnic", emoji: "Ethnic", blurb: "Anarkalis & festive wear" },
  { name: "Lehenga", emoji: "Lehenga", blurb: "Party & bridal sets" },
  { name: "Saree", emoji: "Saree", blurb: "Silk & woven sarees" },
];

export default function Home() {
  const { products, settings, sales, getSalePrice } = useData();
  const [q, setQ] = React.useState("");
  const rowRefs = React.useRef({});

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

  const searchResults = React.useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    return products.filter(
      (p) => p.name.toLowerCase().includes(s) || (p.description || "").toLowerCase().includes(s)
    );
  }, [q, products]);

  const bannerSale = React.useMemo(() => {
    const now = Date.now();
    const usable = sales.filter(
      (s) => s.active !== false && s.imageUrl && (!s.startsAt || new Date(s.startsAt).getTime() <= now) && (!s.endsAt || new Date(s.endsAt).getTime() > now)
    );
    return usable.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))[0] || null;
  }, [sales]);

  const upcomingSale = React.useMemo(() => {
    const now = Date.now();
    const usable = sales.filter((s) => s.active !== false && s.startsAt && new Date(s.startsAt).getTime() > now);
    return usable.sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt))[0] || null;
  }, [sales]);

  const formatDiscount = (sale) => {
    if (!sale) return "";
    if (sale.discountType === "percent") return `${sale.value}% OFF`;
    return `Rs ${sale.value} OFF`;
  };
  const saleScope = (sale) => {
    if (!sale) return "";
    if (sale.type === "category") return `On ${sale.category}`;
    if (sale.type === "product") return "On selected styles";
    if (sale.type === "storewide") return "Storewide";
    if (sale.type === "flash") return "Flash sale";
    return "";
  };
  const formatDate = (v) => {
    if (!v) return "";
    try { return new Date(v).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }); }
    catch { return ""; }
  };

  return (
    <main>
      <section className="hero">
        <div className="hero-inner">
          <p className="eyebrow">New season - Hand-crafted in India</p>
          <h1>{settings.heroHeading}</h1>
          <p className="lead">{settings.heroSubheading}</p>
          <div className="hero-cta">
            <Link to="/catalog" className="btn btn-gold">Shop the collection</Link>
            <Link to="/track" className="btn btn-ghost">Track your order</Link>
          </div>
          <div className="home-search">
            <svg className="home-search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="search"
              placeholder="Search products..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="home-search-input"
            />
          </div>
        </div>
      </section>

      {q.trim() && (
        <section className="section">
          <div className="section-head">
            <p className="eyebrow">Search results</p>
            <h2>{searchResults.length} product{searchResults.length === 1 ? "" : "s"} for "{q.trim()}"</h2>
          </div>
          {searchResults.length === 0 ? (
            <div className="center empty"><p>No products found.</p></div>
          ) : (
            <div className="product-grid">
              {searchResults.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          )}
        </section>
      )}
      {!q.trim() && upcomingSale && (
        <section className="sale-start-alert">
          <span className="sale-start-alert-msg">
            New sale starts {formatDate(upcomingSale.startsAt)}: {upcomingSale.name} - {formatDiscount(upcomingSale)}
          </span>
          <Link to="/catalog" className="sale-start-alert-cta">Preview collection -&gt;</Link>
        </section>
      )}

      {!q.trim() && bannerSale && (
        <section className="sale-banner-wrap">
          <Link to={`/catalog?sale=${encodeURIComponent(bannerSale.id)}`} className="sale-banner" title={bannerSale.name ? `Shop ${bannerSale.name}` : "Shop the sale"}>
            <img src={bannerSale.imageUrl} alt={bannerSale.name || "Sale"} />
            <div className="sale-banner-overlay">
              {bannerSale.name && <span className="sale-banner-pill">{bannerSale.name} -&gt;</span>}
              <div className="sale-banner-content">
                <span className="sale-banner-offer">{formatDiscount(bannerSale)}</span>
                {saleScope(bannerSale) && <span className="sale-banner-scope">{saleScope(bannerSale)}</span>}
                {bannerSale.endsAt && <span className="sale-banner-ends">Ends {formatDate(bannerSale.endsAt)}</span>}
                <span className="sale-banner-cta">Shop now -&gt;</span>
              </div>
            </div>
          </Link>
        </section>
      )}

      {!q.trim() && (
        <>
          {CATS.map((c) => {
            const items = products.filter((p) => p.category === c.name);
            if (!items.length) return null;
            return (
              <section className="section cat-row-section" key={c.name}>
                <div className="section-head cat-row-head">
                  <div>
                    <p className="eyebrow">Shop by category</p>
                    <h2>{c.name}</h2>
                  </div>
                  <Link to={`/catalog?cat=${c.name}`} className="btn btn-outline tiny">View all</Link>
                </div>
                <div className="cat-row-wrap">
                  <button
                    type="button"
                    className="cat-scroll-btn left"
                    aria-label={`Scroll ${c.name} left`}
                    onClick={() => {
                      const el = rowRefs.current[c.name];
                      if (el) el.scrollBy({ left: -320, behavior: 'smooth' });
                    }}
                  >
                    &lsaquo;
                  </button>
                  <div className="cat-row" ref={(el) => { rowRefs.current[c.name] = el; }}>
                    {items.map((p) => (
                      <div className="cat-row-item" key={p.id}>
                        <ProductCard product={p} />
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="cat-scroll-btn right"
                    aria-label={`Scroll ${c.name} right`}
                    onClick={() => {
                      const el = rowRefs.current[c.name];
                      if (el) el.scrollBy({ left: 320, behavior: 'smooth' });
                    }}
                  >
                    &rsaquo;
                  </button>
                </div>
              </section>
            );
          })}

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

          {saleProducts.length > 0 && (
            <section className="section cream">
              <div className="section-head">
                <p className="eyebrow">Limited time offers</p>
                <h2>Sale - Shop Now &amp; Save</h2>
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
        </>
      )}
    </main>
  );
}
