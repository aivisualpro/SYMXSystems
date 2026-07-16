import { Resend } from "resend";
import connectToDatabase from "@/lib/db";
import SymxReimbursementSettings from "@/lib/models/SymxReimbursementSettings";
import SymxReimbursement from "@/lib/models/SymxReimbursement";
import SymxEmployee from "@/lib/models/SymxEmployee";

const APP_URL = "https://symx-systems-erp.vercel.app";
const FROM_ADDRESS = "SYMX Systems Support <info@adeelfullstack.com>";

/**
 * Atomically issues the next reimbursement request number. Shared by both
 * the public submission route and the admin "Add Reimbursement" route so
 * numbering can never collide between the two entry points — same pattern
 * as getNextTicketNumber() in lib/hr-ticket-utils.ts.
 *
 * On first-ever call (no settings doc yet) the counter is seeded from the
 * highest requestNumber already in the collection. Pre-redesign records have
 * no requestNumber at all, so on a fresh install this simply starts at 1.
 */
export async function getNextRequestNumber(): Promise<string> {
  await connectToDatabase();
  let settings = await SymxReimbursementSettings.findOne();
  if (!settings) {
    const existing = await SymxReimbursement.find({}, { requestNumber: 1 }).lean();
    let maxNum = 0;
    for (const r of existing) {
      const n = parseInt(String((r as any).requestNumber || "").replace(/\D/g, ""), 10);
      if (!isNaN(n) && n > maxNum) maxNum = n;
    }
    settings = await SymxReimbursementSettings.create({ lastRequestNumber: maxNum });
  }
  const updated = await SymxReimbursementSettings.findOneAndUpdate(
    { _id: settings._id },
    { $inc: { lastRequestNumber: 1 } },
    { new: true }
  );
  return String(updated!.lastRequestNumber);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export interface EmployeeMatchCandidate {
  _id: string;
  firstName: string;
  lastName: string;
  transporterId: string;
  profileImage: string;
}

const EMPLOYEE_MATCH_SELECT = { firstName: 1, lastName: 1, transporterId: 1, profileImage: 1 };

function toCandidate(doc: any): EmployeeMatchCandidate {
  return {
    _id: String(doc._id),
    firstName: doc.firstName || "",
    lastName: doc.lastName || "",
    transporterId: doc.transporterId || "",
    profileImage: doc.profileImage || "",
  };
}

/**
 * Tries to identify which SymxEmployee a public reimbursement submission is
 * about, without ever trusting typed identifiers directly (that's the manual
 * link picker's job in the admin workbench). Identical two-tier approach to
 * matchEmployeeForTicket in lib/hr-ticket-utils.ts — duplicated rather than
 * shared so the two intake flows (HR tickets, reimbursements) can evolve
 * independently without risking one break the other.
 *
 * - `exact`: an unambiguous exact-match on email or full name — safe to
 *   auto-link immediately.
 * - `suggested`: a same-signal match that wasn't unique — surfaced in the
 *   admin UI as a one-click "confirm" suggestion rather than applied
 *   automatically.
 */
export async function matchEmployeeForReimbursement(
  submitterName?: string,
  submitterEmail?: string
): Promise<{ exact: EmployeeMatchCandidate | null; suggested: EmployeeMatchCandidate | null }> {
  await connectToDatabase();

  const email = (submitterEmail || "").trim().toLowerCase();
  if (email) {
    const emailMatches = await SymxEmployee.find(
      { email: new RegExp(`^${escapeRegex(email)}$`, "i") },
      EMPLOYEE_MATCH_SELECT
    ).lean();
    if (emailMatches.length === 1) return { exact: toCandidate(emailMatches[0]), suggested: null };
    if (emailMatches.length > 1) return { exact: null, suggested: toCandidate(emailMatches[0]) };
  }

  const name = (submitterName || "").trim();
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      const first = parts[0];
      const last = parts.slice(1).join(" ");
      const nameMatches = await SymxEmployee.find(
        {
          firstName: new RegExp(`^${escapeRegex(first)}$`, "i"),
          lastName: new RegExp(`^${escapeRegex(last)}$`, "i"),
        },
        EMPLOYEE_MATCH_SELECT
      ).lean();
      if (nameMatches.length === 1) return { exact: toCandidate(nameMatches[0]), suggested: null };
      if (nameMatches.length > 1) return { exact: null, suggested: toCandidate(nameMatches[0]) };
    }
  }

  return { exact: null, suggested: null };
}

