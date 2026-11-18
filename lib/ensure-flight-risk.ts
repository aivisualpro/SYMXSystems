import RouteType from "@/lib/models/RouteType";

/**
 * Makes sure the "Flight Risk" shift type exists.
 *
 * Flight Risk means "we're planning for this person to possibly not show up
 * tomorrow". It copies everything from "Route" (status, DA/Ops flags, group,
 * start times at every station, where it appears) and differs only in name,
 * colour and icon so it stands out on the schedule.
 *
 * Safe to call repeatedly and concurrently: it checks first, then upserts on
 * the exact name, so at most one is ever created.
 */
const FLIGHT_RISK_COLOR = "#FCA5A5"; // light red
const OLD_DEFAULT_COLORS = ["#DC2626", "#FF0000"];
let ensured = false;

export async function ensureFlightRiskType(): Promise<{ created: boolean; id?: string; error?: string }> {
  if (ensured) return { created: false };

  const existing: any = await RouteType.findOne({ name: { $regex: "^\\s*flight risk\\s*$", $options: "i" } }, { _id: 1, color: 1 }).lean();
  if (existing) {
    // Upgrade the earlier default reds; a colour someone picked themselves is left alone.
    if (OLD_DEFAULT_COLORS.includes(String(existing.color || "").toUpperCase())) {
      await RouteType.updateOne({ _id: existing._id }, { $set: { color: FLIGHT_RISK_COLOR } });
    }
    ensured = true;
    return { created: false, id: String(existing._id) };
  }

  const route: any = await RouteType.findOne({ name: { $regex: "^\\s*route\\s*$", $options: "i" } }).lean();
  if (!route) return { created: false, error: 'No "Route" shift type found to copy from.' };

  const last: any = await RouteType.findOne({}).sort({ sortOrder: -1 }).select("sortOrder").lean();

  const res: any = await RouteType.findOneAndUpdate(
    { name: "Flight Risk" },
    {
      $setOnInsert: {
        name: "Flight Risk",
        color: FLIGHT_RISK_COLOR,
        icon: "Flag",
        startTime: route.startTime || "",
        theoryHrs: route.theoryHrs || 0,
        stations: Array.isArray(route.stations) ? route.stations.map((s: any) => ({ ...s })) : [],
        group: route.group || "None",
        routeStatus: route.routeStatus || "Scheduled",
        isDefault: false, // Route stays the default for new schedules
        partOf: Array.isArray(route.partOf) ? [...route.partOf] : [],
        isDA: !!route.isDA,
        isOps: !!route.isOps,
        isStandby: !!route.isStandby,
        sortOrder: (last?.sortOrder || 0) + 1,
        isActive: true,
      },
    },
    { upsert: true, new: true, includeResultMetadata: true }
  );

  ensured = true;
  return { created: !res?.lastErrorObject?.updatedExisting, id: String(res?.value?._id || "") };
}
