// Sizes shared by admin + storefront (backward compatible).
// product.sizes = ['S', 'M', ...]; missing/empty = free-size.

/** Normalised size list for a product (upper-cased, de-duplicated). */
export function normalizeSizes(product) {
  const raw = Array.isArray(product?.sizes) ? product.sizes : [];
  const out = [];
  for (const s of raw) {
    const v = String(s || '').trim().toUpperCase();
    if (v && !out.includes(v)) out.push(v);
  }
  return out;
}

/** True when the product asks the customer to pick a size. */
export function hasSizes(product) {
  return normalizeSizes(product).length > 0;
}
