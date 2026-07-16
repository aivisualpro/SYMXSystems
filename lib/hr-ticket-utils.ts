import { Resend } from "resend";
import connectToDatabase from "@/lib/db";
import SymxHrTicketSettings from "@/lib/models/SymxHrTicketSettings";
import SymxHrTicket from "@/lib/models/SymxHrTicket";
import SymxEmployee from "@/lib/models/SymxEmployee";

const APP_URL = "https://symx-systems-erp.vercel.app";
const FROM_ADDRESS = "SYMX Systems Support <info@adeelfullstack.com>";

/**
 * Atomically issues the next HR ticket number. Shared by both the public
 * submission route and the admin "New Ticket" route so numbering can never
 * collide between the two entry points (the old public-only implementation
 * derived the next number by reading+incrementing the last ticket's number,
 * which raced under concurrent submissions).
 *
 * On first-ever call (no settings doc yet) the counter is seeded from the
 * highest ticketNumber already in the collection, so it picks up cleanly
 * after legacy data instead of colliding with it. That seed step isn't
 * itself atomic (a vanishingly rare double-submission at the very first
 * call could seed twice) — acceptable since it only matters once, ever;
 * every call after the settings doc exists uses an atomic $inc.
 */
export async function getNextTicketNumber(): Promise<string> {
  await connectToDatabase();
  let settings = await SymxHrTicketSettings.findOne();
  if (!settings) {
    const existing = await SymxHrTicket.find({}, { ticketNumber: 1 }).lean();
    let maxNum = 0;
    for (const t of existing) {
      const n = parseInt(String((t as any).ticketNumber || "").replace(/\D/g, ""), 10);
      if (!isNaN(n) && n > maxNum) maxNum = n;
    }
    settings = await SymxHrTicketSettings.create({ lastTicketNumber: maxNum });
  }
  const updated = await SymxHrTicketSettings.findOneAndUpdate(
    { _id: settings._id },
    { $inc: { lastTicketNumber: 1 } },
    { new: true }
  );
  return String(updated!.lastTicketNumber);
}

/**
 * Best-effort lookup so a driver typing their Transporter ID or Paycom EE
 * Code on the public form gets linked to a real SymxEmployee record —
 * reuses the exact transporterId field the admin ticket list already knows
 * how to resolve into a name/avatar (see enrichTickets in
 * app/api/admin/hr-tickets/route.ts), no new enrichment logic needed there.
 * Returns null if the value is blank or no employee matches.
 */
export async function findEmployeeByLookup(
  lookup: string | undefined | null
): Promise<{ transporterId: string; eeCode: string } | null> {
  const value = (lookup || "").trim();
  if (!value) return null;
  await connectToDatabase();
  const employee = await SymxEmployee.findOne({
    $or: [{ transporterId: value }, { eeCode: value }],
  })
    .select({ transporterId: 1, eeCode: 1 })
    .lean();
  if (!employee) return null;
  return {
    transporterId: (employee as any).transporterId || "",
    eeCode: (employee as any).eeCode || "",
  };
}

/**
 * Notifies HR that a new ticket was submitted via the public form. Fully
 * fire-and-forget from the caller's perspective — swallows its own errors
 * so a Resend outage never blocks ticket creation, since the ticket record
 * itself (not the email) is the source of truth.
 */
