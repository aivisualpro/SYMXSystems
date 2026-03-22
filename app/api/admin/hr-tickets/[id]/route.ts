import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import SymxHrTicket from "@/lib/models/SymxHrTicket";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    await connectToDatabase();
    const { id } = await params;
    const ticket = await SymxHrTicket.findById(id).lean();
    if (!ticket) return new NextResponse("Not Found", { status: 404 });
    return NextResponse.json(ticket);
  } catch (error) {
    console.error("[HR_TICKET_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    await connectToDatabase();
    const session = await getSession();
    if (!session?.role) return new NextResponse("Unauthorized", { status: 401 });

    const { id } = await params;
    const body = await req.json();
    const ticket = await SymxHrTicket.findByIdAndUpdate(id, body, { new: true });
    if (!ticket) return new NextResponse("Not Found", { status: 404 });
    return NextResponse.json(ticket);
  } catch (error) {
    console.error("[HR_TICKET_PUT]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    await connectToDatabase();
    const session = await getSession();
    if (!session?.role) return new NextResponse("Unauthorized", { status: 401 });

    const { id } = await params;
    await SymxHrTicket.findByIdAndDelete(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[HR_TICKET_DELETE]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
