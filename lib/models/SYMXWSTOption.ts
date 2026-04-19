import mongoose, { Schema, Document, Model } from "mongoose";

export interface ISYMXWSTOption extends Document {
    wst: string;
    revenue: number;
    isActive: boolean;
    sortOrder: number;
    createdAt: Date;
    updatedAt: Date;
}

const SYMXWSTOptionSchema = new Schema<ISYMXWSTOption>(
    {
        wst: { type: String, required: true, unique: true },
        revenue: { type: Number, default: 0 },
        isActive: { type: Boolean, default: true },
        sortOrder: { type: Number, default: 0 },
    },
    { timestamps: true, collection: "SYMXWSTOptions" }
);


const SYMXWSTOption: Model<ISYMXWSTOption> =
    mongoose.models.SYMXWSTOption ||
    mongoose.model<ISYMXWSTOption>("SYMXWSTOption", SYMXWSTOptionSchema);

export default SYMXWSTOption;
