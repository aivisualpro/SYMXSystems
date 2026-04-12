import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IRouteType extends Document {
    name: string;        // e.g. "Route", "Open", "Close"
    color: string;       // hex color e.g. "#10B981"
    startTime: string;   // default start time e.g. "06:00 AM"
    routeStatus: string; // default status e.g. "Scheduled", "Off", "Double Route"
    sortOrder: number;   // for display ordering
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const RouteTypeSchema: Schema = new Schema({
    name: { type: String, required: true, unique: true },
    color: { type: String, default: '#6B7280' },
    startTime: { type: String, default: '' },
    routeStatus: { type: String, default: 'Scheduled' },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
}, { timestamps: true, collection: 'SYMXRouteTypes' });

if (mongoose.models.RouteType) {
    delete mongoose.models.RouteType;
}

const RouteType: Model<IRouteType> = mongoose.model<IRouteType>('RouteType', RouteTypeSchema);

export default RouteType;
