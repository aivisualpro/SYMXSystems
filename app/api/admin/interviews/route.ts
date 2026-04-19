import { requirePermission, ForbiddenError } from "@/lib/auth/require-permission";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import SymxInterview from "@/lib/models/SymxInterview";

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
    const status = searchParams.get("status");

    const query: any = {};
    if (status && status !== "all") query.status = status;

    if (limit > 0) {
      const totalCount = await SymxInterview.countDocuments(query);
      const records = await SymxInterview.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();
      return NextResponse.json({ records, totalCount, hasMore: skip + limit < totalCount });
    }

    const records = await SymxInterview.find(query).sort({ createdAt: -1 }).lean();
    return NextResponse.json(records);
  } catch (error) {
    console.error("[INTERVIEWS_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
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
    const doc = await SymxInterview.create(body);
    return NextResponse.json(doc);
  } catch (error) {
    console.error("[INTERVIEWS_POST]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
