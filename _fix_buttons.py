with open('src/components/SalesManager.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the button row with proper CSS buttons
old = '''      <div className="sale-row-actions">
        <button className="linklike" onClick={() => onToggle(sale.id)}>
          {sale.active === false ? 'Activate' : 'Deactivate'}
        </button>
        <button className="linklike" onClick={() => onEdit(sale)}>Edit</button>
        <button className="linklike danger" onClick={() => { if (window.confirm('Delete this sale?')) onDelete(sale.id); }}>Delete</button>
      </div>'''

new = '''      <div className="sale-row-actions">
        <button
          className={"btn btn-sm " + (sale.active === false ? 'btn-gold' : 'btn-ghost')}
          onClick={() => onToggle(sale.id)}
        >
          {sale.active === false ? 'Activate' : 'Deactivate'}
        </button>
        <button className="btn btn-sm btn-dark" onClick={() => onEdit(sale)}>Edit</button>
        <button className="btn btn-sm btn-danger" onClick={() => { if (window.confirm('Delete this sale?')) onDelete(sale.id); }}>Delete</button>
      </div>'''

content = content.replace(old, new)

with open('src/components/SalesManager.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print('Buttons fixed')
