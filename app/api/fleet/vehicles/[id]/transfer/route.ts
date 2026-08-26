import { requirePermission } from "@/lib/auth/require-permission";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import Vehicle from "@/lib/models/Vehicle";
import VehicleActivityLog from "@/lib/models/VehicleActivityLog";
import Site from "@/lib/models/Site";
import { getRequestScope, canAccessRecord } from "@/lib/scoped-query";

// POST /api/fleet/vehicles/[id]/transfer  { toSiteId, notes? }
//
// Moves a van to another station.
//
// Deliberately its own endpoint rather than a field on the generic
// vehicle PUT. That route $sets whatever the body contains, so allowing
// currentSiteId through it would make "which station owns this van" a
// silently writable field with no record of who changed it — and moving a
// van out of a station removes it from that station's fleet list, which
// is exactly the kind of change someone will later need explained.
//
// What does NOT move: every record the van produced. Its DFO2-era
// repairs, inspections and rental agreements keep siteId = DFO2, because
// that is where the work actually happened. Only the van's current
// location changes. Rewriting that history would make past fleet reports
// disagree with themselves depending on when they were run.

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission("Fleet", "edit");
  } catch (e: any) {
    if (e.name === "ForbiddenError") return NextResponse.json({ error: e.message }, { status: 403 });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const { toSiteId, notes } = await req.json();
    if (!toSiteId) {
      return NextResponse.json({ error: "toSiteId is required" }, { status: 400 });
    }

    await connectToDatabase();
    const session = await getSession();
    const scope = await getRequestScope();

    const vehicle = await Vehicle.findById(id);
    // Must be able to reach the van WHERE IT IS NOW, or anyone could pull
    // another station's vans across to their own.
    if (!vehicle || !canAccessRecord(scope, { siteId: (vehicle as any).currentSiteId })) {
      return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
    }

    // ...and must be entitled to the destination, or this becomes a way to
    // push a van somewhere the mover cannot see, making it unrecoverable
    // from their side.
    if (!scope.allowedSiteIds.includes(String(toSiteId))) {
      return NextResponse.json(
        { error: "You don't have access to the destination station." },
        { status: 403 }
      );
    }

    const destination = await Site.findById(toSiteId).lean();
    if (!destination || (destination as any).status !== "active") {
      return NextResponse.json(
        { error: "That station doesn't exist or is closed." },
        { status: 400 }
      );
    }

    const fromSiteId = (vehicle as any).currentSiteId ? String((vehicle as any).currentSiteId) : null;
    if (fromSiteId === String(toSiteId)) {
      return NextResponse.json(
        { error: `This van is already at ${(destination as any).code}.` },
        { status: 400 }
      );
    }

    const fromSite = fromSiteId ? await Site.findById(fromSiteId).lean() : null;
    const fromCode = fromSite ? (fromSite as any).code : "unassigned";
    const toCode = (destination as any).code;

    (vehicle as any).currentSiteId = toSiteId;
    await vehicle.save();

    // Audit trail on the vehicle itself. A van vanishing from one station's
    // list and appearing at another's needs to be explainable months later.
    await VehicleActivityLog.create({
      vehicleId: vehicle._id,
      vin: (vehicle as any).vin || "",
      serviceType: "Station transfer",
      startDate: new Date(),
      notes:
        `Transferred from ${fromCode} to ${toCode} by ${session?.email || "unknown"}` +
        (notes ? ` — ${notes}` : ""),
      // The log entry records an event at the DESTINATION, which is where
      // the van is from now on.
      siteId: toSiteId,
    }).catch((e) => {
      // The transfer itself already succeeded; losing the audit note should
      // not present as a failed transfer, but it must not pass silently.
      console.error("[fleet] Vehicle transfer succeeded but audit log failed:", e?.message);
    });

    return NextResponse.json({
      success: true,
      message: `Moved to ${toCode}. Its ${fromCode} history stays with ${fromCode}.`,
      vehicle: { id: String(vehicle._id), currentSiteId: String(toSiteId) },
    });
  } catch (error: any) {
    console.error("Vehicle transfer error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to transfer vehicle" },
      { status: 500 }
    );
  }
}
