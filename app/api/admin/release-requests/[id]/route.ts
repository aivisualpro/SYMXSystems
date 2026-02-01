import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import VidaReleaseRequest from "@/lib/models/VidaReleaseRequest";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await connectToDatabase();
    const { id } = await params;
    const requestItem = await VidaReleaseRequest.findById(id)
      .populate("product")
      .populate("warehouse");
      
    if (!requestItem) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(requestItem);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    await connectToDatabase();
    const { id } = await params;
    
    const updated = await VidaReleaseRequest.findByIdAndUpdate(id, body, {
      new: true,
      runValidators: true,
    }).populate(["product", "warehouse"]);

    if (!updated) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await connectToDatabase();
    const { id } = await params;
    const deleted = await VidaReleaseRequest.findByIdAndDelete(id);
    
    if (!deleted) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ message: "Deleted successfully" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