const EMPLOYEE_ENRICH_SELECT = { transporterId: 1, firstName: 1, lastName: 1, profileImage: 1 };

/**
 * Resolves employeeId/suggestedEmployeeId/transporterId → employee display
 * info for a batch of reimbursement records in one set of lookups. Shared by
 * both the list route and the single-record detail route so the two never
 * drift apart. Mirrors enrichTickets() in app/api/admin/hr-tickets/route.ts.
 */
export async function enrichReimbursements(records: any[]): Promise<any[]> {
  await connectToDatabase();

  const employeeIds = [...new Set(records.map((r) => r.employeeId).filter(Boolean).map((id: any) => String(id)))];
  const suggestedIds = [...new Set(records.map((r) => r.suggestedEmployeeId).filter(Boolean).map((id: any) => String(id)))];
  const allIds = [...new Set([...employeeIds, ...suggestedIds])];

  const empByIdMap = new Map<string, { employeeName: string; profileImage: string; transporterId: string }>();
  if (allIds.length > 0) {
    const employees = await SymxEmployee.find({ _id: { $in: allIds } }, EMPLOYEE_ENRICH_SELECT).lean();
    employees.forEach((emp: any) => {
      empByIdMap.set(String(emp._id), {
        employeeName: `${emp.firstName || ""} ${emp.lastName || ""}`.trim(),
        profileImage: emp.profileImage || "",
        transporterId: emp.transporterId || "",
      });
    });
  }

  const transporterIds = [...new Set(
    records.filter((r) => !r.employeeId && r.transporterId).map((r) => r.transporterId)
  )];
  const empByTransporterMap = new Map<string, { employeeName: string; profileImage: string }>();
  if (transporterIds.length > 0) {
    const employees = await SymxEmployee.find({ transporterId: { $in: transporterIds } }, EMPLOYEE_ENRICH_SELECT).lean();
    employees.forEach((emp: any) => {
      empByTransporterMap.set(emp.transporterId, {
        employeeName: `${emp.firstName || ""} ${emp.lastName || ""}`.trim(),
        profileImage: emp.profileImage || "",
      });
    });
  }

  return records.map((r) => {
    const empById = r.employeeId ? empByIdMap.get(String(r.employeeId)) : null;
    const empByTransporter = !empById && r.transporterId ? empByTransporterMap.get(r.transporterId) : null;
    const emp = empById || empByTransporter;
    const suggested = !r.employeeId && r.suggestedEmployeeId ? empByIdMap.get(String(r.suggestedEmployeeId)) : null;
    return {
      ...r,
      // Falls back to the driver's typed name for public submissions that
      // haven't been linked to a known SymxEmployee record yet.
      employeeName: emp?.employeeName || r.employeeName || r.submitterName || "",
      profileImage: emp?.profileImage || "",
      resolvedTransporterId: emp ? (empById?.transporterId || r.transporterId) : r.transporterId,
      suggestedEmployeeName: suggested?.employeeName || "",
      suggestedProfileImage: suggested?.profileImage || "",
      suggestedTransporterId: suggested?.transporterId || "",
    };
  });
}

/**
 * Notifies HR/finance that a new reimbursement was submitted via the public
 * form. Fire-and-forget-safe — swallows its own errors so a Resend outage
 * never blocks the request itself, since the record (not the email) is the
 * source of truth.
 */
