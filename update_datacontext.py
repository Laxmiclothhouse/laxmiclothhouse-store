#!/usr/bin/env python3
"""Update DataContext.jsx to add userEmail to reviews and updateReview function."""

import re

# Read the file
with open('src/context/DataContext.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add userEmail parameter to addReview function signature
old_sig = 'const addReview = ({ productId, userId, userName, rating, comment }) => {'
new_sig = 'const addReview = ({ productId, userId, userName, rating, comment, userEmail }) => {'
if old_sig in content:
    content = content.replace(old_sig, new_sig)
    print('1. Added userEmail to addReview signature')
else:
    print('ERROR: Could not find addReview signature')

# 2. Add userEmail to the review object
old_review_lines = '''      comment,
      date: new Date().toISOString(),'''
new_review_lines = '''      comment,
      userEmail,
      date: new Date().toISOString(),'''
if old_review_lines in content:
    content = content.replace(old_review_lines, new_review_lines)
    print('2. Added userEmail to review object')
else:
    print('ERROR: Could not find review object lines')

# 3. Add updateReview function before reviewsFor
update_review_fn = '''
  // Admin-only: update a review by id (moderation).
  const updateReview = (reviewId, updates) => {
    const idx = reviews.findIndex((r) => r.id === reviewId);
    if (idx < 0) return;
    const updated = {
      ...reviews[idx],
      ...updates,
      date: new Date().toISOString(),
    };
    const next = reviews.map((r, i) => (i === idx ? updated : r));
    setReviews(next);
    db.saveReviews(next);
  };

'''

old_marker = '  const reviewsFor = (productId) =>'
if old_marker in content:
    content = content.replace(old_marker, update_review_fn + old_marker)
    print('3. Added updateReview function')
else:
    print('ERROR: Could not find reviewsFor marker')

# Write back
with open('src/context/DataContext.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print('DataContext.jsx updated successfully!')
