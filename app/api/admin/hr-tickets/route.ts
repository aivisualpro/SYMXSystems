import { requirePermission, ForbiddenError } from "@/lib/auth/require-permission";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import SymxHrTicket from "@/lib/models/SymxHrTicket";
import SymxEmployee from "@/lib/models/SymxEmployee";
import SymxUser from "@/lib/models/SymxUser";

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
  // ── Resolve transporterId → employee name ──
  const transporterIds = [...new Set(
    tickets.map((t) => t.transporterId).filter(Boolean)
  )];

  const empMap = new Map<string, { employeeName: string; profileImage: string }>();
  if (transporterIds.length > 0) {
    const employees = await SymxEmployee.find(
      { transporterId: { $in: transporterIds } },
      { transporterId: 1, firstName: 1, lastName: 1, profileImage: 1 }
    ).lean();
    employees.forEach((emp: any) => {
      empMap.set(emp.transporterId, {
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
    const emp = t.transporterId ? empMap.get(t.transporterId) : null;
    return {
      ...t,
      employeeName: emp?.employeeName || "",
      profileImage: emp?.profileImage || "",
      closedByName: t.closedBy ? (userMap.get(t.closedBy) || t.closedBy) : "",
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
    const ticket = await SymxHrTicket.create(body);
    return NextResponse.json(ticket);
  } catch (error) {
    console.error("[HR_TICKETS_POST]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
