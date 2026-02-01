import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import VidaReleaseRequest from "@/lib/models/VidaReleaseRequest";
import VidaProduct from "@/lib/models/VidaProduct";
import VidaWarehouse from "@/lib/models/VidaWarehouse";

// Force dynamic to ensure fresh data
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await connectToDatabase();
    const requests = await VidaReleaseRequest.find()
      .populate("product")
      .populate("warehouse")
      .sort({ createdAt: -1 });
    return NextResponse.json(requests);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    await connectToDatabase();
    
    const newRequest = await VidaReleaseRequest.create(body);
    const populated = await newRequest.populate(["product", "warehouse"]);
    
    return NextResponse.json(populated, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
