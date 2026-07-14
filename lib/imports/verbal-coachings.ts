import { NextResponse } from "next/server";
import SymxEmployee from "@/lib/models/SymxEmployee";
import DropdownOption from "@/lib/models/DropdownOption";
import VerbalCoaching from "@/lib/models/VerbalCoaching";

const verbalCoachingHeaderMap: Record<string, string> = {
  "coaching date": "coachingDate",
  date: "coachingDate",
  "coached by": "coachedBy",
  coach: "coachedBy",
  "employee name": "employeeName",
  employee: "employeeName",
  "coaching type": "coachingType",
  category: "coachingType",
  "coaching status": "status",
  status: "status",
  "notes/details": "notes",
  notes: "notes",
  details: "notes",
  "disputable?": "disputableFlag",
  disputable: "disputableFlag",
  "dispute notes": "disputeNotes",
};

function normalizeStatus(raw: string): string {
  const key = (raw || "").trim().toLowerCase();
  if (key === "completed") return "completed";
  if (key === "unable to coach") return "unable_to_coach";
  if (key === "scheduled") return "scheduled"; // legacy historical value, kept distinct from "new"
  return "new"; // "New", blank, or unrecognized — treat as not-yet-done rather than assume completed
}

function truthy(v?: string): boolean {
  if (!v) return false;
  return ["yes", "true", "x", "checked", "y"].includes(v.trim().toLowerCase());
}

// Verbal coachings are the informal, high-volume precursor to formal
// Write-Ups (see lib/models/VerbalCoaching.ts) — this backfills the
// existing coaching log (AppSheet/Sheets export) as historical records.
// A single row can cover multiple categories ("Coaching Type" is often
// comma-separated), and the "Employee Name" column is inconsistently
// either a Transporter ID or a full name, so matching tries both.
export async function processVerbalCoachings(type: string, data: any[], _week: string | undefined) {
  if (type !== "verbal-coachings") return null;

  const ciMap: Record<string, string> = {};
  Object.entries(verbalCoachingHeaderMap).forEach(([k, v]) => { ciMap[k.toLowerCase()] = v; });

  // Pre-fetch all employees once — small enough table to match in memory,
  // and this data is too messy (ID or name, mixed casing) to bulk-query.
  const employees = await SymxEmployee.find({}, { _id: 1, transporterId: 1, firstName: 1, lastName: 1 }).lean();
  const byTransporterId = new Map<string, any>();
  const byFullName = new Map<string, any>();
  for (const emp of employees as any[]) {
    if (emp.transporterId) byTransporterId.set(emp.transporterId.trim().toUpperCase(), emp);
    const fullName = `${emp.firstName || ""} ${emp.lastName || ""}`.trim().toUpperCase();
    if (fullName) byFullName.set(fullName, emp);
  }

  function matchEmployee(raw: string): { id: any; transporterId: string; name: string } | null {
    const val = (raw || "").trim();
    if (!val) return null;
    const upper = val.toUpperCase();
    const byId = byTransporterId.get(upper);
    if (byId) return { id: byId._id, transporterId: byId.transporterId, name: `${byId.firstName} ${byId.lastName}`.trim() };
    const byName = byFullName.get(upper);
    if (byName) return { id: byName._id, transporterId: byName.transporterId || "", name: val };
    return null;
  }

  const existingCategories = await DropdownOption.find({ type: "metric" }, { description: 1 }).lean();
  const categoryMap = new Map(existingCategories.map((c: any) => [c.description.toLowerCase(), c.description]));

  let skippedNoEmployee = 0;
  let skippedUnmatchedEmployee = 0;
  const unmatchedNames = new Set<string>();
  const documents: any[] = [];
  const newCategoryNames = new Set<string>();

  for (const row of data) {
    const processed: any = {};
    Object.entries(row).forEach(([header, value]) => {
      const schemaKey = ciMap[header.trim().toLowerCase()];
      if (schemaKey && value !== undefined && value !== null && String(value).trim() !== "") {
        processed[schemaKey] = String(value).trim();
      }
    });

    const employeeRaw = processed.employeeName;
    if (!employeeRaw) { skippedNoEmployee++; continue; }

    const emp = matchEmployee(employeeRaw);
    if (!emp) { skippedUnmatchedEmployee++; unmatchedNames.add(employeeRaw); continue; }

    // Split "Coaching Type" on commas into individual categories, matching
    // (or auto-creating, same safety net as the Write-Ups import) each one.
    const typeNames = (processed.coachingType || "")
      .split(",")
      .map((s: string) => s.trim())
      .filter(Boolean);
    const categoryLabels: string[] = [];
    for (const name of typeNames) {
      const label = categoryMap.get(name.toLowerCase()) || name;
      if (!categoryMap.has(name.toLowerCase())) {
        newCategoryNames.add(label);
        categoryMap.set(name.toLowerCase(), label);
      }
      categoryLabels.push(label);
    }

    const coachingDate = processed.coachingDate ? new Date(processed.coachingDate) : new Date();
    const disputeNotes = processed.disputeNotes || "";
    const disputed = truthy(processed.disputableFlag) || !!disputeNotes;
    const status = normalizeStatus(processed.status || "");
    // For rows already resolved in the source data, back-fill the
    // completion trail from the same row rather than leaving it blank —
    // the coach and the coaching date ARE the completion record here.
    const isTerminal = status === "completed" || status === "unable_to_coach";

    documents.push({
      transporterId: emp.transporterId,
      employeeId: emp.id,
      employeeName: emp.name,
      _categoryLookupNames: categoryLabels, // resolved to categoryIds after bulk category creation below
      categoryLabels,
      coachingDate: !isNaN(coachingDate.getTime()) ? coachingDate : new Date(),
      coachedBy: processed.coachedBy || "",
      status,
      notes: processed.notes || "",
      disputed,
      disputeNotes,
      isHistorical: true,
      completedBy: isTerminal ? processed.coachedBy || "historical-import" : undefined,
      completedAt: isTerminal ? (!isNaN(coachingDate.getTime()) ? coachingDate : new Date()) : undefined,
      createdBy: "historical-import",
    });
  }

  if (newCategoryNames.size > 0) {
    await DropdownOption.insertMany(
      Array.from(newCategoryNames).map((description) => ({ description, type: "metric", isActive: true })),
      { ordered: false }
    ).catch(() => {});
  }

  const allCategories = await DropdownOption.find({ type: "metric" }, { _id: 1, description: 1 }).lean();
  const categoryIdMap = new Map(allCategories.map((c: any) => [c.description.toLowerCase(), c._id]));

  for (const doc of documents) {
    doc.categoryIds = doc._categoryLookupNames.map((name: string) => categoryIdMap.get(name.toLowerCase())).filter(Boolean);
    delete doc._categoryLookupNames;
  }

  if (documents.length > 0) {
    const result = await VerbalCoaching.insertMany(documents, { ordered: false });
    return NextResponse.json({
      success: true,
      count: result.length,
      inserted: result.length,
      updated: 0,
      matched: documents.length,
      skipped: skippedNoEmployee + skippedUnmatchedEmployee,
      skippedNoEmployee,
      skippedUnmatchedEmployee,
      unmatchedNames: Array.from(unmatchedNames).slice(0, 25),
    });
  }

  return NextResponse.json({
    success: true,
    count: 0,
    inserted: 0,
    updated: 0,
    skipped: skippedNoEmployee + skippedUnmatchedEmployee,
    unmatchedNames: Array.from(unmatchedNames).slice(0, 25),
  });
}
