import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import SymxHrTicket from "@/lib/models/SymxHrTicket";
import {
  getNextTicketNumber,
  matchEmployeeForTicket,
  sendHrTicketNotificationEmail,
  sendDriverConfirmationEmail,
} from "@/lib/hr-ticket-utils";
import { HR_TICKET_TIME_OFF_CATEGORIES } from "@/lib/hr-ticket-categories";

// YYYY-MM-DD only — matches what a plain <input type="date"> sends. Parsed
// as UTC midnight for that calendar day (never local-timezone-shifted),
// same reasoning as the write-up date-picker bug fixed elsewhere in this
// app: a date-only string must round-trip to the exact calendar day the
// employee picked, not get pushed a day earlier by a timezone conversion.
function parseDateOnly(s: unknown): Date | null {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00.000Z`);
  return isNaN(d.getTime()) ? null : d;
}

// How many public submissions the same IP may make in the throttle window
// before being rejected. Deliberately generous — a driver could plausibly
// file a couple of separate tickets in one sitting — this is just a floor
// against scripted/bot abuse, not a per-person daily cap.
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

/**
 * PUBLIC endpoint — no auth required. Allows drivers with no account in this
 * app to submit HR tickets via the shared /submit-ticket link/QR code.
 *
 * Hardened version of the original: request body fields are explicitly
 * whitelisted (the old version spread the raw body straight into
 * SymxHrTicket.create(), so a crafted POST could set approveDeny,
 * resolution, closedBy, etc. directly), a honeypot field silently no-ops
 * bot submissions, IP-based throttling caps abuse, and ticket numbers come
 * from an atomic shared counter (no more read-then-increment race).
 *
 * This route never trusts an ID a driver types in directly, but it does
 * try to identify the submitter from their name/email: an unambiguous
 * exact match against a SymxEmployee record is auto-linked immediately
 * (matchEmployeeForTicket), since a single exact match is low-risk. A
 * same-signal match that isn't unique is stored as a "suggested" candidate
 * instead and surfaced in the admin UI for a one-click confirm — never
 * applied automatically.
 */
export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();
    const body = await req.json();

    // ── Honeypot ──
    // Hidden form field real users never see or fill. Bots that
    // autofill every input will populate it. Respond with the normal
    // success shape (no ticket created) so scripted submitters get no
    // signal that anything was rejected.
    if (typeof body.website === "string" && body.website.trim() !== "") {
      return NextResponse.json({ success: true, ticketNumber: "0" });
    }

    // ── Basic validation ──
    if (!body.category && !body.issue) {
      return NextResponse.json(
        { error: "Category or Issue is required" },
        { status: 400 }
      );
    }

    // ── Time-off date validation ──
    // The submit-ticket form only lets a driver pick ONE single day or ONE
    // continuous range per ticket (never multiple disjoint dates), so a
    // ticket can always be resolved once its one relevant scheduling week
    // is made — this is enforced client-side too, but never trust that
    // alone on a public, unauthenticated endpoint.
    const category = typeof body.category === "string" ? body.category : "";
    const isTimeOff = HR_TICKET_TIME_OFF_CATEGORIES.includes(category);
    let timeOffDateType: "single" | "range" | undefined;
    let timeOffStartDate: Date | undefined;
    let timeOffEndDate: Date | undefined;
    if (isTimeOff) {
      const dateType = body.timeOffDateType === "range" ? "range" : "single";
      const startDate = parseDateOnly(body.timeOffStartDate);
      if (!startDate) {
        return NextResponse.json({ error: "A date is required for a time-off request." }, { status: 400 });
      }
      let endDate = startDate;
      if (dateType === "range") {
        const parsedEnd = parseDateOnly(body.timeOffEndDate);
        if (!parsedEnd || parsedEnd.getTime() < startDate.getTime()) {
          return NextResponse.json({ error: "End date must be on or after the start date." }, { status: 400 });
        }
        endDate = parsedEnd;
      }
      timeOffDateType = dateType;
      timeOffStartDate = startDate;
      timeOffEndDate = endDate;
    }

    // ── Rate limit by IP ──
    const ip = getClientIp(req);
    if (ip !== "unknown") {
      const recentCount = await SymxHrTicket.countDocuments({
        submitterIp: ip,
        createdAt: { $gte: new Date(Date.now() - RATE_LIMIT_WINDOW_MS) },
      });
      if (recentCount >= RATE_LIMIT_MAX) {
        return NextResponse.json(
          { error: "Too many submissions. Please try again later." },
          { status: 429 }
        );
      }
    }

    // ── Explicit field whitelist (never spread the raw body into create()) ──
    const submitterName = typeof body.submitterName === "string" ? body.submitterName.slice(0, 200) : "";
    const submitterEmail = typeof body.submitterEmail === "string" ? body.submitterEmail.slice(0, 200) : "";

    // Exact-match auto-link (or a suggestion when ambiguous) against
    // SymxEmployee — see matchEmployeeForTicket for the matching rules.
    const { exact, suggested } = await matchEmployeeForTicket(submitterName, submitterEmail);

    const activity: any[] = [
      {
        type: "created",
        text: "Submitted via public form",
        byName: submitterName.trim() || "Public Form",
        byEmail: submitterEmail,
        createdAt: new Date(),
      },
    ];
    if (exact) {
      activity.push({
        type: "system",
        text: `Auto-matched to ${exact.firstName} ${exact.lastName}`.trim(),
        createdAt: new Date(),
      });
    }

    const ticketNumber = await getNextTicketNumber();
    const ticket = await SymxHrTicket.create({
      ticketNumber,
      category: typeof body.category === "string" ? body.category.slice(0, 200) : "",
      issue: typeof body.issue === "string" ? body.issue.slice(0, 5000) : "",
      timeOffDateType,
      timeOffStartDate,
      timeOffEndDate,
      notes: typeof body.notes === "string" ? body.notes.slice(0, 5000) : "",
      submitterName,
      submitterEmail,
      submitterIp: ip !== "unknown" ? ip : undefined,
      source: "public",
      status: "open",
      priority: "normal",
      approveDeny: "",
      createdBy: submitterName.trim() || "Public Form",
      employeeId: exact?._id || undefined,
      transporterId: exact?.transporterId || "",
      employeeMatchType: exact ? "auto" : undefined,
      suggestedEmployeeId: !exact && suggested ? suggested._id : undefined,
      activity,
    });

    // Awaited (not fire-and-forget) because serverless functions can freeze
    // execution the instant the response is sent, killing any still-pending
    // promise — but each helper swallows its own errors internally, so a
    // Resend outage here still can't fail the ticket creation itself.
    await sendHrTicketNotificationEmail({
      ticketNumber: ticket.ticketNumber,
      category: ticket.category,
      issue: ticket.issue,
      submitterName: ticket.submitterName,
      submitterEmail: ticket.submitterEmail,
      transporterId: ticket.transporterId,
    });
    await sendDriverConfirmationEmail({
      ticketNumber: ticket.ticketNumber,
      category: ticket.category,
      submitterName: ticket.submitterName,
      submitterEmail: ticket.submitterEmail,
    });

    return NextResponse.json({
      success: true,
      ticketId: ticket._id,
      ticketNumber: ticket.ticketNumber,
    });
  } catch (error) {
    console.error("[PUBLIC_HR_TICKET_POST]", error);
    return NextResponse.json(
      { error: "Failed to submit ticket" },
      { status: 500 }
    );
  }
}
