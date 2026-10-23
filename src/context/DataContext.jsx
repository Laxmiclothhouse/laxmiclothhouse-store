import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { db } from '../db.js';
import { variantKey } from '../utils/stock.js';
import { listenFromFirestore } from '../db.js';

const DataContext = createContext(null);

export function DataProvider({ children }) {
  const [products, setProducts] = useState(db.getProducts());
  const [orders, setOrders] = useState(db.getOrders());
  const [settings, setSettings] = useState(db.getSettings());
  const [reviews, setReviews] = useState(db.getReviews());
  const [messages, setMessages] = useState(db.getMessages());
  const [coupons, setCoupons] = useState(db.getCoupons());
  const [payments, setPayments] = useState(db.getPayments());
  const [sales, setSales] = useState(db.getSales());
  const [users, setUsers] = useState(db.getUsers());

  const updateSettings = (patch) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    db.saveSettings(next);
  };

  // Keep every open tab in sync when settings/data change in another tab
  // (e.g. switching payment mode in Admin should apply to the checkout tab instantly).
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === 'houselaxmicloth_settings') setSettings(db.getSettings());
      else if (e.key === 'houselaxmicloth_products') setProducts(db.getProducts());
      else if (e.key === 'houselaxmicloth_orders') setOrders(db.getOrders());
      else if (e.key === 'houselaxmicloth_reviews') setReviews(db.getReviews());
      else if (e.key === 'houselaxmicloth_messages') setMessages(db.getMessages());
      else if (e.key === 'houselaxmicloth_coupons') setCoupons(db.getCoupons());
      else if (e.key === 'houselaxmicloth_payments') setPayments(db.getPayments());
      else if (e.key === 'houselaxmicloth_sales') setSales(db.getSales());
      else if (e.key === 'houselaxmicloth_users') setUsers(db.getUsers());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Sync across devices via Firestore
  useEffect(() => {
    const unsubProducts = listenFromFirestore('houselaxmicloth_products', setProducts);
    const unsubOrders = listenFromFirestore('houselaxmicloth_orders', setOrders);
    const unsubSettings = listenFromFirestore('houselaxmicloth_settings', setSettings);
    const unsubReviews = listenFromFirestore('houselaxmicloth_reviews', setReviews);
    const unsubMessages = listenFromFirestore('houselaxmicloth_messages', setMessages);
    const unsubCoupons = listenFromFirestore('houselaxmicloth_coupons', setCoupons);
    const unsubPayments = listenFromFirestore('houselaxmicloth_payments', setPayments);
    const unsubSales = listenFromFirestore('houselaxmicloth_sales', setSales);
    const unsubUsers = listenFromFirestore('houselaxmicloth_users', setUsers);

    return () => {
      unsubProducts();
      unsubOrders();
      unsubSettings();
      unsubReviews();
      unsubMessages();
      unsubCoupons();
      unsubPayments();
      unsubSales();
      unsubUsers();
    };
  }, []);

  // Backfill missing payment amounts from the matching order so the admin
  // Payments tab always shows a value (legacy records may lack `amount`).
  useEffect(() => {
    if (!orders.length || !payments.length) return;
    let changed = false;
    const next = payments.map((p) => {
      if (p && p.amount != null) return p;
      const orderId = p?.orderId || p?.order_id || p?.orderId;
      const order = orders.find((o) => o.id === orderId);
      if (order && order.total != null) {
        changed = true;
        return { ...p, amount: order.total };
      }
      return p;
    });
    if (changed) {
      setPayments(next);
      db.savePayments(next);
    }
  }, [orders, payments]);

  const addReview = ({ productId, userId, userName, rating, comment, userEmail }) => {
    const rev = {
      id: db.uid('R-'),
      productId,
      userId,
      userName,
      rating: Math.min(5, Math.max(1, Number(rating))),
      comment,
      userEmail,
      date: new Date().toISOString(),
    };
    const idx = reviews.findIndex(
      (r) => r.productId === productId && r.userId === userId
    );
    let next;
    if (idx >= 0) {
      next = reviews.map((r, i) => (i === idx ? rev : r));
    } else {
      next = [rev, ...reviews];
    }
    setReviews(next);
    db.saveReviews(next);
  };


  // Admin-only: update a review by id (moderation).
  const updateReview = (reviewId, updates) => {
    const idx = reviews.findIndex((r) => r.id === reviewId);
    if (idx < 0) return;
    const updated = {
      ...reviews[idx],
      ...updates,
      date: new Date().toISOString(),
    };
    const next = reviews.map((r, i) => (i === idx ? updated : r));
    setReviews(next);
    db.saveReviews(next);
  };

  const reviewsFor = (productId) =>
    products.find((p) => p.id === productId)
      ? reviews.filter((r) => r.productId === productId)
      : [];

  // Admin-only: remove a single review by id (moderation).
  const deleteReview = (reviewId) => {
    const next = reviews.filter((r) => r.id !== reviewId);
    setReviews(next);
    db.saveReviews(next);
  };

  // Admin-only: delete a customer's account data. Removes the stored
  // profile entry, their reviews and wishlist. Returns what was removed.
  // NOTE: the Firebase Auth login itself cannot be deleted from the
  // browser — it needs the server-side Admin SDK (documented in the UI).
  const deleteUserAccount = (targetUser) => {
    const uid = targetUser?.id;
    const email = String(targetUser?.email || '').toLowerCase();
    const phone = String(targetUser?.phone || '').replace(/\D/g, '');

    // 1) stored profile entry
    const users = db.getUsers();
    const nextUsers = users.filter((u) => {
      if (uid && u.id === uid) return false;
      if (email && String(u.email || '').toLowerCase() === email) return false;
      return true;
    });
    db.saveUsers(nextUsers);
    setUsers(nextUsers);

    // 2) their reviews
    const nextReviews = reviews.filter((r) => {
      const rUid = r.userId;
      const rMail = String(r.userEmail || '').toLowerCase();
      if (uid && rUid === uid) return false;
      if (email && rMail === email) return false;
      return true;
    });
    setReviews(nextReviews);
    db.saveReviews(nextReviews);

    // 3) their wishlist
    let wishlistRemoved = false;
    try {
      const wKey = 'houselaxmicloth_wishlist_' + (uid || email);
      if (uid && localStorage.getItem(wKey) !== null) {
        localStorage.removeItem(wKey);
        wishlistRemoved = true;
      }
    } catch { /* ignore */ }

    return {
      users: users.length - nextUsers.length,
      reviews: reviews.length - nextReviews.length,
      wishlistRemoved,
    };
  };

  const ratingFor = (productId) => {
    const list = reviewsFor(productId);
    if (!list.length) return { avg: 0, count: 0 };
    return {
      avg: list.reduce((s, x) => s + x.rating, 0) / list.length,
      count: list.length,
    };
  };

  // ----- message helpers -----
  const addMessage = ({ name, email, message }) => {
    const msg = {
      id: db.uid('MSG-'),
      name,
      email,
      message,
      status: 'pending',
      date: new Date().toISOString(),
    };
    const next = [msg, ...messages];
    setMessages(next);
    db.saveMessages(next);
    return msg;
  };

  const updateMessageStatus = (id, status) => {
    const next = messages.map((m) => (m.id === id ? { ...m, status } : m));
    setMessages(next);
    db.saveMessages(next);
  };

  // ----- product admin helpers -----
  const addProduct = (data) => {
    const product = {
      id: db.uid('P-'),
      ...data,
    };
    const next = [product, ...products];
    setProducts(next);
    db.saveProducts(next);
    return product;
  };

  const updateProduct = (id, data) => {
    const next = products.map((p) => (p.id === id ? { ...p, ...data } : p));
    setProducts(next);
    db.saveProducts(next);
  };

  const deleteProduct = (id) => {
    const next = products.filter((p) => p.id !== id);
    setProducts(next);
    db.saveProducts(next);
  };

  // ----- coupon helpers -----
  const saveCoupons = (next) => {
    setCoupons(next);
    db.saveCoupons(next);
  };

  const addCoupon = ({ code, type, value, minOrder }) => {
    const c = {
      id: db.uid('CPN-'),
      code: String(code || '').trim().toUpperCase(),
      type: type === 'percent' ? 'percent' : 'flat',
      value: Math.max(0, Number(value) || 0),
      minOrder: Math.max(0, Number(minOrder) || 0),
      active: true,
      usedCount: 0,
      createdAt: new Date().toISOString(),
    };
    if (!c.code) return null;
    saveCoupons([c, ...coupons]);
    return c;
  };

  const deleteCoupon = (id) => {
    saveCoupons(coupons.filter((c) => c.id !== id));
  };

  const toggleCoupon = (id) => {
    saveCoupons(coupons.map((c) => (c.id === id ? { ...c, active: !c.active } : c)));
  };

  // Validate a coupon code against a cart subtotal.
  // Returns { ok, coupon, discount, error }.
  const validateCoupon = (code, subtotal) => {
    const c = coupons.find(
      (x) => x.code === String(code || '').trim().toUpperCase()
    );
    if (!c) return { ok: false, error: 'Invalid coupon code.' };
    if (!c.active) return { ok: false, error: 'This coupon is no longer active.' };
    if (subtotal < (c.minOrder || 0)) {
      return { ok: false, error: `Minimum order ₹${c.minOrder} required for this coupon.` };
    }
    const discount =
      c.type === 'percent'
        ? Math.round((subtotal * Math.min(c.value, 100)) / 100)
        : Math.min(c.value, subtotal);
    if (discount <= 0) return { ok: false, error: 'Coupon gives no discount on this cart.' };
    return { ok: true, coupon: c, discount };
  };

  const markCouponUsed = (code) => {
    const norm = String(code || '').trim().toUpperCase();
    if (!norm) return;
    // Read the freshest PERSISTED coupon list (not the closure's possibly-stale
    // state array) so a stale tab snapshot can't swallow the increment.
    const fresh = db.getCoupons();
    saveCoupons(
      fresh.map((c) =>
        c.code === norm ? { ...c, usedCount: (c.usedCount || 0) + 1 } : c
      )
    );
  };

  // ----- payment audit log -----
  // Every payment attempt/callback is recorded here (client-side, since the
  // order book is client-side). Admins see it in Admin → Payments.
  const logPayment = (entry) => {
    const e = {
      id: db.uid('PAY-'),
      at: new Date().toISOString(),
      ...(entry || {}),
    };
    const next = [e, ...payments];
    setPayments(next);
    db.savePayments(next);
    return e;
  };

  // ----- order helpers -----
  // Adjust product stock by delta per item quantity (clamped at 0).
  // Called with -1 when an order is placed and +1 when it is cancelled,
  // so the shelf always matches reality. No-op when the product was deleted.
  const adjustStock = (items, delta) => {
    let next = products;
    (items || []).forEach((it) => {
      if (!it || !it.id) return;
      const q = Math.max(0, Number(it.qty) || 1);
      const key = variantKey(it.colorName || it.color, it.size);
      next = next.map((p) => {
        if (p.id !== it.id) return p;
        const map = p.stockByVariant && typeof p.stockByVariant === 'object' && !Array.isArray(p.stockByVariant)
          ? { ...p.stockByVariant }
          : {};
        // Only touch the variant cell when the admin set explicit
        // per-variant stock; otherwise the legacy total is the truth.
        if (Object.prototype.hasOwnProperty.call(map, key)) {
          map[key] = Math.max(0, Number(map[key] || 0) + delta * q);
        } else if (key !== '::') {
          map[key] = Math.max(0, Number(p.stock || 0) + delta * q);
        }
        return {
          ...p,
          stock: Math.max(0, Number(p.stock || 0) + delta * q),
          ...(key === '::' ? {} : { stockByVariant: map }),
        };
      });
    });
    if (next !== products) {
      setProducts(next);
      db.saveProducts(next);
    }
  };

  const placeOrder = (payload) => {
    // Idempotent guard: a repeated submit (double-click, retry, replay) with
    // the same client token returns the SAME order instead of creating a twin.
    if (payload.clientToken) {
      const existing = orders.find((o) => o.clientToken === payload.clientToken);
      if (existing) return existing;
    }
    const order = {
      id: db.uid('ORD-'),
      clientToken: payload.clientToken || null,
      orderDate: new Date().toISOString(),
      userId: payload.userId || null,
      customerEmail:
        payload.customer?.email ||
        (payload.userEmail ? payload.userEmail : null),
      items: payload.items,
      customer: payload.customer,
      shipping: payload.shipping,
      payment: payload.payment,
      phone: payload.phone || null,
      whatsappOptIn: !!payload.whatsappOptIn,
      subtotal: payload.subtotal,
      shippingFee: payload.shippingFee,
      discount: Number(payload.discount) || 0,
      couponCode: payload.couponCode || null,
      total: payload.total,
      // Every order starts at the top of the pipeline: the admin confirms it
      // first, then packed -> shipped -> delivered (or cancelled with a note).
      status: 'placed',
      statusHistory: [
        {
          status: 'placed',
          label: 'Order Placed',
          at: new Date().toISOString(),
        },
      ],
    };
    const next = [order, ...orders];
    setOrders(next);
    db.saveOrders(next);
    // Auto-decrement product stock by the ordered quantities.
    adjustStock(order.items, -1);
    if (order.couponCode) markCouponUsed(order.couponCode);
    // Order confirmation e-mail (fire-and-forget; skips when no mail API configured).
    postApi('/api/send-order-mail', {
      type: 'placed',
      to: order.customerEmail || order.customer?.email,
      order: {
        id: order.id,
        customerEmail: order.customerEmail || order.customer?.email,
        customerName: order.customer?.name,
        customerPhone: order.phone || order.customer?.phone,
        items: order.items,
        total: order.total,
        subtotal: order.subtotal,
        shippingFee: order.shippingFee,
        discount: order.discount || 0,
        couponCode: order.couponCode || '',
        paymentMode: order.payment?.mode,
        orderDate: order.orderDate,
        storeName: settings.storeName,
      },
    });
    // WhatsApp notification (fire-and-forget; skips when no WhatsApp API configured).
    if (order.whatsappOptIn && (order.phone || order.customer?.phone)) {
      postApi('/api/send-whatsapp', {
        type: 'placed',
        to: order.phone || order.customer?.phone,
        order: {
          id: order.id,
          customerPhone: order.phone || order.customer?.phone,
          customerName: order.customer?.name,
          total: order.total,
          paymentMode: order.payment?.mode,
        },
      });
    }
    return order;
  };

  // ----- sales -----
  const addSale = (sale) => {
    const created = { ...sale, id: sale.id || db.uid('S-'), createdAt: new Date().toISOString() };
    const next = [...sales, created];
    setSales(next);
    db.saveSales(next);
    return created;
  };

  const updateSale = (id, patch) => {
    const next = sales.map((s) => (s.id === id ? { ...s, ...patch } : s));
    setSales(next);
    db.saveSales(next);
  };

  const deleteSale = (id) => {
    const next = sales.filter((s) => s.id !== id);
    setSales(next);
    db.saveSales(next);
  };

  const toggleSale = (id) => {
    const next = sales.map((s) => (s.id === id ? { ...s, active: !s.active } : s));
    setSales(next);
    db.saveSales(next);
  };

  // Calculate the best sale price for a product.
  // Priority: product sale > category sale > storewide sale > flash sale > original price.
  // `hasSale` is true ONLY when one of those admin-created sales lowers the
  // price. A product whose MRP sits above its selling price is ordinary shop
  // pricing, NOT a running sale — the UI uses hasSale to decide whether to
  // show sale badges/sections, so nothing looks "on sale" until the admin
  // actually creates one.
  const getSalePrice = (product) => {
    if (!product) return { price: 0, originalPrice: 0, saleLabel: null, saleId: null, hasSale: false };
    const now = Date.now();
    const activeSales = sales.filter((s) => {
      if (s.active === false) return false;
      if (s.startsAt && new Date(s.startsAt).getTime() > now) return false;
      if (s.endsAt && new Date(s.endsAt).getTime() < now) return false;
      return true;
    });

    let bestPrice = product.price;
    let originalPrice = product.mrp > product.price ? product.mrp : product.price;
    let saleLabel = null;
    let saleId = null;

    // Product-level sale (highest priority)
    const productSale = activeSales
      .filter((s) => s.type === 'product' && s.productId === product.id)
      .sort((a, b) => (b.value || 0) - (a.value || 0))[0];
    if (productSale) {
      const discounted = productSale.discountType === 'percent'
        ? Math.round(product.price * (1 - productSale.value / 100))
        : Math.max(0, product.price - productSale.value);
      if (discounted < bestPrice) {
        bestPrice = discounted;
        saleLabel = productSale.name || 'Sale';
        saleId = productSale.id;
      }
    }

    // Category sale
    const categorySale = activeSales
      .filter((s) => s.type === 'category' && s.category === product.category)
      .sort((a, b) => (b.value || 0) - (a.value || 0))[0];
    if (categorySale) {
      const discounted = categorySale.discountType === 'percent'
        ? Math.round(product.price * (1 - categorySale.value / 100))
        : Math.max(0, product.price - categorySale.value);
      if (discounted < bestPrice) {
        bestPrice = discounted;
        saleLabel = categorySale.name || `${product.category} Sale`;
        saleId = categorySale.id;
      }
    }

    // Storewide sale
    const storewideSale = activeSales
      .filter((s) => s.type === 'storewide')
      .sort((a, b) => (b.value || 0) - (a.value || 0))[0];
    if (storewideSale) {
      const discounted = storewideSale.discountType === 'percent'
        ? Math.round(product.price * (1 - storewideSale.value / 100))
        : Math.max(0, product.price - storewideSale.value);
      if (discounted < bestPrice) {
        bestPrice = discounted;
        saleLabel = storewideSale.name || 'Storewide Sale';
        saleId = storewideSale.id;
      }
    }

    // Flash sale (lowest priority but can stack visually)
    const flashSale = activeSales
      .filter((s) => s.type === 'flash')
      .sort((a, b) => (b.value || 0) - (a.value || 0))[0];
    if (flashSale) {
      const discounted = flashSale.discountType === 'percent'
        ? Math.round(product.price * (1 - flashSale.value / 100))
        : Math.max(0, product.price - flashSale.value);
      if (discounted < bestPrice) {
        bestPrice = discounted;
        saleLabel = flashSale.name || '⚡ Flash Sale';
        saleId = flashSale.id;
      }
    }

    return { price: bestPrice, originalPrice, saleLabel, saleId, hasSale: Boolean(saleId) };
  };

  const canCancel = (order) => {
    if (!order) return false;
    if (order.status === 'cancelled' || order.status === 'packed' || order.status === 'shipped' || order.status === 'delivered') {
      return false;
    }
    return true;
  };

  // Orders that are still in progress (anything not delivered/cancelled/refunded).
  // While the user has such an order, name + mobile editing is locked.
  const TERMINAL_ORDER_STATUSES = ['delivered', 'cancelled', 'refunded'];
  const isOrderProcessing = (o) => {
    if (!o) return false;
    return !TERMINAL_ORDER_STATUSES.includes(String(o.status || '').toLowerCase());
  };
  const hasProcessingOrdersForUser = (u) => {
    if (!u) return false;
    return orders.some((o) => {
      const mine =
        (o.userId && u.id && o.userId === u.id) ||
        (o.customerEmail && u.email && String(o.customerEmail).toLowerCase() === String(u.email).toLowerCase());
      return mine && isOrderProcessing(o);
    });
  };

  const cancelOrder = (orderId, refundInfo) => {
    // Put the ordered pieces back on the shelf.
    const target = orders.find((o) => o.id === orderId);
    if (target) adjustStock(target.items, +1);
    const baseRefund = refundInfo || {
      type: 'self_cancel',
      cancelledAt: new Date().toISOString(),
      note: 'Cancelled by customer.',
    };
    // Apply the cancelled status AND the refund record in a single state
    // update so they can't overwrite each other (avoids a race where
    // markOrderRefunded reads stale orders and resets the status).
    const mergedRefund = {
      refundStatus: baseRefund.refundStatus || 'none',
      ...baseRefund,
    };
    const next = orders.map((o) =>
      o.id === orderId
        ? {
            ...o,
            status: 'cancelled',
            refundInfo: mergedRefund,
            statusHistory: [
              ...(o.statusHistory || []),
              { status: 'cancelled', label: 'Cancelled by customer', at: new Date().toISOString() },
            ],
          }
        : o
    );
    setOrders(next);
    db.saveOrders(next);
  };

  const updateOrderStatus = (id, status, label, opts = {}) => {
    const at = new Date().toISOString();
    const by = opts.by
      ? {
          uid: opts.by.uid || opts.by.id,
          name: opts.by.name || opts.by.email || 'staff',
          role: opts.by.role || 'staff',
        }
      : null;
    let prevStatus = null;
    let changed = null;
    const next = orders.map((o) => {
      if (o.id !== id) return o;
      prevStatus = o.status;
      changed = {
        ...o,
        status,
        refundInfo: opts.refundInfo !== undefined ? opts.refundInfo : o.refundInfo,
        trackingNo: opts.trackingNo !== undefined ? opts.trackingNo : o.trackingNo,
        courier: opts.courier !== undefined ? opts.courier : o.courier,
        statusHistory: [
          ...(o.statusHistory || []),
          { status, label: label || status, by, note: opts.note || '', at },
        ],
      };
      return changed;
    });
    setOrders(next);
    db.saveOrders(next);

    if (changed) {
      // Restock the pieces when an order is cancelled (only on the first transition).
      if (status === 'cancelled' && prevStatus !== 'cancelled') {
        adjustStock(changed.items, +1);
      }
      // Server-side audit + status e-mail (fire-and-forget; safe when the API is missing).
      postApi('/api/update-order-status', {
        orderId: id,
        status,
        label: label || status,
        note: opts.note || '',
        trackingNo: changed.trackingNo || '',
        courier: changed.courier || '',
        previousStatus: prevStatus,
        by,
        orderInfo: {
          id: changed.id,
          customerEmail: changed.customerEmail || changed.customer?.email,
          customerName: changed.customer?.name,
          customerPhone: changed.phone || changed.customer?.phone,
          items: changed.items,
          total: changed.total,
          subtotal: changed.subtotal,
          shippingFee: changed.shippingFee,
          discount: changed.discount || 0,
          couponCode: changed.couponCode || '',
          paymentMode: changed.payment?.mode,
          orderDate: changed.orderDate,
          storeName: settings.storeName,
        },
      });
      // WhatsApp notification for every forward step (placed is sent on
      // order creation) plus cancellations (fire-and-forget).
      const whatsappTypes = ['confirmed', 'packed', 'shipped', 'delivered', 'cancelled'];
      if (changed.whatsappOptIn && whatsappTypes.includes(status) && (changed.phone || changed.customer?.phone)) {
        postApi('/api/send-whatsapp', {
          type: status,
          to: changed.phone || changed.customer?.phone,
          order: {
            id: changed.id,
            customerPhone: changed.phone || changed.customer?.phone,
            customerName: changed.customer?.name,
            total: changed.total,
            paymentMode: changed.payment?.mode,
            trackingNo: changed.trackingNo,
            courier: changed.courier,
            note: opts.note || '',
          },
        });
      }
    }
  };

  // Internal (staff) notes on an order — visible to every staff member.
  const addOrderNote = (orderId, note, by) => {
    if (!note || !String(note).trim()) return;
    const entry = {
      id: db.uid('N-'),
      by: by ? { uid: by.uid || by.id, name: by.name || by.email || 'staff' } : null,
      note: String(note).trim(),
      at: new Date().toISOString(),
    };
    const next = orders.map((o) =>
      o.id === orderId ? { ...o, notes: [...(o.notes || []), entry] } : o
    );
    setOrders(next);
    db.saveOrders(next);
  };

  // Merge Delhivery courier data (scans/status/label) into an order
  // WITHOUT touching statusHistory — used by the tracking auto-sync.
  const mergeDelhivery = (orderId, delhiveryPatch) => {
    const at = new Date().toISOString();
    const next = orders.map((o) => {
      if (o.id !== orderId) return o;
      return {
        ...o,
        courier: o.courier || 'Delhivery',
        delhivery: {
          ...(o.delhivery || {}),
          ...delhiveryPatch,
          lastSyncedAt: delhiveryPatch.lastSyncedAt || at,
        },
      };
    });
    setOrders(next);
    db.saveOrders(next);
  };

