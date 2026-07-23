import mongoose, { Schema, Document } from "mongoose";

// Single-document collection (station-scoped app, so just one row).
// Configures the progressive-discipline ladder used by
// lib/writeup-logic.ts to auto-recommend a warning level.

export interface IWriteupEscalationThresholds {
  second_warning: number;
  third_warning: number;
  final_warning: number;
  suspension_review: number;
}

export interface IWriteupCorrectiveActionTemplate {
  categoryLabel: string;
  // Optional finer-grained reason within categoryLabel (e.g. category
  // "Safety Infraction" with subCategory "Seatbelt" / "Speeding" / etc.)
  // — lets one real category carry several distinct corrective-action
  // texts when the category itself doesn't subdivide in the dropdown
  // list. Blank subCategory = the general/fallback template for that
  // category, used when no more specific sub-reason is selected.
  subCategory?: string;
  planForImprovement: string;
  consequences?: string; // overrides defaultConsequences when set (e.g. Attendance's tiered violations)
}

export interface IWriteupCategoryLookbackOverride {
  categoryLabel: string;
  lookbackDays: number;
}

export interface IWriteupSettings extends Document {
  lookbackDays: number;
  escalationThresholds: IWriteupEscalationThresholds;
  // Each inner array is a group of DropdownOption `description` values
  // (metric/category labels) that count toward ONE shared escalation
  // count. A category not listed in any group stacks only with itself.
  stackGroups: string[][];
  // Per-category override of the lookback window above — e.g. Safety
  // Infraction escalating on a tighter 30-day rolling window while
  // everything else still uses the global lookbackDays. A category not
  // listed here just uses the global value.
  categoryLookbackOverrides: IWriteupCategoryLookbackOverride[];
  // Auto-fill content for the New Write-Up form, keyed by category label
  // (case-insensitive match against categoryLabel). Managers can still
  // edit before saving — this just removes the blank-page problem and
  // keeps language consistent/legally vetted across managers.
  correctiveActionTemplates: IWriteupCorrectiveActionTemplate[];
  defaultConsequences: string;
  updatedBy?: string;
  updatedAt: Date;
}

const WriteupCorrectiveActionTemplateSchema = new Schema(
  {
    categoryLabel: { type: String, required: true },
    subCategory: { type: String, default: "" },
    planForImprovement: { type: String, default: "" },
    consequences: { type: String, default: "" },
  },
  { _id: false }
);

