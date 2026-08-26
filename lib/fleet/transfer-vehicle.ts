import VehicleRepair from "@/lib/models/VehicleRepair";
import VehicleInspection from "@/lib/models/VehicleInspection";
import VehicleRentalAgreement from "@/lib/models/VehicleRentalAgreement";
import VehicleActivityLog from "@/lib/models/VehicleActivityLog";
import DailyInspection from "@/lib/models/DailyInspection";
import { orgWide } from "@/lib/scoped-query";

// ── Moving a van moves its records with it ────────────────────────────
//
// Fleet records follow the VEHICLE, not the station where the work was
// done. A van's repair and inspection history is part of the asset: the
// station running it now needs the complete record, and its maintenance
// cost belongs to whoever is operating it.
//
// This is deliberately the OPPOSITE rule from operational and HR data.
// A route, a schedule or a write-up records something that happened at a
// place on a date, and stays with that station forever. A repair record
// describes a physical object that moves.
//
// Consequence worth knowing: because these records carry their new
// station, fleet reports covering past periods will change after a
// transfer — a repair done at DFO2 in June counts under DXC8 once the van
// moves. That is the intended behaviour here (the cost follows the van),
// but it does mean a fleet report is a statement about the fleet as it is
// today, not a frozen record of the past.

/** Collections whose records travel with the van, and how they link to it. */
const FOLLOWS_VEHICLE = [
  { model: VehicleRepair, label: "repairs" },
  { model: VehicleInspection, label: "inspections" },
  { model: VehicleRentalAgreement, label: "rental agreements" },
  { model: VehicleActivityLog, label: "activity log" },
  { model: DailyInspection, label: "daily inspections" },
] as const;

export interface TransferCounts {
  [label: string]: number;
}

/**
 * Repoint every record belonging to a vehicle at its new station.
 *
 * Matched by VIN, which is the vehicle's identity — one VIN, one van, for
 * the life of the vehicle. vehicleId is included as well because some
 * collections link by document id instead.
 *
 * unitNumber is deliberately NOT matched on. Unit numbers are fleet
 * labels that get reassigned to a different van when one is retired, so
 * matching on one would move some OTHER vehicle's repair history along
 * with this transfer — silently, and to a station where nobody would
 * think to look for it.
 */
export async function moveVehicleRecords(
  vehicle: { _id: any; vin?: string },
  toSiteId: string
): Promise<TransferCounts> {
  const match: any = { $or: [{ vehicleId: vehicle._id }] };
  if (vehicle.vin) match.$or.push({ vin: vehicle.vin });

  const counts: TransferCounts = {};

  for (const { model, label } of FOLLOWS_VEHICLE) {
    // orgWide because the records being moved are, by definition, still at
    // the OLD station — a station-scoped update would match none of them
    // and the transfer would silently move nothing.
    const res: any = await orgWide(
      (model as any).updateMany(match, { $set: { siteId: toSiteId } }),
      "moving a van's history to follow it — the records are still at the old station"
    );
    counts[label] = res?.modifiedCount ?? 0;
  }

  return counts;
}

export function summariseTransfer(counts: TransferCounts): string {
  const moved = Object.entries(counts).filter(([, n]) => n > 0);
  if (moved.length === 0) return "No history records to move.";
  return moved.map(([label, n]) => `${n} ${label}`).join(", ");
}