export async function sendHrTicketNotificationEmail(ticket: {
  ticketNumber?: string;
  category?: string;
  issue?: string;
  submitterName?: string;
  submitterEmail?: string;
  transporterId?: string;
}): Promise<void> {
  try {
    await connectToDatabase();
    const settings = await SymxHrTicketSettings.findOne().lean();
    const recipients = ((settings as any)?.notificationEmails || []).filter(Boolean);
    if (recipients.length === 0) return;

    const resend = new Resend(process.env.RESEND_API_KEY || "missing-key");
    const { error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: recipients,
      subject: `New HR Ticket #${ticket.ticketNumber || ""} — ${ticket.category || "General"}`,
      html: `
        <div style="font-family: 'Poppins', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e4e4e7; border-radius: 12px;">
          <div style="text-align: center; margin-bottom: 24px;">
            <img src="${APP_URL}/logo.png" alt="SYMX Systems" style="width: 64px; height: 64px;" />
          </div>
          <h2 style="color: #18181b; text-align: center;">New HR Ticket Submitted</h2>
          <div style="background-color: #f4f4f5; padding: 20px; border-radius: 12px; margin: 24px 0;">
            <p style="margin: 0 0 8px 0; color: #71717a; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Ticket #${ticket.ticketNumber || "—"}</p>
            <p style="margin: 0 0 4px 0; color: #18181b; font-size: 15px;"><strong>Category:</strong> ${ticket.category || "—"}</p>
            <p style="margin: 0 0 4px 0; color: #18181b; font-size: 15px;"><strong>From:</strong> ${ticket.submitterName || "Unknown"} ${ticket.submitterEmail ? `(${ticket.submitterEmail})` : ""}</p>
            ${ticket.transporterId ? `<p style="margin: 0 0 4px 0; color: #18181b; font-size: 15px;"><strong>Transporter ID:</strong> ${ticket.transporterId}</p>` : ""}
            <p style="margin: 12px 0 0 0; color: #52525b; font-size: 14px; line-height: 20px; white-space: pre-wrap;">${ticket.issue || ""}</p>
          </div>
          <div style="text-align: center; margin-top: 30px;">
            <a href="${APP_URL}/hr/tickets" style="background-color: #000; color: #fff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">View in SYMX</a>
          </div>
        </div>
      `,
    });
    if (error) console.error("[HR_TICKET_NOTIFY_EMAIL]", error);
  } catch (err) {
    console.error("[HR_TICKET_NOTIFY_EMAIL]", err);
  }
}

/**
 * Confirms receipt to the driver who submitted the ticket, if they gave an
 * email. Same fire-and-forget error handling as the HR notification above.
 */
export async function sendDriverConfirmationEmail(ticket: {
  ticketNumber?: string;
  category?: string;
  submitterName?: string;
  submitterEmail?: string;
}): Promise<void> {
  if (!ticket.submitterEmail) return;
  try {
    const resend = new Resend(process.env.RESEND_API_KEY || "missing-key");
    const { error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: [ticket.submitterEmail],
      subject: `We received your HR ticket — #${ticket.ticketNumber || ""}`,
      html: `
        <div style="font-family: 'Poppins', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e4e4e7; border-radius: 12px;">
          <div style="text-align: center; margin-bottom: 24px;">
            <img src="${APP_URL}/logo.png" alt="SYMX Systems" style="width: 64px; height: 64px;" />
          </div>
          <h2 style="color: #18181b; text-align: center;">We got your ticket</h2>
          <p style="color: #52525b; font-size: 16px; line-height: 24px;">
            Hi ${ticket.submitterName || "there"},
          </p>
          <p style="color: #52525b; font-size: 16px; line-height: 24px;">
            Thanks for submitting an HR ticket${ticket.category ? ` about "${ticket.category}"` : ""}. Our HR team has been notified and will follow up with you soon.
          </p>
          <div style="background-color: #f4f4f5; padding: 20px; border-radius: 12px; text-align: center; margin: 30px 0;">
            <p style="margin: 0; color: #71717a; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">Your Ticket Number</p>
            <p style="margin: 10px 0 0 0; color: #18181b; font-size: 24px; font-weight: bold;">#${ticket.ticketNumber || "—"}</p>
          </div>
          <p style="color: #a1a1aa; font-size: 12px; text-align: center; margin-top: 30px;">
            Keep this number for reference if you follow up. If you didn't submit this, please ignore this email.
            <br />© ${new Date().getFullYear()} SYMX Systems. All rights reserved.
          </p>
        </div>
      `,
    });
    if (error) console.error("[HR_TICKET_CONFIRM_EMAIL]", error);
  } catch (err) {
    console.error("[HR_TICKET_CONFIRM_EMAIL]", err);
  }
}
