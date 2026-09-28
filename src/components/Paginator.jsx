import React from 'react';

/**
 * Shared admin pager: a "Show [N]" selector next to numbered pages plus
 * Prev / Next buttons. The parent owns `page` + `pageSize` state, slices its
 * own array and passes the totals here - this component is only the bar.
 */
export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

export default function Paginator({ total, page, pageSize, onPageChange, onPageSizeChange, unit = 'items' }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(Math.max(1, page), pages);
  const from = total === 0 ? 0 : (current - 1) * pageSize + 1;
  const to = Math.min(total, current * pageSize);

  // Compact window of page numbers: 1 ... 4 5 6 ... 20
  const windowSize = 5;
  let start = Math.max(1, current - Math.floor(windowSize / 2));
  let end = Math.min(pages, start + windowSize - 1);
  start = Math.max(1, end - windowSize + 1);
  const numbers = [];
  for (let i = start; i <= end; i += 1) numbers.push(i);

  const go = (n) => onPageChange(Math.min(Math.max(1, n), pages));

  return (
    <div className="paginator">
      <span className="muted small">Show</span>
      <select
        className="paginator-size"
        value={pageSize}
        onChange={(e) => onPageSizeChange(Number(e.target.value))}
        aria-label={`${unit} per page`}
      >
        {PAGE_SIZE_OPTIONS.map((n) => (
          <option key={n} value={n}>{n}</option>
        ))}
      </select>
      <span className="muted small">
        {unit} - showing {from} to {to} of {total}
      </span>
      <div className="paginator-pages">
        <button type="button" className="chip" disabled={current <= 1} onClick={() => go(current - 1)}>
          &lt; Prev
        </button>
        {start > 1 && (
          <>
            <button type="button" className="chip" onClick={() => go(1)}>1</button>
            {start > 2 && <span className="muted small">...</span>}
          </>
        )}
        {numbers.map((n) => (
          <button
            key={n}
            type="button"
            className={`chip${n === current ? ' active' : ''}`}
            onClick={() => go(n)}
          >
            {n}
          </button>
        ))}
        {end < pages && (
          <>
            {end < pages - 1 && <span className="muted small">...</span>}
            <button type="button" className="chip" onClick={() => go(pages)}>{pages}</button>
          </>
        )}
        <button type="button" className="chip" disabled={current >= pages} onClick={() => go(current + 1)}>
          Next &gt;
        </button>
      </div>
    </div>
  );
}
