#!/usr/bin/env python3
"""Add sale ending time pill to the home page banner."""
with open('src/pages/Home.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# The line to replace
old = '''            {bannerSale.name && <span className="sale-banner-pill">{bannerSale.name} →</span>}'''

# Replacement: name pill + end time pill
new = '''            {bannerSale.name && <span className="sale-banner-pill">{bannerSale.name} →</span>}
            {bannerSale.endsAt && (
              <span className="sale-banner-end" title="{new Date(bannerSale.endsAt).toLocaleString('en-IN')}">
                Ends {formatSaleEnd(bannerSale.endsAt)}
              </span>
            )}'''

if old in content:
    content = content.replace(old, new, 1)
    with open('src/pages/Home.jsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print('Home.jsx updated successfully')
else:
    print('Pattern not found')
    for i, line in enumerate(content.splitlines()):
        if 'sale-banner-pill' in line:
            print(f'Line {i+1}: {repr(line)}')
