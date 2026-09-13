with open('src/context/DataContext.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add Firestore sync for sales
old_sync = "    const unsubReturns = listenFromFirestore('houselaxmicloth_returns', setReturns);"
new_sync = """    const unsubReturns = listenFromFirestore('houselaxmicloth_returns', setReturns);
    const unsubSales = listenFromFirestore('houselaxmicloth_sales', setSales);"""
content = content.replace(old_sync, new_sync)

# 2. Add sales cleanup in unsubscribe
old_cleanup = "      unsubReturns();"
new_cleanup = """      unsubReturns();
      unsubSales();"""
content = content.replace(old_cleanup, new_cleanup)

# 3. Add sale CRUD + getSalePrice after the placeOrder function (before canCancel)
old_can_cancel = "  const canCancel = (order) => {"
new_sale_fns = """  // ----- sales -----
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

  const canCancel = (order) => {"""

content = content.replace(old_can_cancel, new_sale_fns)

# 4. Add sales to context value
old_value_end = "      returns,\n      addReturnRequest,\n      updateReturnStatus,\n      activeReturnForOrder,"
new_value_end = """      returns,
      addReturnRequest,
      updateReturnStatus,
      activeReturnForOrder,
      sales,
      addSale,
      updateSale,
      deleteSale,
      toggleSale,
      getSalePrice,"""
content = content.replace(old_value_end, new_value_end)

# 5. Add sales to useMemo deps
old_deps = "    [products, orders, settings, reviews, messages, coupons, payments, returns]"
new_deps = "    [products, orders, settings, reviews, messages, coupons, payments, returns, sales]"
content = content.replace(old_deps, new_deps)

with open('src/context/DataContext.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print('DataContext sales patched')
