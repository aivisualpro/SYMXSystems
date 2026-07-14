import jsPDF from "jspdf";
import fs from "fs";
import path from "path";
import { WARNING_LEVELS, WARNING_LEVEL_LABELS } from "@/lib/writeup-logic";

// Server-side PDF generator matching the real "Employee Coaching" paper
// form used at SYMX today (Employee Information / Coaching Type / Area of
// Focus / Details / Acknowledgment of Receipt of Coaching), extended with
// the new warning-level ladder and prior-write-up dates.

export interface CoachingPdfInput {
  employeeName: string;
  managerName: string;
  jobTitle?: string;
  incidentDate: Date | string;
  warningLevel: string;
  categoryLabel: string;
  allCategories: string[]; // full active category list, for the checkbox grid
  description?: string;
  planForImprovement?: string;
  consequences?: string;
  priorDates?: { date: Date | string; warningLevel: string }[];
  priorVerbalCoachingDates?: (Date | string)[]; // "prior discussion or warnings ... (oral)" — reference only
  managerSignature?: { name: string; signatureImage: string; signedAt: Date | string };
  employeeSignature?: { name: string; signatureImage: string; signedAt: Date | string };
  refusal?: { refused: boolean; note?: string; witnessName?: string; witnessSignatureImage?: string; refusedAt?: Date | string };
}

function fmtDate(d?: Date | string): string {
  if (!d) return "";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "";
  return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
}

