import React, { createContext, useContext, useMemo, useState } from 'react';
import { db } from '../db.js';

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [cart, setCart] = useState(db.getCart());

  const persist = (next) => {
    setCart(next);
    db.saveCart(next);
  };

  const addItem = (product, qty = 1, size = '', salePrice = null) => {
    const key = `${product.id}::${String(size || '').toUpperCase()}`;
    const effectivePrice = salePrice !== null && salePrice !== undefined ? salePrice : product.price;
    let next;
    const idx = cart.findIndex((c) => c.key === key);
    if (idx >= 0) {
      next = cart.map((c, i) =>
        i === idx ? { ...c, qty: c.qty + qty, price: effectivePrice } : c
      );
    } else {
      next = [
        ...cart,
        {
          key,
          id: product.id,
          name: product.name,
          price: effectivePrice,
          image: product.image,
          color: product.color,
          size: String(size || ''),
          weightGrams: Number(product.weightGrams) || 500,
          qty,
        },
      ];
    }
    persist(next);
  };

  const updateQty = (key, qty) => {
    if (qty <= 0) {
      persist(cart.filter((c) => c.key !== key));
      return;
    }
    persist(cart.map((c) => (c.key === key ? { ...c, qty } : c)));
  };

  const removeItem = (key) => persist(cart.filter((c) => c.key !== key));

  const clearCart = () => persist([]);

  const totalItems = cart.reduce((s, c) => s + c.qty, 0);
  const subtotal = cart.reduce((s, c) => s + c.qty * c.price, 0);

  const value = useMemo(
    () => ({
      cart,
      addItem,
      updateQty,
      removeItem,
      clearCart,
      totalItems,
      subtotal,
    }),
    [cart, totalItems, subtotal]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  return useContext(CartContext);
}

/**
 * Total weight of the current cart in grams.
 * Each cart item must carry a `weightGrams` field (inherited from the
 * product at add-time). Falls back to 0 for any item missing the field.
 */
export function useCartWeightGrams() {
  const { cart } = useCart();
  return useMemo(() => {
    let total = 0;
    for (const c of cart) {
      const w = Number.isFinite(c.weightGrams) ? c.weightGrams : 0;
      total += w * c.qty;
    }
    return total;
  }, [cart]);
}
