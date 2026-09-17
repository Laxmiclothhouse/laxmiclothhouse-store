// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// db.js â€” localStorage persistence layer for the whole store.
// Provides a tiny synchronous "database" with seeding support.
// Syncs to Firebase Firestore for cross-device consistency.
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

import { initFirebase, isFirebaseReady, firestoreSet, firestoreGet, firestoreListen } from './firebase.js';

const KEYS = {
  users: 'houselaxmicloth_users',
  products: 'houselaxmicloth_products',
  orders: 'houselaxmicloth_orders',
  session: 'houselaxmicloth_session',
  cart: 'houselaxmicloth_cart',
  settings: 'houselaxmicloth_settings',
  wishlist: 'houselaxmicloth_wishlist',
  reviews: 'houselaxmicloth_reviews',
  messages: 'houselaxmicloth_messages',
  coupons: 'houselaxmicloth_coupons',
  payments: 'houselaxmicloth_payments',
  returns: 'houselaxmicloth_returns',
  sales: 'houselaxmicloth_sales',

};

// Initialize Firebase (non-blocking)
initFirebase();

// Sync helpers - write to Firestore when localStorage changes
function syncToFirestore(key, data) {
  if (!isFirebaseReady()) return;
  const collection = key.replace('houselaxmicloth_', '');
  firestoreSet('store', collection, { data, updatedAt: Date.now() });
}

// Listen for Firestore changes and update localStorage
export function listenFromFirestore(key, callback) {
  if (!isFirebaseReady()) return;
  const collection = key.replace('houselaxmicloth_', '');
  firestoreListen('store', collection, (docData) => {
    if (docData && docData.data) {
      localStorage.setItem(key, JSON.stringify(docData.data));
      callback(docData.data);
    }
  });
}

// ---- generic helpers ----------------------------------------
function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function uid(prefix = '') {
  return (
    prefix +
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 8).toUpperCase()
  );
}

