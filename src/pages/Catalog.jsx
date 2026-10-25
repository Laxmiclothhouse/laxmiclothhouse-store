import React, { useMemo, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useData } from '../context/DataContext.jsx';
import ProductCard from '../components/ProductCard.jsx';
import { formatINR } from '../utils/format.js';
import { normalizeColors } from '../utils/colors.js';
import { normalizeSizes } from '../utils/sizes.js';
import { getTotalVariantStock } from '../utils/stock.js';

function totalStock(p) {
  const colors = normalizeColors(p);
  const sizes = normalizeSizes(p);
  const colorNames = colors.map((c) => c.name);
  return colors.length > 0 || sizes.length > 0
    ? getTotalVariantStock(p, colorNames, sizes)
    : Number(p?.stock || 0);
}

export default function Catalog() {
  const { products, sales, getSalePrice, ratingFor } = useData();
  const [params, setParams] = useSearchParams();
  const initialCat = params.get('cat') || '';

  const [selectedCats, setSelectedCats] = useState(initialCat ? [initialCat] : []);
  const [saleFilter, setSaleFilter] = useState(params.get('sale') || '');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [sort, setSort] = useState('featured');
  const [q, setQ] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [minRating, setMinRating] = useState(0);

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
          (p.description || '').toLowerCase().includes(s)
      );
    }
    if (inStockOnly) res = res.filter((p) => totalStock(p) > 0);
    if (minRating > 0) {
      res = res.filter((p) => ratingFor(p.id).avg >= minRating);
    }
    switch (sort) {
      case 'low':
        res.sort((a, b) => a.price - b.price);
        break;
      case 'high':
        res.sort((a, b) => b.price - a.price);
        break;
      case 'az':
        res.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'za':
        res.sort((a, b) => b.name.localeCompare(a.name));
        break;
      case 'rating':
        res.sort((a, b) => ratingFor(b.id).avg - ratingFor(a.id).avg);
        break;
      default:
        break;
    }
    return res;
  }, [products, getSalePrice, saleFilter, selectedCats, priceMin, priceMax, q, sort, inStockOnly, minRating, ratingFor]);

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
    setInStockOnly(false);
    setMinRating(0);
    setSort('featured');
  };

  const activeFilterCount =
    selectedCats.length +
    (saleFilter ? 1 : 0) +
    (priceMin || priceMax ? 1 : 0) +
    (q.trim() ? 1 : 0) +
    (inStockOnly ? 1 : 0) +
    (minRating > 0 ? 1 : 0) +
    (sort !== 'featured' ? 1 : 0);
  return (
    <main className="page">
      <div className="page-head">
        <h1>Catalog</h1>
        <p>Browse our latest collection</p>
      </div>

      <div className="catalog-layout">
        <aside className={`filters ${filtersOpen ? 'open' : ''}`}>
          <div className="filters-head">
            <h3>Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}</h3>
            <button className="linklike" onClick={clearAll}>Clear all</button>
          </div>

          <div className="filter-section">
            <h4>Search</h4>
            <input
              type="search"
              placeholder="Search products..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="search-input"
              style={{ width: '100%' }}
            />
          </div>

          <div className="filter-section">
            <h4>Sort by</h4>
            <select value={sort} onChange={(e) => setSort(e.target.value)} className="select" style={{ width: '100%' }}>
              <option value="featured">Featured</option>
              <option value="low">Price: Low to High</option>
              <option value="high">Price: High to Low</option>
              <option value="az">Name: A-Z</option>
              <option value="za">Name: Z-A</option>
              <option value="rating">Rating: High to Low</option>
            </select>
          </div>

          <div className="filter-section">
            <h4>Availability</h4>
            <label className="filter-check">
              <input
                type="checkbox"
                checked={inStockOnly}
                onChange={(e) => setInStockOnly(e.target.checked)}
              />
              <span>In stock only</span>
            </label>
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

          <div className="filter-section">
            <h4>Rating</h4>
            {[4, 3, 2, 1].map((r) => (
              <label key={r} className="filter-check">
                <input
                  type="radio"
                  name="minRating"
                  checked={minRating === r}
                  onChange={() => setMinRating(r)}
                />
                <span>{r}★ &amp; up</span>
              </label>
            ))}
            <label className="filter-check">
              <input
                type="radio"
                name="minRating"
                checked={minRating === 0}
                onChange={() => setMinRating(0)}
              />
              <span>Any rating</span>
            </label>
          </div>
        </aside>

        <section className="catalog-main">
          <div className="toolbar">
            <button className="btn btn-outline filter-toggle" onClick={() => setFiltersOpen((v) => !v)} aria-label="Toggle filters" title="Filters">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
              </svg>
              <span>Filters</span>
              {activeFilterCount > 0 && <span className="filter-badge">{activeFilterCount}</span>}
            </button>
            <div className="catalog-search">
              <svg className="catalog-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="search"
                placeholder="Search products..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="catalog-search-input"
              />
            </div>
            <span className="muted tiny">{list.length} product{list.length === 1 ? '' : 's'}</span>
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
