import { requirePermission } from "@/lib/auth/require-permission";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import Vehicle from "@/lib/models/Vehicle";
import VehicleActivityLog from "@/lib/models/VehicleActivityLog";
import Site from "@/lib/models/Site";
import { getRequestScope, siteFilter } from "@/lib/scoped-query";
import { moveVehicleRecords } from "@/lib/fleet/transfer-vehicle";

// POST /api/fleet/vehicles/transfer  { vehicleIds: string[], toSiteId, notes? }
//
// Bulk version of the per-vehicle transfer. Standing up a new station
// means moving vans in batches, and doing that one at a time invites
// stopping halfway and losing track of which ones moved.
//
// Each van's history moves with it: repairs, inspections, rental
// agreements and activity log are repointed at the new station, because
// the station running a van needs its full record and carries its cost.
// See lib/fleet/transfer-vehicle.ts for why this differs from routes and
// write-ups, which stay with the station where they happened.

export async function POST(req: NextRequest) {
  try {
    await requirePermission("Fleet", "edit");
  } catch (e: any) {
    if (e.name === "ForbiddenError") return NextResponse.json({ error: e.message }, { status: 403 });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { vehicleIds, toSiteId, notes } = await req.json();

    if (!Array.isArray(vehicleIds) || vehicleIds.length === 0) {
      return NextResponse.json({ error: "Select at least one vehicle." }, { status: 400 });
    }
    if (!toSiteId) {
      return NextResponse.json({ error: "Choose a destination station." }, { status: 400 });
    }

    await connectToDatabase();
    const session = await getSession();
    const scope = await getRequestScope();

    if (!scope.allowedSiteIds.includes(String(toSiteId))) {
      return NextResponse.json(
        { error: "You don't have access to the destination station." },
        { status: 403 }
      );
    }

    const destination: any = await Site.findById(toSiteId).lean();
    if (!destination || destination.status !== "active") {
      return NextResponse.json({ error: "That station doesn't exist or is closed." }, { status: 400 });
    }

    // The station filter goes IN the query: ids the caller isn't entitled
    // to simply don't match, rather than being fetched and then rejected.
    // The count difference is reported back so a partial match is visible
    // instead of looking like a clean success.
    const vehicles = await Vehicle.find({
      _id: { $in: vehicleIds },
      ...siteFilter(scope, { includeUnassigned: true, field: "currentSiteId" }),
    });

    const notFound = vehicleIds.length - vehicles.length;
    const alreadyThere = vehicles.filter(
      (v: any) => String(v.currentSiteId || "") === String(toSiteId)
    ).length;
    const toMove = vehicles.filter((v: any) => String(v.currentSiteId || "") !== String(toSiteId));

    if (toMove.length === 0) {
      return NextResponse.json({
        moved: 0,
        alreadyThere,
        notFound,
        message: alreadyThere
          ? `All selected vans are already at ${destination.code}.`
          : "Nothing to move.",
      });
    }

    // Codes resolved once for the audit notes rather than per vehicle.
    const siteCodes = new Map<string, string>();
    for (const s of await Site.find({}).lean()) {
      siteCodes.set(String((s as any)._id), (s as any).code);
    }

    const movedIds = toMove.map((v: any) => v._id);
    await Vehicle.updateMany({ _id: { $in: movedIds } }, { $set: { currentSiteId: toSiteId } });

    // History follows each van. Sequential rather than parallel: these are
    // multi-collection updates and a burst of them across a large batch
    // would contend for the same documents.
    let historyMoved = 0;
    for (const v of toMove) {
      const counts = await moveVehicleRecords(
        { _id: v._id, vin: (v as any).vin, unitNumber: (v as any).unitNumber },
        String(toSiteId)
      );
      historyMoved += Object.values(counts).reduce((a, b) => a + b, 0);
    }

    // One audit entry per van. A van disappearing from a station's list
    // needs to be explainable months later, and a single summary row would
    // not be findable from the vehicle it describes.
    await VehicleActivityLog.insertMany(
      toMove.map((v: any) => ({
        vehicleId: v._id,
        vin: v.vin || "",
        serviceType: "Station transfer",
        startDate: new Date(),
        notes:
          `Transferred from ${siteCodes.get(String(v.currentSiteId)) || "unassigned"} ` +
          `to ${destination.code} by ${session?.email || "unknown"}` +
          (notes ? ` — ${notes}` : ""),
        siteId: toSiteId,
      }))
    ).catch((e) => {
      console.error("[fleet] Bulk transfer succeeded but audit log failed:", e?.message);
    });

    return NextResponse.json({
      moved: toMove.length,
      alreadyThere,
      notFound,
      message:
        `Moved ${toMove.length} van${toMove.length === 1 ? "" : "s"} to ${destination.code}.` +
        (alreadyThere ? ` ${alreadyThere} already there.` : "") +
        (notFound ? ` ${notFound} not found or not yours.` : "") +
        ` ${historyMoved} history record${historyMoved === 1 ? "" : "s"} moved with them.`,
    });
  } catch (error: any) {
    console.error("Bulk vehicle transfer error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to transfer vehicles" },
      { status: 500 }
    );
  }
}
