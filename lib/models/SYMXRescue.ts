import mongoose, { Schema, Document } from "mongoose";

export interface ISYMXRescue extends Document {
    routeId: mongoose.Types.ObjectId;
    date: string;
    transporterId: string;
    rescuedBytransporterId: string;
    stopsRescued: number;
    reason: string;
    performanceRescue: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const symxRescueSchema = new Schema<ISYMXRescue>(
    {
        routeId: { type: Schema.Types.ObjectId, ref: "SYMXRoute", required: true },
        date: { type: String, required: true },
        transporterId: { type: String, required: true },
        rescuedBytransporterId: { type: String, required: true },
        stopsRescued: { type: Number, required: true, min: [0, "Stops rescued cannot be negative"] },
        reason: { type: String, required: true },
        performanceRescue: { type: Boolean, default: false },
    },
    { timestamps: true, collection: "SYMXRescue" }
);

export default mongoose.models.SYMXRescue || mongoose.model<ISYMXRescue>("SYMXRescue", symxRescueSchema);