const resolveRefund = (orderId, patch = {}) => {
    const next = orders.map((o) => {
      if (o.id !== orderId) return o;
      const merged = {
        ...(o.refundInfo || {}),
        ...patch,
        refundStatus: 'refunded',
        gatewayStatus: patch.gatewayStatus || o.refundInfo?.gatewayStatus || 'processed',
        refundedAt: patch.refundedAt || o.refundInfo?.refundedAt || new Date().toISOString(),
      };
      return { ...o, refundInfo: merged };
    });
    setOrders(next);
    db.saveOrders(next);
  };

  // Attach a refund record to an order (used by the admin "Refund" action and
  // by customer cancellation). When Razorpay confirms the refund
  // (refundStatus === 'refunded'), the order status is automatically flipped
  // to "Amount Refunded" so the customer sees a terminal refunded state.
  const markOrderRefunded = (orderId, refundInfo) => {
    const order = orders.find((o) => o.id === orderId);
    const merged = { refundStatus: refundInfo?.refundStatus || 'refunding', ...refundInfo };

    if (merged.refundStatus === 'refunded') {
      // Razorpay has confirmed the money is back with the customer — mark the
      // order as Amount Refunded (terminal) and attach the refund record.
      updateOrderStatus(orderId, 'refunded', 'Amount Refunded', {
        refundInfo: merged,
        by: merged.by,
        note: merged.note || 'Amount refunded to the original payment method.',
      });
      return;
    }

    // refunding / failed / none: attach the refund record without changing status.
    const next = orders.map((o) => (o.id === orderId ? { ...o, refundInfo: merged } : o));
    setOrders(next);
    db.saveOrders(next);
  };

  // ----- selective delete (admin Delete records) -----
  // Removes the chosen ids from one record store, writing through the same
  // save* helper so localStorage and Firestore stay in sync.
  const deleteRecords = (kind, ids) => {
    const idSet = new Set((ids || []).map(String));
    const pick = (list) => list.filter((x) => !idSet.has(String(x.id)));
    let removed = 0;
    if (kind === 'orders') { const n = pick(orders); removed = orders.length - n.length; setOrders(n); db.saveOrders(n); }
    else if (kind === 'payments') { const n = pick(payments); removed = payments.length - n.length; setPayments(n); db.savePayments(n); }
    else if (kind === 'sales') { const n = pick(sales); removed = sales.length - n.length; setSales(n); db.saveSales(n); }
    else if (kind === 'coupons') { const n = pick(coupons); removed = coupons.length - n.length; setCoupons(n); db.saveCoupons(n); }
    else if (kind === 'reviews') { const n = pick(reviews); removed = reviews.length - n.length; setReviews(n); db.saveReviews(n); }
    else if (kind === 'messages') { const n = pick(messages); removed = messages.length - n.length; setMessages(n); db.saveMessages(n); }
    return removed;
  };

  // Best-effort calls to the Vercel API functions. Never blocks the store.
  // Returns the fetch Response so callers can inspect success/failure.
  const postApi = async (path, body) => {
    try {
      return await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch {
      /* dev/offline — server API is optional */
      return null;
    }
  };

  const findOrder = (id) => orders.find((o) => o.id.toLowerCase() === id.toLowerCase());

  const value = useMemo(
    () => ({
      products,
      orders,
      settings,
      updateSettings,
      reviews,
      addReview,
      updateReview,
      deleteReview,
      reviewsFor,
      ratingFor,
      deleteUserAccount,
      addProduct,
      updateProduct,
      deleteProduct,
      placeOrder,
      updateOrderStatus,
      addOrderNote,
      mergeDelhivery,
      findOrder,
      canCancel,
      cancelOrder,
      markOrderRefunded,
       resolveRefund,
      postApi,
      isOrderProcessing,
      hasProcessingOrdersForUser,
      messages,
      addMessage,
      updateMessageStatus,
      coupons,
      addCoupon,
      deleteCoupon,
      toggleCoupon,
      validateCoupon,
      payments,
      logPayment,
      deleteRecords,
      sales,
      addSale,
      updateSale,
      deleteSale,
      toggleSale,
      getSalePrice,
      users,
    }),
    [products, orders, settings, reviews, messages, coupons, payments, sales, users]
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  return useContext(DataContext);
}
