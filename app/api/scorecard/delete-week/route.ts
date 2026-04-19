import { requirePermission, ForbiddenError } from "@/lib/auth/require-permission";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import SymxDeliveryExcellence from "@/lib/models/SymxDeliveryExcellence";
import SymxPhotoOnDelivery from "@/lib/models/SymxPhotoOnDelivery";
import SymxDVICVehicleInspection from "@/lib/models/SymxDVICVehicleInspection";
import SymxSafetyDashboardDFO2 from "@/lib/models/SymxSafetyDashboardDFO2";
import ScoreCardCDFNegative from "@/lib/models/ScoreCardCDFNegative";
import ScoreCardQualityDSBDNR from "@/lib/models/ScoreCardQualityDSBDNR";
import ScoreCardDCR from "@/lib/models/ScoreCardDCR";
import ScoreCardRTS from "@/lib/models/ScoreCardRTS";

// Map tab slugs to their Mongoose models
const TAB_MODEL_MAP: Record<string, any> = {
  "Drivers": SymxDeliveryExcellence,         // Drivers tab = Delivery Excellence data
  "SYMX": null,                               // Aggregated view, no single collection
  "Delivery-Excellence": SymxDeliveryExcellence,
  "POD": SymxPhotoOnDelivery,
  "CDF-Negative": ScoreCardCDFNegative,
  "DVIC": SymxDVICVehicleInspection,
  "Safety": SymxSafetyDashboardDFO2,
  "DSB": ScoreCardQualityDSBDNR,
  "DCR": ScoreCardDCR,
  "RTS": ScoreCardRTS,
};

export async function DELETE(req: NextRequest) {
  try {
    await requirePermission("Scorecard", "delete");
  } catch (e: any) {
    if (e.name === "ForbiddenError") {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const session = await getSession();
    if (!session || !session.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const week = searchParams.get("week");
    const tab = searchParams.get("tab");

    if (!week || !tab) {
      return NextResponse.json({ error: "Both 'week' and 'tab' are required" }, { status: 400 });
    }

    await connectToDatabase();

    const Model = TAB_MODEL_MAP[tab];
    if (Model === undefined) {
      return NextResponse.json({ error: `Unknown tab: ${tab}` }, { status: 400 });
    }

    if (Model === null) {
      return NextResponse.json({ error: `Cannot delete data for the ${tab} tab directly — it is an aggregated view.` }, { status: 400 });
    }

    // Delete all records for this week
    const result = await Model.deleteMany({ week });

    return NextResponse.json({
      success: true,
      deleted: result.deletedCount || 0,
      tab,
      week,
    });
  } catch (error) {
    console.error("Error deleting scorecard week data:", error);
    return NextResponse.json({ error: "Failed to delete data" }, { status: 500 });
  }
}
