import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IDailyInspection extends Document {
    // Route / schedule
    routeId: string;
    driver: string;
    routeDate: Date;
    timeStamp: Date;
    inspectedBy: string;

    // Vehicle
    vin: string;
    vehicleId: mongoose.Types.ObjectId;
    unitNumber: string;
    mileage: number;

    // Photos (up to 4 vehicle + dashboard + additional)
    vehiclePicture1: string;
    vehiclePicture2: string;
    vehiclePicture3: string;
    vehiclePicture4: string;
    dashboardImage: string;
    additionalPicture: string;

    // Notes
    comments: string;

    // Repair info (embedded on this inspection)
    anyRepairs: string;
    repairDescription: string;
    repairCurrentStatus: string;
    repairEstimatedDate: Date;
    repairImage: string;

    // Misc
    isCompared: boolean;

    createdAt: Date;
    updatedAt: Date;
}

const DailyInspectionSchema: Schema = new Schema(
    {
        // Route / schedule
        routeId: { type: String, default: '', index: true },
        driver: { type: String, default: '' },
        routeDate: { type: Date, index: true },
        timeStamp: { type: Date },
        inspectedBy: { type: String, default: '' },

        // Vehicle
        vin: { type: String, default: '', index: true },
        vehicleId: { type: Schema.Types.ObjectId, ref: 'Vehicle', index: true },
        unitNumber: { type: String, default: '' },
        mileage: { type: Number, default: 0 },

        // Photos
        vehiclePicture1: { type: String, default: '' },
        vehiclePicture2: { type: String, default: '' },
        vehiclePicture3: { type: String, default: '' },
        vehiclePicture4: { type: String, default: '' },
        dashboardImage: { type: String, default: '' },
        additionalPicture: { type: String, default: '' },

        // Notes
        comments: { type: String, default: '' },

        // Repair
        anyRepairs: { type: String, default: '' },
        repairDescription: { type: String, default: '' },
        repairCurrentStatus: { type: String, default: '' },
        repairEstimatedDate: { type: Date },
        repairImage: { type: String, default: '' },

        // Misc
        isCompared: { type: Boolean, default: false },
    },
    {
        timestamps: true,
        collection: 'dailyInspections',
    }
);

// Indexes for fast sorted pagination
DailyInspectionSchema.index({ routeDate: -1 });
DailyInspectionSchema.index({ routeId: 1, vin: 1, routeDate: 1 });
// Compound index for comparison queries (find previous inspection by VIN + date)
DailyInspectionSchema.index({ vin: 1, routeDate: -1 });
// Indexes for search/filter on text fields
DailyInspectionSchema.index({ driver: 1 });
DailyInspectionSchema.index({ inspectedBy: 1 });
DailyInspectionSchema.index({ unitNumber: 1, routeDate: -1 });
// Text index for full-text search (much faster than $regex)
DailyInspectionSchema.index({ vin: 'text', driver: 'text', routeId: 'text', inspectedBy: 'text', comments: 'text' }, { name: 'inspection_text_search' });

const DailyInspection: Model<IDailyInspection> =
    mongoose.models.DailyInspection ||
    mongoose.model<IDailyInspection>('DailyInspection', DailyInspectionSchema);

export default DailyInspection;
