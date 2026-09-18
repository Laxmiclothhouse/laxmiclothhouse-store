// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// utils/ordersReportPdf.js â€” Admin orders report: date-range
// filter + branded PDF download (jsPDF, no extra dependencies).
// Brand: maroon #9b1c3d, gold #c9a24b, cream #faf6f0.
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
import jsPDF from "jspdf";

const money = (n) => "â‚¹" + Number(n || 0).toLocaleString("en-IN");

const fmtDate = (d) => {
  const x = new Date(d);
  return isNaN(x) ? "" : x.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

/** Filter orders between from/to (inclusive, whole days). Empty bounds = open. */
export function filterOrdersByRange(orders, from, to) {
  if (!from && !to) return orders || [];
  const f = from ? new Date(from + "T00:00:00") : null;
  const t = to ? new Date(to + "T23:59:59.999") : null;
  return (orders || []).filter((o) => {
    const d = new Date(o.orderDate || 0);
    if (isNaN(d)) return false;
    if (f && d < f) return false;
    if (t && d > t) return false;
    return true;
  });
}

/** Build + download the branded PDF report for the given orders. */
export function downloadOrdersReportPdf(orders, opts = {}) {
  const list = (orders || [])
    .slice()
    .sort((a, b) => new Date(b.orderDate || 0) - new Date(a.orderDate || 0));

  const revenue = list
    .filter((o) => o.status !== "cancelled")
    .reduce((s, o) => s + (Number(o.total) || 0), 0);
  const cancelledCount = list.filter((o) => o.status === "cancelled").length;
  const codCount = list.filter((o) =>
    String(o.payment?.mode || o.paymentMode || "").toLowerCase().includes("cod") ||
    String(o.payment?.mode || o.paymentMode || "").toLowerCase().includes("cash")
  ).length;

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.getPageWidth();
  const H = doc.getPageHeight();
  const M = 12;
  const CW = W - M * 2;

  const BRAND = [155, 28, 61];
  const GOLD = [201, 162, 75];
  const INK = [43, 34, 38];
  const MUTED = [124, 111, 114];
  const LINE = [234, 223, 214];
  const CREAM = [250, 246, 240];

  const rangeText = `${opts.from ? fmtDate(opts.from) : "start"}  â†’  ${opts.to ? fmtDate(opts.to) : "today"}`;

  // ---------- Header band ----------
  doc.setFillColor(...CREAM);
  doc.rect(0, 0, W, 28, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...BRAND);
  doc.text("LAXMICLOTHHOUSE", M, 13);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...GOLD);
  doc.text("ORDERS REPORT", M, 20);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...INK);
  doc.text(rangeText, W - M, 13, { align: "right" });
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text(`Generated ${fmtDate(new Date())} Â· ${list.length} orders`, W - M, 20, { align: "right" });
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.8);
  doc.line(M, 28, W - M, 28);

  // ---------- Summary boxes ----------
  const stats = [
    ["ORDERS", String(list.length), INK],
    ["REVENUE (excl. cancelled)", money(revenue), BRAND],
    ["CANCELLED", String(cancelledCount), INK],
    ["COD ORDERS", `${codCount} of ${list.length}`, INK],
  ];
  const boxW = (CW - 9) / 4;
  let sy = 34;
  stats.forEach(([label, value, color], i) => {
    const bx = M + i * (boxW + 3);
    doc.setFillColor(...CREAM);
    doc.roundedRect(bx, sy, boxW, 15, 1.6, 1.6, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(...MUTED);
    doc.text(label, bx + 3, sy + 5);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(...color);
    doc.text(value, bx + 3, sy + 11.5);
  });

  // ---------- Table ----------
  const cols = [
    { label: "#", w: 10 },
    { label: "Date", w: 22 },
    { label: "Order", w: 26 },
    { label: "Customer", w: 40 },
    { label: "Phone", w: 24 },
    { label: "Payment", w: 22 },
    { label: "Status", w: 20 },
    { label: "Total", w: 22 },
  ];
  const colX = [];
  let acc = M;
  cols.forEach((c) => { colX.push(acc); acc += c.w; });

  const rowH = 8;
  const fit = (text, w) => {
    doc.setFontSize(7.5);
    const s = doc.splitTextToSize(String(text == null ? "" : text), w - 3);
    return s.length ? s[0] : "";
  };

  const drawTableHead = (y) => {
    doc.setFillColor(...BRAND);
    doc.rect(M, y, CW, rowH, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);
    cols.forEach((c, i) => {
      doc.text(c.label, colX[i] + 2, y + 5.3);
    });
    return y + rowH;
  };

  let y = sy + 21;
  y = drawTableHead(y);

  const getStatusColor = (st) => {
    if (st === "delivered") return [30, 125, 67];
    if (st === "cancelled") return [179, 38, 30];
    if (st === "shipped") return [47, 111, 177];
    if (st === "returned") return [176, 109, 22];
    return INK;
  };

  list.forEach((o, i) => {
    if (y + rowH > H - 20) {
      doc.addPage();
      y = 18;
      y = drawTableHead(y);
    }
    if (i % 2 === 1) {
      doc.setFillColor(...CREAM);
      doc.rect(M, y, CW, rowH, "F");
    }
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.2);
    doc.line(M, y + rowH, W - M, y + rowH);

    const itemsQty = (o.items || []).reduce((s, it) => s + (Number(it.qty) || 1), 0);
    const cells = [
      String(i + 1),
      fmtDate(o.orderDate),
      o.id || "",
      o.customerName || o.customer?.name || "",
      o.phone || o.customer?.phone || "",
      (o.payment?.mode || o.paymentMode || "").toString().toUpperCase(),
      (o.status || "").toUpperCase(),
      money(o.total),
    ];
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    cells.forEach((val, ci) => {
      if (ci === 7) {
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...BRAND);
      } else if (ci === 6) {
        doc.setTextColor(...getStatusColor(String(o.status).toLowerCase()));
      } else {
        doc.setTextColor(...INK);
      }
      doc.text(fit(val, cols[ci].w), colX[ci] + 2, y + 5.3);
    });
    y += rowH;
  });

  // Totals row
  if (y + rowH > H - 20) {
    doc.addPage();
    y = 18;
  }
  doc.setFillColor(...BRAND);
  doc.rect(M, y, CW, rowH, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text(`TOTAL Â· ${list.length} orders`, M + 2, y + 5.3);
  doc.text(money(revenue), W - M - 2, y + 5.3, { align: "right" });

  // ---------- Footers on every page ----------
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(`${STORE_LABEL(opts.storeName)} Â· Orders report`, M, H - 7);
    doc.text(`Page ${p} of ${pages}`, W - M, H - 7, { align: "right" });
  }

  const stamp = `${opts.from || "start"}_to_${opts.to || "today"}`.replace(/[^a-zA-Z0-9_-]+/g, "-");
  doc.save(`orders-report_${stamp}.pdf`);
}

const STORE_LABEL = (storeName) => String(storeName || "Laxmiclothhouse").toUpperCase();
