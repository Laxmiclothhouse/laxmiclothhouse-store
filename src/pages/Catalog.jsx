import React, { useMemo, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useData } from '../context/DataContext.jsx';
import ProductCard from '../components/ProductCard.jsx';

export default function Catalog() {
  const { products, getSalePrice } = useData();
  const [params] = useSearchParams();
  const initialCat = params.get('cat') || '';

  const [category, setCategory] = useState(initialCat);
  const [sort, setSort] = useState('featured');
  const [q, setQ] = useState('');
  const [showSaleOnly, setShowSaleOnly] = useState(false);

  const cats = ['', ...Array.from(new Set(products.map((p) => p.category)))];

  const saleProducts = useMemo(() => {
    return products.filter((p) => {
      const sale = getSalePrice(p);
      return sale.price < (sale.originalPrice || p.price);
    });
  }, [products, getSalePrice]);

  const list = useMemo(() => {
    let res = showSaleOnly ? saleProducts : products;
    if (category) res = res.filter((p) => p.category === category);
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      res = res.filter(
        (p) =>
          p.name.toLowerCase().includes(s) ||
          p.description.toLowerCase().includes(s)
      );
    }
    switch (sort) {
      case 'low': res.sort((a, b) => a.price - b.price); break;
      case 'high': res.sort((a, b) => b.price - a.price); break;
      case 'az': res.sort((a, b) => a.name.localeCompare(b.name)); break;
      default: break;
    }
    return res;
  }, [products, saleProducts, category, q, sort, showSaleOnly]);

  return (
    <main className="page">
      <div className="page-head">
        <h1>Catalog</h1>
        <p>Browse our latest collection</p>
      </div>

      <div className="toolbar">
        <div className="chips">
          {saleProducts.length > 0 && (
            <button
              className={`chip sale-chip ${showSaleOnly ? 'active' : ''}`}
              onClick={() => setShowSaleOnly(!showSaleOnly)}
            >
              🔥 Sale ({saleProducts.length})
            </button>
          )}
          {cats.map((c) => (
            <button
              key={c || 'all'}
              className={`chip ${category === c && !showSaleOnly ? 'active' : ''}`}
              onClick={() => setCategory(c)}
            >
              {c || 'All'}
            </button>
          ))}
        </div>
        <div className="toolbar-right">
          <input
            type="search"
            placeholder="Search products…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="search-input"
          />
          <select value={sort} onChange={(e) => setSort(e.target.value)} className="select">
            <option value="featured">Sort · Featured</option>
            <option value="low">Price: Low to High</option>
            <option value="high">Price: High to Low</option>
            <option value="az">Name: A–Z</option>
          </select>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="center empty">
          <p>No products found.</p>
          <button className="linklike" onClick={() => { setQ(''); setCategory(''); }}>
            Clear filters
          </button>
        </div>
      ) : (
        <div className="product-grid">
          {list.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      )}

      <div className="center">
        <Link to="/track" className="linklike">Already ordered? Track your order →</Link>
      </div>
    </main>
  );
}