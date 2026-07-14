import connectToDatabase from "@/lib/db";
import Writeup from "@/lib/models/Writeup";
import WriteupSettings, { DEFAULT_CORRECTIVE_ACTION_TEMPLATES } from "@/lib/models/WriteupSettings";
import DropdownOption from "@/lib/models/DropdownOption";
import VerbalCoaching from "@/lib/models/VerbalCoaching";

export const WARNING_LEVELS = [
  "first_warning",
  "second_warning",
  "third_warning",
  "final_warning",
  "suspension_review",
] as const;

export type WarningLevel = (typeof WARNING_LEVELS)[number];

export const WARNING_LEVEL_LABELS: Record<string, string> = {
  first_warning: "First Warning",
  second_warning: "Second Warning",
  third_warning: "Third Warning",
  final_warning: "Final Warning",
  suspension_review: "Suspension Review",
};

// Statuses that count as an acknowledged prior for escalation purposes.
// Drafts don't count — an unsigned in-progress write-up shouldn't push
// someone's next violation to a higher warning level.
const COUNTABLE_STATUSES = ["signed", "refused_to_sign", "uploaded_signed_copy", "escalated", "closed"];

export interface WriteupPrior {
  writeupId: string;
  incidentDate: Date;
  warningLevel: string;
}

export interface WriteupRecommendation {
  recommended: WarningLevel;
  priorCount: number;
  priors: WriteupPrior[];
  rationale: string;
}

// Single-document collection by convention. Sort deterministically so this
// always resolves to the same document as the admin settings API route
// (app/api/admin/writeup-settings/route.ts) — otherwise, if stray
// duplicate documents exist (see scripts/dedupe-writeup-settings.mjs),
// this and the settings page could silently read/write different rows,
// making saved changes appear to vanish.
async function getSettings() {
  await connectToDatabase();
  let settings = await WriteupSettings.findOne().sort({ _id: 1 }).lean();
  if (!settings) {
    settings = (await WriteupSettings.create({})).toObject();
  }
  return settings as any;
}

// Resolve which category labels count toward the same ladder as the given
// one, based on admin-configured stack groups. A category not in any
// configured group stacks only with itself.
function resolveStackGroup(categoryLabel: string, stackGroups: string[][]): string[] {
  for (const group of stackGroups) {
    if (group.some((c) => c.toLowerCase() === categoryLabel.toLowerCase())) {
      return group;
    }
  }
  return [categoryLabel];
}

function levelFromCount(count: number, thresholds: any): WarningLevel {
  if (count >= thresholds.suspension_review) return "suspension_review";
  if (count >= thresholds.final_warning) return "final_warning";
  if (count >= thresholds.third_warning) return "third_warning";
  if (count >= thresholds.second_warning) return "second_warning";
  return "first_warning";
}

function formatDateList(dates: Date[]): string {
  const formatted = dates.map((d) => new Date(d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }));
  if (formatted.length === 1) return formatted[0];
  if (formatted.length === 2) return `${formatted[0]} and ${formatted[1]}`;
  return `${formatted.slice(0, -1).join(", ")}, and ${formatted[formatted.length - 1]}`;
}

