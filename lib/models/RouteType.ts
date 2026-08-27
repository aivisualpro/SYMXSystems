import mongoose, { Schema, Document, Model } from 'mongoose';

/** A station's own start time for a shared route type. */
export interface IRouteTypeStationOverride {
  siteId: mongoose.Types.ObjectId;
  /** Overrides the shared startTime at this station. Blank = use shared. */
  startTime?: string;
  /** Overrides the shared theoryHrs at this station. 0/absent = use shared. */
  theoryHrs?: number;
}

export interface IRouteType extends Document {
    name: string;        // e.g. "Route", "Open", "Close"
    color: string;       // hex color e.g. "#10B981"
    /** Shared default start time, used by any station without an override. */
    startTime: string;   // e.g. "06:00 AM"
    /** Shared default theory hours. */
    theoryHrs: number;
    /** Per-station start times. Stations run the same route types at
     *  different hours, so only these two values vary. */
    stations: IRouteTypeStationOverride[];
    group: string;       // "Operations" or "Driver"
    routeStatus: string; // default status e.g. "Scheduled", "Off", "Double Route"
    isDefault: boolean;  // whether this is the default type for new schedules
    partOf: string[];    // which modules this type belongs to e.g. ["Dispatching", "Shift"]
    isDA: boolean;       // whether this counts as a DA (Delivery Associate)
    isOps: boolean;      // whether this counts as OPS
    isStandby: boolean;  // whether this counts as Standby
    icon: string;
    sortOrder: number;   // for display ordering
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const RouteTypeSchema: Schema = new Schema({
    name: { type: String, required: true },
    color: { type: String, default: '#6B7280' },
    startTime: { type: String, default: '' },
    theoryHrs: { type: Number, default: 0 },
    stations: [
        {
            _id: false,
            siteId: { type: Schema.Types.ObjectId, ref: 'Site', required: true },
            startTime: { type: String, default: '' },
            theoryHrs: { type: Number, default: 0 },
        },
    ],
    group: { type: String, enum: ['Operations', 'Driver', 'None'], default: 'None' },
    routeStatus: { type: String, default: 'Scheduled' },
    isDefault: { type: Boolean, default: false },
    partOf: { type: [String], default: [] },
    isDA: { type: Boolean, default: false },
    isOps: { type: Boolean, default: false },
    isStandby: { type: Boolean, default: false },
    icon: { type: String, default: '' },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
}, { timestamps: true, collection: 'SYMXRouteTypes' });

if (mongoose.models.RouteType) {
    delete mongoose.models.RouteType;
}

// ── Shared catalogue, per-station start times ─────────────────────────
// The route types themselves are the same everywhere — a "Route" is a
// Route at any station. What differs is when it starts.
//
// Cloning the catalogue per station was the earlier design and it was
// wrong in a way that showed up immediately: a new station started with
// NO route types, so it could not generate a schedule at all until
// someone copied them across, and thereafter adding a type meant adding
// it three times and letting the copies drift.
//
// One catalogue, globally unique by name, with overrides per station.
RouteTypeSchema.index({ name: 1 }, { unique: true });
RouteTypeSchema.index({ 'stations.siteId': 1 });

// No siteOwned plugin: this catalogue is organization-level. The station
// only decides start times, held in stations[] and resolved by
// routeTypeStartTime() — there is no siteId to filter on.

/**
 * The start time for a route type at a station.
 *
 * Falls back to the shared value when the station has no override, so a
 * station that has not been configured still schedules at a sensible hour
 * rather than at an empty string.
 */
export function routeTypeStartTime(
    rt: { startTime?: string; stations?: IRouteTypeStationOverride[] } | null | undefined,
    siteId: string | mongoose.Types.ObjectId | null | undefined
): string {
    if (!rt) return '';
    if (siteId && Array.isArray(rt.stations)) {
        const hit = rt.stations.find((s) => String(s.siteId) === String(siteId));
        if (hit?.startTime) return hit.startTime;
    }
    return rt.startTime || '';
}

/** Theory hours for a route type at a station, with the same fallback. */
export function routeTypeTheoryHrs(
    rt: { theoryHrs?: number; stations?: IRouteTypeStationOverride[] } | null | undefined,
    siteId: string | mongoose.Types.ObjectId | null | undefined
): number {
    if (!rt) return 0;
    if (siteId && Array.isArray(rt.stations)) {
        const hit = rt.stations.find((s) => String(s.siteId) === String(siteId));
        if (hit?.theoryHrs) return hit.theoryHrs;
    }
    return rt.theoryHrs || 0;
}

const RouteType: Model<IRouteType> = mongoose.model<IRouteType>('RouteType', RouteTypeSchema);

export default RouteType;
