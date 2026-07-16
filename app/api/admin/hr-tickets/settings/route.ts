import { requirePermission } from "@/lib/auth/require-permission";
import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import SymxHrTicketSettings from "@/lib/models/SymxHrTicketSettings";

export async function GET() {
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
    let settings = await SymxHrTicketSettings.findOne().lean();
    if (!settings) {
      settings = (await SymxHrTicketSettings.create({})).toObject();
    }
    return NextResponse.json({ notificationEmails: (settings as any).notificationEmails || [] });
  } catch (error) {
    console.error("[HR_TICKET_SETTINGS_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
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
    const body = await req.json();
    const notificationEmails = Array.isArray(body.notificationEmails)
      ? body.notificationEmails
          .map((e: any) => String(e || "").trim())
          .filter((e: string) => e.length > 0)
      : [];

    let settings = await SymxHrTicketSettings.findOne();
    if (!settings) {
      settings = await SymxHrTicketSettings.create({ notificationEmails });
    } else {
      settings.notificationEmails = notificationEmails;
      await settings.save();
    }

    return NextResponse.json({ notificationEmails: settings.notificationEmails });
  } catch (error) {
    console.error("[HR_TICKET_SETTINGS_PUT]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
