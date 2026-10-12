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
function legacyGallery(product) {
  return (Array.isArray(product?.images) && product.images.length > 0
    ? product.images
    : product?.image
      ? [product.image]
      : []
  ).filter((u) => typeof u === 'string' && u.trim() !== '');
}

/**
 * Images to show for a selected colour.
 *  - colour chosen  → that colour's photos (may be empty → caller shows "No image")
 *  - no colour yet  → legacy main gallery, else first colour's photos, else empty
 */
export function imagesForColor(product, colorName) {
  if (colorName) {
    const v = normalizeColors(product).find(
      (c) => c.name.toLowerCase() === String(colorName).trim().toLowerCase()
    );
    if (v) return v.images;
    return legacyGallery(product);
  }
  const main = legacyGallery(product);
  if (main.length > 0) return main;
  for (const c of normalizeColors(product)) {
    if (c.images.length > 0) return c.images;
  }
  return [];
}

/** First usable image for a colour variant (for cart thumbnails). */
export function firstImageForColor(product, colorName) {
  const imgs = imagesForColor(product, colorName);
  if (imgs.length > 0) return imgs[0];
  return displayImage(product);
}

/**
 * Display image for product cards / detail hero.
 *
 * Priority:
 *  1. Legacy main image — first non-blank entry of product.images,
 *     else product.image.
 *  2. First colour variant that has photos (first colour, first image).
 *  3. '' — caller renders the "No image" placeholder.
 */
export function displayImage(product) {
  if (!product) return '';
  const clean = (u) => typeof u === 'string' && u.trim() !== '' ? u : '';
  if (Array.isArray(product.images)) {
    const found = product.images.map(clean).find(Boolean);
    if (found) return found;
  }
  const main = clean(product.image);
  if (main) return main;
  for (const c of normalizeColors(product)) {
    if (c.images.length > 0) return c.images[0];
  }
  return '';
}
