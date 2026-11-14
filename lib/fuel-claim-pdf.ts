import jsPDF from "jspdf";

export interface FuelClaimForPDF {
  claimNumber: string;
  date: string;
  expenseType: string;
  driverName: string;
  transporterId?: string;
  tripType: string;
  routeNumber?: string;
  vendor?: string;
  amount: number;
  paidWith?: string;
  driverRepaid?: string;
  notes?: string;
  receipts: string[];
  status: string;
  submittedDate?: string;
  amazonReference?: string;
  approvedAmount?: number;
  decidedDate?: string;
  denialReason?: string;
}

const STATUS_LABEL: Record<string, string> = {
  needs_submission: "Needs submission",
  submitted: "Submitted to Amazon",
  approved: "Approved",
  denied: "Denied",
};
const REPAID_LABEL: Record<string, string> = { yes: "Yes", no: "No", not_needed: "Not needed" };

const fmtDate = (d?: string) => {
  if (!d) return "—";
  const dt = new Date(String(d).slice(0, 10) + "T12:00:00Z");
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
};
const money = (n?: number) => (typeof n === "number" ? `$${n.toFixed(2)}` : "—");

// Cloudinary can hand back a web-safe, reasonably sized JPEG of any upload
// (including phone HEIC photos jsPDF cannot read directly).
function printableUrl(url: string) {
  return /res\.cloudinary\.com/.test(url) && url.includes("/upload/") && !/\.pdf($|\?)/i.test(url)
    ? url.replace("/upload/", "/upload/f_jpg,q_auto,w_1600/")
    : url;
}

async function loadImage(url: string): Promise<{ data: string; w: number; h: number } | null> {
  try {
    const res = await fetch(printableUrl(url));
    if (!res.ok) return null;
    const blob = await res.blob();
    const data: string = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
    const dims: { w: number; h: number } = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = reject;
      img.src = data;
    });
    return { data, ...dims };
  } catch {
    return null;
  }
}

/** Builds the claim printout: a summary page, then each receipt photo on its own page. */
export async function buildFuelClaimPDF(claim: FuelClaimForPDF, stationName: string): Promise<Blob> {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 48;

  // Header band
  doc.setFillColor(24, 24, 27);
  doc.rect(0, 0, W, 78, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(`${claim.expenseType === "EV Charging" ? "EV Charging" : "Fuel"} Reimbursement Claim`, M, 38);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`SYMX Logistics${stationName ? " · " + stationName : ""}`, M, 58);
  doc.setFont("helvetica", "bold");
  doc.text(claim.claimNumber, W - M, 38, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.text(`Printed ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`, W - M, 58, { align: "right" });

  // Details
  doc.setTextColor(30, 30, 30);
  let y = 112;
  const row = (label: string, value: string) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(110, 110, 115);
    doc.text(label.toUpperCase(), M, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(25, 25, 25);
    const lines = doc.splitTextToSize(value || "—", W - M * 2 - 150);
    doc.text(lines, M + 150, y);
    y += Math.max(20, lines.length * 14 + 6);
  };

  row("Date purchased", fmtDate(claim.date));
  row("Driver", claim.driverName + (claim.transporterId ? `  (${claim.transporterId})` : ""));
  row("Trip", claim.tripType + (claim.routeNumber ? ` · Route ${claim.routeNumber}` : ""));
  row("Type", claim.expenseType);
  row("Vendor / location", claim.vendor || "—");
  row("Amount on receipt", money(claim.amount));
  row("Paid with", claim.paidWith || "—");
  row("Driver repaid", REPAID_LABEL[claim.driverRepaid || ""] || "—");
  if (claim.notes) row("Notes", claim.notes);

  y += 6;
  doc.setDrawColor(220, 220, 225);
  doc.line(M, y, W - M, y);
  y += 24;

  // Amazon status block
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(25, 25, 25);
  doc.text("Amazon reimbursement", M, y);
  y += 22;
  row("Status", STATUS_LABEL[claim.status] || claim.status);
  if (claim.submittedDate) row("Submitted", fmtDate(claim.submittedDate));
  if (claim.amazonReference) row("Amazon reference", claim.amazonReference);
  if (claim.status === "approved") {
    row("Approved on", fmtDate(claim.decidedDate));
    row("Approved amount", money(claim.approvedAmount ?? claim.amount));
  }
  if (claim.status === "denied") {
    row("Denied on", fmtDate(claim.decidedDate));
    row("Reason", claim.denialReason || "—");
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(130, 130, 135);
  doc.text(`${claim.receipts.length} receipt photo${claim.receipts.length === 1 ? "" : "s"} attached on the following page${claim.receipts.length === 1 ? "" : "s"}.`, M, H - 40);

  // Receipt pages
  let n = 0;
  for (const url of claim.receipts) {
    n++;
    doc.addPage();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(60, 60, 65);
    doc.text(`${claim.claimNumber} · Receipt ${n} of ${claim.receipts.length}`, M, 36);
    const img = await loadImage(url);
    if (!img) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.text("This receipt image could not be loaded. Original link:", M, 70);
      doc.setFontSize(8);
      doc.text(doc.splitTextToSize(url, W - M * 2), M, 86);
      continue;
    }
    const maxW = W - M * 2;
    const maxH = H - 90 - M;
    const scale = Math.min(maxW / img.w, maxH / img.h, 1.5);
    const w = img.w * scale;
    const h = img.h * scale;
    doc.addImage(img.data, /^data:image\/png/i.test(img.data) ? "PNG" : /^data:image\/webp/i.test(img.data) ? "WEBP" : "JPEG", M + (maxW - w) / 2, 52, w, h, undefined, "FAST");
  }

  return doc.output("blob");
}
