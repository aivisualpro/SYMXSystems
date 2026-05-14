/**
 * Shared helper — single source of truth for creating a DailyInspection
 * tied to a SYMXRoute.  Used by both mobile and web POST endpoints.
 *
 * Features:
 *  • Vehicle resolution (van name → VIN / unitNumber / vehicleId)
 *  • Idempotency — if an inspection already exists for the routeId we
 *    return it instead of creating a duplicate
 *  • SYMXRoute write-back (inspectionTime + inspectionId) — wrapped in
 *    try/catch so a failure there never fails the overall operation
 */

import connectToDatabase from "@/lib/db";
import DailyInspection from "@/lib/models/DailyInspection";
import SYMXRoute from "@/lib/models/SYMXRoute";
import Vehicle from "@/lib/models/Vehicle";
import VehicleRepair from "@/lib/models/VehicleRepair";

// ────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────

export type InspectionInput = {
  routeId: string;                    // SYMXRoute._id (string)
  transporterId: string;              // driver
  employeeName?: string;
  inspectedBy: string;                // badgeNumber / email of submitter
  van?: string;
  vin?: string;
  mileage: number;
  anyRepairs: "TRUE" | "FALSE" | "" | null;
  repairDescription?: string | null;
  repairCurrentStatus?: string | null;
  repairImage?: string | null;
  comments?: string | null;
  vehiclePicture1?: string | null;
  vehiclePicture2?: string | null;
  vehiclePicture3?: string | null;
  vehiclePicture4?: string | null;
  dashboardImage?: string | null;
  additionalPicture?: string | null;
  routeDate?: string | Date;          // optional, else now()
  inspectionType?: string;            // default "Route Inspection"
};

export type InspectionResult = {
  inspection: {
    _id: string;
    routeId: string;
    inspectionTime: string;
    routeDate: Date;
  };
  created: boolean; // false when we returned an existing record (idempotent)
};

// ────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────

/** Format a Date to "HH:mm" in America/Los_Angeles */
function formatPacificTime(d: Date): string {
  return d.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Los_Angeles",
  });
}

/** Replace "" with null in every own-property of `obj` */
function emptyStringsToNull<T extends Record<string, any>>(obj: T): T {
  for (const k of Object.keys(obj)) {
    if ((obj as any)[k] === "") (obj as any)[k] = null;
  }
  return obj;
}

// ────────────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────────────

