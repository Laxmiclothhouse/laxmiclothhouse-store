import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext.jsx';
import { useData } from '../context/DataContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { formatINR } from '../utils/format.js';
import { payWithRazorpay } from '../utils/razorpay.js';

const ALL_PAY_METHODS = [
  { id: 'upi', label: 'UPI', hint: 'GPay / PhonePe / Paytm / BHIM' },
  { id: 'card', label: 'Credit / Debit Card', hint: 'Visa, Mastercard, RuPay' },
  { id: 'cod', label: 'Cash on Delivery', hint: 'Pay in cash at your doorstep' },
];

export default function Checkout() {
  const { cart, subtotal, clearCart } = useCart();
  const { placeOrder, settings, products, validateCoupon, logPayment } = useData();
  const { user } = useAuth();
  const nav = useNavigate();

  const [shipping, setShipping] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    email: user?.email || '',
    address: '',
    city: '',
    state: '',
    pincode: '',
  });
  const [method, setMethod] = useState('');
  const [paying, setPaying] = useState(false);
  const [placed, setPlaced] = useState(null);
  const [err, setErr] = useState('');
  const [gatewayNotice, setGatewayNotice] = useState('');
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null); // coupon CODE string
  const [couponMsg, setCouponMsg] = useState('');
  const [whatsappOptIn, setWhatsappOptIn] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showPinList, setShowPinList] = useState(false);
  const [filterPin, setFilterPin] = useState('');
  const [filteredPins, setFilteredPins] = useState([]);

  const shippingFee = cart.reduce((sum, c) => {
    const p = products.find((x) => x.id === c.id);
    const perUnit = p && typeof p.shippingCost === 'number' ? p.shippingCost : 99;
    return sum + perUnit * c.qty;
  }, 0);
  // Discount is re-derived on every render so it stays correct if the
  // cart changes after a coupon is applied.
  const couponRes = appliedCoupon ? validateCoupon(appliedCoupon, subtotal) : null;
  const discount = couponRes?.ok ? couponRes.discount : 0;
  const total = Math.max(0, subtotal + shippingFee - discount);

  // If the coupon stops qualifying (e.g. qty dropped below min order), drop it.
  React.useEffect(() => {
    if (appliedCoupon && couponRes && !couponRes.ok) {
      setAppliedCoupon(null);
      setCouponMsg(couponRes.error + ' Coupon removed.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedCoupon, subtotal]);

  const applyCoupon = () => {
    setCouponMsg('');
    const code = couponInput.trim();
    if (!code) return;
    const res = validateCoupon(code, subtotal);
    if (!res.ok) {
      setAppliedCoupon(null);
      setCouponMsg(res.error);
      return;
    }
    setAppliedCoupon(res.coupon.code);
    setCouponMsg(`✓ ${res.coupon.code} applied — you saved ${formatINR(res.discount)}!`);
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponInput('');
    setCouponMsg('');
  };

  // ── Pincode serviceability + delivery-date promise ──────────
  const pinCode = String(shipping.pincode || '').trim();
  const pinInfo = /^\d{6}$/.test(pinCode)
    ? (() => {
        const pins = Array.isArray(settings.serviceablePincodes)
          ? settings.serviceablePincodes
          : [];
        if (pins.length === 0 || pins.includes(pinCode)) {
          const minD = Math.max(1, Number(settings.deliveryMinDays) || 4);
          const maxD = Math.max(minD, Number(settings.deliveryMaxDays) || 7);
          const fmt = (d) =>
            new Date(Date.now() + d * 86400000).toLocaleDateString('en-IN', {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
            });
          return { state: 'ok', label: `Expected delivery ${fmt(minD)} – ${fmt(maxD)}` };
        }
        return { state: 'no', label: `We don't deliver to pincode ${pinCode} yet` };
      })()
    : { state: 'empty' };

  const availableMethods = ALL_PAY_METHODS.filter((m) =>
    cart.every((c) => {
      const p = products.find((x) => x.id === c.id);
      const accepted = p && Array.isArray(p.paymentMethods) ? p.paymentMethods : ['upi', 'card', 'cod'];
      return accepted.includes(m.id);
    })
  );

  const gatewayConfigured = Boolean(settings.razorpayKeyId);
  const activeMethod = availableMethods.find((m) => m.id === method) ? method : (availableMethods[0]?.id || '');
  const pmode = settings.paymentMode || 'demo';

  const payText = (p) => {
    if (p?.method === 'cod') return 'Cash on Delivery';
    if (p?.gateway === 'Demo') return 'Demo payment - no real money charged';
    if (p?.status === 'pending') return 'Online payment pending';
    return p ? 'Paid online via ' + (p.gateway || 'Razorpay') + (p.mode ? ' (' + p.mode + ')' : '') : '';
  };

  if (cart.length === 0 && !placed) {
    return (
      <main className="page center">
        <p>Your cart is empty.</p>
        <Link to="/catalog" className="btn btn-dark">Browse products</Link>
      </main>
    );
  }

  if (placed) {
    return (
      <main className="page center">
        <div className="card-box">
          <div className="ok" style={{ fontSize: 48 }}>OK</div>
          <h2>Order placed successfully!</h2>
          <p><strong>Order ID:</strong> {placed.id}</p>
          <p><strong>Payment:</strong> {payText(placed.payment)}</p>
          <p><strong>Total paid:</strong> {formatINR(placed.total)}</p>
          {gatewayNotice && <p className="error" style={{ marginTop: 10 }}>{gatewayNotice}</p>}
          <div className="pay-methods">
            <button className="btn btn-dark" onClick={() => nav('/')}>Continue shopping</button>
            <button className="btn btn-gold" onClick={() => nav('/track')}>Track order</button>
          </div>
        </div>
      </main>
    );
  }

  const setShip = (k) => (e) => setShipping({ ...shipping, [k]: e.target.value });

  const validate = () => {
    for (const k of ['name', 'phone', 'address', 'city', 'state', 'pincode']) {
      if (!shipping[k].trim()) return 'Please fill all shipping details.';
    }
    if (!/^\d{6}$/.test(shipping.pincode)) return 'Enter a valid 6-digit pincode.';
    if (pinInfo.state === 'no') return `We don't deliver to pincode ${pinCode} yet. Please check another pincode.`;
    return '';
  };

  const submit = async (e) => {
    e.preventDefault();
    if (submitting) return; // double-click / replay guard
    setSubmitting(true);
    setErr('');
    setGatewayNotice('');
    try {
    const v = validate();
    if (v) return setErr(v);

    // Hard stock guard: block the order when any cart qty exceeds available stock.
    const stockIssue = cart.find((c) => {
      const p = products.find((x) => x.id === c.id);
      return p && typeof p.stock === 'number' && c.qty > p.stock;
    });
    if (stockIssue) {
      const left = products.find((x) => x.id === stockIssue.id)?.stock || 0;
      return setErr(
        `Only ${left} left in stock of "${stockIssue.name}" (you have ${stockIssue.qty} in the cart). Please reduce the quantity or remove it.`
      );
    }

    const clientToken =
      Date.now().toString(36) + Math.random().toString(36).slice(2, 12).toUpperCase();
    const baseOrder = {
      clientToken,
      userId: user?.id || null,
      items: cart,
      customer: { name: shipping.name, phone: shipping.phone, email: shipping.email },
      shipping: { address: shipping.address, city: shipping.city, state: shipping.state, pincode: shipping.pincode },
      phone: shipping.phone,
      whatsappOptIn,
      subtotal, shippingFee,
      discount,
      couponCode: appliedCoupon?.code || null,
      total,
    };

    if (activeMethod === 'cod') {
      const payment = { method: 'cod', status: 'pending', mode: 'Cash on Delivery' };
      const order = placeOrder({ ...baseOrder, payment });
      logPayment({ orderId: order.id, method: 'cod', gateway: '', mode: 'COD', status: 'pending', amount: total, verified: null, ref: '' });
      clearCart();
      setPlaced(order);
      return;
    }

    // Simulated online payment (used by Demo mode & Auto fallback). No Razorpay call.
    const simulatePayment = () => {
      const payment = {
        method: 'online',
        gateway: 'Demo',
        status: 'paid',
        mode: activeMethod === 'upi' ? 'UPI' : 'Card',
        ref: 'DEMO-' + Date.now().toString(36).toUpperCase(),
      };
      const order = placeOrder({ ...baseOrder, payment });
      logPayment({ orderId: order.id, method: 'online', gateway: 'Demo', mode: activeMethod === 'upi' ? 'UPI' : 'Card', status: 'paid', verified: false, ref: payment.ref });
      clearCart();
      setPlaced(order);
    };

    // Payment mode from Admin -> Settings:
    //   demo -> always simulate (no Razorpay, no real money)
    //   auto -> try Razorpay, fall back to demo payment on failure
    //   live -> Razorpay only (real money)
    if (pmode === 'demo') {
      setPaying(true);
      await new Promise((r) => setTimeout(r, 1200));
      simulatePayment();
      setPaying(false);
      return;
    }

    if (!gatewayConfigured) {
      if (pmode === 'auto') {
        setPaying(true);
        await new Promise((r) => setTimeout(r, 900));
        simulatePayment();
        setPaying(false);
        setGatewayNotice("Razorpay isn't configured yet, so this test order was completed as a demo payment — no money was charged.");
        return;
      }
      setErr('Payment gateway not configured. Add the Razorpay Key ID in Admin > Settings.');
      return;
    }

    setPaying(true);
    try {
      const response = await payWithRazorpay({
        key: settings.razorpayKeyId,
        amount: total,
        name: settings.storeName,
        mode: activeMethod === 'upi' ? 'UPI' : 'Card',
        prefill: { name: shipping.name, email: shipping.email, contact: shipping.phone },
      });
      const payment = {
        method: 'online',
        gateway: 'Razorpay',
        status: 'paid',
        mode: activeMethod === 'upi' ? 'UPI' : 'Card',
        ref: response.razorpay_payment_id,
      };
      const order = placeOrder({ ...baseOrder, payment });
      logPayment({
        orderId: order.id,
        method: 'online',
        gateway: 'Razorpay',
        mode: activeMethod === 'upi' ? 'UPI' : 'Card',
        status: 'paid',
        verified: Boolean(response && response._verified),
        ref: response?.razorpay_payment_id || '',
        rzOrderId: response?.razorpay_order_id || '',
        signaturePresent: Boolean(response && response.razorpay_signature),
      });
      clearCart();
      setPlaced(order);
    } catch (ex) {
      if (pmode === 'auto') {
        await new Promise((r) => setTimeout(r, 600));
        simulatePayment();
        setGatewayNotice("Payment gateway couldn't complete the payment (" + (ex.message || 'gateway error') + ") — this test order was recorded as a demo payment. No money was charged.");
      } else {
        setErr(ex.message || 'Payment failed. Please try again.');
      }
    } finally {
      setPaying(false);
    }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="page checkout">
      <form id="checkout-form" onSubmit={submit} className="co-left">
        <section className="card-box">
          <h2>1. Shipping details</h2>
          <div className="grid2">
            <label>Full name<input value={shipping.name} onChange={setShip('name')} /></label>
            <label>Phone<input value={shipping.phone} onChange={setShip('phone')} /></label>
          </div>
          <label>Email<input type="email" value={shipping.email} onChange={setShip('email')} /></label>
          <label>Address<input value={shipping.address} onChange={setShip('address')} placeholder="House no, street, area" /></label>
          <div className="grid3">
            <label>City<input value={shipping.city} onChange={setShip('city')} /></label>
            <label>State<input value={shipping.state} onChange={setShip('state')} /></label>
            <label>Pincode
              <input
                value={shipping.pincode}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                  setShip('pincode')({ target: { value: val } });
                  // Re-filter dropdown while typing if it's open
                  if (showPinList) {
                    const p = Array.isArray(settings.serviceablePincodes)
                      ? settings.serviceablePincodes
                      : [];
                    setFilterPin(val);
                    setFilteredPins(
                      p.length === 0
                        ? []
                        : val
                          ? p.filter((x) => x.startsWith(val))
                          : p
                    );
                  }
                }}
                onFocus={() => {
                  const p = Array.isArray(settings.serviceablePincodes)
                    ? settings.serviceablePincodes
                    : [];
                  setShowPinList(true);
                  setFilterPin(shipping.pincode);
                  setFilteredPins(
                    p.length === 0
                      ? []
                      : shipping.pincode
                        ? p.filter((x) => x.startsWith(shipping.pincode))
                        : p
                  );
                }}
                onBlur={() => setTimeout(() => setShowPinList(false), 180)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && filteredPins.length === 1) {
                    setShip('pincode')({ target: { value: filteredPins[0] } });
                    setShowPinList(false);
                  }
                }}
                maxLength={6}
                placeholder="Type or select pincode"
                aria-label="Pincode"
              />
              {showPinList && filteredPins.length > 0 && (
                <ul className="pin-dropdown">
                  {filteredPins.map((pin) => (
                    <li
                      key={pin}
                      className={shipping.pincode === pin ? 'selected' : ''}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setShip('pincode')({ target: { value: pin } });
                        setShowPinList(false);
                      }}
                    >
                      {pin}
                    </li>
                  ))}
                </ul>
              )}
              {pinInfo.state === 'ok' && <span className="pin-msg ok">✓ {pinInfo.label}</span>}
              {pinInfo.state === 'no' && <span className="pin-msg error">✕ {pinInfo.label}</span>}
            </label>
          </div>

          <label className="whatsapp-opt">
            <input
              type="checkbox"
              checked={whatsappOptIn}
              onChange={(e) => setWhatsappOptIn(e.target.checked)}
            />
            <span>📱 Get order updates on WhatsApp</span>
          </label>
        </section>

        <section className="card-box">
          <h2>2. Payment method</h2>
          {activeMethod !== 'cod' && (
            <div className={"mode-badge " + pmode}>
              {pmode === 'demo' && 'DEMO MODE — simulated payment, no money charged'}
              {pmode === 'auto' && 'AUTO MODE — tries Razorpay, falls back to demo'}
              {pmode === 'live' && 'LIVE MODE — real Razorpay payment'}
            </div>
          )}
          <div className="pay-methods">
            {availableMethods.map((m) => (
              <label key={m.id} className={"pay-opt " + (activeMethod === m.id ? "active" : "")}>
                <input type="radio" name="pay" checked={activeMethod === m.id}
                  onChange={() => setMethod(m.id)} />
                <div><strong>{m.label}</strong><span>{m.hint}</span></div>
              </label>
            ))}
          </div>
          {activeMethod === 'upi' && <p className="muted">Pay securely via UPI (GPay, PhonePe, Paytm, BHIM).</p>}
          {activeMethod === 'card' && <p className="muted">Pay securely via card inside the Razorpay window.</p>}
          {activeMethod === 'cod' && <p className="muted">Keep exact change ready at delivery.</p>}
          {activeMethod !== 'cod' && pmode === 'demo' && <p className="muted">Demo mode is ON - online payment is simulated, no real money is charged.</p>}
          {activeMethod !== 'cod' && pmode === 'auto' && <p className="muted">Auto mode: tries Razorpay first, falls back to a demo payment if it fails.</p>}
          {activeMethod !== 'cod' && pmode === 'live' && !gatewayConfigured && <p className="error">Payment gateway not configured.</p>}
          {activeMethod !== 'cod' && pmode === 'live' && gatewayConfigured && <p className="ok tiny">Secure online payment via Razorpay.</p>}
        </section>
      </form>

      <aside className="co-right">
        <div className="card-box sticky">
          <h2>Order summary</h2>
          <ul className="sum-items">
            {cart.map((c) => (
              <li key={c.key}>
                <span>{c.name}{c.size ? ` (Size ${c.size})` : ''} x {c.qty}</span>
                <span>{formatINR(c.price * c.qty)}</span>
              </li>
            ))}
          </ul>
          <div className="sum-lines">
            <div><span>Subtotal</span><span>{formatINR(subtotal)}</span></div>
            <div><span>Shipping</span><span>{shippingFee === 0 ? 'FREE' : formatINR(shippingFee)}</span></div>
            {discount > 0 && (
              <div className="discount-line">
                <span>Coupon ({appliedCoupon.code})</span>
                <span>− {formatINR(discount)}</span>
              </div>
            )}
            <div className="total"><span>Total</span><span>{formatINR(total)}</span></div>
          </div>
          {pinInfo.state === 'ok' && (
            <p className="pin-promise">🚚 {pinInfo.label}</p>
          )}
          {pinInfo.state === 'no' && (
            <p className="error tiny">{pinInfo.label}</p>
          )}

          <div className="coupon-box">
            {appliedCoupon ? (
              <div className="coupon-applied">
                <span>🎟️ <strong>{appliedCoupon.code}</strong> — saved {formatINR(appliedCoupon.discount)}</span>
                <button type="button" className="linklike" onClick={removeCoupon}>Remove</button>
              </div>
            ) : (
              <div className="coupon-row">
                <input
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                  placeholder="Coupon code"
                  aria-label="Coupon code"
                />
                <button type="button" className="btn btn-sm btn-ghost" onClick={applyCoupon} disabled={!couponInput.trim()}>
                  Apply
                </button>
              </div>
            )}
            {couponMsg && <p className={`tiny ${couponMsg.startsWith('✓') ? 'ok' : 'error'}`}>{couponMsg}</p>}
          </div>

          {err && <p className="error">{err}</p>}
          <button form="checkout-form" className="btn btn-gold btn-block" type="submit" disabled={paying || submitting || !activeMethod}>
            {paying ? 'Processing...' : submitting ? 'Placing order...' : activeMethod === 'cod' ? 'Place order - COD' : 'Pay & place order'}
          </button>
        </div>
      </aside>
    </main>
  );
}
