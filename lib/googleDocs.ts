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

  // ── 2b. Query past records for same employee + same metric ──
  const pastRecords: { type: string; incidentDate: string }[] = [];
  if ((record as any).employeeId && (record as any).metric) {
    const pastDocs = await SYMXCoachingWriteUp.find({
      _id: { $ne: (record as any)._id },
      employeeId: (record as any).employeeId,
      metric: (record as any).metric,
    })
      .sort({ incidentDate: -1 })
      .select({ type: 1, incidentDate: 1 })
      .lean();
    for (const p of pastDocs) {
      pastRecords.push({
        type: (p as any).type || "",
        incidentDate: formatDateStr((p as any).incidentDate),
      });
    }
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
    "{{DAMishandledPackage}}": r.DAMishandledPackage ? `DA Mishandled Package: "${r.DAMishandledPackage}"` : "",
    "{{DAWasUnprofessional}}": r.DAWasUnprofessional ? `DA was Unprofessional: "${r.DAWasUnprofessional}"` : "",
    "{{DADidNotFollowMyDeliveryInstructions}}": r.DADidNotFollowMyDeliveryInstructions ? `DA did not follow my delivery instructions: "${r.DADidNotFollowMyDeliveryInstructions}"` : "",
    "{{deliveredToWrongAddress}}": r.deliveredToWrongAddress ? `Delivered to Wrong Address: "${r.deliveredToWrongAddress}"` : "",
    "{{neverReceivedDelivery}}": r.neverReceivedDelivery ? `Never Received Delivery: "${r.neverReceivedDelivery}"` : "",
    "{{receivedWrongItem}}": r.receivedWrongItem ? `Received Wrong Item: "${r.receivedWrongItem}"` : "",
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

    // ── 6a. Replace {{pastRecords}} with a dynamic table ──
    {
      const prDoc = await docs.documents.get({ documentId: tempDocId });
      const prBody = prDoc.data.body?.content || [];

      // Find {{pastRecords}} placeholder position
      let prIndex = -1;
      let prEndIndex = -1;
      const placeholder = "{{pastRecords}}";
      for (const block of prBody) {
        if (block.paragraph?.elements) {
          for (const el of block.paragraph.elements) {
            if (el.textRun?.content && el.startIndex != null && el.endIndex != null) {
              const idx = el.textRun.content.indexOf(placeholder);
              if (idx !== -1) {
                prIndex = el.startIndex + idx;
                prEndIndex = prIndex + placeholder.length;
              }
            }
          }
        }
      }

      if (prIndex !== -1) {
        if (pastRecords.length === 0) {
          // No past records — just remove the placeholder and its paragraph
          // Find the paragraph boundaries to remove the whole line
          let paraStart = prIndex;
          let paraEnd = prEndIndex;
          for (const block of prBody) {
            if (block.paragraph?.elements && block.startIndex != null && block.endIndex != null) {
              if (block.startIndex <= prIndex && block.endIndex! >= prEndIndex) {
                paraStart = block.startIndex;
                paraEnd = block.endIndex!;
                break;
              }
            }
          }
          await docs.documents.batchUpdate({
            documentId: tempDocId,
            requestBody: {
              requests: [{ deleteContentRange: { range: { startIndex: paraStart, endIndex: paraEnd } } }],
            },
          });
        } else {
          // Delete the placeholder text first
          await docs.documents.batchUpdate({
            documentId: tempDocId,
            requestBody: {
              requests: [{ deleteContentRange: { range: { startIndex: prIndex, endIndex: prEndIndex } } }],
            },
          });

          // Insert a table at the placeholder position
          const numRows = pastRecords.length + 1; // +1 for header
          await docs.documents.batchUpdate({
            documentId: tempDocId,
            requestBody: {
              requests: [{
                insertTable: {
                  rows: numRows,
                  columns: 2,
                  location: { index: prIndex },
                },
              }],
            },
          });

          // Read the doc again to get the table cell indices
          const tableDoc = await docs.documents.get({ documentId: tempDocId });
          const tableBody = tableDoc.data.body?.content || [];

          // Find the table we just inserted (should be near prIndex)
          let table: any = null;
          let tableStartIndex = -1;
          for (const block of tableBody) {
            if (block.table && block.startIndex != null && block.startIndex >= prIndex - 2) {
              table = block.table;
              tableStartIndex = block.startIndex;
              break;
            }
          }

          if (table) {
            // Set narrow column widths: Type=100pt, Incident Date=120pt
            await docs.documents.batchUpdate({
              documentId: tempDocId,
              requestBody: {
                requests: [
                  {
                    updateTableColumnProperties: {
                      tableStartLocation: { index: tableStartIndex },
                      columnIndices: [0],
                      tableColumnProperties: { widthType: "FIXED_WIDTH", width: { magnitude: 100, unit: "PT" } },
                      fields: "widthType,width",
                    },
                  },
                  {
                    updateTableColumnProperties: {
                      tableStartLocation: { index: tableStartIndex },
                      columnIndices: [1],
                      tableColumnProperties: { widthType: "FIXED_WIDTH", width: { magnitude: 120, unit: "PT" } },
                      fields: "widthType,width",
                    },
                  },
                ],
              },
            });

            // Re-read the doc to get updated cell indices after column resize
            const tableDoc2 = await docs.documents.get({ documentId: tempDocId });
            const tableBody2 = tableDoc2.data.body?.content || [];
            let table2: any = null;
            for (const block of tableBody2) {
              if (block.table && block.startIndex != null && block.startIndex >= prIndex - 2) {
                table2 = block.table;
                break;
              }
            }
            if (table2) table = table2;

            // Build data: header + rows
            const data = [["Type", "Incident Date"], ...pastRecords.map(pr => [pr.type, pr.incidentDate])];
            const insertRequests: any[] = [];

            // Process rows bottom-to-top to avoid index shifting
            for (let rowIdx = data.length - 1; rowIdx >= 0; rowIdx--) {
              for (let colIdx = 1; colIdx >= 0; colIdx--) {
                const cell = table.tableRows?.[rowIdx]?.tableCells?.[colIdx];
                if (cell?.content?.[0]?.paragraph?.elements?.[0]?.startIndex != null) {
                  const cellIndex = cell.content[0].paragraph.elements[0].startIndex;
                  insertRequests.push({
                    insertText: {
                      location: { index: cellIndex },
                      text: data[rowIdx][colIdx],
                    },
                  });
                }
              }
            }

            if (insertRequests.length > 0) {
              await docs.documents.batchUpdate({
                documentId: tempDocId,
                requestBody: { requests: insertRequests },
              });
            }

            // Now style: bold headers, un-bold data rows
            // Re-read doc to get correct indices after text insertion
            const styledDoc = await docs.documents.get({ documentId: tempDocId });
            const styledBody = styledDoc.data.body?.content || [];
            let styledTable: any = null;
            for (const block of styledBody) {
              if (block.table && block.startIndex != null && block.startIndex >= prIndex - 2) {
                styledTable = block.table;
                break;
              }
            }

            if (styledTable) {
              const styleRequests: any[] = [];
              for (let rowIdx = 0; rowIdx < styledTable.tableRows.length; rowIdx++) {
                const row = styledTable.tableRows[rowIdx];
                const isBold = rowIdx === 0; // only header row
                for (const cell of row.tableCells || []) {
                  for (const content of cell.content || []) {
                    if (content.paragraph?.elements) {
                      for (const el of content.paragraph.elements) {
                        if (el.startIndex != null && el.endIndex != null && el.endIndex > el.startIndex) {
                          styleRequests.push({
                            updateTextStyle: {
                              range: { startIndex: el.startIndex, endIndex: el.endIndex },
                              textStyle: { bold: isBold, fontSize: { magnitude: 9, unit: "PT" } },
                              fields: "bold,fontSize",
                            },
                          });
                        }
                      }
                    }
                  }
                }
              }
              if (styleRequests.length > 0) {
                await docs.documents.batchUpdate({
                  documentId: tempDocId,
                  requestBody: { requests: styleRequests },
                });
              }
            }
          }
        }
      }
    }

    // ── 6b. Process conditional blocks: <<If: {{field}}="value">> ... <<EndIf>> ──
    {
      const condDoc = await docs.documents.get({ documentId: tempDocId });
      const condBody = condDoc.data.body?.content || [];

      // Concatenate all text with character indices
      let fullText = "";
      const indexMap: { docIndex: number; textIndex: number }[] = [];
      for (const block of condBody) {
        if (block.paragraph?.elements) {
          for (const el of block.paragraph.elements) {
            if (el.textRun?.content && el.startIndex != null) {
              const startTextIdx = fullText.length;
              fullText += el.textRun.content;
              indexMap.push({ docIndex: el.startIndex, textIndex: startTextIdx });
            }
          }
        }
      }

      // Helper: convert text offset to doc character index
      const toDocIndex = (textOffset: number): number => {
        let last = indexMap[0];
        for (const m of indexMap) {
          if (m.textIndex > textOffset) break;
          last = m;
        }
        return last.docIndex + (textOffset - last.textIndex);
      };

      // Find all <<If: ...>> ... <<EndIf>> blocks
      const ifRegex = /<<If:\s*(.+?)\s*>>/g;
      const endIfStr = "<<EndIf>>";
      type CondBlock = { ifStart: number; ifEnd: number; endIfStart: number; endIfEnd: number; conditionMet: boolean };
      const blocks: CondBlock[] = [];

      let match;
      while ((match = ifRegex.exec(fullText)) !== null) {
        const ifTextStart = match.index;
        const ifTextEnd = match.index + match[0].length;
        const conditionExpr = match[1].trim(); // e.g. {{metricName}}="Customer Delivery Feedback"

        // Find matching <<EndIf>>
        const endIdx = fullText.indexOf(endIfStr, ifTextEnd);
        if (endIdx === -1) continue; // no matching EndIf, skip

        // Evaluate condition: supports {{field}}="value" or already-replaced actualValue="value"
        let conditionMet = false;
        const eqMatch = conditionExpr.match(/^\{\{(.+?)\}\}\s*(!?=)\s*"(.+?)"$/);
        if (eqMatch) {
          // Case 1: {{field}}="value" — look up in replacements map
          const fieldName = `{{${eqMatch[1]}}}`;
          const operator = eqMatch[2];
          const expectedValue = eqMatch[3];
          const actualValue = replacements[fieldName] || "";
          conditionMet = operator === "=" ? actualValue === expectedValue : actualValue !== expectedValue;
        } else {
          // Case 2: already-replaced value — e.g. Customer Delivery Feedback="Customer Delivery Feedback"
          const directMatch = conditionExpr.match(/^(.+?)\s*(!?=)\s*"(.+?)"$/);
          if (directMatch) {
            const actualValue = directMatch[1].trim();
            const operator = directMatch[2];
            const expectedValue = directMatch[3];
            conditionMet = operator === "=" ? actualValue === expectedValue : actualValue !== expectedValue;
          }
        }

        blocks.push({
          // Expand ranges to include surrounding newlines to avoid leftover blank lines
          ifStart: toDocIndex(
            // eat newline before <<If>> if present
            ifTextStart > 0 && fullText[ifTextStart - 1] === "\n" ? ifTextStart - 1 : ifTextStart
          ),
          ifEnd: toDocIndex(
            // eat newline after <<If:...>> marker
            ifTextEnd < fullText.length && fullText[ifTextEnd] === "\n" ? ifTextEnd + 1 : ifTextEnd
          ),
          endIfStart: toDocIndex(
            // eat newline before <<EndIf>>
            endIdx > 0 && fullText[endIdx - 1] === "\n" ? endIdx - 1 : endIdx
          ),
          endIfEnd: toDocIndex(
            // eat newline after <<EndIf>>
            endIdx + endIfStr.length < fullText.length && fullText[endIdx + endIfStr.length] === "\n"
              ? endIdx + endIfStr.length + 1
              : endIdx + endIfStr.length
          ),
          conditionMet,
        });
      }

      // Process blocks bottom-to-top to preserve indices
      if (blocks.length > 0) {
        const deleteRequests: any[] = [];
        for (const b of blocks.reverse()) {
          if (!b.conditionMet) {
            // Delete the entire block (from <<If>> start to <<EndIf>> end)
            deleteRequests.push({
              deleteContentRange: { range: { startIndex: b.ifStart, endIndex: b.endIfEnd } },
            });
          } else {
            // Keep content, delete only the markers
            // Delete <<EndIf>> first (higher index)
            deleteRequests.push({
              deleteContentRange: { range: { startIndex: b.endIfStart, endIndex: b.endIfEnd } },
            });
            // Delete <<If: ...>>
            deleteRequests.push({
              deleteContentRange: { range: { startIndex: b.ifStart, endIndex: b.ifEnd } },
            });
          }
        }
        await docs.documents.batchUpdate({
          documentId: tempDocId,
          requestBody: { requests: deleteRequests },
        });
      }
    }

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
