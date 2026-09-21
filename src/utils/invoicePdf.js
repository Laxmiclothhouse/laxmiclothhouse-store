import jsPDF from "jspdf";
import * as qrcode from "qrcode";

const MONEY = (n) => "Rs. " + Number(n || 0).toLocaleString("en-IN");
const fmtDt = (d) => {
  if (!d) return "";
  const x = new Date(d);
  return x.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) + " Â· " +
    x.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
};

// Each item row ready for the PDF table
export function invoiceLines(order, settings) {
  const s = settings || {};
  const items = (order?.items || []).map((it) => ({
    name: it.name,
    size: it.size || it.variant || "",
    qty: it.qty || 1,
    price: Number(it.price || 0),
    total: Number(it.price || 0) * (it.qty || 1),
  }));
  const subtotal = items.reduce((a, b) => a + b.total, 0);
  const shipping = Number(order?.shippingFee ?? 0);
  const discount = Number(order?.discount ?? 0);
  const couponCode = order?.couponCode || "";
  const total = Number(order?.total ?? subtotal + shipping - discount);
  return {
    brand: s.storeName || "Laxmiclothhouse",
    tagline: s.tagline || "Ethnic fashion store",
    phone: s.contactPhone || "",
    email: s.contactEmail || "",
    address: s.contactAddress || "",
    invoiceNo: order?.id || "ORD-",
    date: fmtDt(order?.orderDate),
    status: (order?.status || "placed").toUpperCase(),
    payment: order?.payment?.mode?.toUpperCase() || "â€”",
    customer: order?.customer || {},
    shippingAddr: order?.shipping || {},
    items,
    subtotal,
    shipping,
    discount,
    couponCode,
    total,
  };
}
const wraps = (doc, text, maxW, size) => {
  doc.setFontSize(size);
  const out = doc.splitTextToSize(text || "", maxW);
  return out.length ? out : [""];
};

