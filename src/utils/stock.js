// ─────────────────────────────────────────────────────────────
// stock.js — per-variant (colour × size) stock helpers.
//
// Data model (backward compatible):
//   product.stock            — legacy total / fallback (number)
//   product.stockByVariant   — { "ORANGE::S": 5, ... } explicit cells
//
// Key format: `${COLOR}::${SIZE}` upper-cased + trimmed.
//   colours only → "ORANGE::"
//   sizes only   → "::S"
//   neither      → use product.stock directly.
// Missing cell → falls back to product.stock (so old products and
// newly-added variants keep selling until the admin sets exact numbers).
// ─────────────────────────────────────────────────────────────

export function variantKey(colorName, size) {
  const c = String(colorName || '').trim().toUpperCase();
  const s = String(size || '').trim().toUpperCase();
  return `${c}::${s}`;
}

export function getVariantMap(product) {
  const m = product?.stockByVariant;
  return m && typeof m === 'object' && !Array.isArray(m) ? m : {};
}

function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/** Explicit cell value, or null when the admin never set it. */
export function explicitVariantStock(product, colorName, size) {
  const map = getVariantMap(product);
  const k = variantKey(colorName, size);
  if (Object.prototype.hasOwnProperty.call(map, k)) return Math.max(0, num(map[k], 0));
  return null;
}

/**
 * Effective stock for one colour × size combo.
 * Explicit cell wins; otherwise falls back to product.stock.
 */
export function getVariantStock(product, colorName, size) {
  const explicit = explicitVariantStock(product, colorName, size);
  if (explicit !== null) return explicit;
  return Math.max(0, num(product?.stock, 0));
}

/** All combos implied by the product's colours × sizes. */
export function listCombos(product, colors, sizes) {
  const cs = Array.isArray(colors) && colors.length > 0
    ? colors.map((c) => (typeof c === 'string' ? c : c?.name || ''))
    : [''];
  const ss = Array.isArray(sizes) && sizes.length > 0 ? sizes : [''];
  const combos = [];
  for (const c of cs) {
    for (const s of ss) {
      combos.push({ color: c || '', size: s || '' });
    }
  }
  return combos;
}

/** Sum of effective stock across every colour × size combo. */
export function getTotalVariantStock(product, colors, sizes) {
  const combos = listCombos(product, colors, sizes);
  if (combos.length === 0) return Math.max(0, num(product?.stock, 0));
  return combos.reduce((sum, cb) => sum + getVariantStock(product, cb.color, cb.size), 0);
}

/** True when the product uses variant-level stock at all. */
export function usesVariantStock(product) {
  return Object.keys(getVariantMap(product)).length > 0;
}

/** Stock left for a whole colour (across its sizes). */
export function getColorStock(product, colorName, sizes) {
  const ss = Array.isArray(sizes) && sizes.length > 0 ? sizes : [''];
  return ss.reduce((sum, s) => sum + getVariantStock(product, colorName, s), 0);
}

/** Stock left for a whole size (across its colours). */
export function getSizeStock(product, size, colors) {
  const cs = Array.isArray(colors) && colors.length > 0
    ? colors.map((c) => (typeof c === 'string' ? c : c?.name || ''))
    : [''];
  return cs.reduce((sum, c) => sum + getVariantStock(product, c, size), 0);
}
