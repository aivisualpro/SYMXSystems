import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import SymxReleaseRequest from "@/lib/models/SymxReleaseRequest";
import SymxProduct from "@/lib/models/SymxProduct";
import SymxWarehouse from "@/lib/models/SymxWarehouse";
import { getSession } from "@/lib/auth";

// Force dynamic to ensure fresh data
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await connectToDatabase();
    const requests = await SymxReleaseRequest.find()
      .populate("warehouse")
      .populate("customer")
      .populate("requestedBy")
      .populate({
         path: 'releaseOrderProducts.product',
         model: 'SymxProduct'
      })
      .sort({ createdAt: -1 });
    return NextResponse.json(requests);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}


export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    await connectToDatabase();
    
    // Auto-populate createdBy from session
    body.createdBy = session.name || session.email;

    const newRequest = await SymxReleaseRequest.create(body);
    const populated = await SymxReleaseRequest.findById(newRequest._id)
      .populate("warehouse")
      .populate("customer")
      .populate("requestedBy")
      .populate({
         path: 'releaseOrderProducts.product',
         model: 'SymxProduct'
      });
    
    return NextResponse.json(populated, { status: 201 });
  } catch (error: any) {
    console.error("Release Request Create Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
