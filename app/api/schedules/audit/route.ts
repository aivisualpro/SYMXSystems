import { requirePermission, ForbiddenError } from "@/lib/auth/require-permission";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import ScheduleAuditLog from "@/lib/models/ScheduleAuditLog";
import SymxUser from "@/lib/models/SymxUser";

// Resolve performer name from session, with DB fallback
async function resolvePerformerName(session: any): Promise<{ email: string; name: string }> {
    const email = session?.email || "unknown";
    const sessionName = session?.name || "";
    if (sessionName && sessionName.length > 1) {
        return { email, name: sessionName };
    }
    try {
        const user = await SymxUser.findOne({ email: email.toLowerCase() }, { name: 1 }).lean() as any;
        if (user?.name) {
            return { email, name: user.name };
        }
    } catch { }
    return { email, name: email };
}

// GET — Fetch audit logs for a given yearWeek
export async function GET(req: NextRequest) {
  try {
    await requirePermission("Scheduling", "view");
  } catch (e: any) {
    if (e.name === "ForbiddenError") {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const yearWeek = searchParams.get("yearWeek");
        const transporterId = searchParams.get("transporterId");
        const countsOnly = searchParams.get("counts") === "true";
        const limit = parseInt(searchParams.get("limit") || "100");

        if (!yearWeek) {
            return NextResponse.json({ error: "yearWeek is required" }, { status: 400 });
        }

        await connectToDatabase();

        // Return per-employee counts for the week
        if (countsOnly) {
            const counts = await ScheduleAuditLog.aggregate([
                { $match: { yearWeek } },
                { $group: { _id: "$transporterId", count: { $sum: 1 } } },
            ]);
            const countsMap: Record<string, number> = {};
            counts.forEach((c: any) => { countsMap[c._id] = c.count; });
            return NextResponse.json({ counts: countsMap });
        }

        const filter: Record<string, any> = { yearWeek };
        if (transporterId) {
            filter.transporterId = transporterId;
        }

        const logs = await ScheduleAuditLog
            .find(filter)
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean();

        // Enrich performer names from user DB for logs missing proper names
        const performerEmails = [...new Set(logs.map((l: any) => l.performedBy).filter(Boolean))];
        if (performerEmails.length > 0) {
            const users = await SymxUser.find(
                { email: { $in: performerEmails.map(e => e.toLowerCase()) } },
                { email: 1, name: 1 }
            ).lean();
            const userMap = new Map((users as any[]).map(u => [u.email.toLowerCase(), u.name]));
            logs.forEach((log: any) => {
                const dbName = userMap.get((log.performedBy || "").toLowerCase());
                if (dbName && (!log.performedByName || log.performedByName === "unknown" || log.performedByName === log.performedBy)) {
                    log.performedByName = dbName;
                }
            });
        }

        return NextResponse.json({ logs, totalCount: logs.length });
    } catch (error: any) {
        console.error("Audit GET Error:", error);
        return NextResponse.json(
            { error: error.message || "Internal server error" },
            { status: 500 }
        );
    }
}

// POST — Create a new audit log entry
export async function POST(req: NextRequest) {
  try {
    await requirePermission("Scheduling", "edit");
  } catch (e: any) {
    if (e.name === "ForbiddenError") {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        await connectToDatabase();

        const body = await req.json();
        const {
            yearWeek,
            transporterId,
            employeeName,
            action,
            field,
            oldValue,
            newValue,
            date,
            dayOfWeek,
        } = body;

        if (!yearWeek || !transporterId || !action || !field) {
            return NextResponse.json(
                { error: "yearWeek, transporterId, action, and field are required" },
                { status: 400 }
            );
        }

        const performer = await resolvePerformerName(session);

        const log = await ScheduleAuditLog.create({
            yearWeek,
            transporterId,
            employeeName: employeeName || "",
            action,
            field,
            oldValue: oldValue || "",
            newValue: newValue || "",
            date: date ? new Date(date) : undefined,
            dayOfWeek: dayOfWeek || "",
            performedBy: performer.email,
            performedByName: performer.name,
        });

        return NextResponse.json({ success: true, log });
    } catch (error: any) {
        console.error("Audit POST Error:", error);
        return NextResponse.json(
            { error: error.message || "Internal server error" },
            { status: 500 }
        );
    }
}
