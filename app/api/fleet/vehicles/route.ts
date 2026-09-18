import { requirePermission } from "@/lib/auth/require-permission";
import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import { getRequestScope, siteFilter, canAccessRecord, resolveWriteSiteId, orgWide } from "@/lib/scoped-query";
import Vehicle from "@/lib/models/Vehicle";
import DailyInspection from "@/lib/models/DailyInspection";
import Site from "@/lib/models/Site";
import VehicleActivityLog from "@/lib/models/VehicleActivityLog";
import { moveVehicleRecords } from "@/lib/fleet/transfer-vehicle";
import { authorizeAction } from "@/lib/rbac";
import { getSession } from "@/lib/auth";

/**
 * A human-readable explanation of where a duplicate-VIN vehicle actually
 * lives, for the case where it's a genuine live duplicate (not a Returned
 * van being reactivated — that path never reaches this function).
 */
async function describeDuplicateVin(vin: string, dup: any): Promise<string> {
  let stationLabel = "no station (unassigned)";
  if (dup.currentSiteId) {
    try {
      const site: any = await Site.findById(dup.currentSiteId).lean();
      stationLabel = site ? `${site.code} — ${site.name}` : "an unknown station";
    } catch { /* fall back to the generic label above */ }
  }
  return (
    `A vehicle with VIN ${vin} already exists` +
    (dup.vehicleName ? ` (${dup.vehicleName})` : "") +
    ` at ${stationLabel}, status "${dup.status || "Active"}". ` +
    (dup.status === "Returned"
      ? "It's marked Returned — toggle \"Returned\" on in the vehicle list to find it, or try adding it again to reactivate it."
      : "Search for it directly, or use Transfer on its page if it belongs at a different station.")
  );
}

