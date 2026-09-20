import React, { useState } from 'react';
import { formatINR } from '../utils/format.js';

const CATS = ['Suits', 'Ethnic', 'Lehenga', 'Saree', 'Daily Wear'];

// ── Sale banner image (optional) ─────────────────────────────
// The picked file is turned into a data URL, exactly like product images.
// Anything wider than MAX_IMAGE_WIDTH (or heftier than ~400 KB) is redrawn
// on a canvas first, because the whole sales list lives in one Firestore
// document and a multi-megabyte banner would blow its size limit.
const MAX_IMAGE_WIDTH = 1600;
const MAX_STORED_BYTES = 400 * 1024;
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

function imageFileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file || !String(file.type || '').startsWith('image/')) {
      reject(new Error('Please choose an image file (JPG, PNG or WebP).'));
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      reject(new Error('That image is larger than 8 MB — please pick a smaller one.'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read that image.'));
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      const img = new Image();
      img.onerror = () => resolve(dataUrl); // keep the original if it will not decode
      img.onload = () => {
        const smallEnough = img.width <= MAX_IMAGE_WIDTH && dataUrl.length <= MAX_STORED_BYTES * 1.4;
        if (smallEnough) {
          resolve(dataUrl);
          return;
        }
        try {
          const scale = Math.min(1, MAX_IMAGE_WIDTH / img.width);
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(img.width * scale));
          canvas.height = Math.max(1, Math.round(img.height * scale));
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#ffffff'; // flatten any transparency onto white
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        } catch {
          resolve(dataUrl);
        }
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}

function SaleRow({ sale, products, onEdit, onDelete, onToggle }) {
  const product = sale.productId ? products.find((p) => p.id === sale.productId) : null;
  const scope = sale.type === 'product'
    ? product?.name || 'Unknown product'
    : sale.type === 'category'
      ? sale.category + ' category'
      : sale.type === 'flash'
        ? 'Flash sale (all products)'
        : 'Entire store';
  return (
    <div className={'sale-row ' + (sale.active === false ? 'inactive' : '')}>
      <div className="sale-row-main">
        {sale.imageUrl && <img className="sale-thumb" src={sale.imageUrl} alt="" />}
        <span className="sale-badge">{sale.type}</span>
        <div>
          <strong>{sale.name || 'Unnamed sale'}</strong>
          <span className="sale-scope">{scope} - {sale.discountType === 'percent' ? sale.value + '% off' : 'Rs.' + sale.value + ' off'}</span>
        </div>
      </div>
      <div className="sale-row-actions">
        <button
          className={"btn btn-sm " + (sale.active === false ? 'btn-gold' : 'btn-ghost')}
          onClick={() => onToggle(sale.id)}
        >
          {sale.active === false ? 'Activate' : 'Deactivate'}
        </button>
        <button className="btn btn-sm btn-dark" onClick={() => onEdit(sale)}>Edit</button>
        <button className="btn btn-sm btn-danger" onClick={() => { if (window.confirm('Delete this sale?')) onDelete(sale.id); }}>Delete</button>
      </div>
    </div>
  );
}

export default function SalesManager({ sales, products, addSale, updateSale, deleteSale, toggleSale }) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ type: 'product', name: '', discountType: 'percent', value: '', productId: '', category: 'Suits', startsAt: '', endsAt: '', active: true, imageUrl: '' });
  const [imageMsg, setImageMsg] = useState('');

  const resetForm = () => { setForm({ type: 'product', name: '', discountType: 'percent', value: '', productId: '', category: 'Suits', startsAt: '', endsAt: '', active: true, imageUrl: '' }); setEditing(null); setShowForm(false); setImageMsg(''); };
  const openEdit = (sale) => { setEditing(sale.id); setForm({ type: sale.type, name: sale.name || '', discountType: sale.discountType || 'percent', value: sale.value || '', productId: sale.productId || '', category: sale.category || 'Suits', startsAt: sale.startsAt ? sale.startsAt.slice(0,16) : '', endsAt: sale.endsAt ? sale.endsAt.slice(0,16) : '', active: sale.active !== false, imageUrl: sale.imageUrl || '' }); setImageMsg(''); setShowForm(true); };

  const setF = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  // Optional banner artwork. Failure is non-fatal: the sale is still saved.
  const onPickImage = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = ''; // so the same file can be re-picked later
    if (!file) return;
    setImageMsg('Preparing image…');
    try {
      const dataUrl = await imageFileToDataUrl(file);
      setForm((prev) => ({ ...prev, imageUrl: dataUrl }));
      setImageMsg('');
    } catch (err) {
      setImageMsg(err.message || 'Could not read that image.');
    }
  };
  const submit = (e) => {
    e.preventDefault();
    const v = Number(form.value);
    if (!v || v <= 0) return;
    if (form.discountType === 'percent' && v > 100) return;
    if (form.type === 'product' && !form.productId) return;
    const data = { type: form.type, name: form.name.trim() || null, discountType: form.discountType, value: v, productId: form.type === 'product' ? form.productId : undefined, category: form.type === 'category' ? form.category : undefined, startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null, endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null, imageUrl: form.imageUrl || null, active: form.active };
    if (editing) updateSale(editing, data); else addSale(data);
    resetForm();
  };

  const now = Date.now();
  const active = sales.filter((s) => s.active !== false && (!s.endsAt || new Date(s.endsAt).getTime() > now));
  const expired = sales.filter((s) => s.endsAt && new Date(s.endsAt).getTime() <= now);
  const upcoming = sales.filter((s) => s.startsAt && new Date(s.startsAt).getTime() > now);

  return (
    <section className="card-box">
      <div className="sales-header">
        <h2>Manage sales</h2>
        {!showForm && <button className="btn btn-gold btn-sm" onClick={() => setShowForm(true)}>+ Create sale</button>}
      </div>
      {showForm && (
        <form onSubmit={submit} className="sale-form">
          <div className="grid2">
            <label>Sale type
              <select value={form.type} onChange={setF('type')}>
                <option value="product">Product (specific item)</option>
                <option value="category">Category (entire category)</option>
                <option value="storewide">Storewide (everything)</option>
                <option value="flash">Flash sale (time-limited)</option>
              </select>
            </label>
            <label>Label (optional)
              <input value={form.name} onChange={setF('name')} placeholder="e.g. Diwali Special" />
            </label>
          </div>
          {form.type === 'product' && (
            <label>Product
              <select value={form.productId} onChange={setF('productId')}>
                <option value="">Select a product</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({formatINR(p.price)})</option>)}
              </select>
            </label>
          )}
          {form.type === 'category' && (
            <label>Category
              <select value={form.category} onChange={setF('category')}>
                {CATS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
          )}
          <div className="grid2">
            <label>Discount type
              <select value={form.discountType} onChange={setF('discountType')}>
                <option value="percent">Percentage (%)</option>
                <option value="flat">Flat amount</option>
              </select>
            </label>
            <label>Value
              <input type="number" min="1" value={form.value} onChange={setF('value')} placeholder={form.discountType === 'percent' ? 'e.g. 30' : 'e.g. 500'} required />
            </label>
          </div>
          <div className="grid2">
            <label>Start (optional)
              <input type="datetime-local" value={form.startsAt} onChange={setF('startsAt')} />
            </label>
            <label>End (optional)
              <input type="datetime-local" value={form.endsAt} onChange={setF('endsAt')} />
            </label>
          </div>
          <label>Sale banner image (optional)
            <input type="file" accept="image/*" onChange={onPickImage} />
            <input
              type="text"
              value={form.imageUrl && !form.imageUrl.startsWith('data:') ? form.imageUrl : ''}
              onChange={setF('imageUrl')}
              placeholder="…or paste an image link (https://…)"
            />
            <span className="muted tiny">
              Shown as a clickable banner on the home page, roughly 1240 × 400. Any image is
              stretched to fill that whole box, so a wide image looks sharpest (tall posters get
              centre-cropped). Clicking it opens this sale's products. Leave it empty and no
              banner appears anywhere.
            </span>
          </label>
          {imageMsg && <p className="muted tiny">{imageMsg}</p>}
          {form.imageUrl && (
            <div className="sale-image-preview">
              <img src={form.imageUrl} alt="Sale banner preview" />
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                onClick={() => setForm({ ...form, imageUrl: '' })}
              >
                Remove image
              </button>
            </div>
          )}
          <label className="check-row">
            <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
            Active (visible to customers)
          </label>
          <div className="sale-form-actions">
            <button type="submit" className="btn btn-gold">{editing ? 'Update sale' : 'Create sale'}</button>
            <button type="button" className="btn btn-ghost" onClick={resetForm}>Cancel</button>
          </div>
        </form>
      )}
      {active.length > 0 && <div className="sale-list"><h3>Active sales ({active.length})</h3>{active.map((s) => <SaleRow key={s.id} sale={s} products={products} onEdit={openEdit} onDelete={deleteSale} onToggle={toggleSale} />)}</div>}
      {upcoming.length > 0 && <div className="sale-list"><h3>Upcoming ({upcoming.length})</h3>{upcoming.map((s) => <SaleRow key={s.id} sale={s} products={products} onEdit={openEdit} onDelete={deleteSale} onToggle={toggleSale} />)}</div>}
      {expired.length > 0 && <div className="sale-list"><h3>Expired ({expired.length})</h3>{expired.map((s) => <SaleRow key={s.id} sale={s} products={products} onEdit={openEdit} onDelete={deleteSale} onToggle={toggleSale} />)}</div>}
      {sales.length === 0 && <p className="muted">No sales yet. Create your first sale to attract customers!</p>}
    </section>
  );
}
