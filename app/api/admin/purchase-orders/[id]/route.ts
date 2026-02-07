
import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import SymxPO from "@/lib/models/SymxPO";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(req: Request, { params }: RouteParams) {
  try {
    await connectToDatabase();
    const { id } = await params;
    const item = await SymxPO.findById(id);

    if (!item) {
      return NextResponse.json(
        { error: "Purchase Order not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(item);
  } catch (error) {
    console.error("Failed to fetch purchase order:", error);
    return NextResponse.json(
      { error: "Failed to fetch purchase order" },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request, { params }: RouteParams) {
  try {
    await connectToDatabase();
    const { id } = await params;
    const data = await req.json();
    const updatedItem = await SymxPO.findByIdAndUpdate(id, data, {
      new: true,
      runValidators: true,
    });

    if (!updatedItem) {
      return NextResponse.json(
        { error: "Purchase Order not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(updatedItem);
  } catch (error) {
    console.error("Failed to update purchase order:", error);
    return NextResponse.json(
      { error: "Failed to update purchase order" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request, { params }: RouteParams) {
  try {
    await connectToDatabase();
    const { id } = await params;
    const deletedItem = await SymxPO.findByIdAndDelete(id);

    if (!deletedItem) {
      return NextResponse.json(
        { error: "Purchase Order not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ message: "Purchase Order deleted successfully" });
  } catch (error) {
    console.error("Failed to delete purchase order:", error);
    return NextResponse.json(
      { error: "Failed to delete purchase order" },
      { status: 500 }
    );
  }
}