export async function sendReimbursementNotificationEmail(request: {
  requestNumber?: string;
  total?: number;
  submitterName?: string;
  submitterEmail?: string;
  itemCount?: number;
}): Promise<void> {
  try {
    await connectToDatabase();
    const settings = await SymxReimbursementSettings.findOne().lean();
    const recipients = ((settings as any)?.notificationEmails || []).filter(Boolean);
    if (recipients.length === 0) return;

    const resend = new Resend(process.env.RESEND_API_KEY || "missing-key");
    const amount = typeof request.total === "number" ? `$${request.total.toFixed(2)}` : "—";
    const { error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: recipients,
      subject: `New Reimbursement Request #${request.requestNumber || ""} — ${amount}`,
      html: `
        <div style="font-family: 'Poppins', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e4e4e7; border-radius: 12px;">
          <div style="text-align: center; margin-bottom: 24px;">
            <img src="${APP_URL}/logo.png" alt="SYMX Systems" style="width: 64px; height: 64px;" />
          </div>
          <h2 style="color: #18181b; text-align: center;">New Reimbursement Request</h2>
          <div style="background-color: #f4f4f5; padding: 20px; border-radius: 12px; margin: 24px 0;">
            <p style="margin: 0 0 8px 0; color: #71717a; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Request #${request.requestNumber || "—"}</p>
            <p style="margin: 0 0 4px 0; color: #18181b; font-size: 15px;"><strong>From:</strong> ${request.submitterName || "Unknown"} ${request.submitterEmail ? `(${request.submitterEmail})` : ""}</p>
            <p style="margin: 0 0 4px 0; color: #18181b; font-size: 15px;"><strong>Total:</strong> ${amount} across ${request.itemCount || 0} item(s)</p>
          </div>
          <div style="text-align: center; margin-top: 30px;">
            <a href="${APP_URL}/hr/reimbursement" style="background-color: #000; color: #fff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">Review in SYMX</a>
          </div>
        </div>
      `,
    });
    if (error) console.error("[REIMBURSEMENT_NOTIFY_EMAIL]", error);
  } catch (err) {
    console.error("[REIMBURSEMENT_NOTIFY_EMAIL]", err);
  }
}

/**
 * Confirms receipt to the driver who submitted the request, if they gave an
 * email. Same fire-and-forget error handling as the notification above.
 */
export async function sendReimbursementConfirmationEmail(request: {
  requestNumber?: string;
  total?: number;
  submitterName?: string;
  submitterEmail?: string;
}): Promise<void> {
  if (!request.submitterEmail) return;
  try {
    const resend = new Resend(process.env.RESEND_API_KEY || "missing-key");
    const amount = typeof request.total === "number" ? `$${request.total.toFixed(2)}` : "—";
    const { error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: [request.submitterEmail],
      subject: `We received your reimbursement request — #${request.requestNumber || ""}`,
      html: `
        <div style="font-family: 'Poppins', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e4e4e7; border-radius: 12px;">
          <div style="text-align: center; margin-bottom: 24px;">
            <img src="${APP_URL}/logo.png" alt="SYMX Systems" style="width: 64px; height: 64px;" />
          </div>
          <h2 style="color: #18181b; text-align: center;">We got your request</h2>
          <p style="color: #52525b; font-size: 16px; line-height: 24px;">
            Hi ${request.submitterName || "there"},
          </p>
          <p style="color: #52525b; font-size: 16px; line-height: 24px;">
            Thanks for submitting a reimbursement request for ${amount}. Our team has been notified and will review it soon.
          </p>
          <div style="background-color: #f4f4f5; padding: 20px; border-radius: 12px; text-align: center; margin: 30px 0;">
            <p style="margin: 0; color: #71717a; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">Your Request Number</p>
            <p style="margin: 10px 0 0 0; color: #18181b; font-size: 24px; font-weight: bold;">#${request.requestNumber || "—"}</p>
          </div>
          <p style="color: #a1a1aa; font-size: 12px; text-align: center; margin-top: 30px;">
            Keep this number for reference if you follow up. If you didn't submit this, please ignore this email.
            <br />© ${new Date().getFullYear()} SYMX Systems. All rights reserved.
          </p>
        </div>
      `,
    });
    if (error) console.error("[REIMBURSEMENT_CONFIRM_EMAIL]", error);
  } catch (err) {
    console.error("[REIMBURSEMENT_CONFIRM_EMAIL]", err);
  }
}