// Given an employee + category, look up prior write-ups (in the lookback
// window, for stacked categories) and recommend the next warning level.
// excludeWriteupId lets a PUT/regenerate call exclude the record itself.
export async function recommendWarningLevel(
  employeeId: string,
  categoryId: string | undefined,
  categoryLabelFallback: string,
  excludeWriteupId?: string
): Promise<WriteupRecommendation> {
  await connectToDatabase();
  const settings = await getSettings();

  let categoryLabel = categoryLabelFallback;
  if (categoryId) {
    const cat = await DropdownOption.findById(categoryId).lean();
    if (cat) categoryLabel = (cat as any).description || categoryLabel;
  }

  const stackLabels = resolveStackGroup(categoryLabel, settings.stackGroups || []);
  const cutoff = new Date(Date.now() - (settings.lookbackDays || 90) * 24 * 60 * 60 * 1000);

  const query: any = {
    employeeId,
    categoryLabel: { $in: stackLabels.map((l) => new RegExp(`^${l.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i")) },
    status: { $in: COUNTABLE_STATUSES },
    incidentDate: { $gte: cutoff },
  };
  if (excludeWriteupId) query._id = { $ne: excludeWriteupId };

  const priorDocs = await Writeup.find(query)
    .sort({ incidentDate: -1 })
    .select({ incidentDate: 1, warningLevel: 1 })
    .lean();

  const priors: WriteupPrior[] = priorDocs.map((p: any) => ({
    writeupId: String(p._id),
    incidentDate: p.incidentDate,
    warningLevel: p.warningLevel,
  }));

  const hasSuspensionReview = priors.some((p) => p.warningLevel === "suspension_review");
  const priorCount = priors.length;

  let recommended: WarningLevel;
  let rationale: string;

  if (hasSuspensionReview) {
    recommended = "suspension_review";
    rationale = `This employee already has a Suspension Review write-up for ${categoryLabel}. This is a continued occurrence and should go to Admin/HR review before further action.`;
  } else {
    recommended = levelFromCount(priorCount, settings.escalationThresholds);
    if (priorCount === 0) {
      rationale = `No prior ${categoryLabel} write-ups in the last ${settings.lookbackDays} days. Recommending First Warning.`;
    } else {
      const dates = formatDateList(priors.map((p) => p.incidentDate));
      rationale = `This employee has ${priorCount} prior ${categoryLabel} write-up${priorCount === 1 ? "" : "s"} in the last ${settings.lookbackDays} days. Previous date${priorCount === 1 ? "" : "s"}: ${dates}. This write-up has been auto-populated as ${WARNING_LEVEL_LABELS[recommended]}.`;
    }
  }

  return { recommended, priorCount, priors, rationale };
}

// Category-specific auto-fill for the New Write-Up form's Plan for
// Improvement / Consequences fields. Managers can still edit the result —
// this just removes the blank-page problem and keeps language consistent.
export async function getCorrectiveActionTemplate(
  categoryLabel: string
): Promise<{ planForImprovement: string; consequences: string }> {
  const settings = await getSettings();
  const templates: any[] =
    settings.correctiveActionTemplates && settings.correctiveActionTemplates.length > 0
      ? settings.correctiveActionTemplates
      : DEFAULT_CORRECTIVE_ACTION_TEMPLATES;
  const normalize = (s: string) => (s || "").trim().toLowerCase().replace(/\s+/g, " ");
  const match = templates.find((t: any) => normalize(t.categoryLabel) === normalize(categoryLabel));
  const defaultConsequences =
    settings.defaultConsequences ||
    "Failure to demonstrate immediate and sustained improvement may result in further disciplinary action, up to and including suspension, corrective action, or termination of employment, depending on the severity and frequency of future incidents.";
  return {
    planForImprovement: match?.planForImprovement || "",
    consequences: (match?.consequences && match.consequences.trim()) || defaultConsequences,
  };
}

export interface VerbalCoachingContextItem {
  coachingDate: Date;
  categoryLabels: string[];
  status: string;
  notes: string;
}

// Prior verbal coachings for the same employee + category, shown as
// reference context on the New Write-Up form and in the generated PDF —
// informational only, NOT counted toward the warning-level recommendation
// above (verbal coachings are often unsigned, undelivered, or disputed).
export async function getVerbalCoachingContext(
  employeeId: string,
  categoryLabel: string,
  lookbackDays?: number
): Promise<{ count: number; items: VerbalCoachingContextItem[] }> {
  if (!employeeId || !categoryLabel) return { count: 0, items: [] };
  await connectToDatabase();
  const settings = await getSettings();
  const cutoff = new Date(Date.now() - (lookbackDays ?? settings.lookbackDays ?? 90) * 24 * 60 * 60 * 1000);

  const docs = await VerbalCoaching.find({
    employeeId,
    categoryLabels: new RegExp(`^${categoryLabel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"),
    coachingDate: { $gte: cutoff },
  })
    .sort({ coachingDate: -1 })
    .limit(10)
    .select({ coachingDate: 1, categoryLabels: 1, status: 1, notes: 1 })
    .lean();

  const items: VerbalCoachingContextItem[] = docs.map((d: any) => ({
    coachingDate: d.coachingDate,
    categoryLabels: d.categoryLabels || [],
    status: d.status,
    notes: d.notes || "",
  }));

  return { count: items.length, items };
}
