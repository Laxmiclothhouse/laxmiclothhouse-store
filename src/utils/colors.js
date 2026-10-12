// ─────────────────────────────────────────────────────────────
// colors.js — colour-variant helpers shared by admin + storefront.
//
// Data model (backward compatible):
//   product.colors = [{ name, hex, images: [url, ...] }, ...]
// Legacy products without `colors` fall back to `images`/`image`
// and show no colour picker.
// ─────────────────────────────────────────────────────────────

/**
 * Normalise a product's colour variants.
 * @returns {Array<{name:string, hex:string, images:string[]}>}
 */
export function normalizeColors(product) {
  if (!product) return [];
  const raw = Array.isArray(product.colors) ? product.colors : [];
  const out = [];
  for (const c of raw) {
    if (!c) continue;
    const name = String(c.name || '').trim();
    if (!name) continue;
    const imgs = Array.isArray(c.images)
      ? c.images.filter((u) => typeof u === 'string' && u.trim() !== '')
      : [];
    out.push({ name, hex: c.hex || '#9b1c3d', images: imgs });
  }
  return out;
}

/** True when the product has selectable colour variants. */
export function hasColorVariants(product) {
  return normalizeColors(product).length > 0;
}

/**
 * Images to show for a selected colour. Falls back to the legacy
 * product.images / product.image when the variant has no images
 * or when no colour is selected.
 */
export function imagesForColor(product, colorName) {
  const legacy = (Array.isArray(product?.images) && product.images.length > 0
    ? product.images
    : product?.image
      ? [product.image]
      : []
  ).filter((u) => typeof u === 'string' && u.trim() !== '');
  if (!colorName) return legacy;
  const v = normalizeColors(product).find(
    (c) => c.name.toLowerCase() === String(colorName).trim().toLowerCase()
  );
  if (!v) return legacy;
  return v.images.length > 0 ? v.images : legacy;
}

/** First usable image for a colour variant (for cart thumbnails). */
export function firstImageForColor(product, colorName) {
  const imgs = imagesForColor(product, colorName);
  return imgs.length > 0 ? imgs[0] : (product?.image || '');
}