export async function createInspectionForRoute(
  input: InspectionInput
): Promise<InspectionResult> {
  // ── Validation ──────────────────────────────────────────────────
  if (!input.routeId) {
    throw new Error("routeId is required");
  }
  if (input.mileage == null || Number(input.mileage) < 0) {
    throw new Error("mileage is required and must be >= 0");
  }

  await connectToDatabase();

  // ── Vehicle resolution ──────────────────────────────────────────
  let vin = input.vin || "";
  let unitNumber = "";
  let vehicleId: any = null;

  if (input.van) {
    const vehicle = await Vehicle.findOne(
      { vehicleName: input.van },
      { vin: 1, unitNumber: 1, _id: 1 }
    ).lean();
    if (vehicle) {
      // Prefer the resolved VIN over whatever the caller sent
      vin = (vehicle as any).vin || vin;
      unitNumber = (vehicle as any).unitNumber || "";
      vehicleId = (vehicle as any)._id || null;
    }
  }

  // ── Idempotency check ──────────────────────────────────────────
  const existing = await DailyInspection.findOne({ routeId: input.routeId })
    .sort({ timeStamp: -1 })
    .lean() as any;

  if (existing) {
    const inspectionTime = existing.timeStamp
      ? formatPacificTime(new Date(existing.timeStamp))
      : formatPacificTime(new Date());

    const inspectionId = String(existing._id);

    // Back-fill the route if needed (fire-and-forget)
    writeBackToRoute(input.routeId, inspectionTime, inspectionId);

    return {
      inspection: {
        _id: inspectionId,
        routeId: existing.routeId,
        inspectionTime,
        routeDate: existing.routeDate,
      },
      created: false,
    };
  }

  // ── Build inspection doc ────────────────────────────────────────
  const now = new Date();
  const routeDate = input.routeDate ? new Date(input.routeDate as string) : now;

  const doc = emptyStringsToNull({
    type: input.inspectionType || "Route Inspection",
    inspectionType: input.inspectionType || "Route Inspection",
    driver: input.transporterId || "",
    employeeName: input.employeeName || "",
    vin,
    unitNumber,
    vehicleId,
    routeDate,
    mileage: Number(input.mileage) || 0,
    anyRepairs: input.anyRepairs === "TRUE" ? "TRUE" : "FALSE",
    repairDescription: input.repairDescription || null,
    repairCurrentStatus: input.repairCurrentStatus || null,
    repairImage: input.repairImage || null,
    comments: input.comments || null,
    inspectedBy: input.inspectedBy || "",
    routeId: input.routeId,
    timeStamp: now,
    vehiclePicture1: input.vehiclePicture1 || null,
    vehiclePicture2: input.vehiclePicture2 || null,
    vehiclePicture3: input.vehiclePicture3 || null,
    vehiclePicture4: input.vehiclePicture4 || null,
    dashboardImage: input.dashboardImage || null,
    additionalPicture: input.additionalPicture || null,
  });

  const inspection = await DailyInspection.create(doc as any);
  const inspectionId = String((inspection as any)._id);
  const inspectionTime = formatPacificTime(now);

  // ── Write-back to SYMXRoute (fire-and-forget) ──────────────────
  writeBackToRoute(input.routeId, inspectionTime, inspectionId);

  // ── Auto-create VehicleRepair if anyRepairs = TRUE ─────────────
  if (input.anyRepairs === "TRUE") {
    writeRepairRecord({
      vehicleId,
      vin,
      unitNumber,
      description: input.repairDescription || "",
      currentStatus: input.repairCurrentStatus || "Not Started",
      repairImage: input.repairImage || null,
      inspectionId,
    });
  }

  return {
    inspection: {
      _id: inspectionId,
      routeId: input.routeId,
      inspectionTime,
      routeDate,
    },
    created: true,
  };
}

// ────────────────────────────────────────────────────────────────────
// Route write-back (never throws)
// ────────────────────────────────────────────────────────────────────

function writeBackToRoute(
  routeId: string,
  inspectionTime: string,
  inspectionId: string
): void {
  SYMXRoute.findByIdAndUpdate(routeId, {
    $set: { inspectionTime, inspectionId },
  })
    .exec()
    .catch((err) => {
      console.error(
        `[createInspectionForRoute] SYMXRoute write-back failed for ${routeId}:`,
        err
      );
    });
}

// ────────────────────────────────────────────────────────────────────
// VehicleRepair auto-create (never throws)
// ────────────────────────────────────────────────────────────────────

function writeRepairRecord(opts: {
  vehicleId: any;
  vin: string;
  unitNumber: string;
  description: string;
  currentStatus: string;
  repairImage: string | null;
  inspectionId: string;
}): void {
  VehicleRepair.create({
    vehicleId: opts.vehicleId || undefined,
    vin: opts.vin || "",
    unitNumber: opts.unitNumber || "",
    description: opts.description || "",
    currentStatus: opts.currentStatus || "Not Started",
    images: opts.repairImage ? [opts.repairImage] : [],
    creationDate: new Date(),
    lastEditOn: new Date(),
    // Link back to the inspection that triggered this repair
    sourceInspectionId: opts.inspectionId,
  })
    .then(() => {
      console.log(
        `[createInspectionForRoute] VehicleRepair created for inspection ${opts.inspectionId}`
      );
    })
    .catch((err) => {
      console.error(
        `[createInspectionForRoute] VehicleRepair write failed for inspection ${opts.inspectionId}:`,
        err
      );
    });
}
