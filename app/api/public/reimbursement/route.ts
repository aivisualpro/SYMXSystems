import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import SymxReimbursement from "@/lib/models/SymxReimbursement";
import {
  getNextRequestNumber,
  matchEmployeeForReimbursement,
  sendReimbursementNotificationEmail,
  sendReimbursementConfirmationEmail,
} from "@/lib/reimbursement-utils";

const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes — same throttle as the public HR ticket form

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

/**
 * PUBLIC endpoint — no auth required. Allows drivers with no account in this
 * app to submit their own itemized reimbursement request via the shared
 * /submit-reimbursement link/QR code, mirroring app/api/public/hr-ticket.
 *
 * Same hardening as the ticket route: explicit field whitelist (never
 * spreads the raw body into .create()), honeypot, IP throttling, and an
 * atomic shared request-number counter. Employee identity is resolved the
 * same two-tier way as tickets (matchEmployeeForReimbursement) — an
 * unambiguous exact match on name/email auto-links, an ambiguous one is
 * only surfaced as a suggestion for a human to confirm in the admin
 * workbench, and a typed identifier is never trusted directly.
 */
export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();
    const body = await req.json();

    // ── Honeypot ──
    if (typeof body.website === "string" && body.website.trim() !== "") {
      return NextResponse.json({ success: true, requestNumber: "0" });
    }

    const submitterName = typeof body.submitterName === "string" ? body.submitterName.slice(0, 200) : "";
    const submitterEmail = typeof body.submitterEmail === "string" ? body.submitterEmail.slice(0, 200) : "";

    if (!submitterName.trim()) {
      return NextResponse.json({ error: "Your name is required" }, { status: 400 });
    }

    const items = Array.isArray(body.items)
      ? body.items
          .map((it: any) => ({
            description: String(it.description || "").slice(0, 500),
            category: it.category ? String(it.category).slice(0, 100) : undefined,
            amount: typeof it.amount === "string" ? parseFloat(it.amount) : Number(it.amount) || 0,
          }))
          .filter((it: any) => it.description && it.amount > 0)
          .slice(0, 50)
      : [];

    if (items.length === 0) {
      return NextResponse.json({ error: "At least one itemized expense with a description and amount is required" }, { status: 400 });
    }

    const attachments = Array.isArray(body.attachments)
      ? body.attachments.filter((a: any) => typeof a === "string" && a.startsWith("http")).slice(0, 20)
      : [];

    // ── Rate limit by IP ──
    const ip = getClientIp(req);
    if (ip !== "unknown") {
      const recentCount = await SymxReimbursement.countDocuments({
        submitterIp: ip,
        createdAt: { $gte: new Date(Date.now() - RATE_LIMIT_WINDOW_MS) },
      });
      if (recentCount >= RATE_LIMIT_MAX) {
        return NextResponse.json({ error: "Too many submissions. Please try again later." }, { status: 429 });
      }
    }

    const { exact, suggested } = await matchEmployeeForReimbursement(submitterName, submitterEmail);

    const amount = items.reduce((sum: number, it: any) => sum + it.amount, 0);
    const requestNumber = await getNextRequestNumber();

    const activity: any[] = [
      { type: "created", text: "Submitted via public form", byName: submitterName.trim(), byEmail: submitterEmail, createdAt: new Date() },
    ];
    if (exact) {
      activity.push({
        type: "system",
        text: `Auto-matched to ${exact.firstName} ${exact.lastName}`.trim(),
        createdAt: new Date(),
      });
    }

    const record = await SymxReimbursement.create({
      requestNumber,
      items,
      amount,
      category: items[0]?.category,
      date: body.date ? new Date(body.date) : new Date(),
      notes: typeof body.notes === "string" ? body.notes.slice(0, 2000) : "",
      attachments,
      attachment: attachments[0] || undefined,
      submitterName: submitterName.trim(),
      submitterEmail: submitterEmail.trim(),
      submitterIp: ip !== "unknown" ? ip : undefined,
      source: "public",
      status: "pending",
      createdBy: submitterName.trim(),
      employeeId: exact?._id || undefined,
      transporterId: exact?.transporterId || "",
      employeeMatchType: exact ? "auto" : undefined,
      suggestedEmployeeId: !exact && suggested ? suggested._id : undefined,
      activity,
    });

    // Awaited (not fire-and-forget) — serverless functions can freeze the
    // instant the response is sent, killing any still-pending promise. Each
    // helper swallows its own errors so a Resend outage can't fail the
    // request itself.
    await sendReimbursementNotificationEmail({
      requestNumber: record.requestNumber,
      total: record.amount,
      submitterName: record.submitterName,
      submitterEmail: record.submitterEmail,
      itemCount: items.length,
    });
    await sendReimbursementConfirmationEmail({
      requestNumber: record.requestNumber,
      total: record.amount,
      submitterName: record.submitterName,
      submitterEmail: record.submitterEmail,
    });

    return NextResponse.json({ success: true, requestId: record._id, requestNumber: record.requestNumber });
  } catch (error) {
    console.error("[PUBLIC_REIMBURSEMENT_POST]", error);
    return NextResponse.json({ error: "Failed to submit reimbursement request" }, { status: 500 });
  }
}