function getLogoDataUrl(): string | null {
  try {
    const logoPath = path.join(process.cwd(), "public", "sidebar-icon.png");
    const buf = fs.readFileSync(logoPath);
    return `data:image/png;base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

const MARGIN = 40;

function sectionHeader(doc: jsPDF, y: number, pageW: number, label: string): number {
  doc.setFillColor(20, 20, 20);
  doc.rect(MARGIN, y, pageW - MARGIN * 2, 16, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(label.toUpperCase(), MARGIN + 6, y + 11);
  doc.setTextColor(0, 0, 0);
  return y + 16;
}

function checkbox(doc: jsPDF, x: number, y: number, checked: boolean) {
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.6);
  doc.rect(x, y - 7, 7, 7);
  if (checked) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("X", x + 1.2, y - 1.2);
  }
}

export function generateCoachingPdfBuffer(input: CoachingPdfInput): Buffer {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter" });
  renderCoachingPage(doc, input);
  return Buffer.from(doc.output("arraybuffer"));
}

// Renders one Employee Coaching form onto the current page of an existing
// jsPDF document. Used both for the single-writeup PDF and for combining
// several write-ups into one downloadable file (one form per page).
function renderCoachingPage(doc: jsPDF, input: CoachingPdfInput): void {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const contentW = pageW - MARGIN * 2;

  let y = 36;

  // ── Header ──
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.text("Employee Coaching", MARGIN, y);

  const logo = getLogoDataUrl();
  const logoSize = 16;
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  const symxW = doc.getTextWidth("SYMX ");
  doc.setFont("helvetica", "bolditalic");
  const logisticsW = doc.getTextWidth("Logistics");
  const titleW = logoSize + 5 + symxW + logisticsW;
  const titleX = pageW - MARGIN - titleW;
  if (logo) doc.addImage(logo, "PNG", titleX, y - logoSize + 3, logoSize, logoSize);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("SYMX ", titleX + logoSize + 5, y);
  doc.setFont("helvetica", "bolditalic");
  doc.text("Logistics", titleX + logoSize + 5 + symxW, y);

  y += 16;

  // ── Employee Information ──
  y = sectionHeader(doc, y, pageW, "Employee Information");
  const infoBoxH = 34;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  doc.rect(MARGIN, y, contentW, infoBoxH);
  doc.line(MARGIN, y + infoBoxH / 2, MARGIN + contentW, y + infoBoxH / 2);
  doc.line(MARGIN + contentW * 0.62, y, MARGIN + contentW * 0.62, y + infoBoxH);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Employee Name:  ${input.employeeName}`, MARGIN + 6, y + 14);
  doc.text(`Date:  ${fmtDate(input.incidentDate)}`, MARGIN + contentW * 0.62 + 6, y + 14);
  doc.text(`Manager:  ${input.managerName}`, MARGIN + 6, y + infoBoxH / 2 + 14);
  doc.text(`Job Title:  ${input.jobTitle || "Delivery Associate"}`, MARGIN + contentW * 0.62 + 6, y + infoBoxH / 2 + 14);
  y += infoBoxH + 10;

  // ── Coaching Type (warning ladder) ──
  y = sectionHeader(doc, y, pageW, "Coaching Type");
  y += 16;
  const levelColW = contentW / WARNING_LEVELS.length;
  WARNING_LEVELS.forEach((lvl, i) => {
    const cx = MARGIN + i * levelColW;
    checkbox(doc, cx, y, lvl === input.warningLevel);
    doc.setFont("helvetica", input.warningLevel === lvl ? "bold" : "normal");
    doc.setFontSize(7.5);
    const label = WARNING_LEVEL_LABELS[lvl];
    doc.text(label, cx + 10, y - 1, { maxWidth: levelColW - 12 });
  });
  y += 14;

  // ── Area of Focus ──
  y = sectionHeader(doc, y, pageW, "Area of Focus");
  y += 16;
  const categories = input.allCategories.length > 0 ? input.allCategories : [input.categoryLabel];
  const colCount = 3;
  const colW = contentW / colCount;
  categories.forEach((cat, i) => {
    const col = i % colCount;
    const row = Math.floor(i / colCount);
    const cx = MARGIN + col * colW;
    const cy = y + row * 14;
    checkbox(doc, cx, cy, cat.toLowerCase() === input.categoryLabel.toLowerCase());
    doc.setFont("helvetica", cat.toLowerCase() === input.categoryLabel.toLowerCase() ? "bold" : "normal");
    doc.setFontSize(8);
    doc.text(cat, cx + 10, cy - 1, { maxWidth: colW - 12 });
  });
  const rowCount = Math.ceil(categories.length / colCount);
  y += rowCount * 14 + 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("Other: ___________________________________", MARGIN, y);
  y += 12;

  // ── Details ──
  y = sectionHeader(doc, y, pageW, "Details");
  y += 14;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text("Description:", MARGIN, y);
  y += 11;
  doc.setFont("helvetica", "normal");
  let descText = input.description || "";
  if (input.priorDates && input.priorDates.length > 0) {
    const dateList = input.priorDates
      .map((p) => `${fmtDate(p.date)} (${WARNING_LEVEL_LABELS[p.warningLevel] || p.warningLevel})`)
      .join("; ");
    descText += `\n\nPrevious ${input.categoryLabel} write-ups on file: ${dateList}`;
  }
  if (input.priorVerbalCoachingDates && input.priorVerbalCoachingDates.length > 0) {
    const dateList = input.priorVerbalCoachingDates.map((d) => fmtDate(d)).join("; ");
    descText += `\n\nPrior verbal coaching on this subject: ${dateList}`;
  }
  const descLines = doc.splitTextToSize(descText, contentW - 4);
  doc.text(descLines, MARGIN, y);
  y += descLines.length * 10 + 8;

  doc.setFont("helvetica", "bold");
  doc.text("Plan for Improvement:", MARGIN, y);
  y += 11;
  doc.setFont("helvetica", "normal");
  const planLines = doc.splitTextToSize(input.planForImprovement || "", contentW - 4);
  doc.text(planLines, MARGIN, y);
  y += planLines.length * 10 + 8;

  doc.setFont("helvetica", "bold");
  doc.text("Consequences:", MARGIN, y);
  y += 11;
  doc.setFont("helvetica", "normal");
  const consLines = doc.splitTextToSize(input.consequences || "", contentW - 4);
  doc.text(consLines, MARGIN, y);
  y += consLines.length * 10 + 10;

  // Page break guard before acknowledgment/signature block
  if (y > pageH - 140) {
    doc.addPage();
    y = 40;
  }

  // ── Acknowledgment ──
  y = sectionHeader(doc, y, pageW, "Acknowledgment of Receipt of Coaching");
  y += 12;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  const ackText =
    "By signing this form, you confirm that you understand the information in this Coaching Form. You also confirm that you and your " +
    "manager have discussed the coaching and a plan for improvement. Signing this form does not necessarily indicate that you agree with this Coaching.";
  const ackLines = doc.splitTextToSize(ackText, contentW);
  doc.text(ackLines, MARGIN, y);
  y += ackLines.length * 9 + 10;

  const sigRowH = 30;
  const sigLabelW = contentW * 0.6;

  function signatureRow(label: string, name: string, sigImage: string | undefined, dateStr: string) {
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.5);
    doc.line(MARGIN, y, MARGIN + sigLabelW, y);
    doc.line(MARGIN + sigLabelW + 10, y, MARGIN + contentW, y);
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.text(label, MARGIN, y + 9);
    doc.text("Date", MARGIN + sigLabelW + 10, y + 9);
    if (sigImage) {
      try {
        doc.addImage(sigImage, "PNG", MARGIN + 2, y - sigRowH + 6, 110, sigRowH - 12);
      } catch {
        // Bad image data — leave blank rather than fail the whole PDF
      }
    } else if (name) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(11);
      doc.text(name, MARGIN + 4, y - 4);
    }
    if (dateStr) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(dateStr, MARGIN + sigLabelW + 12, y - 4);
    }
    y += sigRowH;
  }

  y += sigRowH;
  if (input.refusal?.refused) {
    signatureRow("Employee Signature", "REFUSED TO SIGN", undefined, fmtDate(input.refusal.refusedAt));
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    const noteLines = doc.splitTextToSize(`Refusal note: ${input.refusal.note || ""}`, contentW);
    doc.text(noteLines, MARGIN, y - sigRowH + 22);
  } else {
    signatureRow(
      "Employee Signature",
      input.employeeSignature?.name || "",
      input.employeeSignature?.signatureImage,
      fmtDate(input.employeeSignature?.signedAt)
    );
  }
  signatureRow(
    "Manager Signature",
    input.managerSignature?.name || input.managerName,
    input.managerSignature?.signatureImage,
    fmtDate(input.managerSignature?.signedAt)
  );
  signatureRow(
    "Witness Signature (if employee refuses to sign)",
    input.refusal?.witnessName || "",
    input.refusal?.witnessSignatureImage,
    input.refusal?.refused ? fmtDate(input.refusal.refusedAt) : ""
  );
}

// Combines several write-ups into a single downloadable PDF — one
// Employee Coaching form per page, in the order given.
export function generateCombinedCoachingPdfBuffer(inputs: CoachingPdfInput[]): Buffer {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter" });
  inputs.forEach((input, i) => {
    if (i > 0) doc.addPage();
    renderCoachingPage(doc, input);
  });
  return Buffer.from(doc.output("arraybuffer"));
}
