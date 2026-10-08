import React from 'react';
import { createPortal } from 'react-dom';

/**
 * PdfViewer — fullscreen in-app PDF preview.
 *
 * Props:
 *   title      — heading shown in the top bar (e.g. "Invoice — ORD-12")
 *   subtitle   — small muted line under / next to the title
 *   url        — object URL of the PDF blob (iframe src)
 *   fileName   — suggested file name for the download button
 *   onDownload — () => void — rebuilds + downloads the PDF
 *   onClose    — () => void — Back / ✕ / overlay click / Esc all close
 *
 * Print: focuses the same-origin blob iframe and calls print(), so the
 * browser's print dialog prints the PDF itself (not the app page).
 * URL lifetime is owned by the caller.
 */
export default function PdfViewer({ title, subtitle, url, fileName, onDownload, onClose }) {
  const frameRef = React.useRef(null);

  React.useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  const onPrint = () => {
    const frame = frameRef.current;
    if (frame) {
      try {
        frame.contentWindow.focus();
        frame.contentWindow.print();
        return;
      } catch {
        /* cross-origin fallback below */
      }
    }
    window.open(url, '_blank', 'noopener');
  };

  const onDownloadClick = () => {
    if (onDownload) {
      onDownload();
      return;
    }
    // Fallback: download straight from the preview URL.
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName || 'document.pdf';
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return createPortal(
    <div className="pdf-viewer" role="dialog" aria-modal="true" aria-label={title}>
      <div className="pdf-bar">
        <button type="button" className="btn btn-sm btn-ghost pdf-back" onClick={onClose} aria-label="Go back">
          ← Back
        </button>
        <div className="pdf-title">
          <strong>{title}</strong>
          {subtitle ? <span className="muted">{subtitle}</span> : null}
        </div>
        <div className="pdf-actions">
          <button type="button" className="btn btn-sm btn-ghost" onClick={onPrint}>
            🖨 Print
          </button>
          <button type="button" className="btn btn-sm btn-gold" onClick={onDownloadClick}>
            ⬇ Download
          </button>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
      </div>
      <div className="pdf-body">
        {url ? (
          <iframe
            ref={frameRef}
            title={title}
            src={url}
            className="pdf-frame"
          />
        ) : (
          <p className="muted pdf-loading">Preparing PDF…</p>
        )}
      </div>
    </div>,
    document.body
  );
}