export async function GET(req: NextRequest) {
  try { await requirePermission("Fleet", "view"); } catch (e: any) {
    if (e.name === "ForbiddenError") return NextResponse.json({ error: e.message }, { status: 403 });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const auth = await authorizeAction("Fleet", "view");
    if (!auth.authorized) return auth.response;

    await connectToDatabase();
    const { searchParams } = new URL(req.url);
    const includeReturned = searchParams.get("includeReturned") === "true";
    // Vehicles carry currentSiteId — they transfer between stations.
    const vScope = await getRequestScope();
    const filter: any = {
      ...siteFilter(vScope, { includeUnassigned: true, field: "currentSiteId" }),
      ...(includeReturned ? {} : { status: { $ne: "Returned" } }),
    };
    
    // Fetch vehicles and latest inspection mileage in parallel
    const [vehiclesRaw, latestMileages] = await Promise.all([
      Vehicle.find(filter)
        .select("-notes -info -__v")
        .sort({ createdAt: -1 })
        .lean(),
      // Get the latest non-zero mileage per VIN from daily inspections
      DailyInspection.aggregate([
        // Scoped: this feeds the mileage column of the station's own
        // vehicle list, so it must not average in another station's
        // odometer readings.
        { $match: { mileage: { $gt: 0 }, ...siteFilter(vScope, { includeUnassigned: true }) } },
        { $sort: { routeDate: -1 } },
        { $group: {
          _id: "$vin",
          lastMileage: { $first: "$mileage" },
          lastMileageDate: { $first: "$routeDate" },
        }},
      ]),
    ]);

    // Build a lookup map: VIN → { mileage, date }
    const mileageMap = new Map<string, { mileage: number; date: Date }>();
    for (const entry of latestMileages) {
      if (entry._id) {
        mileageMap.set(entry._id, { mileage: entry.lastMileage, date: entry.lastMileageDate });
      }
    }

    // Enrich vehicles with latest inspection mileage
    const vehicles = vehiclesRaw.map((v: any) => {
      const inspectionMileage = v.vin ? mileageMap.get(v.vin) : null;
      if (inspectionMileage) {
        v.mileage = inspectionMileage.mileage;
        v.lastMileageDate = inspectionMileage.date;
      }
      return v;
    });
      
    return NextResponse.json({ vehicles });
  } catch (error) {
    console.error("Fleet Vehicles GET Error:", error);
    return NextResponse.json({ error: "Failed to fetch vehicles" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try { await requirePermission("Fleet", "edit"); } catch (e: any) {
    if (e.name === "ForbiddenError") return NextResponse.json({ error: e.message }, { status: 403 });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let data: any = null;
  try {
    const auth = await authorizeAction("Fleet", "create");
    if (!auth.authorized) return auth.response;

    await connectToDatabase();
    const body = await req.json();
    data = body.data || body;

    if (data) {
      for (const key of Object.keys(data)) {
        if (data[key] === "") data[key] = null;
      }
    }

    // ── Which station does this van belong to? ──
    // The add-vehicle form never asked, and Vehicle.create(data) never set
    // currentSiteId itself — so every van created this way landed with NO
    // station at all. siteFilter's "unassigned" shim only surfaces those to
    // whoever is viewing the DEFAULT station, so from DXC8 (or any
    // non-default station) the van you just added simply never appeared:
    // it wasn't broken, it was invisible. resolveWriteSiteId honors an
    // explicit station picked in the form, or falls back to the single
    // station currently in view; it returns null when that's ambiguous
    // (0 or 2+ active stations and no explicit pick), which we now refuse
    // outright rather than silently repeating the bug.
    const createScope = await getRequestScope();
    const writeSiteId = resolveWriteSiteId(createScope, data.currentSiteId ?? null);
    if (!writeSiteId) {
      return NextResponse.json(
        { error: "Select which station this vehicle belongs to." },
        { status: 400 }
      );
    }
    data.currentSiteId = writeSiteId;

    // ── A van that left as "Returned" and is now coming back ──
    // Vans get returned to the leasing company and picked up again later
    // in the season — sometimes by a different station than the one that
    // returned it. Checked org-wide (a Returned van is invisible in the
    // normal list unless that toggle is on, and might be sitting at a
    // DIFFERENT station than the one adding it back). Reactivating in
    // place instead of erroring means the van keeps its _id, and with it
    // its whole repair/inspection/rental history — recreating it fresh
    // would orphan all of that under a new, disconnected record.
    if (data.vin) {
      const existingByVin: any = await orgWide(
        Vehicle.findOne({ vin: data.vin }),
        "checking whether this VIN already exists anywhere in the org, so a returned van can be reactivated instead of blocked as a duplicate"
      );
      if (existingByVin) {
        if (String(existingByVin.status || "").trim() !== "Returned") {
          // A live duplicate — not ours to silently merge. Same
          // find-and-explain path as the race-condition catch below.
          return NextResponse.json(
            { error: await describeDuplicateVin(data.vin, existingByVin) },
            { status: 409 }
          );
        }

        // Only apply fields the form actually provided — someone re-adding
        // a van by typing just the essentials shouldn't blank out year,
        // make, dashcam, etc. that are still sitting on the old record.
        const updateFields: Record<string, any> = {};
        for (const [k, v] of Object.entries(data)) {
          if (k === "vin" || v === null || v === undefined) continue;
          updateFields[k] = v;
        }
        updateFields.currentSiteId = writeSiteId;
        updateFields.status = data.status || "Active";

        const previousSiteId = existingByVin.currentSiteId ? String(existingByVin.currentSiteId) : null;
        const reactivated = await Vehicle.findByIdAndUpdate(
          existingByVin._id,
          { $set: updateFields },
          { new: true }
        );

        let historyMoved = 0;
        const movedStation = previousSiteId && previousSiteId !== String(writeSiteId);
        if (movedStation) {
          const counts = await moveVehicleRecords({ _id: existingByVin._id, vin: existingByVin.vin }, String(writeSiteId));
          historyMoved = Object.values(counts).reduce((a: number, b: number) => a + b, 0);
        }

        const session = await getSession();
        let stationCode = "";
        try {
          const site: any = await Site.findById(writeSiteId).lean();
          stationCode = site?.code || "";
        } catch { /* best-effort label only */ }

        await VehicleActivityLog.create({
          vehicleId: existingByVin._id,
          vin: existingByVin.vin || "",
          serviceType: "Reactivated",
          startDate: new Date(),
          notes:
            `Reactivated from Returned status${movedStation ? ` and moved to ${stationCode || "a new station"}` : ""}` +
            ` by ${session?.email || "unknown"}`,
          siteId: writeSiteId,
        }).catch((e) => console.error("Fleet Vehicles: reactivation audit log failed:", e?.message));

        return NextResponse.json({
          vehicle: reactivated,
          reactivated: true,
          message:
            `Reactivated returned vehicle (VIN ${data.vin})` +
            (movedStation ? ` and moved it to ${stationCode || "the new station"}` : "") +
            (historyMoved ? ` — ${historyMoved} history record(s) came with it.` : "."),
        });
      }
    }

    const vehicle = await Vehicle.create(data);
    return NextResponse.json({ vehicle, message: "Vehicle created successfully" });
  } catch (error: any) {
    console.error("Fleet Vehicles POST Error:", error);

    // ── E11000 on the VIN's global unique index ──
    // The raw Mongo error ("E11000 duplicate key... vin_1...") was passed
    // straight through as the user-facing message. It's technically
    // accurate but useless in practice: it says a duplicate exists, not
    // WHERE — and the existing vehicle is very often invisible in the
    // admin's current view (a different station, or "Returned" status
    // with the Returned toggle off), so "duplicate" with nothing findable
    // reads as the app being broken. Looked up org-wide — regardless of
    // which station is active — so the admin can actually go find it, at
    // whatever station or status it's really sitting in.
    if (error.code === 11000) {
      // Belt-and-suspenders: the pre-check above handles the normal case,
      // this only fires on a genuine race (two people adding the same VIN
      // at once) where the pre-check saw nothing but the insert still
      // collided.
      const vin = data?.vin;
      if (vin) {
        try {
          const dup: any = await orgWide(
            Vehicle.findOne({ vin }),
            "reporting where a duplicate VIN already exists, regardless of which station is active — the admin needs to find it to resolve the conflict"
          ).lean();
          if (dup) {
            return NextResponse.json({ error: await describeDuplicateVin(vin, dup) }, { status: 409 });
          }
        } catch (lookupErr) {
          console.error("Fleet Vehicles duplicate-VIN lookup failed:", lookupErr);
        }
      }
      return NextResponse.json({ error: "A vehicle with this VIN already exists." }, { status: 409 });
    }

    return NextResponse.json({ error: error.message || "Failed to create vehicle" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try { await requirePermission("Fleet", "edit"); } catch (e: any) {
    if (e.name === "ForbiddenError") return NextResponse.json({ error: e.message }, { status: 403 });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const auth = await authorizeAction("Fleet", "edit");
    if (!auth.authorized) return auth.response;

    await connectToDatabase();
    const body = await req.json();
    const id = body.id || new URL(req.url).searchParams.get("id");
    const data = body.data || body;

    if (data) {
      for (const key of Object.keys(data)) {
        if (data[key] === "") data[key] = null;
      }
    }

    // Ownership check: this route $sets whatever the body contains, so
    // without it any vehicle id could be edited from any station.
    const putScope = await getRequestScope();
    const existing = await Vehicle.findById(id).lean();
    if (!existing || !canAccessRecord(putScope, { siteId: (existing as any).currentSiteId })) {
      return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
    }

    // Station changes do NOT go through here. Moving a van removes it from
    // one station's fleet and adds it to another's, which needs a record of
    // who did it and when — see POST /api/fleet/vehicles/[id]/transfer.
    // Silently dropping the field rather than erroring, because older
    // clients may still send back the whole vehicle object they were given.
    delete (data as any).currentSiteId;
    delete (data as any).siteId;

    const vehicle = await Vehicle.findByIdAndUpdate(id, { $set: data }, { new: true });
    return NextResponse.json({ vehicle, message: "Vehicle updated successfully" });
  } catch (error: any) {
    console.error("Fleet Vehicles PUT Error:", error);
    return NextResponse.json({ error: error.message || "Failed to update vehicle" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try { await requirePermission("Fleet", "delete"); } catch (e: any) {
    if (e.name === "ForbiddenError") return NextResponse.json({ error: e.message }, { status: 403 });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const session = await getSession();
    if (!session || !session.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await connectToDatabase();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    await Vehicle.findByIdAndDelete(id);
    return NextResponse.json({ message: "Vehicle deleted successfully" });
  } catch (error: any) {
    console.error("Fleet Vehicles DELETE Error:", error);
    return NextResponse.json({ error: error.message || "Failed to delete vehicle" }, { status: 500 });
  }
}
