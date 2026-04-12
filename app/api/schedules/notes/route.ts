import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import { getSession } from "@/lib/auth";
import SymxEmployeeNote from "@/lib/models/SymxEmployeeNote";
import SymxUser from "@/lib/models/SymxUser";

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
  } catch {}
  return { email, name: email.split("@")[0] };
}

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await connectToDatabase();
    const { searchParams } = new URL(req.url);
    const transporterId = searchParams.get("transporterId");
    const getCounts = searchParams.get("getCounts") === "true";

    // 1. Fetch bulk counts map for the whole table
    if (getCounts) {
      const countsRaw = await SymxEmployeeNote.aggregate([
        { $group: { _id: "$transporterId", count: { $sum: 1 } } }
      ]);
      const countsMap: Record<string, number> = {};
      countsRaw.forEach(c => {
        countsMap[c._id] = c.count;
      });
      return NextResponse.json({ counts: countsMap });
    }

    // 2. Fetch specific employee's notes
    if (!transporterId) {
      return NextResponse.json({ error: "transporterId required" }, { status: 400 });
    }

    const notes = await SymxEmployeeNote.find({ transporterId })
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({ notes });
  } catch (error: any) {
    console.error("Notes GET Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await connectToDatabase();
    const performer = await resolvePerformerName(session);

    const body = await req.json();
    const { employeeId, transporterId, note } = body;

    if (!employeeId || !transporterId || !note) {
      return NextResponse.json({ error: "employeeId, transporterId, and note are required" }, { status: 400 });
    }

    const newNote = await SymxEmployeeNote.create({
      employeeId,
      transporterId,
      note,
      createdBy: performer.name || performer.email || "Unknown User",
    });

    return NextResponse.json({ success: true, note: newNote });
  } catch (error: any) {
    console.error("Notes POST Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
