
import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import SymxAppRole from "@/lib/models/SymxAppRole";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectToDatabase();
    // Resolve params properly in Next.js 15+ (waiting if it's a promise, though typically it's object or promise depending on version)
    // The type signature suggests waiting might be needed in newer versions, but for now treating as params.id
    // To be safe we can await if params is a promise
    const { id } = await params;

    const role = await SymxAppRole.findById(id);
    if (!role) {
      return NextResponse.json({ error: "Role not found" }, { status: 404 });
    }
    return NextResponse.json(role);
  } catch (error) {
    console.error("Error fetching role:", error);
    return NextResponse.json({ error: "Failed to fetch role" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectToDatabase();
    const { id } = await params;
    const body = await req.json();

    const updatedRole = await SymxAppRole.findByIdAndUpdate(
      id,
      { $set: body },
      { new: true }
    );

    if (!updatedRole) {
      return NextResponse.json({ error: "Role not found" }, { status: 404 });
    }

    return NextResponse.json(updatedRole);
  } catch (error) {
    console.error("Error updating role:", error);
    return NextResponse.json({ error: "Failed to update role" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectToDatabase();
    const { id } = await params;

    const deletedRole = await SymxAppRole.findByIdAndDelete(id);

    if (!deletedRole) {
      return NextResponse.json({ error: "Role not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting role:", error);
    return NextResponse.json({ error: "Failed to delete role" }, { status: 500 });
  }
}
