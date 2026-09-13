with open('src/pages/Admin.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Remove the duplicate SaleRow function (it's now in SalesManager.jsx)
old_salerow = """function SaleRow({ sale, products, onEdit, onDelete, onToggle }) {
  const product = sale.productId ? products.find((p) => p.id === sale.productId) : null;
  const scope = sale.type === 'product'
    ? product?.name || 'Unknown product'
    : sale.type === 'category'
      ? `${sale.category} category`
      : sale.type === 'flash'
        ? 'Flash sale (all products)'
        : 'Entire store';

  return (
    <div className={`sale-row ${sale.active === false ? 'inactive' : ''}`}>
      <div className="sale-row-main">
        <span className="sale-badge">{sale.type}</span>
        <div>
          <strong>{sale.name || 'Unnamed sale'}</strong>
          <span className="sale-scope">{scope} · {sale.discountType === 'percent' ? `${sale.value}% off` : `₹${sale.value} off`}</span>
        </div>
      </div>
      <div className="sale-row-actions">
        <button className="linklike" onClick={() => onToggle(sale.id)}>
          {sale.active === false ? 'Activate' : 'Deactivate'}
        </button>
        <button className="linklike" onClick={() => onEdit(sale)}>Edit</button>
        <button className="linklike danger" onClick={() => {
          if (window.confirm('Delete this sale?')) onDelete(sale.id);
        }}>Delete</button>
      </div>
    </div>
  );
}

"""

content = content.replace(old_salerow, '')

with open('src/pages/Admin.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print('Duplicate SaleRow removed')
