import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IRouteType extends Document {
    name: string;        // e.g. "Route", "Open", "Close"
    color: string;       // hex color e.g. "#10B981"
    startTime: string;   // default start time e.g. "06:00 AM"
    sortOrder: number;   // for display ordering
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const RouteTypeSchema: Schema = new Schema({
    name: { type: String, required: true, unique: true },
    color: { type: String, default: '#6B7280' },
    startTime: { type: String, default: '' },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
}, { timestamps: true, collection: 'SYMXRouteTypes' });

const RouteType: Model<IRouteType> =
    mongoose.models.RouteType ||
    mongoose.model<IRouteType>('RouteType', RouteTypeSchema);

export default RouteType;
