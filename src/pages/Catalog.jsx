import React, { useMemo, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useData } from '../context/DataContext.jsx';
import ProductCard from '../components/ProductCard.jsx';
import { formatINR } from '../utils/format.js';

export default function Catalog() {
  const { products, sales, getSalePrice } = useData();
  const [params, setParams] = useSearchParams();
  const initialCat = params.get('cat') || '';

  const [selectedCats, setSelectedCats] = useState(initialCat ? [initialCat] : []);
  const [saleFilter, setSaleFilter] = useState(params.get('sale') || '');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [sort, setSort] = useState('featured');
  const [q, setQ] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);

  React.useEffect(() => {
    setSaleFilter(params.get('sale') || '');
  }, [params]);

  const cats = Array.from(new Set(products.map((p) => p.category))).sort();

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
    if (selectedCats.length) res = res.filter((p) => selectedCats.includes(p.category));
    if (priceMin) res = res.filter((p) => p.price >= Number(priceMin));
    if (priceMax) res = res.filter((p) => p.price <= Number(priceMax));
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
  }, [products, getSalePrice, saleFilter, selectedCats, priceMin, priceMax, q, sort]);

  const setSaleParam = (value) => {
    const next = new URLSearchParams(params);
    if (value) next.set('sale', value);
    else next.delete('sale');
    setParams(next, { replace: true });
  };

  const toggleCat = (c) => {
    setSelectedCats((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
    );
  };

  const toggleSale = (checked) => {
    const value = checked ? 'all' : '';
    setSaleFilter(value);
    setSaleParam(value);
  };

  const clearAll = () => {
    setSelectedCats([]);
    setPriceMin('');
    setPriceMax('');
    setQ('');
    setSaleFilter('');
    setSaleParam('');
  };
  return (
    <main className="page">
      <div className="page-head">
        <h1>Catalog</h1>
        <p>Browse our latest collection</p>
      </div>

      <div className="catalog-layout">
        <aside className={`filters ${filtersOpen ? 'open' : ''}`}>
          <div className="filters-head">
            <h3>Filters</h3>
            <button className="linklike" onClick={clearAll}>Clear all</button>
          </div>

          <div className="filter-section">
            <h4>Categories</h4>
            {cats.map((c) => (
              <label key={c} className="filter-check">
                <input
                  type="checkbox"
                  checked={selectedCats.includes(c)}
                  onChange={() => toggleCat(c)}
                />
                <span>{c}</span>
              </label>
            ))}
          </div>

          {saleProducts.length > 0 && (
            <div className="filter-section">
              <h4>Sale</h4>
              <label className="filter-check">
                <input
                  type="checkbox"
                  checked={!!saleFilter}
                  onChange={(e) => toggleSale(e.target.checked)}
                />
                <span>On sale ({saleProducts.length})</span>
              </label>
            </div>
          )}

          <div className="filter-section">
            <h4>Price</h4>
            <div className="price-range">
              <input
                type="number"
                placeholder="Min"
                value={priceMin}
                onChange={(e) => setPriceMin(e.target.value)}
              />
              <span>to</span>
              <input
                type="number"
                placeholder="Max"
                value={priceMax}
                onChange={(e) => setPriceMax(e.target.value)}
              />
            </div>
          </div>
        </aside>

        <section className="catalog-main">
          <div className="toolbar">
            <button className="btn btn-outline filter-toggle" onClick={() => setFiltersOpen((v) => !v)}>
              {filtersOpen ? 'Hide filters' : 'Show filters'}
            </button>
            <div className="toolbar-right">
              <input
                type="search"
                placeholder="Search products..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="search-input"
              />
              <select value={sort} onChange={(e) => setSort(e.target.value)} className="select">
                <option value="featured">Sort - Featured</option>
                <option value="low">Price: Low to High</option>
                <option value="high">Price: High to Low</option>
                <option value="az">Name: A-Z</option>
              </select>
            </div>
          </div>

          {activeSale && (
            <p className="sale-filter-note">
              Showing <strong>{activeSale.name || 'this sale'}</strong>
              {activeSale.discountType === 'percent'
                ? ` - ${activeSale.value}% off`
                : ` - ${formatINR(activeSale.value)} off`}
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
            <Link to="/track" className="linklike">Already ordered? Track your order -&gt;</Link>
          </div>
        </section>
      </div>
    </main>
  );
}