// ---- Product image placeholder (data URI) -------------------
export function productImage(label, color = '#9b1c3d') {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='600' height='750'>
    <defs>
      <linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
        <stop offset='0' stop-color='${color}'/>
        <stop offset='1' stop-color='#000' stop-opacity='0.65'/>
      </linearGradient>
    </defs>
    <rect width='100%' height='100%' fill='url(#g)'/>
    <g fill='rgba(255,255,255,0.14)'>
      <circle cx='90' cy='120' r='70'/><circle cx='510' cy='640' r='110'/>
      <path d='M0 520 Q150 420 300 540 T600 520 L600 750 L0 750 Z'/>
    </g>
    <text x='50%' y='50%' font-family="Georgia, serif" font-size='52' fill='#fff'
      text-anchor='middle' dominant-baseline='middle' font-weight='bold'>${label}</text>
  </svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

// ---- Product seeds ------------------------------------------
const PALETTE = ['#9b1c3d', '#7a1f3d', '#8a5a2b', '#5b2c6f', '#146c64', '#a24b18'];

function seedProducts() {
  const names = [
    ['2D Suit', 'Classic 2D printed suit set with matching dupatta.'],
    ['2D Suit â€” Teej Special', 'Festive teej special 2D suit in rich colours.'],
    ['3D Flowers', 'Hand-worked 3D floral design on premium fabric.'],
    ['3D Punjab Suit', 'Heavy 3D Punjabi-style designer suit.'],
    ['3D Suit (Maroon)', 'Elegant maroon 3D designer suit for occasions.'],
    ['3D Suit (Teal)', 'Stunning teal 3D suit with fine embroidery.'],
    ['Designer Anarkali', 'Flowing anarkali with delicate gota detailing.'],
    ['Party Wear Lehenga', 'Sparkling party lehenga with zari work.'],
    ['Cotton Daily Suit', 'Light and breathable everyday cotton suit.'],
    ['Silk Saree', 'Pure silk saree with woven border.'],
  ];
  const prices = [2550, 3850, 3250, 4650, 4050, 3250, 2950, 5450, 1790, 4200];
  const cats = ['Suits', 'Suits', 'Suits', 'Suits', 'Suits', 'Suits', 'Ethnic', 'Lehenga', 'Daily Wear', 'Saree'];

  // shippingCost: per-unit shipping fee (0 = free for that product)
  // paymentMethods: which online/COD methods this product accepts
  // returnsAccepted / returnDays: return window for this product
  const shipCosts = [99, 99, 120, 150, 120, 99, 99, 180, 50, 130];
  const payMethods = [
    ['upi', 'card', 'cod'], ['upi', 'card', 'cod'], ['upi', 'card', 'cod'],
    ['upi', 'card'], ['upi', 'card', 'cod'], ['upi', 'card', 'cod'],
    ['upi', 'card', 'cod'], ['upi', 'card'], ['cod'], ['upi', 'card', 'cod'],
  ];
  const retAccept = [true, true, true, false, true, true, true, false, true, true];
  const retDays =   [7, 7, 10, 0, 7, 7, 7, 0, 10, 7];

  return names.map((n, i) => ({
    id: 'P' + (i + 1),
    name: n[0],
    description: n[1],
    category: cats[i],
    price: prices[i],
    mrp: Math.round(prices[i] * 1.25 / 10) * 10,
    stock: i % 4 === 2 ? 0 : 20 + i * 5,
    color: PALETTE[i % PALETTE.length],
    image: productImage(n[0].toUpperCase(), PALETTE[i % PALETTE.length]),
    images: [productImage(n[0].toUpperCase(), PALETTE[i % PALETTE.length])],
    
    images: [productImage(n[0].toUpperCase(), PALETTE[i % PALETTE.length])],
    featured: i < 6,
    shippingCost: shipCosts[i],
    paymentMethods: payMethods[i],
    returnsAccepted: retAccept[i],
    weightGrams: 500,
    returnDays: retDays[i],
  }));
}

// ---- Seed users ---------------------------------------------
function seedUsers() {
  return [
    {
      id: 'U-admin',
      name: 'Store Admin',
      email: 'admin@houselaxmicloth.store',
      // password stored plainly for demo purposes (hint only)
      password: 'admin123',
      role: 'admin',
    },
  ];
}

// ---- Default site settings ---------------------------------
const DEFAULT_SETTINGS = {
  storeName: 'Houselaxmicloth Suit Collection',
     logoUrl: null,
   logoWidth: 40,
   logoLetter: 'B',
  tagline: 'Suit Collection',
  announcement: 'Free shipping on orders above â‚¹1499 Â· COD available across India',
  heroHeading: 'Designer Suits & Ethnic Elegance',
  heroSubheading:
    'Heavy 3D work, rich zari, finest fabrics â€” made for your special days.',
  contactPhone: '+91 98765 43210',
  contactEmail: 'support@houselaxmicloth.store',
  contactAddress:
    'Najafgarh Road, Near Balour More, Opp. Sector 9, Bahadurgarh â€” 124507',
  // Razorpay merchant key. Use a TEST key for the sandbox,
  // or your LIVE key for real payments. Managed in Admin â†’ Settings.
  razorpayKeyId: 'rzp_test_TYAM6GyacLBRrL',
  paymentMode: 'demo',
    freeShippingThreshold: 1499,
  // Empty list = deliver everywhere (India). Enter pincodes in Admin → Settings
  // to restrict service areas. Delivery promise in days (min–max window).
  serviceablePincodes: [],
  deliveryMinDays: 4,
  deliveryMaxDays: 7,
  shippingSource: 'product',  // 'product' | 'delhivery'
  // Delhivery-style rate card — used when shippingSource === 'delhivery'.
  // A zone key is matched as: longest `pin:12345` prefix → lowercase state
  // name → 'default'. Per zone:
  //   same      flat base charge (₹)
  //   per500g   added for every 500 g slab of parcel weight (₹)
  //   codExtra  surcharge when the payment mode is COD (₹)
  //   minCharge floor for the zone (₹)
  //   freeAbove free shipping at/above this order value (0 = never free)
  // Delhivery has no public unauthenticated rate API — the real numbers come
  // from your Delhivery contract. Edit them in Admin → Settings → Delivery.
  rateCard: {
    zones: {
      'pin:124': { same: 40, per500g: 25, codExtra: 20, minCharge: 60, freeAbove: 0 },
      'pin:12': { same: 60, per500g: 35, codExtra: 25, minCharge: 80, freeAbove: 0 },
      'pin:13': { same: 60, per500g: 35, codExtra: 25, minCharge: 80, freeAbove: 0 },
      default: { same: 90, per500g: 50, codExtra: 40, minCharge: 120, freeAbove: 0 },
    },
  },
};

function seedSettings() {
  write(KEYS.settings, DEFAULT_SETTINGS);
  return DEFAULT_SETTINGS;
}

// ---- Public API ---------------------------------------------
export const db = {
  getUsers() {
    let u = read(KEYS.users, null);
    if (u === null) {
      u = seedUsers();
      write(KEYS.users, u);
    }
    return u;
  },
  saveUsers(u) {
    write(KEYS.users, u);
    syncToFirestore(KEYS.users, u);
  },

  getProducts() {
    let p = read(KEYS.products, null);
    if (p === null) {
      p = seedProducts();
      write(KEYS.products, p);
    }
    return p;
  },
  saveProducts(p) {
    write(KEYS.products, p);
    syncToFirestore(KEYS.products, p);
  },

  getOrders() {
    return read(KEYS.orders, []);
  },
  saveOrders(o) {
    write(KEYS.orders, o);
    syncToFirestore(KEYS.orders, o);
  },

  getSession() {
    return read(KEYS.session, null);
  },
  saveSession(s) {
    write(KEYS.session, s);
  },
  clearSession() {
    localStorage.removeItem(KEYS.session);
  },

  getCart() {
    return read(KEYS.cart, []);
  },
  saveCart(c) {
    write(KEYS.cart, c);
  },

  getSettings() {
    let s = read(KEYS.settings, null);
    if (s === null) {
      s = seedSettings();
    }
    return { ...DEFAULT_SETTINGS, ...s };
  },
  saveSettings(s) {
    write(KEYS.settings, s);
    syncToFirestore(KEYS.settings, s);
  },

  // wishlist stored as map: { [userId]: [productId, ...] }
  getWishlists() {
    return read(KEYS.wishlist, {});
  },
  saveWishlists(w) {
    write(KEYS.wishlist, w);
    syncToFirestore(KEYS.wishlist, w);
  },

  // reviews stored as array of objects
  getReviews() {
    return read(KEYS.reviews, []);
  },
  saveReviews(r) {
    write(KEYS.reviews, r);
    syncToFirestore(KEYS.reviews, r);
  },

  // messages stored as array of objects
  getMessages() {
    return read(KEYS.messages, []);
  },
  saveMessages(m) {
    write(KEYS.messages, m);
    syncToFirestore(KEYS.messages, m);

  },

  // coupons: array of { id, code, type, value, minOrder, active, createdAt }
  getCoupons() {
    return read(KEYS.coupons, []);
  },
  saveCoupons(c) {
    write(KEYS.coupons, c);
    syncToFirestore(KEYS.coupons, c);
  },

  // payments: audit log of every payment attempt/callback
  getPayments() {
    return read(KEYS.payments, []);
  },
  savePayments(p) {
    write(KEYS.payments, p);
    syncToFirestore(KEYS.payments, p);
  },

  // returns: customer return requests + reverse-pickup state
  getReturns() {
    return read(KEYS.returns, []);
  },
  saveReturns(r) {
    write(KEYS.returns, r);
    syncToFirestore(KEYS.returns, r);
  },

  // sales: promotional discounts created by admin
  // { id, type: 'product'|'category'|'storewide'|'flash', name, discountType: 'percent'|'flat', value, productId?, category?, startsAt?, endsAt?, active }
  getSales() {
    return read(KEYS.sales, []);
  },
  saveSales(s) {
    write(KEYS.sales, s);
    syncToFirestore(KEYS.sales, s);
  },

  uid,
};