// Seeded from SYMX's existing corrective-action notice language (the
// EmployeePerformance mail-merge template) so the first write-up ever
// created already has correct, consistent auto-fill text. Matched
// case-insensitively against categoryLabel (+ subCategory when given) —
// categories without an entry here just fall back to a blank field the
// manager fills in.
// Category labels below are matched case-insensitively against the
// live, freeform DropdownOption categories actually used in this
// system (Settings > Dropdowns, type "metric") — not generic Amazon
// DSP scorecard terminology. Keep these in sync with whatever the real
// category list is, or auto-fill silently won't trigger. "Delivered Not
// Received" is its own real category (added alongside this change —
// see scripts/add-dnr-category.mjs). The five safety sub-types are all
// filed under the single real "Safety Infraction" category but kept as
// distinct subCategory entries so each gets its own corrective-action
// text and the New Write-Up form can offer a specific-issue picker.
export const DEFAULT_CORRECTIVE_ACTION_TEMPLATES: IWriteupCorrectiveActionTemplate[] = [
  {
    categoryLabel: "Customer Delivery Feedback",
    planForImprovement:
      "Always follow customer delivery instructions. When no delivery instructions exist, deliver to a secure location — not visible from the street, not in high traffic, and protected from weather. Never leave packages in a common lobby, outside a gate, in a mailroom, or on/inside a USPS mailbox. If unsure of a safe location, contact the customer directly, or SYMX Dispatch if the customer is unreachable. Use the correct scan code and never mark delivered to a household member without confirming receipt.",
  },
  {
    categoryLabel: "Delivered Not Received",
    planForImprovement:
      "Delivered Not Received issues most often trace back to incorrect address confirmation or an insecure drop location. Verify the Geopin and address before every delivery, follow all customer instructions, and take a clear Photo on Delivery so the drop location is documented.",
  },
  {
    categoryLabel: "Delivery Completion Rate",
    planForImprovement:
      "Review each stop before marking it UTL/UTA/Customer Unavailable/NSL/BC/OODT/PNOV — these should reflect genuine access or time issues, not convenience. Confirm you attempted access and checked for a secure location before returning a package. Escalate access issues to Dispatch rather than returning packages preventable through a second attempt.",
  },
  {
    categoryLabel: "Delivery Success Behaviors",
    planForImprovement:
      "Compare the name and address in the app to both the package label and the physical building — always check the Geopin. Mark packages delivered only at the correct location shown in the Delivery App, and never more than 50 meters from the Geopin. Take a Photo on Delivery for every stop.",
  },
  {
    categoryLabel: "Photo on Delivery",
    planForImprovement:
      "Take photos in the final delivery location only — not from the vehicle, sidewalk, or in hand. Ensure the area is well lit, hold the camera steady, and use the sizing frame so the entire package is visible and unobstructed. Retake the photo if it doesn't clearly show the package. Do not include license plates, addresses, faces, or bystanders in the frame.",
  },
  {
    categoryLabel: "Safety Infraction",
    subCategory: "Seatbelt",
    planForImprovement:
      "Seatbelts must be fastened correctly before the vehicle is placed in motion, every trip, no exceptions. The daily goal is zero seatbelt-off instances.",
  },
  {
    categoryLabel: "Safety Infraction",
    subCategory: "Speeding",
    planForImprovement:
      "Do not exceed the posted speed limit by 10+ mph for any sustained duration, and never exceed 85 mph under any circumstance. Adjust speed for road, weather, and traffic conditions at all times.",
  },
  {
    categoryLabel: "Safety Infraction",
    subCategory: "Distraction",
    planForImprovement:
      "Keep full attention on the road at all times. Do not look at or use a phone while the vehicle is in motion. If you need to communicate, safely pull over and park before using a device.",
  },
  {
    categoryLabel: "Safety Infraction",
    subCategory: "Following Distance",
    planForImprovement:
      "Maintain safe following distance at all times — at least 1+ second of space behind the vehicle ahead, more at higher speeds. Avoid multiple consecutive lane changes without adequate space.",
  },
  {
    categoryLabel: "Safety Infraction",
    subCategory: "Sign/Signal",
    planForImprovement:
      "Come to a complete stop at every stop sign and red light before proceeding, and never execute an illegal U-turn. Treat all posted signs and signals as non-negotiable, not situational.",
  },
  {
    categoryLabel: "Attendance",
    planForImprovement:
      "Report to every scheduled shift on time. If you cannot attend, notify management with as much advance notice as possible — a no-call/no-show is treated more seriously than a called-out absence.",
    consequences:
      "Call-Out — 1st Violation: Written warning. 2nd Violation: Reduction in scheduled workdays. 3rd Violation: Termination of employment. No-Call/No-Show (NCNS) — 1st Violation: Loss of one scheduled workday the following week. 2nd Violation: Termination of employment.",
  },
  {
    categoryLabel: "Behavior",
    planForImprovement:
      "Maintain professional conduct with customers, coworkers, and management at all times. Specific behavior concerns are detailed in the Description above — review and correct the noted conduct going forward.",
  },
];

const WriteupSettingsSchema = new Schema<IWriteupSettings>(
  {
    lookbackDays: { type: Number, default: 90 },
    escalationThresholds: {
      second_warning: { type: Number, default: 1 },
      third_warning: { type: Number, default: 2 },
      final_warning: { type: Number, default: 3 },
      suspension_review: { type: Number, default: 4 },
    },
    stackGroups: { type: [[String]], default: [] },
    categoryLookbackOverrides: {
      type: [
        new Schema(
          {
            categoryLabel: { type: String, required: true },
            lookbackDays: { type: Number, required: true },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
    correctiveActionTemplates: { type: [WriteupCorrectiveActionTemplateSchema], default: DEFAULT_CORRECTIVE_ACTION_TEMPLATES },
    defaultConsequences: {
      type: String,
      default:
        "Failure to demonstrate immediate and sustained improvement may result in further disciplinary action, up to and including suspension, corrective action, or termination of employment, depending on the severity and frequency of future incidents.",
    },
    updatedBy: { type: String, default: "" },
  },
  { timestamps: { createdAt: false, updatedAt: true }, collection: "SYMXWriteupSettings" }
);

const WriteupSettings =
  mongoose.models.WriteupSettings ||
  mongoose.model<IWriteupSettings>("WriteupSettings", WriteupSettingsSchema);

export default WriteupSettings;
