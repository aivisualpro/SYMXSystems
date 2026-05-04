import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IRouteType extends Document {
    name: string;        // e.g. "Route", "Open", "Close"
    color: string;       // hex color e.g. "#10B981"
    startTime: string;   // default start time e.g. "06:00 AM"
    theoryHrs: number;   // default theory hours
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
    name: { type: String, required: true, unique: true },
    color: { type: String, default: '#6B7280' },
    startTime: { type: String, default: '' },
    theoryHrs: { type: Number, default: 0 },
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

const RouteType: Model<IRouteType> = mongoose.model<IRouteType>('RouteType', RouteTypeSchema);

export default RouteType;
