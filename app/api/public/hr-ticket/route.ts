import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import SymxHrTicket from "@/lib/models/SymxHrTicket";

/**
 * PUBLIC endpoint — no auth required.
 * Allows external users to submit HR tickets via shared link.
 */
export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();
    const body = await req.json();

    // Basic validation
    if (!body.category && !body.issue) {
      return NextResponse.json(
        { error: "Category or Issue is required" },
        { status: 400 }
      );
    }

    // Auto-generate ticket number
    const lastTicket = await SymxHrTicket.findOne({}, { ticketNumber: 1 })
      .sort({ createdAt: -1 })
      .lean();

    let nextNum = 1;
    if (lastTicket?.ticketNumber) {
      const parsed = parseInt(lastTicket.ticketNumber.replace(/\D/g, ""), 10);
      if (!isNaN(parsed)) nextNum = parsed + 1;
    }

    const ticket = await SymxHrTicket.create({
      ...body,
      ticketNumber: String(nextNum),
      approveDeny: "",
      createdBy: body.submitterName || "Public Form",
    });

    return NextResponse.json({ success: true, ticketId: ticket._id });
  } catch (error) {
    console.error("[PUBLIC_HR_TICKET_POST]", error);
    return NextResponse.json(
      { error: "Failed to submit ticket" },
      { status: 500 }
    );
  }
}
