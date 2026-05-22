import { google } from "googleapis";
import connectToDatabase from "@/lib/db";
import SYMXCoachingWriteUp from "@/lib/models/SYMXCoachingWriteUp";
import SymxEmployee from "@/lib/models/SymxEmployee";
import DropdownOption from "@/lib/models/DropdownOption";
import fs from "fs";
import path from "path";


// ── Google Auth ──
function getGoogleAuth() {
  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!keyJson) throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY env var not set");

  let credentials: any;

  // Try raw JSON first
  try {
    credentials = JSON.parse(keyJson);
  } catch {
    // Base64 encoded — decode, trim trailing whitespace, escape real newlines
    const decoded = Buffer.from(keyJson, "base64").toString("utf-8").trim();
    try {
      credentials = JSON.parse(decoded);
    } catch {
      // The private_key field contains literal newline chars that break JSON.parse.
      // Escape them to the JSON \\n sequence, then parse.
      const escaped = decoded.replace(/\r/g, "").replace(/\n/g, "\\n");
      credentials = JSON.parse(escaped);
    }
  }

  // Ensure private_key has real newlines (required by Google Auth library)
  if (credentials.private_key) {
    credentials.private_key = credentials.private_key.replace(/\\n/g, "\n");
  }

  return new google.auth.GoogleAuth({
    credentials,
    scopes: [
      "https://www.googleapis.com/auth/documents",
      "https://www.googleapis.com/auth/drive",
    ],
  });
}

function formatDateStr(d?: string | Date): string {
  if (!d) return "";
  try {
    const date = new Date(d);
    return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
  } catch {
    return String(d);
  }
}

/**
 * Generate a PDF from the coaching writeup Google Doc template,
 * upload to Cloudinary, and update the record's unSignedPdf field.
 */