export async function buildInvoicePdf(order, settings) {
  const L = invoiceLines(order, settings);
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.getPageWidth();
  const H = doc.getPageHeight();
  const M = 14;
  const CW = W - M * 2;

  const brandR = 155, brandG = 28, brandB = 61;   // maroon
  const inkR = 43, inkG = 34, inkB = 38;          // near-black
  const lineR = 220, lineG = 214, lineB = 219;    // light divider

  // ---------- Header band ----------
  const bandH = 38;
  doc.setFillColor(250, 240, 243);
  doc.rect(0, 0, W, bandH, "F");
  doc.setDrawColor(brandR, brandG, brandB);
  doc.setLineWidth(0.8);
  doc.line(M, bandH, W - M, bandH);

  // Left: brand, tagline, contact (width-capped so it never reaches the right block)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(brandR, brandG, brandB);
  doc.text(M, 13, L.brand);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(inkR, inkG, inkB);
  doc.text(M, 19, L.tagline || "");

  doc.setFontSize(8);
  if (L.phone || L.email) doc.text(M, 25, [L.phone, L.email].filter(Boolean).join("  Â·  "));
  if (L.address) {
    const aLines = wraps(doc, L.address, 78, 8);
    aLines.slice(0, 2).forEach((ln, i) => doc.text(M, 30 + i * 4, ln));
  }

  // Right: TAX INVOICE title + label/value meta column
  const metaLX = W - M - 66;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(brandR, brandG, brandB);
  doc.text(W - M, 13, "TAX INVOICE", { align: "right" });

  let my = 21;
  const metaLines = [
    { label: "Invoice No.", value: L.invoiceNo },
    { label: "Date", value: L.date },
    { label: "Status", value: L.status },
    { label: "Payment", value: L.payment },
  ];
  for (const m of metaLines) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(inkR, inkG, inkB);
    doc.text(metaLX, my, m.label);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(brandR, brandG, brandB);
    doc.text(W - M, my, m.value, { align: "right" });
    my += 5;
  }

  // ---------- Bill To ----------
  let y = 47;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(inkR, inkG, inkB);
  doc.text(M, y, "BILLED TO");
  doc.setDrawColor(brandR, brandG, brandB);
  doc.setLineWidth(0.4);
  doc.line(M, y + 1.5, M + 50, y + 1.5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const cust = L.customer;
  const addr = L.shippingAddr;
  const fullAddr = [addr.address, addr.city, addr.state, addr.pincode].filter(Boolean).join(", ");
  let cLines = [];
  if (cust.name) cLines.push(cust.name);
  if (cust.phone) cLines.push("Phone: " + cust.phone);
  if (cust.email) cLines.push(cust.email);
  if (fullAddr) cLines = cLines.concat(wraps(doc, fullAddr, 82, 10));
  y += 8;
  for (const cl of cLines) {
    doc.text(M, y, cl);
    y += 5.2;
  }
  y += 5;// ---------- Items table ----------
  const th = 7;
  if (y > H - 46) {
    doc.addPage();
    y = M + 6;
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setFillColor(brandR, brandG, brandB);
  doc.setTextColor(255, 255, 255);
  doc.rect(M, y, CW, th, "F");
  doc.text(M + 2, y + 4.6, "#");
  doc.text(M + 8, y + 4.6, "ITEM");
  doc.text(M + 124, y + 4.6, "QTY", { align: "right" });
  doc.text(M + 150, y + 4.6, "RATE", { align: "right" });
  doc.text(M + 180, y + 4.6, "AMOUNT", { align: "right" });
  y += th;

  doc.setFont("helvetica", "normal");
  doc.setTextColor(inkR, inkG, inkB);
  let n = 0;
  let zebraLine = true;
  for (const it of L.items) {
    n += 1;
    const nameLines = wraps(doc, it.name, 84, 9);
    const rowH = Math.max(th, nameLines.length * 4.2 + 2);
    if (y + rowH > H - 46) {
      doc.addPage();
      y = M + 6;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(inkR, inkG, inkB);
      doc.text(M, y, L.brand + " â€” " + L.invoiceNo + " (continued)");
      y += 8;
      doc.setFont("helvetica", "normal");
    }
    zebraLine = !zebraLine;
    if (zebraLine) {
      doc.setFillColor(246, 242, 244);
      doc.rect(M, y, CW, rowH, "F");
    }
    doc.setDrawColor(lineR, lineG, lineB);
    doc.setLineWidth(0.2);
    doc.line(M, y, W - M, y);
    doc.setFontSize(9);
    doc.text(M + 2, y + 4.6, String(n));
    doc.text(M + 8, y + 4.6, nameLines[0]);
    if (nameLines.length > 1) {
      for (let li = 1; li < nameLines.length; li++) doc.text(M + 8, y + 4.6 + li * 4.2, nameLines[li]);
    }
    doc.text(M + 124, y + 4.6, String(it.qty), { align: "right" });
    doc.text(M + 150, y + 4.6, MONEY(it.price), { align: "right" });
    doc.text(M + 180, y + 4.6, MONEY(it.total), { align: "right" });
    y += rowH;
  }
  doc.setDrawColor(lineR, lineG, lineB);
  doc.setLineWidth(0.5);
  doc.line(M, y, W - M, y);
  y += 4;

  // If totals + QR would not fit above the footer, move them to a fresh page
  if (y + 76 > H - 26) {
    doc.addPage();
    y = M + 8;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(inkR, inkG, inkB);
    doc.text(M, y, L.brand + " â€” " + L.invoiceNo + " (summary)");
    y += 8;
  }

  // ---------- Totals ----------
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(inkR, inkG, inkB);
  doc.text(M, y, "Subtotal");
  doc.text(W - M, y, MONEY(L.subtotal), { align: "right" });
  y += 5.6;
  doc.text(M, y, "Shipping");
  doc.text(W - M, y, L.shipping > 0 ? MONEY(L.shipping) : "FREE", { align: "right" });
  y += 5.6;
  if (L.discount > 0) {
    doc.setTextColor(20, 120, 90);
    doc.text(M, y, "Coupon" + (L.couponCode ? " (" + L.couponCode + ")" : ""));
    doc.text(W - M, y, "-" + MONEY(L.discount), { align: "right" });
    doc.setTextColor(inkR, inkG, inkB);
    y += 5.6;
  }
  y += 1;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(brandR, brandG, brandB);
  doc.text(M, y, "TOTAL DUE");
  doc.text(W - M, y, MONEY(L.total), { align: "right" });

  // ---------- QR code ----------
  const base = window.location.origin || (window.location.protocol + "//" + window.location.host);
  const qrTarget = base + "/#/order-manage/" + encodeURIComponent(L.invoiceNo);
  const qrSide = 30;
  try {
    const qrData = await qrcode.toDataURL(qrTarget);
    const qx = W - M - qrSide;
    const qy = y + 9;
    doc.setFillColor(250, 240, 243);
    doc.rect(qx - 4, qy - 4, qrSide + 8, qrSide + 16, "F");
    doc.setDrawColor(brandR, brandG, brandB);
    doc.setLineWidth(0.3);
    doc.rect(qx - 4, qy - 4, qrSide + 8, qrSide + 16, "S");
    doc.addImage(qrData, "PNG", qx, qy, qrSide, qrSide);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(inkR, inkG, inkB);
    doc.text(qx + qrSide / 2, qy + qrSide + 6, "Scan to open", { align: "center" });
    doc.text(qx + qrSide / 2, qy + qrSide + 10, "order in admin", { align: "center" });
  } catch (e) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(160, 150, 154);
    doc.text(W - M, y + 10, "QR: " + qrTarget, { align: "right" });
  }

  // ---------- Thank-you footer ----------
  const fo = H - 24;
  doc.setDrawColor(lineR, lineG, lineB);
  doc.setLineWidth(0.3);
  doc.line(M, fo, W - M, fo);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(10);
  doc.setTextColor(inkR, inkG, inkB);
  doc.text(M, fo + 6, "Thank you for shopping with " + L.brand + "!");
  doc.setFontSize(8);
  doc.text(M, fo + 12, "This is a system-generated invoice. For order support, contact " + (L.phone || L.email || "the store"));

  const buf = doc.output("arraybuffer");
  return new Blob([buf], { type: "application/pdf" });
}
/** Returns an object URL for in-browser preview (async). Caller must revoke it. */
export async function invoicePdfUrl(order, settings) {
  const blob = await buildInvoicePdf(order, settings);
  return URL.createObjectURL(blob);
}

