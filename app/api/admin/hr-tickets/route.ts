import { requirePermission, ForbiddenError } from "@/lib/auth/require-permission";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import SymxHrTicket from "@/lib/models/SymxHrTicket";
import SymxEmployee from "@/lib/models/SymxEmployee";
import SymxUser from "@/lib/models/SymxUser";
import { getNextTicketNumber } from "@/lib/hr-ticket-utils";

export async function GET(req: NextRequest) {
  try {
    await requirePermission("HR", "view");
  } catch (e: any) {
    if (e.name === "ForbiddenError") {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectToDatabase();
    const { searchParams } = new URL(req.url);
    const skip = parseInt(searchParams.get("skip") || "0");
    const limit = parseInt(searchParams.get("limit") || "0");

    const query: any = {};

    let tickets: any[];

    if (limit > 0) {
      const totalCount = await SymxHrTicket.countDocuments(query);
      tickets = await SymxHrTicket.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

      // Enrich with employee names
      const enriched = await enrichTickets(tickets);
      return NextResponse.json({ records: enriched, totalCount, hasMore: skip + limit < totalCount });
    }

    tickets = await SymxHrTicket.find(query).sort({ createdAt: -1 }).lean();
    const enriched = await enrichTickets(tickets);
    return NextResponse.json(enriched);
  } catch (error) {
    console.error("[HR_TICKETS_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

async function enrichTickets(tickets: any[]) {
  // ── Resolve employeeId + suggestedEmployeeId → employee name in one
  // batched lookup (the former is the confirmed/auto link, the latter is
  // an unconfirmed suggestion the admin UI offers as a one-click match) ──
  const employeeIds = [...new Set(
    tickets.map((t) => t.employeeId).filter(Boolean).map((id: any) => String(id))
  )];
  const suggestedIds = [...new Set(
    tickets.map((t) => t.suggestedEmployeeId).filter(Boolean).map((id: any) => String(id))
  )];
  const allIds = [...new Set([...employeeIds, ...suggestedIds])];

  const empByIdMap = new Map<string, { employeeName: string; profileImage: string; transporterId: string }>();
  if (allIds.length > 0) {
    const employees = await SymxEmployee.find(
      { _id: { $in: allIds } },
      { transporterId: 1, firstName: 1, lastName: 1, profileImage: 1 }
    ).lean();
    employees.forEach((emp: any) => {
      empByIdMap.set(String(emp._id), {
        employeeName: `${emp.firstName || ""} ${emp.lastName || ""}`.trim(),
        profileImage: emp.profileImage || "",
        transporterId: emp.transporterId || "",
      });
    });
  }

  // ── Fallback: resolve bare transporterId → employee name, for legacy/
  // imported tickets that predate the employeeId link and were never
  // manually re-linked ──
  const transporterIds = [...new Set(
    tickets.filter((t) => !t.employeeId && t.transporterId).map((t) => t.transporterId)
  )];

  const empByTransporterMap = new Map<string, { employeeName: string; profileImage: string }>();
  if (transporterIds.length > 0) {
    const employees = await SymxEmployee.find(
      { transporterId: { $in: transporterIds } },
      { transporterId: 1, firstName: 1, lastName: 1, profileImage: 1 }
    ).lean();
    employees.forEach((emp: any) => {
      empByTransporterMap.set(emp.transporterId, {
        employeeName: `${emp.firstName || ""} ${emp.lastName || ""}`.trim(),
        profileImage: emp.profileImage || "",
      });
    });
  }

  // ── Resolve closedBy email → user name ──
  const closedByEmails = [...new Set(
    tickets.map((t) => t.closedBy).filter(Boolean)
  )];

  const userMap = new Map<string, string>();
  if (closedByEmails.length > 0) {
    const users = await SymxUser.find(
      { email: { $in: closedByEmails } },
      { email: 1, name: 1 }
    ).lean();
    users.forEach((u: any) => {
      userMap.set(u.email, u.name || u.email);
    });
  }

  // ── Enrich tickets ──
  return tickets.map((t) => {
    const empById = t.employeeId ? empByIdMap.get(String(t.employeeId)) : null;
    const empByTransporter = !empById && t.transporterId ? empByTransporterMap.get(t.transporterId) : null;
    const emp = empById || empByTransporter;
    const suggested = !t.employeeId && t.suggestedEmployeeId ? empByIdMap.get(String(t.suggestedEmployeeId)) : null;
    return {
      ...t,
      // Falls back to the driver's typed name (submitterName) when the
      // ticket isn't linked to a known SymxEmployee record — previously
      // any public-form ticket without a transporterId match displayed
      // "Unknown" in the card grid even though the submitter's name was
      // sitting right there in the document.
      employeeName: emp?.employeeName || t.submitterName || "",
      profileImage: emp?.profileImage || "",
      closedByName: t.closedBy ? (userMap.get(t.closedBy) || t.closedBy) : "",
      // Only present when there's an unconfirmed suggested match to show.
      suggestedEmployeeName: suggested?.employeeName || "",
      suggestedProfileImage: suggested?.profileImage || "",
      suggestedTransporterId: suggested?.transporterId || "",
    };
  });
}

export async function POST(req: Request) {
  try {
    await requirePermission("HR", "edit");
  } catch (e: any) {
    if (e.name === "ForbiddenError") {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectToDatabase();
    const session = await getSession();
    if (!session?.role) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const body = await req.json();
    // Assign from the same atomic counter the public form uses, so ticket
    // numbers stay unique across both entry points instead of the two
    // paths handing out overlapping numbers independently.
    const ticketNumber = body.ticketNumber || (await getNextTicketNumber());
    const ticket = await SymxHrTicket.create({ ...body, ticketNumber, source: body.source || "admin" });
    return NextResponse.json(ticket);
  } catch (error) {
    console.error("[HR_TICKETS_POST]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
