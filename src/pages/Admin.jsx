import React, { useState } from 'react';
import { Navigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useData } from '../context/DataContext.jsx';
import { formatINR, formatDateTime } from '../utils/format.js';
import { invoicePdfUrl, downloadInvoicePdf, downloadPackingSlip } from '../utils/invoicePdf.js';
import { productImage } from '../db.js';
import OrdersQueue from '../components/OrdersQueue.jsx';
import SizeGuide from '../components/SizeGuide.jsx';
import SalesManager from '../components/SalesManager.jsx';
import { statusMeta } from '../orderFlow.js';

const CATS = ['Suits', 'Ethnic', 'Lehenga', 'Saree', 'Daily Wear'];
const ALL_PAY = [
  { id: 'upi', label: 'UPI' },
  { id: 'card', label: 'Card' },
  { id: 'cod', label: 'COD' },
];

const emptyForm = {
  name: '',
  description: '',
  category: 'Suits',
  price: '',
  mrp: '',
  stock: 10,
  featured: false,
  color: '#9b1c3d',
  shippingCost: 99,
  paymentMethods: ['upi', 'card', 'cod'],
  returnsAccepted: true,
  returnDays: 7,
  sizes: [],
  customImages: [],
};

// ── Delhivery rate card ⇄ compact text ──────────────────────
// One zone per line:  key | base | per500g | codExtra | minCharge | freeAbove
// A zone key is matched as the longest `pin:12345` prefix, then a lowercase
// state name (e.g. `haryana`), then `default`.
const rateCardToText = (card) => {
  const zones = card && card.zones ? card.zones : null;
  if (!zones || typeof zones !== "object") return "";
  return Object.keys(zones)
    .map((k) => {
      const z = zones[k] || {};
      return [k, z.same || 0, z.per500g || 0, z.codExtra || 0, z.minCharge || 0, z.freeAbove || 0].join(" | ");
    })
    .join("\n");
};

const textToRateCard = (text) => {
  const zones = {};
  String(text || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .forEach((line) => {
      const parts = line.split("|").map((p) => p.trim());
      const key = parts[0];
      if (!key) return;
      const num = (i) => {
        const n = Number(String(parts[i] === undefined ? "" : parts[i]).replace(/[^\d.]/g, ""));
        return Number.isFinite(n) && n > 0 ? n : 0;
      };
      zones[key] = { same: num(1), per500g: num(2), codExtra: num(3), minCharge: num(4), freeAbove: num(5) };
    });
  return { zones };
};
function InvoicePreviewModal({ order, settings, onClose }) {
  const [url, setUrl] = React.useState('');
  React.useEffect(() => {
    let u = null;
    invoicePdfUrl(order, settings).then((url) => {
      u = url;
      setUrl(url);
    });
    return () => {
      if (u) URL.revokeObjectURL(u);
    };
  }, [order, settings]);
  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-card invoice-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 860 }}>
        <div className="modal-head">
          <h2>Invoice — {order.id}</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div style={{ padding: 16 }}>
          <div className="row-gap" style={{ marginBottom: 12 }}>
            <span className="muted">{formatDateTime(order.orderDate)} · {formatINR(order.total)}</span>
            <span style={{ flex: 1 }} />
            <button
              type="button"
              className="btn btn-sm btn-gold"
              onClick={() => downloadInvoicePdf(order, settings)}
            >
              ⬇ Download PDF
            </button>
            <button type="button" className="btn btn-sm btn-ghost" onClick={onClose}>Close</button>
          </div>
          {url ? (
            <iframe
              title={`Invoice ${order.id}`}
              src={url}
              style={{ width: '100%', height: 520, border: '1px solid var(--line)', borderRadius: 8, background: '#fff' }}
            />
          ) : (
            <p className="muted">Preparing PDF…</p>
          )}
        </div>
      </div>
    </div>
  );
}

const STAFF_ROLE_CHOICES = ['packer', 'shipper', 'support', 'manager', 'admin', 'customer'];

function CouponForm({ addCoupon }) {
  const [code, setCode] = useState('');
  const [type, setType] = useState('percent');
  const [value, setValue] = useState('');
  const [minOrder, setMinOrder] = useState('');
  const [msg, setMsg] = useState('');

  const submit = (e) => {
    e.preventDefault();
    const v = Number(value);
    if (!code.trim()) return setMsg('Enter a coupon code.');
    if (!v || v <= 0) return setMsg('Enter a discount value.');
    if (type === 'percent' && v > 100) return setMsg('Percent discount cannot exceed 100.');
    addCoupon({ code, type, value: v, minOrder: Number(minOrder) || 0 });
    setMsg(`Coupon "${code.trim().toUpperCase()}" created — it is live at checkout right away.`);
    setCode(''); setValue(''); setMinOrder('');
    setTimeout(() => setMsg(''), 3500);
  };

  return (
    <form onSubmit={submit} className="form">
      <div className="grid2">
        <label>
          Coupon code
          <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="e.g. FESTIVE10" maxLength={20} />
        </label>
        <label>
          Discount type
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="percent">Percent (%) off subtotal</option>
            <option value="flat">Flat (₹) off subtotal</option>
          </select>
        </label>
      </div>
      <div className="grid2">
        <label>
          {type === 'percent' ? 'Percent off (e.g. 10)' : 'Amount off in ₹ (e.g. 200)'}
          <input type="number" min="1" value={value} onChange={(e) => setValue(e.target.value)} placeholder={type === 'percent' ? '10' : '200'} />
        </label>
        <label>
          Minimum order ₹ (optional)
          <input type="number" min="0" value={minOrder} onChange={(e) => setMinOrder(e.target.value)} placeholder="e.g. 1499" />
        </label>
      </div>
      <div className="row-gap">
        <button className="btn btn-gold" type="submit">Create coupon</button>
      </div>
      {msg && <p className="ok">{msg}</p>}
    </form>
  );
}