export async function generateCoachingPdf(recordId: string): Promise<string> {
  const templateDocId = process.env.COACHING_TEMPLATE_DOC_ID;
  if (!templateDocId) throw new Error("COACHING_TEMPLATE_DOC_ID env var not set");

  await connectToDatabase();

  // ── 1. Load the record ──
  const record = await SYMXCoachingWriteUp.findById(recordId).lean();
  if (!record) throw new Error(`Coaching writeup ${recordId} not found`);

  // ── 2. Resolve names ──
  let employeeName = "";
  if ((record as any).employeeId) {
    const emp = await SymxEmployee.findById((record as any).employeeId, { firstName: 1, lastName: 1 }).lean();
    if (emp) employeeName = `${(emp as any).firstName || ""} ${(emp as any).lastName || ""}`.trim();
  }

  let supervisorName = "";
  if ((record as any).supervisor) {
    const sup = await SymxEmployee.findById((record as any).supervisor, { firstName: 1, lastName: 1 }).lean();
    if (sup) supervisorName = `${(sup as any).firstName || ""} ${(sup as any).lastName || ""}`.trim();
  }

  let metricName = "";
  if ((record as any).metric) {
    const met = await DropdownOption.findById((record as any).metric, { description: 1 }).lean();
    if (met) metricName = (met as any).description || "";
  }

  // ── 3. Build replacement map ──
  const r: any = record;

  // File button labels — replace placeholder with display text; hyperlinks applied separately below
  const files: { name: string; url: string }[] = r.files || [];
  const fileLabel = (i: number) => `File ${i + 1} 📎`;
  const file1Label = files[0] ? fileLabel(0) : "";
  const allFilesLabel = files.map((_, i) => fileLabel(i)).join("  ");

  const replacements: Record<string, string> = {
    "{{employeeName}}": employeeName,
    "{{supervisorName}}": supervisorName,
    "{{incidentDate}}": formatDateStr(r.incidentDate),
    "{{incidentWeek}}": r.incidentWeek || "",
    "{{durationOfIncident}}": r.durationOfIncident || "",
    "{{type}}": r.type || "",
    "{{metricName}}": metricName,
    "{{metricValue}}": r.metricValue || "",
    "{{goal}}": r.goal || "",
    "{{correctiveActionNumber}}": r.correctiveActionNumber || "",
    "{{metricNoticeNumber}}": r.metricNoticeNumber || "",
    "{{correctiveAction}}": r.correctiveAction || "",
    "{{improvedByDate}}": formatDateStr(r.improvedByDate),
    "{{seatbeltOffRate}}": r.seatbeltOffRate || "",
    "{{speedingEventRate}}": r.speedingEventRate || "",
    "{{distractionsRate}}": r.distractionsRate || "",
    "{{signSignalViolationsRate}}": r.signSignalViolationsRate || "",
    "{{followingDistanceRate}}": r.followingDistanceRate || "",
    "{{DAMishandledPackage}}": r.DAMishandledPackage || "",
    "{{DAWasUnprofessional}}": r.DAWasUnprofessional || "",
    "{{DADidNotFollowMyDeliveryInstructions}}": r.DADidNotFollowMyDeliveryInstructions || "",
    "{{deliveredToWrongAddress}}": r.deliveredToWrongAddress || "",
    "{{neverReceivedDelivery}}": r.neverReceivedDelivery || "",
    "{{receivedWrongItem}}": r.receivedWrongItem || "",
    "{{totalNegativeFeedbacks}}": r.totalNegativeFeedbacks || "",
    "{{priorDiscussionOrWarningsOnThisSubject}}": r.priorDiscussionOrWarningsOnThisSubject || "",
    // Files — insert display labels; hyperlinks applied after
    "{{file1Url}}": file1Label,
    "{{allFileUrls}}": allFilesLabel,
  };

  // ── 4. Google API clients ──
  const auth = getGoogleAuth();
  const docs = google.docs({ version: "v1", auth });
  const drive = google.drive({ version: "v3", auth });

  // ── 5. Copy the template ──
  const copyRes = await drive.files.copy({
    fileId: templateDocId,
    supportsAllDrives: true,       // required for Shared Drive files
    requestBody: {
      name: `Coaching-${employeeName || recordId}-${Date.now()}`,
    },
  });
  const tempDocId = copyRes.data.id!;

  try {
    // ── 6. Replace placeholders ──
    const requests = Object.entries(replacements).map(([placeholder, value]) => ({
      replaceAllText: {
        containsText: { text: placeholder, matchCase: true },
        replaceText: value,
      },
    }));

    await docs.documents.batchUpdate({
      documentId: tempDocId,
      requestBody: { requests },
    });

    // ── 7. Apply hyperlinks to file button labels ──
    // The Docs API requires character index ranges to apply links,
    // so we read back the doc and search for each label text.
    if (files.length > 0) {
      const docContent = await docs.documents.get({ documentId: tempDocId });
      const body = docContent.data.body?.content || [];

      // Flatten all paragraph elements into a list of { text, startIndex, endIndex }
      const segments: { text: string; start: number; end: number }[] = [];
      for (const block of body) {
        if (block.paragraph?.elements) {
          for (const el of block.paragraph.elements) {
            if (el.textRun?.content && el.startIndex != null && el.endIndex != null) {
              segments.push({ text: el.textRun.content, start: el.startIndex, end: el.endIndex });
            }
          }
        }
      }

      // Build hyperlink requests for each file label found in the doc
      const linkRequests: any[] = [];
      for (let fi = 0; fi < files.length; fi++) {
        const file = files[fi];
        const label = fileLabel(fi);
        const absoluteUrl = file.url.startsWith("http") ? file.url : `${process.env.NEXTAUTH_URL || ""}${file.url}`;
        for (const seg of segments) {
          const idx = seg.text.indexOf(label);
          if (idx !== -1) {
            linkRequests.push({
              updateTextStyle: {
                range: {
                  startIndex: seg.start + idx,
                  endIndex: seg.start + idx + label.length,
                },
                textStyle: {
                  link: { url: absoluteUrl },
                  foregroundColor: { color: { rgbColor: { red: 0.067, green: 0.42, blue: 0.82 } } },
                  underline: true,
                  bold: false,
                },
                fields: "link,foregroundColor,underline,bold",
              },
            });
            break; // only link first occurrence per file
          }
        }
      }

      if (linkRequests.length > 0) {
        await docs.documents.batchUpdate({
          documentId: tempDocId,
          requestBody: { requests: linkRequests },
        });
      }
    }


    // ── 8. Export as PDF ──
    const pdfRes = await drive.files.export(
      { fileId: tempDocId, mimeType: "application/pdf" },
      { responseType: "arraybuffer" }
    );
    const pdfBuffer = Buffer.from(pdfRes.data as ArrayBuffer);

    // ── 8. Save PDF to public/pdfs/ (served as static file, no auth issues) ──
    const pdfsDir = path.join(process.cwd(), "public", "pdfs");
    fs.mkdirSync(pdfsDir, { recursive: true });
    const fileName = `coaching-${recordId}-${Date.now()}.pdf`;
    fs.writeFileSync(path.join(pdfsDir, fileName), pdfBuffer);
    const pdfUrl = `/pdfs/${fileName}`;

    // ── 9. Update record with PDF URL ──
    await SYMXCoachingWriteUp.findByIdAndUpdate(recordId, {
      $set: { unSignedPdf: pdfUrl },
    });

    return pdfUrl;
  } finally {
    // ── 10. Delete temp doc ──
    try {
      await drive.files.delete({ fileId: tempDocId, supportsAllDrives: true });
    } catch (e) {
      console.warn("Failed to delete temp Google Doc:", e);
    }
  }
}
