import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import SymxReimbursement from "@/lib/models/SymxReimbursement";
import SymxEmployee from "@/lib/models/SymxEmployee";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await connectToDatabase();

    // Fetch reimbursements and employees in parallel
    const [data, employees] = await Promise.all([
      SymxReimbursement.find({}).sort({ date: -1 }).lean(),
      SymxEmployee.find({}, { transporterId: 1, firstName: 1, lastName: 1 }).lean(),
    ]);

    // Build a transporterId → full name map
    const nameMap = new Map<string, string>();
    for (const emp of employees) {
      if (emp.transporterId) {
        nameMap.set(emp.transporterId, `${emp.firstName || ""} ${emp.lastName || ""}`.trim());
      }
    }

    // Enrich each record with the resolved employee name
    const enriched = data.map((r: any) => ({
      ...r,
      employeeName: r.employeeName || nameMap.get(r.transporterId) || "",
    }));

    return NextResponse.json(enriched);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await connectToDatabase();
    const body = await req.json();
    const record = await SymxReimbursement.create(body);
    return NextResponse.json(record, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