function StaffRoleForm({ setUserRole }) {
  const [uid, setUid] = useState('');
  const [role, setRole] = useState('packer');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setMsg('');
    setErr('');
    try {
      await setUserRole(uid.trim(), role);
      setMsg('Role saved: ' + uid.trim() + ' is now "' + role + '". Applies on their next login/reload.');
      setUid('');
    } catch (ex) {
      setErr(ex.message || 'Failed to update role.');
    }
  };

  return (
    <form onSubmit={submit} className="form">
      <div className="grid2">
        <label>
          Firebase UID
          <input
            value={uid}
            onChange={(e) => setUid(e.target.value)}
            required
            placeholder="e.g. 3XkQ9Z... (Firebase console > Authentication)"
          />
        </label>
        <label>
          Role
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            {STAFF_ROLE_CHOICES.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="row-gap">
        <button className="btn btn-gold" type="submit">Save role</button>
      </div>
      {msg && <p className="ok">{msg}</p>}
      {err && <p className="error">{err}</p>}
    </form>
  );
}

export default function Admin() {
  const { user, isAdmin, isStaff, setUserRole } = useAuth();
  const { products, orders, settings, updateSettings, addProduct, updateProduct, deleteProduct, updateOrderStatus, coupons, addCoupon, deleteCoupon, toggleCoupon } = useData();
  const { payments, returns, updateReturnStatus, sales, addSale, updateSale, deleteSale, toggleSale } = useData();
  const [tab, setTab] = useState(isAdmin ? 'products' : 'orders');
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [msg, setMsg] = useState('');
  const [invoiceOrder, setInvoiceOrder] = useState(null);
  const [s, setS] = useState(settings);
  const [savedMsg, setSavedMsg] = useState('');
  const [sizeGuideOpen, setSizeGuideOpen] = useState(false);
  const [autoOpened, setAutoOpened] = useState(false);
  const [params] = useSearchParams();
  const orderParam = params.get('order');

  React.useEffect(() => {
    if (autoOpened || !orderParam) return;
    const found = orders.find((o) => o.id === orderParam);
    if (found) {
      setAutoOpened(true);
      setTab('orders');
      setInvoiceOrder(found);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, orderParam]);

  if (!isStaff) {
    const from = orderParam ? `/admin?order=${orderParam}` : '/admin';
    return <Navigate to="/login" replace state={{ from }} />;
  }

    const setSField = (k) => (e) => setS({ ...s, [k]: e.target.value });

  const readAsDataURL = async (file) => {
    const buf = await file.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return 'data:' + file.type + ';base64,' + btoa(bin);
  };

  const handleLogoFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/') || file.size > 5 * 1024 * 1024) {
      setSavedMsg('Upload an image file smaller than 5 MB.');
      setTimeout(() => setSavedMsg(''), 2500);
      e.target.value = '';
      return;
    }
    try {
      const url = await readAsDataURL(file);
      setS({ ...s, logoUrl: url, logoWidth: 48 });
      setSavedMsg('Logo uploaded — click Save settings to apply site-wide.');
      setTimeout(() => setSavedMsg(''), 2500);
    } catch {
      setSavedMsg('Failed to read the image file.');
      setTimeout(() => setSavedMsg(''), 2500);
    }
    e.target.value = '';
  };

  const saveSettings = (e) => {
    e.preventDefault();
    updateSettings(s);
    setSavedMsg('Settings saved & applied right away.');
    setTimeout(() => setSavedMsg(''), 2500);
  };

  const set = (k) => (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm({ ...form, [k]: val });
  };

  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const MAX = 5;
    const accepted = files.filter(
      (file) => file.type.startsWith('image/') && file.size <= 5 * 1024 * 1024
    );

    if (accepted.length !== files.length) {
      setMsg('Only image files under 5MB are allowed.');
      setTimeout(() => setMsg(''), 2500);
      if (accepted.length === 0) {
        e.target.value = '';
        return;
      }
    }

    const readAsDataURL = async (file) => {
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let bin = '';
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      return 'data:' + file.type + ';base64,' + btoa(bin);
    };

    Promise.all(accepted.map(readAsDataURL))
      .then((urls) => {
        const room = Math.max(0, MAX - form.customImages.length);
        const next = [...form.customImages, ...urls.slice(0, room)];
        setForm({ ...form, customImages: next });
        if (urls.length > room) {
          setMsg('Maximum 5 images allowed. Extra images were skipped.');
          setTimeout(() => setMsg(''), 2500);
        }
      })
      .catch(() => {
        setMsg('Failed to read the selected image file(s).');
        setTimeout(() => setMsg(''), 2500);
      });

    // Reset input so the same file can be selected again
    e.target.value = '';
  };

  const removeImage = (index) => {
    const newImages = form.customImages.filter((_, i) => i !== index);
    setForm({ ...form, customImages: newImages });
  };

  const submit = (e) => {
    e.preventDefault();
    if (form.paymentMethods.length === 0) {
      setMsg('Select at least one payment method.');
      setTimeout(() => setMsg(''), 2500);
      return;
    }
    const customImgs = form.customImages.filter((img) => img && img.trim() !== '');
    const data = {
      ...form,
      price: Number(form.price),
      mrp: Number(form.mrp) || Math.round(Number(form.price) * 1.25 / 10) * 10,
      sizes: (form.sizes || []).map((s) => String(s).trim().toUpperCase()).filter(Boolean),
      image: customImgs.length > 0 ? customImgs[0] : productImage(form.name.toUpperCase(), form.color),
      images: customImgs.length > 0 ? customImgs : [productImage(form.name.toUpperCase(), form.color)],
      shippingCost: Number(form.shippingCost) || 0,
      returnsAccepted: Boolean(form.returnsAccepted),
      returnDays: form.returnsAccepted ? Math.max(0, Number(form.returnDays) || 0) : 0,
    };
    if (editingId) {
      updateProduct(editingId, data);
      setMsg('Product updated.');
    } else {
      addProduct(data);
      setMsg('Product added.');
    }
    setForm(emptyForm);
    setEditingId(null);
    setTimeout(() => setMsg(''), 2000);
  };

  const startEdit = (p) => {
    setEditingId(p.id);
    setForm({
      name: p.name,
      description: p.description,
      category: p.category,
      price: p.price,
      mrp: p.mrp,
      stock: p.stock,
      featured: p.featured,
      color: p.color,
      shippingCost: p.shippingCost ?? 99,
      paymentMethods: p.paymentMethods || ['upi', 'card', 'cod'],
      returnsAccepted: p.returnsAccepted ?? true,
      returnDays: p.returnDays ?? 7,
      sizes: p.sizes || [],
      customImages: p.images || (p.image ? [p.image] : []),
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const togglePayMethod = (id) => {
    setForm((f) => {
      const has = f.paymentMethods.includes(id);
      const next = has
        ? f.paymentMethods.filter((m) => m !== id)
        : [...f.paymentMethods, id];
      return { ...f, paymentMethods: next };
    });
  };
  return (
    <main className="page admin">
      <div className="page-head">
        <h1>Admin Dashboard</h1>
        <p>Manage products & orders</p>
      </div>

      <div className="admin-tabs">
        {isAdmin && (
          <button className={tab === 'products' ? 'chip active' : 'chip'} onClick={() => setTab('products')}>
            Products ({products.length})
          </button>
        )}
        <button className={tab === 'orders' ? 'chip active' : 'chip'} onClick={() => setTab('orders')}>
          Orders ({orders.length})
        </button>
        {isAdmin && (
          <button className={tab === 'settings' ? 'chip active' : 'chip'} onClick={() => setTab('settings')}>
            Settings
          </button>
        )}
        {isAdmin && (
          <button className={tab === 'coupons' ? 'chip active' : 'chip'} onClick={() => setTab('coupons')}>
            Coupons {coupons.length ? `(${coupons.length})` : ''}
          </button>
        )}
        {isAdmin && (
          <button className={tab === 'returns' ? 'chip active' : 'chip'} onClick={() => setTab('returns')}>
            Returns {returns.length ? `(${returns.length})` : ''}
          </button>
        )}
        {isAdmin && (
          <button className={tab === 'payments' ? 'chip active' : 'chip'} onClick={() => setTab('payments')}>
            Payments
          </button>
        )}
        {isAdmin && (
          <button className={tab === 'sales' ? 'chip active' : 'chip'} onClick={() => setTab('sales')}>
            Sales
          </button>
        )}
        {isAdmin && (
          <button className={tab === 'staff' ? 'chip active' : 'chip'} onClick={() => setTab('staff')}>
            Staff
          </button>
        )}
        <Link to="/customer360" className="chip">Customer 360</Link>
        <Link to="/dashboard" className="chip">Live board</Link>
      </div>

      {tab === 'products' && (
        <>
          <section className="card-box">
            <h2>{editingId ? 'Edit product' : 'Add a new product'}</h2>
            {msg && <p className="ok">{msg}</p>}
            <form onSubmit={submit} className="form">
              <div className="grid2">
                <label>Name<input value={form.name} onChange={set('name')} required /></label>
                <label>Category<select value={form.category} onChange={set('category')}>
                  {CATS.map((c) => <option key={c}>{c}</option>)}
                </select></label>
              </div>
              <label>Description<textarea rows="2" value={form.description} onChange={set('description')} required /></label>

              {/* ── Image: URL or file upload ─────────────────── */}
              <div className="image-upload-section">
                <label>Product images (up to 5)
                  <span className="muted tiny">Upload up to 5 images. First image will be the main image.</span>
                </label>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageUpload}
                  disabled={form.customImages.length >= 5}
                />
                {form.customImages.length > 0 && (
                  <div className="img-preview-grid">
                    {form.customImages.map((img, idx) => (
                      <div key={idx} className="img-preview-item">
                        <img src={img} alt={`Preview ${idx + 1}`} />
                        {idx === 0 && <span className="img-badge">Main</span>}
                        <button type="button" className="btn btn-sm danger remove-img" onClick={() => removeImage(idx)}>
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <label>Or paste image URL
                  <input
                    onBlur={(e) => {
                      const url = e.target.value.trim();
                      if (url && (url.startsWith("http") || url.startsWith("data:"))) {
                        setForm({ ...form, customImages: [...form.customImages, url] });
                        e.target.value = "";
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        e.target.blur();
                      }
                    }}
                    placeholder="https://example.com/image.jpg — press Enter to add"
                  />
                </label>
              </div>

              <div className="grid3">
                <label>Price (₹)<input type="number" min="0" value={form.price} onChange={set('price')} required /></label>
                <label>MRP (₹)<input type="number" min="0" value={form.mrp} onChange={set('mrp')} placeholder="Optional" /></label>
                <label>Stock<input type="number" min="0" value={form.stock} onChange={set('stock')} /></label>
              </div>
              <div className="grid2">
                <label>Image tint<input type="color" value={form.color} onChange={set('color')} /></label>
                <label className="inline-check">
                  <input type="checkbox" checked={form.featured} onChange={set('featured')} />
                  Show as featured product
                </label>
              </div>
              {/* ── Shipping cost ─────────────────────────── */}
              <div className="grid2">
               {/* ── Product weight ─────────────────────────── */}
               <div className="grid2">
                 <label>Product weight (grams)
                   <input
                     type="number"
                     min="50"
                     step="10"
                     value={form.weightGrams || 500}
                     onChange={(e) => setForm({ ...form, weightGrams: Number(e.target.value) || 500 })}
                     placeholder="500"
                   />
                   <span className="muted tiny">Used by live Delhivery shipping to calculate rate by weight.</span>
                 </label>
               </div>

                <label>Shipping cost per unit (₹)
                  <input
                    type="number"
                    min="0"
                    value={form.shippingCost}
                    onChange={(e) => setForm({ ...form, shippingCost: e.target.value })}
                    placeholder="99"
                  />
                  <span className="muted tiny">Set to 0 for free shipping on this product.</span>
                </label>
                <div>
                  <label style={{ display: 'block', marginBottom: 4 }}>Accepted payment methods</label>
                  <div className="pay-checks">
                    {ALL_PAY.map((m) => (
                      <label key={m.id} className="check">
                        <input
                          type="checkbox"
                          checked={form.paymentMethods.includes(m.id)}
                          onChange={() => togglePayMethod(m.id)}
                        />
                        {m.label}
                      </label>
                    ))}
                  </div>
                  <span className="muted tiny">Uncheck to disable a method for this product.</span>
                </div>
              </div>

              {/* ── Returns ───────────────────────────────── */}
              <div className="return-box">
                <label className="check">
                  <input
                    type="checkbox"
                    checked={form.returnsAccepted}
                    onChange={(e) => setForm({ ...form, returnsAccepted: e.target.checked })}
                  />
                  Returns accepted
                </label>
                {form.returnsAccepted && (
                  <label className="return-days">
                    Return window (days)
                    <input
                      type="number"
                      min="0"
                      value={form.returnDays}
                      onChange={(e) => setForm({ ...form, returnDays: e.target.value })}
                      placeholder="7"
                    />
                  </label>
                )}
              </div>

              {/* ── Sizes (opens the editable size guide) ─────────── */}
              <div className="sizes-box">
                <label style={{ display: 'block', marginBottom: 4 }}>Sizes for this product</label>
                {form.sizes.length > 0 ? (
                  <div className="size-edit-chips">
                    {form.sizes.map((sz) => <span key={sz} className="chip size-chip">{sz}</span>)}
                  </div>
                ) : (
                  <p className="muted tiny">No sizes set — the product will be sold free-size (no size picker).</p>
                )}
                <button
                  type="button"
                  className="btn btn-sm btn-ghost"
                  onClick={() => setSizeGuideOpen(true)}
                >
                  📏 Edit sizes &amp; size guide
                </button>
                <span className="muted tiny">
                  Click to open the size guide — add/remove the sizes (S, M, L…) customers can choose.
                </span>
              </div>

              <div className="row-gap">
                <button className="btn btn-gold" type="submit">
                  {editingId ? 'Update product' : 'Add product'}
                </button>
                {editingId && (
                  <button type="button" className="btn btn-ghost"
                    onClick={() => { setEditingId(null); setForm(emptyForm); }}>
                    Cancel edit
                  </button>
                )}
              </div>
            </form>
          </section>

          <section className="card-box">
            <h2>All products</h2>
            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr><th>Name</th><th>Category</th><th>Price</th><th>Stock</th><th>Featured</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p.id}>
                      <td><Link to={`/product/${p.id}`}>{p.name}</Link></td>
                      <td>{p.category}</td>
                      <td>{formatINR(p.price)}</td>
                      <td>{p.stock}</td>
                      <td>{p.featured ? '★' : '—'}</td>
                      <td className="row-gap">
                        <button className="btn btn-sm" onClick={() => startEdit(p)}>Edit</button>
                        <button className="btn btn-sm danger" onClick={() => deleteProduct(p.id)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
      {tab === 'orders' && (
        <section className="card-box">
          <h2>Orders queue</h2>
          {orders.length === 0 ? (
            <p className="muted">No orders yet. Orders placed by customers will appear here.</p>
          ) : (
            <OrdersQueue
              orders={orders}
              role={user?.role || 'admin'}
              user={user}
              onUpdate={(o, status, opts) => updateOrderStatus(o.id, status, statusMeta(status).label, opts)}
              onInvoice={(o) => setInvoiceOrder(o)}
              onPackSlip={(o) => downloadPackingSlip(o, settings)}
            />
          )}
        </section>
      )}

      {tab === 'staff' && (
        <section className="card-box">
          <h2>Staff roles</h2>
          <p className="muted small">
            Promote a registered user to a staff role. The UID is visible in the Firebase console
            (Authentication &gt; Users) after the person logs in on the site once. The new role
            applies on their next login or page reload.
          </p>
          <StaffRoleForm setUserRole={setUserRole} />
        </section>
      )}

      {tab === 'coupons' && (
        <>
          <section className="card-box">
            <h2>Create a coupon</h2>
            <p className="muted small">
              Customers can enter the code at checkout. Percent coupons take a % off the subtotal;
              flat coupons take a fixed ₹ amount off. Minimum order (optional) must be met before the coupon applies.
            </p>
            <CouponForm addCoupon={addCoupon} />
          </section>

          <section className="card-box">
            <h2>All coupons</h2>
            {coupons.length === 0 ? (
              <p className="muted">No coupons yet. Create your first one above.</p>
            ) : (
              <div className="table-scroll">
                <table className="table">
                  <thead>
                    <tr><th>Code</th><th>Discount</th><th>Min order</th><th>Used</th><th>Status</th><th>Actions</th></tr>
                  </thead>
                  <tbody>
                    {coupons.map((c) => (
                      <tr key={c.id}>
                        <td><strong>{c.code}</strong></td>
                        <td>{c.type === 'percent' ? `${c.value}% off` : `${formatINR(c.value)} off`}</td>
                        <td>{c.minOrder ? formatINR(c.minOrder) : '—'}</td>
                        {(() => {
                          // "Used" is counted straight from the ORDERS collection
                          // (source of truth) — it updates live and can never
                          // drift or be overwritten by a stale device snapshot.
                          const used = orders.filter(
                            (o) => o.couponCode &&
                              String(o.couponCode).toUpperCase() === String(c.code).toUpperCase()
                          ).length;
                          return <td title={`${used} order${used === 1 ? '' : 's'} used this code`}>{used}</td>;
                        })()}
                        <td>
                          <span className={`status-badge ${c.active ? 'confirmed' : 'cancelled'}`}>
                            {c.active ? 'Active' : 'Paused'}
                          </span>
                        </td>
                        <td className="row-gap">
                          <button className="btn btn-sm" onClick={() => toggleCoupon(c.id)}>
                            {c.active ? 'Pause' : 'Activate'}
                          </button>
                          <button className="btn btn-sm danger" onClick={() => deleteCoupon(c.id)}>Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

    {tab === 'returns' && (
        <section className="card-box">
          <h2>Return requests</h2>
          {returns.length === 0 ? (
            <p className="muted">
              No returns yet. Customers request returns from their order page; reverse pickup is booked with Delhivery automatically.
            </p>
          ) : (
            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr><th>Return</th><th>Order</th><th>Customer</th><th>Items</th><th>Reason</th><th>Status / AWB</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {returns.map((r) => (
                    <tr key={r.id}>
                      <td><strong>{r.id}</strong><br /><span className="muted tiny">{formatDateTime(r.requestDate)}</span></td>
                      <td>{r.orderId}</td>
                      <td>{r.customerName}<br /><span className="muted tiny">{r.phone}</span></td>
                      <td><span className="muted tiny">{r.items.map((it) => `${it.name}${it.size ? ` (${it.size})` : ''} ×${it.qty}`).join(', ')}</span></td>
                      <td>{r.reason}{r.note ? <span className="muted tiny"><br />{r.note}</span> : null}</td>
                      <td>
                        <span className={`status-badge ${r.status}`}>{r.status.toUpperCase()}</span>
                        {r.pickupAwb ? <span className="muted tiny"><br />AWB {r.pickupAwb}</span> : null}
                      </td>
                      <td className="row-gap">
                        {r.status === 'requested' && <button className="btn btn-sm" onClick={() => updateReturnStatus(r.id, 'approved')}>Approve pickup</button>}
                        {r.status === 'approved' && <button className="btn btn-sm" onClick={() => updateReturnStatus(r.id, 'picked')}>Mark picked</button>}
                        {r.status === 'picked' && <button className="btn btn-sm" onClick={() => updateReturnStatus(r.id, 'received')}>Mark received</button>}
                        {r.status === 'received' && <button className="btn btn-sm" onClick={() => updateReturnStatus(r.id, 'refunded')}>Mark refunded</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {tab === 'payments' && (
        <section className="card-box">
          <h2>Payment log</h2>
          <p className="muted small">
            Every payment attempt/callback is recorded when an order is placed. ✓ = Razorpay signature verified server-side.
          </p>
          {payments.length === 0 ? (
            <p className="muted">No payments recorded yet.</p>
          ) : (
            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr><th>When</th><th>Order</th><th>Gateway</th><th>Mode</th><th>Ref</th><th>Verified</th><th>Amount</th></tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id}>
                      <td>{formatDateTime(p.at)}</td>
                      <td>{p.orderId || '—'}</td>
                      <td>{p.gateway || p.method || '—'}</td>
                      <td>{p.mode || '—'}</td>
                      <td>{String(p.ref || '').slice(0, 22)}</td>
                      <td>
                        {p.gateway === 'Razorpay'
                          ? (p.verified ? <span className="ok">✓ verified</span> : <span className="muted">not verified</span>)
                          : <span className="muted">n/a</span>}
                      </td>
                      <td>{p.amount ? formatINR(p.amount) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {tab === 'sales' && (
        <>
          <SalesDashboard orders={orders} payments={payments} returns={returns} />
          <SalesManager
            sales={sales}
            products={products}
            addSale={addSale}
            updateSale={updateSale}
            deleteSale={deleteSale}
            toggleSale={toggleSale}
          />
        </>
      )}

      {tab === 'settings' && (
        <section className="card-box">
          <h2>Store settings</h2>
          <p className="muted">These changes are applied across the site instantly.</p>
          <form onSubmit={saveSettings} className="form settings-form">
                        <div className="grid2">
              <label>Store name
                <input value={s.storeName} onChange={setSField('storeName')} />
              </label>
              <label>Logo letter
                <input maxLength={1} value={s.logoLetter} onChange={setSField('logoLetter')} />
              </label>
            </div>

            <label>Logo image (optional — overrides the letter mark)
              <div className="logo-upload-row">
                <input
                  type="url"
                  placeholder="https://example.com/logo.png"
                  value={s.logoUrl || ''}
                  onChange={(e) => setS({ ...s, logoUrl: e.target.value || null })}
                  className="logo-url-input"
                />
                <label className="logo-file-btn">
                  Upload file
                  <input type="file" accept="image/*" hidden onChange={handleLogoFile} />
                </label>
                {s.logoUrl && (
                  <button
                    type="button"
                    className="linklike"
                    onClick={() => setS({ ...s, logoUrl: null })}
                  >
                    Remove
                  </button>
                )}
              </div>
              <span className="muted tiny">Paste an image URL or upload a file. Recommended: a transparent PNG, ~48px tall. Max 5 MB.</span>
            </label>
            <label>Tagline (below the store name)
              <input value={s.tagline} onChange={setSField('tagline')} />
            </label>
            <label>Announcement bar
              <input value={s.announcement} onChange={setSField('announcement')} />
            </label>
            <label>Hero heading (home page)
              <input value={s.heroHeading} onChange={setSField('heroHeading')} />
            </label>
            <label>Hero subheading (home page)
              <input value={s.heroSubheading} onChange={setSField('heroSubheading')} />
            </label>
            <div className="grid2">
              <label>Contact phone
                <input value={s.contactPhone} onChange={setSField('contactPhone')} />
              </label>
              <label>Contact email
                <input value={s.contactEmail} onChange={setSField('contactEmail')} />
              </label>
            </div>
            <label>Contact address
              <input value={s.contactAddress} onChange={setSField('contactAddress')} />
            </label>
                        
            <label>Razorpay Key ID (payment gateway)
              <input value={s.razorpayKeyId || ''} onChange={setSField('razorpayKeyId')} placeholder="rzp_test_XXXX / rzp_live_XXXX" />
              <span className="muted tiny">Used to accept live UPI & card payments via Razorpay. Use a TEST key for sandbox or your LIVE key for real money.</span>
            </label>
            <label>Free shipping threshold (₹)
              <input type="number" min="0" value={s.freeShippingThreshold || 0} onChange={setSField('freeShippingThreshold')} placeholder="1499" />
              <span className="muted tiny">Orders at or above this amount get free shipping. Per-product shipping fees still apply below this threshold.</span>
            </label>

            <div className="flash-sale-settings">
              <h3 style={{ margin: '6px 0 10px' }}>🔥 Flash sale banner</h3>
              <label className="check-row" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={!!(s.flashSale && s.flashSale.active)}
                  onChange={(e) =>
                    setS({
                      ...s,
                      flashSale: {
                        ...(s.flashSale || {}),
                        active: e.target.checked,
                        message: (s.flashSale && s.flashSale.message) || '',
                        endsAt: (s.flashSale && s.flashSale.endsAt) || '',
                      },
                    })
                  }
                />
                <span>Show flash-sale banner on every page (with live countdown)</span>
              </label>
              <label>Banner message
                <input
                  value={(s.flashSale && s.flashSale.message) || ''}
                  onChange={(e) => setS({ ...s, flashSale: { ...(s.flashSale || {}), active: !!(s.flashSale && s.flashSale.active), message: e.target.value, endsAt: (s.flashSale && s.flashSale.endsAt) || '' } })}
                  placeholder="e.g. TEEJ SALE — flat 20% off everything!"
                  maxLength={120}
                />
              </label>
              <label>Sale ends at
                <input
                  type="datetime-local"
                  value={(s.flashSale && s.flashSale.endsAt) || ''}
                  onChange={(e) => setS({ ...s, flashSale: { ...(s.flashSale || {}), active: !!(s.flashSale && s.flashSale.active), message: (s.flashSale && s.flashSale.message) || '', endsAt: e.target.value } })}
                />
                <span className="muted tiny">The banner disappears automatically the moment this time passes — on every visitor's screen. Save settings to apply.</span>
              </label>
            </div>

            <div className="flash-sale-settings">
              <h3 style={{ margin: '6px 0 10px' }}>🚚 Delivery & pincodes</h3>
              <label>Serviceable pincodes (one per line, 6-digit)
                <textarea
                  rows="4"
                  value={(s.serviceablePincodes || []).join('\n')}
                  onChange={(e) => setS({ ...s, serviceablePincodes: e.target.value.split(/[\s,]+/).map((x) => x.trim()).filter((x) => /^\d{6}$/.test(x)) })}
                  placeholder={'124507\n110001\n560001'}
                />
                <span className="muted tiny">Checkout blocks pincodes not listed here. Empty = deliver everywhere in India.</span>
              </label>
              <div className="grid2">
                <label>Earliest delivery (days from today)
                  <input type="number" min="1" value={s.deliveryMinDays || 4} onChange={setSField('deliveryMinDays')} />
                </label>
                <label>Latest delivery (days from today)
                  <input type="number" min="1" value={s.deliveryMaxDays || 7} onChange={setSField('deliveryMaxDays')} />
                </label>
              </div>
              <p className="muted tiny">The checkout shows e.g. <strong>"Expected delivery Mon, 15 Sep – Thu, 18 Sep"</strong> once a valid, serviceable pincode is entered.</p>
            </div>
               <div className="grid2">
                 <label>Shipping cost source
                   <select value={s.shippingSource || 'product'} onChange={(e) => setSField('shippingSource')(e)}>
                     <option value="product">Per-product shipping cost (current)</option>
                     <option value="delhivery">Live Delhivery rate by pincode + weight</option>
                   </select>
                 </label>
                 <span className="muted tiny">Choose how checkout calculates shipping. 'delhivery' uses live courier rates based on pincode + order weight.</span>
               </div>

            {(s.shippingSource || "product") === "delhivery" && (
              <div className="flash-sale-settings">
                <h3 style={{ margin: "6px 0 10px" }}>📦 Delhivery rate card</h3>
                <label>Zones — one per line: key | base | per500g | codExtra | minCharge | freeAbove
                  <textarea
                    rows="6"
                    value={rateCardToText(s.rateCard)}
                    onChange={(e) => setS({ ...s, rateCard: textToRateCard(e.target.value) })}
                    placeholder={"pin:124 | 40 | 25 | 20 | 60 | 0\ndefault | 90 | 50 | 40 | 120 | 0"}
                  />
                  <span className="muted tiny">
                    Checkout charges the courier rate for the parcel weight plus the COD surcharge.
                    A key is matched as the longest <code>pin:12345</code> prefix, then a lowercase
                    state name (e.g. <code>haryana</code>), then <code>default</code>.
                    <strong> base</strong> is a flat charge, <strong>per500g</strong> is added per
                    500 g slab, <strong>minCharge</strong> is a floor, and <strong>freeAbove</strong>
                    makes that zone free at or above the given order value (0 = never free).
                    Copy these numbers from your Delhivery contract — the courier has no public rate API.
                  </span>
                </label>
              </div>
            )}
            <div className="pay-mode-row">
              <label style={{ display: 'block', marginBottom: 4 }}>Payment mode</label>
              <div className="pay-mode-options">
                {[
                  { id: 'demo', label: 'Demo', desc: 'Simulated payments — no real money' },
                  { id: 'auto', label: 'Auto', desc: 'Try Razorpay, fall back to demo' },
                  { id: 'live', label: 'Live', desc: 'Real payments only — no fallback' },
                ].map((opt) => (
                  <label key={opt.id} className={`pay-mode-opt ${(s.paymentMode || 'demo') === opt.id ? 'active' : ''}`}>
                    <input
                      type="radio"
                      name="paymentMode"
                      checked={(s.paymentMode || 'demo') === opt.id}
                      onChange={() => setS({ ...s, paymentMode: opt.id })}
                    />
                    <div>
                      <strong>{opt.label}</strong>
                      <span>{opt.desc}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>
            {savedMsg && <p className="ok">{savedMsg}</p>}
            <button className="btn btn-gold" type="submit">Save settings</button>
          </form>
        </section>
      )}

      {invoiceOrder && (
        <InvoicePreviewModal
          order={invoiceOrder}
          settings={settings}
          onClose={() => setInvoiceOrder(null)}
        />
      )}

      {sizeGuideOpen && (
        <SizeGuide
          editable
          category={form.category}
          sizeValue={form.sizes || []}
          onSizesChange={(sizes) => setForm({ ...form, sizes })}
          onClose={() => setSizeGuideOpen(false)}
        />
      )}

      </main>
  );
}

function SalesDashboard({ orders, payments, returns }) {
  const [range, setRange] = useState('all');
  const now = new Date();

  const filtered = orders.filter((o) => {
    if (range === 'all') return true;
    const d = new Date(o.orderDate);
    if (range === 'today') return d.toDateString() === now.toDateString();
    if (range === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 86400000);
      return d >= weekAgo;
    }
    if (range === 'month') {
      const monthAgo = new Date(now.getTime() - 30 * 86400000);
      return d >= monthAgo;
    }
    return true;
  });

  const completed = filtered.filter((o) => o.status !== 'cancelled');
  const revenue = completed.reduce((s, o) => s + (o.total || 0), 0);
  const orderCount = completed.length;
  const avgOrder = orderCount > 0 ? revenue / orderCount : 0;
  const cancelledCount = filtered.filter((o) => o.status === 'cancelled').length;
  const returnCount = returns.length;
  const returnRate = orderCount > 0 ? ((returnCount / orderCount) * 100).toFixed(1) : '0.0';

  // Top products
  const productSales = {};
  completed.forEach((o) => {
    (o.items || []).forEach((it) => {
      if (!productSales[it.id]) productSales[it.id] = { id: it.id, name: it.name, qty: 0, revenue: 0 };
      productSales[it.id].qty += it.qty;
      productSales[it.id].revenue += (it.price || 0) * (it.qty || 1);
    });
  });
  const topProducts = Object.values(productSales).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

  // City breakdown
  const citySales = {};
  completed.forEach((o) => {
    const city = o.shipping?.city || o.customer?.city || 'Unknown';
    if (!citySales[city]) citySales[city] = { city, orders: 0, revenue: 0 };
    citySales[city].orders += 1;
    citySales[city].revenue += o.total || 0;
  });
  const topCities = Object.values(citySales).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

  return (
    <>
      <section className="card-box">
        <h2>Sales overview</h2>
        <div className="sales-range">
          {[
            { id: 'all', label: 'All time' },
            { id: 'today', label: 'Today' },
            { id: 'week', label: 'Last 7 days' },
            { id: 'month', label: 'Last 30 days' },
          ].map((r) => (
            <button
              key={r.id}
              className={range === r.id ? 'chip active' : 'chip'}
              onClick={() => setRange(r.id)}
            >
              {r.label}
            </button>
          ))}
        </div>
        <div className="sales-cards">
          <div className="sales-card">
            <span className="sales-label">Revenue</span>
            <span className="sales-value">{formatINR(revenue)}</span>
          </div>
          <div className="sales-card">
            <span className="sales-label">Orders</span>
            <span className="sales-value">{orderCount}</span>
          </div>
          <div className="sales-card">
            <span className="sales-label">Avg. order</span>
            <span className="sales-value">{formatINR(avgOrder)}</span>
          </div>
          <div className="sales-card">
            <span className="sales-label">Cancelled</span>
            <span className="sales-value">{cancelledCount}</span>
          </div>
          <div className="sales-card">
            <span className="sales-label">Return rate</span>
            <span className="sales-value">{returnRate}%</span>
          </div>
        </div>
      </section>

      <section className="card-box">
        <h2>Top products by revenue</h2>
        {topProducts.length === 0 ? (
          <p className="muted">No sales data yet.</p>
        ) : (
          <div className="table-scroll">
            <table className="table">
              <thead><tr><th>Product</th><th>Units sold</th><th>Revenue</th></tr></thead>
              <tbody>
                {topProducts.map((p) => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td>{p.qty}</td>
                    <td>{formatINR(p.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card-box">
        <h2>Top cities by revenue</h2>
        {topCities.length === 0 ? (
          <p className="muted">No location data yet.</p>
        ) : (
          <div className="table-scroll">
            <table className="table">
              <thead><tr><th>City</th><th>Orders</th><th>Revenue</th></tr></thead>
              <tbody>
                {topCities.map((c) => (
                  <tr key={c.city}>
                    <td>{c.city}</td>
                    <td>{c.orders}</td>
                    <td>{formatINR(c.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

