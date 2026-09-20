import React, { useMemo, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useData } from '../context/DataContext.jsx';
import ProductCard from '../components/ProductCard.jsx';
import { formatINR } from '../utils/format.js';

export default function Catalog() {
  const { products, sales, getSalePrice } = useData();
  const [params, setParams] = useSearchParams();
  const initialCat = params.get('cat') || '';

  const [category, setCategory] = useState(initialCat);
  // Sale filter — deep-linkable as ?sale=all or ?sale=<saleId>, which is how
  // the home-page sale banner lands on exactly that sale's products.
  const [saleFilter, setSaleFilter] = useState(params.get('sale') || '');
  const [sort, setSort] = useState('featured');
  const [q, setQ] = useState('');

  // Keep the filter in sync with the URL (banner clicks, back/forward).
  React.useEffect(() => {
    setSaleFilter(params.get('sale') || '');
  }, [params]);

  const cats = ['', ...Array.from(new Set(products.map((p) => p.category)))];

  // Only admin-created sales qualify — an MRP above the selling price is
  // ordinary shop pricing, so it never populates the Sale chip.
  const saleProducts = useMemo(
    () => products.filter((p) => getSalePrice(p).hasSale),
    [products, getSalePrice]
  );

  const activeSale =
    saleFilter && saleFilter !== 'all' ? sales.find((s) => s.id === saleFilter) || null : null;

  const list = useMemo(() => {
    let res = [...products];
    if (saleFilter) {
      res = res.filter((p) => {
        const sale = getSalePrice(p);
        if (!sale.hasSale) return false;
        return saleFilter === 'all' ? true : sale.saleId === saleFilter;
      });
    }
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
  }, [products, getSalePrice, saleFilter, category, q, sort]);

  // Mirror the sale filter into the URL so it can be refreshed/shared.
  const setSaleParam = (value) => {
    const next = new URLSearchParams(params);
    if (value) next.set('sale', value);
    else next.delete('sale');
    setParams(next, { replace: true });
  };

  const pickSale = () => {
    const value = saleFilter ? '' : 'all';
    setSaleFilter(value);
    setSaleParam(value);
    if (value) setCategory('');
  };

  const pickCategory = (c) => {
    setCategory(c);
    if (saleFilter) {
      setSaleFilter('');
      setSaleParam('');
    }
  };

  const clearAll = () => {
    setQ('');
    setCategory('');
    setSaleFilter('');
    setSaleParam('');
  };

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
              className={`chip sale-chip ${saleFilter ? 'active' : ''}`}
              onClick={pickSale}
            >
              🔥 Sale ({saleProducts.length})
            </button>
          )}
          {cats.map((c) => (
            <button
              key={c || 'all'}
              className={`chip ${category === c && !saleFilter ? 'active' : ''}`}
              onClick={() => pickCategory(c)}
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

      {activeSale && (
        <p className="sale-filter-note">
          Showing <strong>{activeSale.name || 'this sale'}</strong>
          {activeSale.discountType === 'percent'
            ? ` — ${activeSale.value}% off`
            : ` — ${formatINR(activeSale.value)} off`}
        </p>
      )}

      {list.length === 0 ? (
        <div className="center empty">
          <p>No products found.</p>
          <button className="linklike" onClick={clearAll}>
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