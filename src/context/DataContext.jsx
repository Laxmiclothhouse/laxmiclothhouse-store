import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { db } from '../db.js';
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
  const [returns, setReturns] = useState(db.getReturns());
  const [sales, setSales] = useState(db.getSales());

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
      else if (e.key === 'houselaxmicloth_returns') setReturns(db.getReturns());
      else if (e.key === 'houselaxmicloth_sales') setSales(db.getSales());
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
    const unsubReturns = listenFromFirestore('houselaxmicloth_returns', setReturns);
    const unsubSales = listenFromFirestore('houselaxmicloth_sales', setSales);

    return () => {
      unsubProducts();
      unsubOrders();
      unsubSettings();
      unsubReviews();
      unsubMessages();
      unsubCoupons();
      unsubPayments();
      unsubReturns();
      unsubSales();
    };
  }, []);

  // ----- reviews -----
  const addReview = ({ productId, userId, userName, rating, comment }) => {
    const rev = {
      id: db.uid('R-'),
      productId,
      userId,
      userName,
      rating: Math.min(5, Math.max(1, Number(rating))),
      comment,
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

  const reviewsFor = (productId) =>
    products.find((p) => p.id === productId)
      ? reviews.filter((r) => r.productId === productId)
      : [];

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

  // ----- returns (reverse pickup) -----
  const RETURN_ACTIVE = ['requested', 'approved', 'picked', 'received'];
  const activeReturnForOrder = (orderId) =>
    returns.find((r) => r.orderId === orderId && RETURN_ACTIVE.includes(r.status));

  const addReturnRequest = ({ order, items, reason, note, user }) => {
    if (activeReturnForOrder(order.id)) return null;
    const ret = {
      id: db.uid('RET-'),
      orderId: order.id,
      userId: user?.id || null,
      customerName: order.customer?.name || user?.name || '',
      email: order.customerEmail || user?.email || '',
      phone: order.customer?.phone || user?.phone || '',
      items,
      reason,
      note: String(note || '').slice(0, 300),
      status: 'requested', // requested → approved → picked → received → refunded
      requestDate: new Date().toISOString(),
    };
    const next = [ret, ...returns];
    setReturns(next);
    db.saveReturns(next);
    return ret;
  };

  const updateReturnStatus = (id, status, meta = {}) => {
    const now = new Date().toISOString();
    let target = null;
    const next = returns.map((r) => {
      if (r.id !== id) return r;
      target = { ...r, status, ...(meta || {}), updatedAt: now };
      return target;
    });
    setReturns(next);
    db.saveReturns(next);
    if (!target) return null;

    // Items are back in the warehouse → restock & mark the order "returned".
    if (status === 'received') {
      adjustStock(target.items || [], +1);
      const orderNext = orders.map((o) =>
        o.id === target.orderId && o.status !== 'returned'
          ? {
              ...o,
              status: 'returned',
              statusHistory: [
                ...(o.statusHistory || []),
                { status: 'returned', label: 'Return received & restocked', at: now },
              ],
            }
          : o
      );
      if (orderNext !== orders) {
        setOrders(orderNext);
        db.saveOrders(orderNext);
      }
    }
    return target;
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
      next = next.map((p) =>
        p.id === it.id
          ? { ...p, stock: Math.max(0, Number(p.stock || 0) + delta * q) }
          : p
      );
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
      status: payload.payment.method === 'cod' ? 'confirmed' : 'paid',
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
    // SMS notification (fire-and-forget; skips when no SMS API configured).
    if (order.smsOptIn && (order.phone || order.customer?.phone)) {
      postApi('/api/send-sms', {
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
    const next = [...sales, { ...sale, id: sale.id || db.uid('S-'), createdAt: new Date().toISOString() }];
    setSales(next);
    db.saveSales(next);
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
  const getSalePrice = (product) => {
    if (!product) return { price: 0, originalPrice: 0, saleLabel: null, saleId: null };
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

    return { price: bestPrice, originalPrice, saleLabel, saleId };
  };

  const canCancel = (order) => {
    if (!order) return false;
    if (order.status === 'cancelled' || order.status === 'packed' || order.status === 'shipped' || order.status === 'delivered') {
      return false;
    }
    return true;
  };

  // Orders that are still in progress (anything not delivered/cancelled).
  // While the user has such an order, name + mobile editing is locked.
  const TERMINAL_ORDER_STATUSES = ['delivered', 'cancelled'];
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
    const next = orders.map((o) =>
      o.id === orderId
        ? {
            ...o,
            status: 'cancelled',
            statusHistory: [
              ...(o.statusHistory || []),
              { status: 'cancelled', label: 'Cancelled by customer', at: new Date().toISOString() },
            ],
            refundInfo: refundInfo || {
              type: 'self_cancel',
              cancelledAt: new Date().toISOString(),
              note: 'Cancelled by customer.',
            },
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
      // WhatsApp notification for status changes (fire-and-forget).
      const whatsappTypes = ['packed', 'shipped', 'delivered', 'cancelled', 'returned'];
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
          },
        });
      }
      // SMS notification for status changes (fire-and-forget).
      const smsTypes = ['packed', 'shipped', 'delivered', 'cancelled', 'returned'];
      if (changed.smsOptIn && smsTypes.includes(status) && (changed.phone || changed.customer?.phone)) {
        postApi('/api/send-sms', {
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

  // Best-effort calls to the Vercel API functions. Never blocks the store.
  const postApi = async (path, body) => {
    try {
      await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch {
      /* dev/offline — server API is optional */
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
      reviewsFor,
      ratingFor,
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
      returns,
      addReturnRequest,
      updateReturnStatus,
      activeReturnForOrder,
      sales,
      addSale,
      updateSale,
      deleteSale,
      toggleSale,
      getSalePrice,
    }),
    [products, orders, settings, reviews, messages, coupons, payments, returns, sales]
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  return useContext(DataContext);
}
