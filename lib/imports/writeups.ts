import { NextResponse } from "next/server";
import SymxEmployee from "@/lib/models/SymxEmployee";
import DropdownOption from "@/lib/models/DropdownOption";
import Writeup from "@/lib/models/Writeup";

const writeupsHeaderMap: Record<string, string> = {
  "transporter id": "transporterId",
  transporterid: "transporterId",
  "employee name": "employeeName",
  category: "category",
  "area of focus": "category",
  "incident date": "incidentDate",
  date: "incidentDate",
  "warning level": "warningLevel",
  "coaching type": "warningLevel",
  description: "description",
  "plan for improvement": "planForImprovement",
  consequences: "consequences",
  manager: "managerName",
  "manager name": "managerName",
  status: "status",
};

const WARNING_LEVEL_ALIASES: Record<string, string> = {
  first: "first_warning",
  "first warning": "first_warning",
  "first coaching": "first_warning",
  second: "second_warning",
  "second warning": "second_warning",
  "second coaching": "second_warning",
  third: "third_warning",
  "third warning": "third_warning",
  "third coaching": "third_warning",
  final: "final_warning",
  "final warning": "final_warning",
  "final coaching": "final_warning",
  suspension: "suspension_review",
  "suspension review": "suspension_review",
};

function normalizeWarningLevel(raw: string): string {
  const key = (raw || "").trim().toLowerCase();
  return WARNING_LEVEL_ALIASES[key] || "first_warning";
}

// Historical write-ups being backfilled from paper records. Marked
// isHistorical:true and status defaults to "signed" (they were already
// signed on paper) so they count toward future escalation math the same
// as any other closed write-up.
export async function processWriteups(type: string, data: any[], _week: string | undefined) {
  if (type !== "writeups") return null;

  const transporterIds = data
    .map((row: any) => (row["Transporter ID"] || row["transporterId"] || "").toString().trim())
    .filter((id: string) => id);

  const employees = await SymxEmployee.find(
    { transporterId: { $in: transporterIds } },
    { _id: 1, transporterId: 1, firstName: 1, lastName: 1 }
  ).lean();
  const employeeMap = new Map<string, { id: any; name: string }>(
    employees.map((emp: any) => [emp.transporterId, { id: emp._id, name: `${emp.firstName || ""} ${emp.lastName || ""}`.trim() }])
  );

  const existingCategories = await DropdownOption.find({ type: "metric" }, { description: 1 }).lean();
  const categoryMap = new Map(existingCategories.map((c: any) => [c.description.toLowerCase(), c.description]));

  const ciMap: Record<string, string> = {};
  Object.entries(writeupsHeaderMap).forEach(([k, v]) => { ciMap[k.toLowerCase()] = v; });

  let skipped = 0;
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

    const transporterId = processed.transporterId;
    const emp = transporterId ? employeeMap.get(transporterId) : undefined;
    if (!emp) { skipped++; continue; }
    if (!processed.category) { skipped++; continue; }

    const categoryLabel = categoryMap.get(processed.category.toLowerCase()) || processed.category;
    if (!categoryMap.has(processed.category.toLowerCase())) {
      newCategoryNames.add(categoryLabel);
      categoryMap.set(processed.category.toLowerCase(), categoryLabel); // avoid duplicate creates within this batch
    }

    const incidentDate = processed.incidentDate ? new Date(processed.incidentDate) : null;

    documents.push({
      transporterId,
      employeeId: emp.id,
      employeeName: processed.employeeName || emp.name,
      categoryLabel,
      _categoryLookupName: categoryLabel, // resolved to categoryId after bulk category creation below
      warningLevel: normalizeWarningLevel(processed.warningLevel || ""),
      warningLevelAuto: normalizeWarningLevel(processed.warningLevel || ""),
      incidentDate: incidentDate && !isNaN(incidentDate.getTime()) ? incidentDate : new Date(),
      description: processed.description || "",
      planForImprovement: processed.planForImprovement || "",
      consequences: processed.consequences || "",
      managerName: processed.managerName || "",
      status: ["signed", "refused_to_sign", "uploaded_signed_copy", "closed"].includes((processed.status || "").toLowerCase())
        ? processed.status.toLowerCase()
        : "signed",
      isHistorical: true,
      priorWriteups: [],
      attachments: [],
      events: [{ type: "created", actorEmail: "import", occurredAt: new Date() }],
      createdBy: "historical-import",
    });
  }

  // Auto-create any categories mentioned in the import that don't exist yet.
  if (newCategoryNames.size > 0) {
    await DropdownOption.insertMany(
      Array.from(newCategoryNames).map((description) => ({ description, type: "metric", isActive: true })),
      { ordered: false }
    ).catch(() => {}); // ignore duplicate-key races
  }

  const allCategories = await DropdownOption.find({ type: "metric" }, { _id: 1, description: 1 }).lean();
  const categoryIdMap = new Map(allCategories.map((c: any) => [c.description.toLowerCase(), c._id]));

  for (const doc of documents) {
    doc.categoryId = categoryIdMap.get(doc._categoryLookupName.toLowerCase());
    delete doc._categoryLookupName;
  }

  if (documents.length > 0) {
    const result = await Writeup.insertMany(documents, { ordered: false });
    return NextResponse.json({ success: true, count: result.length, inserted: result.length, updated: 0, matched: documents.length, skipped });
  }

  return NextResponse.json({ success: true, count: 0, inserted: 0, updated: 0, skipped });
}