/** Generates the PDF and triggers a browser download. */
export async function downloadInvoicePdf(order, settings) {
  const blob = await buildInvoicePdf(order, settings);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `invoice-${order?.id || "download"}.pdf`;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}
/** Compact picking/packing slip â€” no prices, just items + checklist info (Step 7). */
async function buildPackingSlip(order, settings) {
  const L = invoiceLines(order, settings);
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.getPageWidth();
  const H = doc.getPageHeight();
  const M = 14;
  const CW = W - M * 2;
  const brandR = 155, brandG = 28, brandB = 61;
  const inkR = 43, inkG = 34, inkB = 38;

  doc.setFillColor(250, 240, 243);
  doc.rect(0, 0, W, 26, "F");
  doc.setDrawColor(brandR, brandG, brandB);
  doc.setLineWidth(0.8);
  doc.line(M, 26, W - M, 26);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(brandR, brandG, brandB);
  doc.text(M, 12, L.brand);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(inkR, inkG, inkB);
  doc.text(M, 18, L.address || L.phone || L.email || "");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(W - M, 12, "PACKING SLIP", { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(W - M, 18, L.invoiceNo + " Â· " + L.date, { align: "right" });

  let y = 34;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(M, y, "SHIP TO");
  doc.setFont("helvetica", "normal");
  y += 5.5;
  const addr = L.shippingAddr;
  const shipLines = [
    L.customer?.name,
    L.customer?.phone,
    [addr.address, addr.city, addr.state, addr.pincode].filter(Boolean).join(", "),
  ].filter(Boolean);
  for (const ln of shipLines) {
    doc.text(M, y, ln);
    y += 5.5;
  }
  y += 4;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setFillColor(brandR, brandG, brandB);
  doc.setTextColor(255, 255, 255);
  doc.rect(M, y, CW, 7, "F");
  doc.text(M + 2, y + 4.6, "ITEM");
  doc.text(M + 108, y + 4.6, "SIZE");
  doc.text(M + 138, y + 4.6, "QTY", { align: "right" });
  doc.text(M + 158, y + 4.6, "PACKED", { align: "right" });
  y += 7;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(inkR, inkG, inkB);
  const drawBox = (bx, by) => {
    doc.setDrawColor(inkR, inkG, inkB);
    doc.setLineWidth(0.3);
    doc.rect(bx, by, 3.6, 3.6);
    doc.setDrawColor(220, 214, 219);
    doc.setLineWidth(0.2);
  };
  let n = 0;
  for (const it of L.items) {
    n += 1;
    const nameLines = wraps(doc, it.name, 100, 9);
    const sizeText = it.size ? String(it.size) : "â€”";
    const rowH = Math.max(8, nameLines.length * 4.2 + 3);
    if (y + rowH > H - 46) {
      doc.addPage();
      y = M + 6;
    }
    doc.setDrawColor(220, 214, 219);
    doc.setLineWidth(0.2);
    doc.line(M, y, W - M, y);
    doc.text(M + 2, y + 4.6, String(n));
    doc.text(M + 8, y + 4.6, nameLines[0]);
    if (nameLines.length > 1) {
      for (let li = 1; li < nameLines.length; li++) doc.text(M + 8, y + 4.6 + li * 4.2, nameLines[li]);
    }
    doc.text(M + 108, y + 4.6, sizeText);
    doc.text(M + 138, y + 4.6, String(it.qty), { align: "right" });
    drawBox(M + 148, y + 2.4);
    y += rowH;
  }
  doc.line(M, y, W - M, y);
  y += 6;

  const totalQty = L.items.reduce((a, b) => a + b.qty, 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(brandR, brandG, brandB);
  doc.text(M, y, "Total items: " + L.items.length + "   Â·   Total qty: " + totalQty);
  y += 8;

  // â”€â”€ Packer checklist: one tick per piece, then final seals â”€â”€
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(inkR, inkG, inkB);
  doc.text(M, y, "Packer checklist â€” tick each piece as it goes in:");
  y += 6;
  for (const it of L.items) {
    const sizeText = it.size ? ` (Size ${it.size})` : "";
    const label = `â˜  ${it.name}${sizeText} Ã— ${it.qty}`;
    const labelLines = wraps(doc, label, CW - 6, 9);
    if (y + labelLines.length * 4.2 > H - 40) {
      doc.addPage();
      y = M + 6;
    }
    labelLines.forEach((ln, li) => doc.text(M + 2, y + li * 4.2, ln));
    y += labelLines.length * 4.2 + 1.4;
  }
  y += 2;
  doc.text(M, y, "â˜  Invoice slip included in the package");
  y += 6;
  doc.text(M, y, "â˜  Package sealed and dispatched");

  const buf = doc.output("arraybuffer");
  return new Blob([buf], { type: "application/pdf" });
}

/** Returns an object URL for in-browser preview (async). Caller must revoke it. */
export async function packingSlipUrl(order, settings) {
  const blob = await buildPackingSlip(order, settings);
  return URL.createObjectURL(blob);
}

/** Generates the packing-slip PDF and triggers a browser download. */
export async function downloadPackingSlip(order, settings) {
  const blob = await buildPackingSlip(order, settings);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `packing-slip-${order?.id || "download"}.pdf`;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}