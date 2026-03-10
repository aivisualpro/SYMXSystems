import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IDropdownOption extends Document {
    description: string;   // Display label
    type: string;          // Category e.g. "inspection", "repair", etc.
    isActive: boolean;
    sortOrder: number;
    image?: string;
    color?: string;
    icon?: string;
    createdAt: Date;
    updatedAt: Date;
}

const DropdownOptionSchema: Schema = new Schema({
    description: { type: String, required: true },
    type: { type: String, required: true, index: true },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
    image: { type: String, default: '' },
    color: { type: String, default: '' },
    icon: { type: String, default: '' },
}, { timestamps: true, collection: 'SYMXDropdownOptions' });

// Compound unique: same description + type can't exist twice
DropdownOptionSchema.index({ description: 1, type: 1 }, { unique: true });

const DropdownOption: Model<IDropdownOption> =
    mongoose.models.DropdownOption ||
    mongoose.model<IDropdownOption>('DropdownOption', DropdownOptionSchema);

export default DropdownOption;
