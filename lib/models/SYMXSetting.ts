import mongoose, { Schema, Document, Model } from "mongoose";

export interface ISYMXSetting extends Document {
    key: string;
    value: any;
    description: string;
    createdAt: Date;
    updatedAt: Date;
}

const SYMXSettingSchema = new Schema<ISYMXSetting>(
    {
        key: { type: String, required: true, unique: true },
        value: { type: Schema.Types.Mixed, required: true },
        description: { type: String, default: "" },
    },
    { timestamps: true, collection: "SYMXSettings" }
);



const SYMXSetting: Model<ISYMXSetting> =
    mongoose.models.SYMXSetting ||
    mongoose.model<ISYMXSetting>("SYMXSetting", SYMXSettingSchema);

export default SYMXSetting;
