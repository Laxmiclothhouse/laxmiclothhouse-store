import React, { useState, useMemo, useEffect } from 'react';
import { Navigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useData } from '../context/DataContext.jsx';
import { formatINR, formatDateTime } from '../utils/format.js';
import { invoicePdfUrl, downloadInvoicePdf, printInvoicePdf } from '../utils/invoicePdf.js';
import OrdersQueue from '../components/OrdersQueue.jsx';
import SizeGuide from '../components/SizeGuide.jsx';
import { variantKey } from '../utils/stock.js';
import SalesManager from '../components/SalesManager.jsx';
import AlertsManager from '../components/AlertsManager.jsx';
import PdfViewer from '../components/PdfViewer.jsx';
import { statusMeta } from '../orderFlow.js';
import { buildOrdersReportPdf, triggerBlobDownload, ordersReportFileName, ordersReportPdfUrl, downloadOrdersReportPdf, printOrdersReportPdf, filterOrdersByRange } from '../utils/ordersReportPdf.js';

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
  colors: [],
  stockByVariant: {},
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
    invoicePdfUrl(order, settings).then((v) => {
      u = v;
      setUrl(v);
    });
    return () => {
      if (u) URL.revokeObjectURL(u);
    };
  }, [order, settings]);
  return (
    <PdfViewer
      title={`Invoice — ${order.id}`}
      subtitle={`${formatDateTime(order.orderDate)} · ${formatINR(order.total)}`}
      url={url}
      fileName={`invoice-${order.id || 'download'}.pdf`}
      onDownload={() => downloadInvoicePdf(order, settings)}
      onPrint={() => printInvoicePdf(order, settings)}
      onClose={onClose}
    />
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

function StaffRoleForm({ setUserRole, searchUsers }) {
  const [uid, setUid] = useState('');
  const [role, setRole] = useState('packer');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  // Find a user's UID by name / email / phone so the admin never has to
  // open the Firebase console.
  const [search, setSearch] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState([]);
  const [searchErr, setSearchErr] = useState('');

  const runSearch = async (e) => {
    if (e) e.preventDefault();
    const text = search.trim();
    if (text.length < 2) {
      setSearchErr('Type at least 2 characters to search.');
      setResults([]);
      return;
    }
    setSearching(true);
    setSearchErr('');
    setResults([]);
    try {
      const hits = typeof searchUsers === 'function' ? await searchUsers(text) : [];
      setResults(Array.isArray(hits) ? hits : []);
      if (!hits || !hits.length) setSearchErr('No users found matching that search.');
    } catch (ex) {
      setSearchErr(ex?.message || 'Search failed.');
    } finally {
      setSearching(false);
    }
  };

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
      <div className="card-box" style={{ marginBottom: 12, padding: 12 }}>
        <h3 style={{ marginTop: 0 }}>Find a user's UID</h3>
        <p className="muted small">
          Type a name, email or phone number and search — then click “Use UID” to fill the field below.
        </p>
        <div className="row-gap" style={{ alignItems: 'center' }}>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); runSearch(); } }}
            placeholder="e.g. Rahul, rahul@example.com, 9876543210"
            style={{ flex: 1, minWidth: 220 }}
          />
          <button type="button" className="btn btn-sm" onClick={runSearch} disabled={searching}>
            {searching ? 'Searching…' : 'Search'}
          </button>
        </div>
        {searchErr && <p className="muted small" style={{ marginTop: 6 }}>{searchErr}</p>}
        {results.length > 0 && (
          <div className="table-scroll" style={{ marginTop: 8 }}>
            <table className="table">
              <thead>
                <tr><th>Name</th><th>Email</th><th>Phone</th><th>Role</th><th>UID</th><th></th></tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={r.uid || i}>
                    <td>{r.name || '—'}</td>
                    <td>{r.email || '—'}</td>
                    <td>{r.phone || '—'}</td>
                    <td>{r.role || '—'}</td>
                    <td><code style={{ fontSize: '0.85em', wordBreak: 'break-all' }}>{r.uid}</code></td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={() => { setUid(r.uid || ''); setMsg(''); setErr(''); }}
                      >
                        Use UID
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

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
  const { user, isAdmin, isStaff, setUserRole, searchUsers } = useAuth();
  const { products, orders, settings, updateSettings, addProduct, updateProduct, deleteProduct, updateOrderStatus, coupons, addCoupon, deleteCoupon, toggleCoupon, deleteRecords } = useData();
  const { payments, returns = [], updateReturnStatus = () => {}, sales, addSale, updateSale, deleteSale, toggleSale, alerts = [], addAlert, updateAlert, deleteAlert, toggleAlert, pdfs = [], addPdfRecord, deletePdfRecord, notifications = [], logActivity } = useData();
  const [tab, setTabState] = useState(() => {
    try {
      const saved = localStorage.getItem('admin_tab');
      const allowed = isAdmin
        ? ['products', 'orders', 'settings', 'coupons', 'payments', 'sales', 'alerts', 'staff', 'pdfs', 'notifications']
        : ['orders'];
      if (saved && allowed.includes(saved)) return saved;
    } catch {}
    return isAdmin ? 'products' : 'orders';
  });
  const setTab = (next) => {
    setTabState(next);
    try { localStorage.setItem('admin_tab', next); } catch {}
  };
  const blobToBase64 = (blob) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result || '').split(',')[1] || '');
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

  const monthYearName = (dateStr) => {
    const d = dateStr ? new Date(dateStr + 'T00:00:00') : new Date();
    const m = d.toLocaleString('en-US', { month: 'long' });
    return `${m}_${d.getFullYear()}.pdf`;
  };

  const archiveOrdersToPdf = async (filtered, opts) => {
    if (!filtered || !filtered.length) return;
    try {
      const { blob, fileName } = buildOrdersReportPdf(filtered, opts || {});
      // name as month_year per requirement
      const name = monthYearName(opts?.to || opts?.from);
      const downloadName = name;
      triggerBlobDownload(blob, downloadName);
      const base64 = await blobToBase64(blob);
      const revenue = filtered.filter((o) => o.status !== 'cancelled').reduce((s, o) => s + (o.total || 0), 0);
      addPdfRecord({
        id: `PDF${Date.now().toString(36)}`,
        name: downloadName,
        createdAt: Date.now(),
        by: user?.email || 'admin',
        from: opts?.from || '',
        to: opts?.to || '',
        orderCount: filtered.length,
        revenue,
        base64,
      });
      const ids = filtered.map((o) => o.id);
      // delete via DataContext deleteRecords
      deleteRecords('orders', ids);
      logActivity('Exported orders to PDF and deleted', { count: filtered.length, name: downloadName }, user?.email);
    } catch (e) {
      console.error(e);
      alert('Failed to export/delete orders: ' + (e?.message || e));
    }
  };

  const downloadArchivedPdf = (record) => {
    if (!record?.base64) return;
    const byteChars = atob(record.base64);
    const byteNums = new Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) byteNums[i] = byteChars.charCodeAt(i);
    const blob = new Blob([new Uint8Array(byteNums)], { type: 'application/pdf' });
    triggerBlobDownload(blob, record.name || 'archive.pdf');
  };


  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [msg, setMsg] = useState('');
  const [showProductForm, setShowProductForm] = useState(false);
  const [showCouponForm, setShowCouponForm] = useState(false);
  const [productQuery, setProductQuery] = useState('');
  const [couponQuery, setCouponQuery] = useState('');
  const [invoiceOrder, setInvoiceOrder] = useState(null);
  const [s, setS] = useState(settings);
  const [savedMsg, setSavedMsg] = useState('');
  const [sizeGuideOpen, setSizeGuideOpen] = useState(false);
  const [autoOpened, setAutoOpened] = useState(false);
  const [variantDrafts, setVariantDrafts] = useState({});
  const [extraCats, setExtraCats] = useState(() => {
    try { return JSON.parse(localStorage.getItem('laxmiclothhouse_extra_cats') || '[]'); } catch { return []; }
  });
  const [deletedCats, setDeletedCats] = useState(() => {
    try { return JSON.parse(localStorage.getItem('laxmiclothhouse_deleted_cats') || '[]'); } catch { return []; }
  });
  useEffect(() => {
    try { localStorage.setItem('laxmiclothhouse_extra_cats', JSON.stringify(extraCats)); } catch {}
  }, [extraCats]);
  useEffect(() => {
    try { localStorage.setItem('laxmiclothhouse_deleted_cats', JSON.stringify(deletedCats)); } catch {}
  }, [deletedCats]);
  const categories = useMemo(() => {
    const base = ['Suits', 'Ethnic', 'Lehenga', 'Saree', 'Daily Wear'];
    const fromProducts = (products || []).map((p) => p?.category).filter(Boolean);
    const set = new Set([...base, ...fromProducts, ...extraCats]);
    (deletedCats || []).forEach((c) => set.delete(c));
    return Array.from(set);
  }, [products, extraCats, deletedCats]);
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

  const addColor = () => {
    setForm((f) => ({ ...f, colors: [...(f.colors || []), { name: '', hex: '#9b1c3d', images: [] }] }));
  };
  const removeColor = (idx) => {
    setForm((f) => {
      const colors = (f.colors || []).filter((_, i) => i !== idx);
      // drop stock cells for removed color
      const removed = (f.colors || [])[idx];
      const stockByVariant = { ...(f.stockByVariant || {}) };
      if (removed?.name) {
        const prefix = String(removed.name).trim().toUpperCase() + '::';
        Object.keys(stockByVariant).forEach((k) => {
          if (k.startsWith(prefix)) delete stockByVariant[k];
        });
      }
      return { ...f, colors, stockByVariant };
    });
  };
  const updateColor = (idx, patch) => {
    setForm((f) => {
      const colors = [...(f.colors || [])];
      const prev = colors[idx] || {};
      const next = { ...prev, ...patch };
      // if name changed, migrate stock keys
      if (patch.name !== undefined && String(patch.name).trim().toUpperCase() !== String(prev.name || '').trim().toUpperCase()) {
        const oldPrefix = String(prev.name || '').trim().toUpperCase() + '::';
        const newPrefix = String(patch.name || '').trim().toUpperCase() + '::';
        const stockByVariant = { ...(f.stockByVariant || {}) };
        Object.keys(stockByVariant).forEach((k) => {
          if (k.startsWith(oldPrefix)) {
            const suffix = k.slice(oldPrefix.length);
            stockByVariant[newPrefix + suffix] = stockByVariant[k];
            delete stockByVariant[k];
          }
        });
        colors[idx] = next;
        return { ...f, colors, stockByVariant };
      }
      colors[idx] = next;
      return { ...f, colors };
    });
  };
  const handleColorImageUpload = (colorIdx, e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const MAX = 5;
    const accepted = files.filter((file) => file.type.startsWith('image/') && file.size <= 5 * 1024 * 1024);
    if (accepted.length !== files.length) {
      setMsg('Only image files under 5MB are allowed.');
      setTimeout(() => setMsg(''), 2500);
      if (accepted.length === 0) { e.target.value = ''; return; }
    }
    const readAsDataURL = async (file) => {
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let bin = '';
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      return 'data:' + file.type + ';base64,' + btoa(bin);
    };
    Promise.all(accepted.map(readAsDataURL)).then((urls) => {
      setForm((f) => {
        const colors = [...(f.colors || [])];
        const c = colors[colorIdx] || { name: '', hex: '#9b1c3d', images: [] };
        const room = Math.max(0, MAX - (c.images || []).length);
        colors[colorIdx] = { ...c, images: [...(c.images || []), ...urls.slice(0, room)] };
        return { ...f, colors };
      });
      if (urls.length > MAX) {
        setMsg('Maximum 5 images per colour. Extra images were skipped.');
        setTimeout(() => setMsg(''), 2500);
      }
    }).catch(() => {
      setMsg('Failed to read the selected image file(s).');
      setTimeout(() => setMsg(''), 2500);
    });
    e.target.value = '';
  };
  const removeColorImage = (colorIdx, imgIdx) => {
    setForm((f) => {
      const colors = [...(f.colors || [])];
      const c = colors[colorIdx];
      if (!c) return f;
      colors[colorIdx] = { ...c, images: (c.images || []).filter((_, i) => i !== imgIdx) };
      return { ...f, colors };
    });
  };
  const addVariantSize = (ci, colorName) => {
    const draft = variantDrafts[ci] || {};
    const size = String(draft.size || '').trim().toUpperCase();
    if (!size) {
      setMsg('Enter a size for this colour.');
      setTimeout(() => setMsg(''), 2500);
      return;
    }
    const stockRaw = draft.stock;
    const stockNum = stockRaw === '' || stockRaw === undefined || stockRaw === null ? null : Number(stockRaw);
    setForm((f) => {
      const sizes = Array.from(new Set([...(f.sizes || []).map((s) => String(s).trim().toUpperCase()).filter(Boolean), size]));
      const stockByVariant = { ...(f.stockByVariant || {}) };
      const key = variantKey(colorName, size);
      if (stockNum !== null && Number.isFinite(stockNum) && stockNum >= 0) stockByVariant[key] = stockNum;
      else if (!(key in stockByVariant)) stockByVariant[key] = 0;
      return { ...f, sizes, stockByVariant };
    });
    setVariantDrafts((d) => ({ ...d, [ci]: { size: '', stock: '' } }));
  };
  const setColorStock = (colorName, size, value) => {
    const key = variantKey(colorName, size);
    setForm((f) => {
      const stockByVariant = { ...(f.stockByVariant || {}) };
      if (value === '' || value === null) delete stockByVariant[key];
      else stockByVariant[key] = value;
      return { ...f, stockByVariant };
    });
  };

  const submit = (e) => {
    e.preventDefault();
    if (form.paymentMethods.length === 0) {
      setMsg('Select at least one payment method.');
      setTimeout(() => setMsg(''), 2500);
      return;
    }
    const customImgs = form.customImages.filter((img) => img && img.trim() !== '');
    const colors = (form.colors || [])
      .map((c) => ({
        name: String(c?.name || '').trim(),
        hex: c?.hex || '#9b1c3d',
        images: Array.isArray(c?.images) ? c.images.filter((u) => u && String(u).trim() !== '') : [],
      }))
      .filter((c) => c.name);
    const stockByVariant = {};
    Object.entries(form.stockByVariant || {}).forEach(([k, v]) => {
      const n = Number(v);
      if (Number.isFinite(n) && n >= 0) stockByVariant[k] = n;
    });
    const data = {
      ...form,
      colors,
      stockByVariant,
      price: Number(form.price),
      mrp: Number(form.mrp) || Math.round(Number(form.price) * 1.25 / 10) * 10,
      sizes: (form.sizes || []).map((s) => String(s).trim().toUpperCase()).filter(Boolean),
       image: customImgs.length > 0 ? customImgs[0] : (colors[0]?.images?.[0] || ''),
       images: customImgs.length > 0 ? customImgs : (colors[0]?.images || []),
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
    setShowProductForm(false);
    setTimeout(() => setMsg(''), 2000);
  };

  const startEdit = (p) => {
    setEditingId(p.id);
    setShowProductForm(true);
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
      colors: Array.isArray(p.colors) ? p.colors.map((c) => ({ name: c?.name || '', hex: c?.hex || '#9b1c3d', images: Array.isArray(c?.images) ? c.images : [] })) : [],
      stockByVariant: p.stockByVariant && typeof p.stockByVariant === 'object' ? { ...p.stockByVariant } : {},
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
          <>
            <button className={tab === 'sales' ? 'chip active' : 'chip'} onClick={() => setTab('sales')}>
              Sales {sales.length ? `(${sales.length})` : ''}
            </button>
            <button className={tab === 'alerts' ? 'chip active' : 'chip'} onClick={() => setTab('alerts')}>
              Alerts {alerts.length ? `(${alerts.length})` : ''}
            </button>
          </>
        )}
        {isAdmin && (
          <button className={tab === 'coupons' ? 'chip active' : 'chip'} onClick={() => setTab('coupons')}>
            Coupons {coupons.length ? `(${coupons.length})` : ''}
          </button>
        )}
        {isAdmin && (
          <button className={tab === 'pdfs' ? 'chip active' : 'chip'} onClick={() => setTab('pdfs')}>
            PDFs {pdfs.length ? `(${pdfs.length})` : ''}
          </button>
        )}
        {isAdmin && (
          <button className={tab === 'notifications' ? 'chip active' : 'chip'} onClick={() => setTab('notifications')}>
            Notifications {notifications.length ? `(${notifications.length})` : ''}
          </button>
        )}
        {isAdmin && (
          <button className={tab === 'payments' ? 'chip active' : 'chip'} onClick={() => setTab('payments')}>
            Payments
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
          {!showProductForm && !editingId && (
            <section className="card-box" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <h2 style={{ margin: 0 }}>Products</h2>
              <button type="button" className="btn btn-gold" onClick={() => { setForm(emptyForm); setEditingId(null); setShowProductForm(true); }}>+ Add product</button>
            </section>
          )}
          {(showProductForm || editingId) && (
            <section className="card-box">
              <div className="sales-header">
                <h2 style={{ margin: 0 }}>{editingId ? 'Edit product' : 'Add a new product'}</h2>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setForm(emptyForm); setEditingId(null); setShowProductForm(false); }}>Close</button>
              </div>
            {msg && <p className="ok">{msg}</p>}
            <form onSubmit={submit} className="form">
              <div className="grid2">
                <label>Name<input value={form.name} onChange={set('name')} required /></label>
                <label>Category<select value={form.category} onChange={(e) => {
                  const v = e.target.value;
                  if (v === '__add__') {
                    const name = window.prompt('Enter new category name');
                    const trimmed = String(name || '').trim();
                    if (!trimmed) return;
                    setExtraCats((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]));
                    setDeletedCats((prev) => prev.filter((c) => c !== trimmed));
                    setForm((f) => ({ ...f, category: trimmed }));
                    return;
                  }
                  if (v === '__delete__') {
                    const name = window.prompt('Enter category name to delete');
                    const trimmed = String(name || '').trim();
                    if (!trimmed) return;
                    if (!categories.includes(trimmed)) {
                      window.alert('Category not found.');
                      return;
                    }
                    const inUse = (products || []).some((p) => p?.category === trimmed);
                    if (inUse && !window.confirm('This category is used by products. Delete anyway?')) return;
                    setExtraCats((prev) => prev.filter((c) => c !== trimmed));
                    setDeletedCats((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]));
                    if (form.category === trimmed) {
                      const next = categories.find((c) => c !== trimmed) || 'Suits';
                      setForm((f) => ({ ...f, category: next }));
                    }
                    return;
                  }
                  set('category')(e);
                }}>
                  {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                  <option value="__add__">+ Add category</option>
                  <option value="__delete__">− Delete category</option>
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

              {/* ── Colour variants & per-variant stock ─────────── */}
              <div className="sizes-box" style={{ marginTop: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <label style={{ margin: 0 }}>Colour variants (each with its own images & stock)</label>
                  <button type="button" className="btn btn-sm btn-ghost" onClick={addColor}>+ Add colour</button>
                </div>
                {(form.colors || []).length === 0 && (
                  <p className="muted tiny">No colour variants — product will be sold in a single colour (legacy images above).</p>
                )}
                {(form.colors || []).map((c, ci) => {
                  const colorName = c.name || '';
                  const sizes = (form.sizes || []).map((s) => String(s).trim().toUpperCase()).filter(Boolean);
                  const stockSizes = sizes.length > 0 ? sizes : [''];
                  return (
                    <div key={ci} style={{ border: '1px solid #e8dcd3', borderRadius: 8, padding: 10, marginBottom: 10, background: '#fff' }}>
                      <div className="grid2" style={{ marginBottom: 8 }}>
                        <label>Colour name
                          <input value={c.name || ''} onChange={(e) => updateColor(ci, { name: e.target.value })} placeholder="e.g. Maroon" />
                        </label>
                        <label>Colour hex
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <input type="color" value={c.hex || '#9b1c3d'} onChange={(e) => updateColor(ci, { hex: e.target.value })} style={{ width: 44, height: 34, padding: 2 }} />
                            <input value={c.hex || '#9b1c3d'} onChange={(e) => updateColor(ci, { hex: e.target.value })} placeholder="#9b1c3d" />
                          </div>
                        </label>
                      </div>

                      {/* images for this colour */}
                      <div style={{ marginBottom: 8 }}>
                        <label className="muted tiny" style={{ display: 'block', marginBottom: 4 }}>Images for this colour (up to 5)</label>
                        <input type="file" accept="image/*" multiple onChange={(e) => handleColorImageUpload(ci, e)} disabled={(c.images || []).length >= 5} />
                        {(c.images || []).length > 0 && (
                          <div className="img-preview-grid" style={{ marginTop: 6 }}>
                            {(c.images || []).map((img, ii) => (
                              <div key={ii} className="img-preview-item">
                                <img src={img} alt={`Colour ${ci + 1} image ${ii + 1}`} />
                                <button type="button" className="btn btn-sm danger remove-img" onClick={() => removeColorImage(ci, ii)}>✕</button>
                              </div>
                            ))}
                          </div>
                        )}
                        <input
                          style={{ marginTop: 6 }}
                          onBlur={(e) => {
                            const url = e.target.value.trim();
                            if (url && (url.startsWith('http') || url.startsWith('data:'))) {
                              setForm((f) => {
                                const colors = [...(f.colors || [])];
                                const cc = colors[ci] || { name: '', hex: '#9b1c3d', images: [] };
                                colors[ci] = { ...cc, images: [...(cc.images || []), url].slice(0, 5) };
                                return { ...f, colors };
                              });
                              e.target.value = '';
                            }
                          }}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); } }}
                          placeholder="Or paste image URL — press Enter to add"
                        />
                      </div>

                      {/* add size + stock for this colour */}
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
                        <input
                          placeholder="Add size (e.g. M)"
                          style={{ width: 120 }}
                          value={(variantDrafts[ci]?.size) || ''}
                          onChange={(e) => setVariantDrafts((d) => ({ ...d, [ci]: { ...(d[ci] || {}), size: e.target.value } }))}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addVariantSize(ci, colorName); } }}
                        />
                        <input
                          type="number"
                          min="0"
                          placeholder="Stock"
                          style={{ width: 90 }}
                          value={(variantDrafts[ci]?.stock) || ''}
                          onChange={(e) => setVariantDrafts((d) => ({ ...d, [ci]: { ...(d[ci] || {}), stock: e.target.value } }))}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addVariantSize(ci, colorName); } }}
                        />
                        <button type="button" className="btn btn-sm btn-ghost" onClick={() => addVariantSize(ci, colorName)}>+ Add size & stock</button>
                      </div>

                      {/* per-variant stock */}
                      <div>
                        <label className="muted tiny" style={{ display: 'block', marginBottom: 4 }}>Stock for this colour</label>
                        {!colorName.trim() ? (
                          <span className="muted tiny">Enter a colour name to set per-variant stock.</span>
                        ) : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                          {stockSizes.map((sz) => {
                            const key = variantKey(colorName, sz === '' ? '' : sz);
                            const val = (form.stockByVariant || {})[key];
                            return (
                              <label key={sz || 'free'} style={{ fontSize: 12 }}>
                                {sz ? `Size ${sz}` : 'Free size'}
                                <input
                                  type="number"
                                  min="0"
                                  style={{ width: 70, marginLeft: 6 }}
                                  value={val === undefined ? '' : val}
                                  placeholder="auto"
                                  onChange={(e) => setColorStock(colorName, sz === '' ? '' : sz, e.target.value)}
                                />
                              </label>
                            );
                          })}
                        </div>
                        )}
                        <span className="muted tiny">Leave blank to fall back to the product stock above.</span>
                      </div>

                      <div style={{ textAlign: 'right', marginTop: 8 }}>
                        <button type="button" className="btn btn-sm danger" onClick={() => removeColor(ci)}>Remove colour</button>
                      </div>
                    </div>
                  );
                })}
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
          )}

          <section className="card-box">
            <div className="sales-header">
              <h2 style={{ margin: 0 }}>All products</h2>
              <input
                type="search"
                placeholder="Search products..."
                value={productQuery}
                onChange={(e) => setProductQuery(e.target.value)}
                style={{ padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 6, minWidth: 200 }}
              />
            </div>
            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr><th>Name</th><th>Category</th><th>Price</th><th>Stock</th><th>Featured</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {products
                    .filter((p) => {
                      const q = productQuery.trim().toLowerCase();
                      if (!q) return true;
                      return String(p.name || '').toLowerCase().includes(q) ||
                        String(p.category || '').toLowerCase().includes(q);
                    })
                    .map((p) => (
                    <tr key={p.id}>
                      <td><Link to={`/product/${p.id}`}>{p.name}</Link></td>
                      <td>{p.category}</td>
                      <td>{formatINR(p.price)}</td>
                      <td>{p.stock}</td>
                      <td>{p.featured ? '★' : '—'}</td>
                      <td className="row-gap">
                        <button className="btn btn-sm" onClick={() => startEdit(p)}>Edit</button>
                        <button className="btn btn-sm danger" onClick={() => { deleteProduct(p.id); logActivity('Deleted product', { id: p.id, name: p.name }, user?.email); }}>Delete</button>
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
            <>
              <OrdersQueue
                orders={orders}
                role={user?.role || 'admin'}
                user={user}
                onUpdate={(o, status, opts) => { logActivity('Order status updated', { orderId: o.id, status }, user?.email); return updateOrderStatus(o.id, status, statusMeta(status).label, opts); }}
                onInvoice={(o) => setInvoiceOrder(o)}
              />
              <div style={{ marginTop: 16 }}>
                <OrdersReport orders={orders} settings={settings} onArchive={archiveOrdersToPdf} />
              </div>
            </>
          )}
        </section>
      )}

      {tab === 'staff' && (
        <section className="card-box">
          <h2>Staff roles</h2>
          <p className="muted small">
            Promote a registered user to a staff role. Search by name, email or phone below to find
            their UID automatically, or paste it manually from the Firebase console
            (Authentication &gt; Users) after the person logs in on the site once. The new role
            applies on their next login or page reload.
          </p>
          <StaffRoleForm setUserRole={setUserRole} searchUsers={searchUsers} />
        </section>
      )}

      {tab === 'coupons' && (
        <>
          {!showCouponForm && (
            <section className="card-box" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <h2 style={{ margin: 0 }}>Coupons</h2>
              <button type="button" className="btn btn-gold" onClick={() => setShowCouponForm(true)}>+ Create coupon</button>
            </section>
          )}
          {showCouponForm && (
            <section className="card-box">
              <div className="sales-header">
                <h2 style={{ margin: 0 }}>Create a coupon</h2>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowCouponForm(false)}>Close</button>
              </div>
              <p className="muted small">
                Customers can enter the code at checkout. Percent coupons take a % off the subtotal;
                flat coupons take a fixed ₹ amount off. Minimum order (optional) must be met before the coupon applies.
              </p>
              <CouponForm addCoupon={(data) => { addCoupon(data); setShowCouponForm(false); }} />
            </section>
          )}

          <section className="card-box">
            <div className="sales-header">
              <h2 style={{ margin: 0 }}>All coupons</h2>
              <input
                type="search"
                placeholder="Search coupons..."
                value={couponQuery}
                onChange={(e) => setCouponQuery(e.target.value)}
                style={{ padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 6, minWidth: 200 }}
              />
            </div>
            {coupons.filter((c) => {
              const q = couponQuery.trim().toLowerCase();
              if (!q) return true;
              return String(c.code || '').toLowerCase().includes(q);
            }).length === 0 ? (
              <p className="muted">No coupons yet. Create your first one above.</p>
            ) : (
              <div className="table-scroll">
                <table className="table">
                  <thead>
                    <tr><th>Code</th><th>Discount</th><th>Min order</th><th>Used</th><th>Status</th><th>Actions</th></tr>
                  </thead>
                  <tbody>
                    {coupons
                      .filter((c) => {
                        const q = couponQuery.trim().toLowerCase();
                        if (!q) return true;
                        return String(c.code || '').toLowerCase().includes(q);
                      })
                      .map((c) => (
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
                      <td>{(() => {
                        const amt = p.amount != null
                          ? p.amount
                          : (orders.find((o) => o.id === (p.orderId || p.order_id))?.total);
                        return amt != null ? formatINR(amt) : '—';
                      })()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {tab === 'pdfs' && (
        <section className="card-box">
          <h2>Archived PDF reports</h2>
          <p className="muted small">PDFs generated when exporting & deleting old orders. Download or remove them here.</p>
          {pdfs.length === 0 ? (
            <p className="muted">No archived PDFs yet.</p>
          ) : (
            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr><th>Name</th><th>Created</th><th>Orders</th><th>Revenue</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {pdfs.map((p) => (
                    <tr key={p.id}>
                      <td>{p.name}</td>
                      <td>{formatDateTime(p.createdAt)}</td>
                      <td>{p.orderCount ?? '—'}</td>
                      <td>{p.revenue != null ? formatINR(p.revenue) : '—'}</td>
                      <td>
                        <button className="btn btn-ghost btn-sm" onClick={() => downloadArchivedPdf(p)}>⬇ Download</button>
                        <button className="btn btn-ghost btn-sm" style={{ marginLeft: 6 }} onClick={() => { if (window.confirm('Delete this PDF?')) { deletePdfRecord(p.id); logActivity('Deleted archived PDF', { name: p.name }, user?.email); } }}>🗑 Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {tab === 'notifications' && (
        <section className="card-box">
          <h2>Admin activity log</h2>
          <p className="muted small">Recent actions performed in the admin panel.</p>
          {notifications.length === 0 ? (
            <p className="muted">No activity recorded yet.</p>
          ) : (
            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr><th>When</th><th>Action</th><th>By</th><th>Details</th></tr>
                </thead>
                <tbody>
                  {notifications.map((n) => (
                    <tr key={n.id}>
                      <td>{formatDateTime(n.time)}</td>
                      <td>{n.action}</td>
                      <td>{n.by || '—'}</td>
                      <td><span className="muted tiny">{JSON.stringify(n.details || {})}</span></td>
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

      {tab === 'alerts' && (
        <AlertsManager
          alerts={alerts}
          addAlert={addAlert}
          updateAlert={updateAlert}
          deleteAlert={deleteAlert}
          toggleAlert={toggleAlert}
        />
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
            <label>Categories shown on homepage
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 6 }}>
                {categories.map((c) => (
                  <label key={c} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 400 }}>
                    <input
                      type="checkbox"
                      checked={Array.isArray(s.homeCategories) ? s.homeCategories.includes(c) : false}
                      onChange={(e) => {
                        const cur = Array.isArray(s.homeCategories) ? s.homeCategories : [];
                        const next = e.target.checked ? [...cur, c] : cur.filter((x) => x !== c);
                        setS({ ...s, homeCategories: next });
                      }}
                    />
                    {c}
                  </label>
                ))}
              </div>
              <span className="muted tiny">Choose which category rows appear on the home page. Leave at least one selected.</span>
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
                  { id: 'live', label: 'Live', desc: 'Real payments only — no fallback' },
                ].map((opt) => (
                  <label key={opt.id} className={`pay-mode-opt ${(s.paymentMode || 'live') === opt.id ? 'active' : ''}`}>
                    <input
                      type="radio"
                      name="paymentMode"
                      checked={(s.paymentMode || 'live') === opt.id}
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
        </div>
      </section>

    </>
  );
}

// ── Orders report: date-range filter + PDF download ──────────
function OrdersReport({ orders, settings, onArchive }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [previewUrl, setPreviewUrl] = React.useState('');
  const [previewName, setPreviewName] = React.useState('');

  const filtered = filterOrdersByRange(orders, from, to);
  const completed = filtered.filter((o) => o.status !== "cancelled");
  const revenue = completed.reduce((s, o) => s + (o.total || 0), 0);

  const applyPreset = (days) => {
    if (days == null) { setFrom(""); setTo(""); return; }
    const now = new Date();
    const start = new Date(now.getTime() - days * 86400000);
    setFrom(start.toISOString().slice(0, 10));
    setTo(now.toISOString().slice(0, 10));
  };

  const reportOpts = () => ({ from, to, storeName: settings?.storeName });

  const closePreview = React.useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl('');
    setPreviewName('');
  }, [previewUrl]);

  const openPreview = () => {
    if (busy || !filtered.length) return;
    setBusy(true);
    try {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      const url = ordersReportPdfUrl(filtered, reportOpts());
      setPreviewName(ordersReportFileName(reportOpts()));
      setPreviewUrl(url);
    } finally {
      setBusy(false);
    }
  };

  const download = () => {
    if (busy || !filtered.length) return;
    setBusy(true);
    try {
      downloadOrdersReportPdf(filtered, reportOpts());
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card-box" style={{ background: '#faf6f0', marginBottom: 16 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
        <label style={{ fontSize: 13 }}>
          <span style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>From</span>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input" />
        </label>
        <label style={{ fontSize: 13 }}>
          <span style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>To</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="input" />
        </label>
        <div className="row-gap" style={{ paddingBottom: 2 }}>
          <button className="chip" onClick={() => applyPreset(0)}>Today</button>
          <button className="chip" onClick={() => applyPreset(7)}>Last 7 days</button>
          <button className="chip" onClick={() => applyPreset(30)}>Last 30 days</button>
          <button className="chip" onClick={() => applyPreset(60)}>Last 60 days</button>
          <button className="chip" onClick={() => applyPreset(null)}>All time</button>
        </div>
        <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
          <div style={{ fontSize: 13 }}>
            <strong>{filtered.length}</strong> orders · <strong style={{ color: '#9b1c3d' }}>{formatINR(revenue)}</strong> revenue
            {from || to ? <span className="muted"> (filtered)</span> : ''}
          </div>
          <button
            className="btn btn-ghost btn-sm"
            style={{ marginTop: 6, marginRight: 8 }}
            disabled={busy || !filtered.length}
            onClick={openPreview}
            title={filtered.length ? 'Preview the orders report fullscreen' : 'No orders in this date range'}
          >
            👁 Preview
          </button>
          <button
            className="btn btn-gold btn-sm"
            style={{ marginTop: 6 }}
            disabled={busy || !filtered.length}
            onClick={download}
            title={filtered.length ? 'Download the orders report as PDF' : 'No orders in this date range'}
          >
            {busy ? 'Preparing…' : '⬇ Download PDF'}
          </button>
          <button
            className="btn btn-danger btn-sm"
            style={{ marginTop: 6, marginLeft: 8 }}
            disabled={busy || !filtered.length || !onArchive}
            onClick={() => { if (window.confirm(`Export ${filtered.length} orders to PDF and delete them from the site?`)) onArchive(filtered, reportOpts()); }}
            title="Export selected orders to PDF, download it, archive it, then delete them"
          >
            🗑 Export & delete
          </button>
        </div>
      </div>
      {from || to ? (
        <p className="muted tiny" style={{ margin: '10px 0 0 0' }}>
          Range: {from || 'beginning'} → {to || 'today'}. The PDF includes every order in this range with a revenue total.
        </p>
      ) : null}
      {previewUrl ? (
        <PdfViewer
          title="Orders report"
          subtitle={`${filtered.length} orders · ${from || 'beginning'} → ${to || 'today'}`}
          url={previewUrl}
          fileName={previewName || 'orders-report.pdf'}
          onDownload={download}
          onPrint={() => printOrdersReportPdf(filtered, reportOpts())}
          onClose={closePreview}
        />
      ) : null}
    </div>
  );
}

// ── Review moderation: search + edit + delete reviews ──
function ReviewsAdmin() {
  const { products, reviews, updateReview, deleteReview } = useData();
  const [query, setQuery] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [reviewDelMode, setReviewDelMode] = useState(false);

  const nameFor = (pid) => products.find((p) => p.id === pid)?.name || pid;

  // search: customer name / email / product name / product name + customer name
  const q = (query || '').trim().toLowerCase();
  const list = q === ''
    ? reviews
    : reviews.filter((r) => {
        const reviewer = `${r.userName || ''} ${r.email || ''}`.toLowerCase();
        const product = `${nameFor(r.productId)} ${r.productName || ''}`.toLowerCase();
        return reviewer.includes(q) || product.includes(q);
      });
  const sorted = [...list].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

  // Pagination
  useEffect(() => { setPage(1); }, [query, pageSize]);
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const startEdit = (r) => {
    setEditingId(r.id);
    setDraft({ rating: r.rating || 0, comment: r.comment || '' });
  };
  const saveEdit = (r) => {
    if (draft.rating < 1 || draft.rating > 5) {
      alert('Rating must be between 1 and 5.');
      return;
    }
    updateReview(r.id, { rating: draft.rating, comment: draft.comment.trim() });
    setEditingId(null);
  };

  return (
    <>
      <section className="card-box">
        <h2>Review moderation</h2>
        <button
          className={`btn btn-sm danger ${reviewDelMode ? 'active' : ''}`}
          onClick={() => setReviewDelMode((m) => !m)}
          title={reviewDelMode ? 'Done' : 'Delete mode'}
        >
          {reviewDelMode ? '✓ Done' : '🗑️'}
        </button>
        <p className="muted small">
          Search across customer name, email or product name. Edit a review in place, or delete it. Changes are permanent and sync to every device.
        </p>
        <input
          className="input"
          style={{ maxWidth: 360 }}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search: try a customer name, email, or product…"
        />
        <p className="muted small" style={{ marginTop: 6 }}>
          Showing <strong>{sorted.length}</strong> review{sorted.length === 1 ? '' : 's'}.
        </p>
      </section>

      <section className="card-box">
        {sorted.length === 0 ? (
          <p className="muted">{q ? 'No reviews match the search.' : 'No reviews yet.'}</p>
        ) : (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  {reviewDelMode && <th style={{ width: 44, textAlign: 'center' }}>Select</th>}
                  <th>Product</th>
                  <th>Reviewer</th>
                  <th>Rating</th>
                  <th>Comment</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((r) => (
                  <tr key={r.id}>
                    {reviewDelMode && (
                      <td style={{ width: 44, textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          onChange={(e) => { e.stopPropagation(); deleteReview(r.id); }}
                          aria-label={`Delete review by ${r.userName || 'customer'}`}
                        />
                      </td>
                    )}
                    <td>{nameFor(r.productId)}</td>
                    <td>
                      {r.userName || '—'}
                      {r.email && <span className="muted small" style={{ display: 'block' }}>{r.email}</span>}
                    </td>
                    <td style={{ color: '#c9a24b', whiteSpace: 'nowrap' }}>
                      {'★'.repeat(r.rating || 0)}{'☆'.repeat(Math.max(0, 5 - (r.rating || 0)))}
                    </td>
                    <td style={{ maxWidth: 280 }}>
                      {editingId === r.id ? (
                        <textarea
                          className="input"
                          rows={3}
                          value={draft.comment}
                          onChange={(e) => setDraft({ ...draft, comment: e.target.value })}
                        />
                      ) : (
                        r.comment || '—'
                      )}
                    </td>
                    <td style={{ whiteSpace: 'nowrap', fontSize: 12 }}>{formatDateTime(r.date)}</td>
                    <td>
                      {editingId === r.id ? (
                        <>
                          <input
                            type="number"
                            min={1}
                            max={5}
                            className="input"
                            style={{ width: 64, marginBottom: 6 }}
                            value={draft.rating}
                            onChange={(e) => setDraft({ ...draft, rating: Number(e.target.value) })}
                          />
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button className="btn btn-sm" onClick={() => saveEdit(r)}>Save</button>
                            <button className="btn btn-sm" onClick={() => setEditingId(null)}>✕</button>
                          </div>
                        </>
                      ) : (
                        <button className="btn btn-sm" onClick={() => startEdit(r)}>Edit</button>
                      )}
                      {!reviewDelMode && (
                        <button
                          className="btn btn-sm danger"
                          style={{ marginLeft: 8 }}
                          onClick={() => {
                            if (window.confirm(`Delete this review by ${r.userName || 'this customer'}?\n\nThis cannot be undone.`)) {
                              deleteReview(r.id);
                            }
                          }}
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {sorted.length > 0 && (
          <Paginator
            total={sorted.length}
            page={currentPage}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(n) => { setPageSize(n); setPage(1); }}
            unit="reviews"
          />
        )}
      </section>
    </>
  );
}

// ── Customer accounts: view + delete account data ─────────────
function CustomersAdmin() {
  const { deleteUserAccount } = useData();
  const { user, listAllUsers, deleteUserProfile } = useAuth();
  const [users, setUsers] = useState(() => db.getUsers());
  const [query, setQuery] = useState('');
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [usersError, setUsersError] = useState('');
  const [pending, setPending] = useState(null);
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [msg, setMsg] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Show every registered customer the moment the tab opens — no search
  // needed. Firestore `users` is the source of truth; the local cache and
  // order emails are merged in as a fallback so the list is never empty
  // when rules or cache hide the directory.
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoadingUsers(true);
      setUsersError('');
      try {
        const merged = new Map();
        const put = (u) => {
          const key = String(u.uid || u.id || u.email || '').toLowerCase();
          if (!key || merged.has(key)) return;
          merged.set(key, u);
        };
        if (typeof listAllUsers === 'function') {
          try {
            const dir = await listAllUsers();
            (dir || []).forEach((u) => put({
              id: u.uid,
              uid: u.uid,
              name: u.name || '',
              email: u.email || '',
              phone: u.phone || '',
              role: u.role || 'customer',
            }));
          } catch (err) {
            if (alive) setUsersError(err.message || 'Could not load customer accounts.');
          }
        }
        (db.getUsers() || []).forEach((u) => put({
          id: u.id,
          uid: u.uid || u.id,
          name: u.name || '',
          email: u.email || '',
          phone: u.phone || '',
          role: u.role || 'customer',
        }));
        (db.getOrders() || []).forEach((o) => {
          const email = String(o.customerEmail || o.customer?.email || '').trim();
          if (!email) return;
          put({
            id: o.userId || email,
            uid: o.userId || email,
            name: o.customer?.name || '',
            email,
            phone: o.phone || o.customer?.phone || '',
            role: 'customer',
            fromOrders: true,
          });
        });
        if (alive) setUsers([...merged.values()]);
      } finally {
        if (alive) setLoadingUsers(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const q = query.trim().toLowerCase();
  const list = users
    .filter((u) =>
      !q ||
      String(u.name || '').toLowerCase().includes(q) ||
      String(u.email || '').toLowerCase().includes(q) ||
      String(u.phone || '').replace(/\D/g, '').includes(q.replace(/\D/g, ''))
    )
    .sort((a, b) => String(a.email || '').localeCompare(String(b.email || '')));

  // Pagination
  useEffect(() => { setPage(1); }, [query, pageSize]);
  const totalPages = Math.max(1, Math.ceil(list.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = list.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const startDelete = (u) => {
    setMsg(null);
    setConfirmText('');
    setPending(u);
  };

  const confirmDelete = async () => {
    if (!pending || deleting) return;
    if ((pending.email || '').trim().toLowerCase() !== confirmText.trim().toLowerCase()) {
      setMsg({ ok: false, text: 'Type the customer’s email exactly as shown to confirm deletion.' });
      return;
    }
    setDeleting(true);
    setMsg(null);
    try {
      // 1) remove the real Firestore profile (the account row the admin sees)
      const uid = String(pending.uid || pending.id || '').trim();
      let profileDeleted = false;
      if (uid && typeof deleteUserProfile === 'function' && !pending.fromOrders) {
        try {
          await deleteUserProfile(uid);
          profileDeleted = true;
        } catch (err) {
          setMsg({ ok: false, text: err.message || 'Could not delete that profile.' });
          return;
        }
      }
      // 2) remove local store copies (profile cache, reviews, wishlist)
      const res = deleteUserAccount(pending);
      const removedKey = String(pending.uid || pending.id || pending.email || '').toLowerCase();
      setUsers((prev) => prev.filter((u) =>
        String(u.uid || u.id || u.email || '').toLowerCase() !== removedKey
      ));
      setPending(null);
      setConfirmText('');
      const removedCount = (profileDeleted ? 1 : 0) + (res.users || 0);
      setMsg({
        ok: removedCount > 0 || (res.reviews || 0) > 0,
        text: removedCount > 0
          ? `Deleted: ${removedCount} profile${removedCount === 1 ? '' : 's'}, ${res.reviews} review(s)${res.wishlistRemoved ? ', wishlist' : ''}. ` +
            'Note: the underlying Firebase login can only be fully removed with server-side setup.'
          : `Nothing was deleted — no stored profile matched ${pending.email || 'that account'}. ` +
            'Their Firebase login/profile may already be gone; reload the page to refresh the list.',
      });
    } finally {
      setDeleting(false);
    }
  };

  const isStaffRole = (r) => r === 'admin' || ['manager', 'packer', 'shipper', 'support'].includes(r);

  return (
    <>
      <section className="card-box">
        <h2>Customer accounts ({users.length})</h2>
        <p className="muted small">
          All registered accounts are listed below — no search needed. Deleting an account removes the customer's stored profile,
          their reviews and their wishlist. <strong>Orders are kept</strong> — they are business records.
          The Firebase login itself is not removable from here (needs server-side setup).
        </p>
        <input
          className="input"
          style={{ maxWidth: 360 }}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by name, email or phone… (optional)"
        />
        {loadingUsers && <p className="muted small">Loading customer accounts…</p>}
        {usersError && <p className="error small">{usersError} Showing cached accounts below.</p>}
      </section>

      {msg && (
        <section className="card-box">
          <p className={msg.ok ? 'ok' : 'error'}>{msg.text}</p>
        </section>
      )}

      {pending && (
        <section className="card-box" style={{ borderColor: '#b3261e' }}>
          <h2>⚠ Delete account</h2>
          <p>
            <strong>{pending.name || 'Unknown'}</strong> — {pending.email || 'no email'} (role: {pending.role || 'customer'})
          </p>
          <p className="muted small">
            This permanently deletes their profile, reviews and wishlist from the store.
            Type their email below to confirm.
          </p>
          <div className="row-gap" style={{ alignItems: 'center' }}>
            <input
              className="input"
              style={{ maxWidth: 320 }}
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={pending.email || 'type their email'}
            />
            <button className="btn btn-sm danger" disabled={deleting} onClick={confirmDelete}>{deleting ? 'Deleting…' : 'Confirm deletion'}</button>
            <button className="btn btn-sm" disabled={deleting} onClick={() => { setPending(null); setConfirmText(''); }}>Cancel</button>
          </div>
        </section>
      )}

      <section className="card-box">
        {list.length === 0 ? (
          <p className="muted">{q ? 'No accounts match this filter.' : 'No customer accounts yet. They appear here after someone signs up or orders.'}</p>
        ) : (
          <>
            <p className="muted small" style={{ marginTop: 0 }}>
              Showing <strong>{list.length}</strong> of <strong>{users.length}</strong> account{users.length === 1 ? '' : 's'}.
            </p>
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr><th>Name</th><th>Email</th><th>Role</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {paged.map((u) => (
                  <tr key={u.id || u.email}>
                    <td>{u.name || '—'}</td>
                    <td>{u.email || '—'}</td>
                    <td>{u.role || 'customer'}</td>
                    <td>
                      {u.id === user?.id ? (
                        <span className="muted tiny">You</span>
                      ) : isStaffRole(u.role) ? (
                        <span className="muted tiny">Staff — protected</span>
                      ) : (
                        <button className="btn btn-sm danger" onClick={() => startDelete(u)}>Delete account</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Paginator
            total={list.length}
            page={currentPage}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(n) => { setPageSize(n); setPage(1); }}
            unit="accounts"
          />
          </>
        )}
      </section>
    </>
  );
}

