import mongoose, { Schema, Document, Model } from "mongoose";

export interface ISYMXRoute extends Document {
    // ── Core identifiers ──
    scheduleId: mongoose.Types.ObjectId; // ref to SYMXEmployeeSchedule._id
    date: Date;
    weekDay: string;
    yearWeek: string;
    transporterId: string;

    // ── Schedule-derived fields ──
    type: string;
    subType: string;
    trainingDay: string;

    // ── Route info ──
    routeSize: string;
    van: string;
    serviceType: string;
    dashcam: string;
    routeNumber: string;
    stopCount: number;
    packageCount: number;
    routeDuration: string;       // duration "6:56"
    waveTime: string;            // time "2:00 PM"
    pad: string;
    wst: string;
    wstDuration: number;
    wstRevenue: number;          // currency $
    notes: string;
    stagingLocation: string;
    extraStops: number;
    stopsRescued: number;

    // ── Departure & stems ──
    departureDelay: string;             // duration
    actualDepartureTime: string;        // duration
    plannedOutboundStem: string;        // time
    actualOutboundStem: string;         // time
    outboundDelay: string;              // duration

    // ── Stops ──
    plannedFirstStop: string;           // time
    actualFirstStop: string;            // time
    firstStopDelay: string;             // time
    plannedLastStop: string;            // time
    actualLastStop: string;             // time
    lastStopDelay: string;              // time

    // ── RTS & duration ──
    plannedRTSTime: string;             // time
    plannedInboundStem: string;         // time
    estimatedRTSTime: string;           // time
    plannedDuration1stToLast: string;   // time
    actualDuration1stToLast: string;    // time
    stopsPerHour: number;

    // ── Delivery ──
    deliveryCompletionTime: string;     // time
    dctDelay: string;                   // duration
    driverEfficiency: number;           // percentage %

    // ── Attendance ──
    attendance: string;                 // "Absent" | "Present"
    attendanceTime: string;             // time

    // ── Amazon & Paycom times ──
    amazonOutLunch: string;
    amazonInLunch: string;
    amazonAppLogout: string;
    inspectionTime: string;
    inspectionId: string;
    paycomInDay: string;
    paycomOutLunch: string;
    paycomInLunch: string;
    paycomOutDay: string;
    driversUpdatedForLunch: string;

    // ── Hours & pay ──
    totalHours: string;                 // duration
    regHrs: string;                     // duration
    otHrs: string;                      // duration
    totalCost: number;                  // currency $
    regPay: number;                     // currency $
    otPay: number;                      // currency $

    // ── Misc ──
    punchStatus: string;
    whc: Date;
    bags: string;
    ov: string;
}

const SYMXRouteSchema = new Schema<ISYMXRoute>(
    {
        // Core
        scheduleId: { type: Schema.Types.ObjectId, ref: "SymxEmployeeSchedule" },
        date: { type: Date, required: true },
        weekDay: { type: String, required: true },
        yearWeek: { type: String, required: true },
        transporterId: { type: String, required: true },

        // Schedule-derived
        type: { type: String, default: "" },
        subType: { type: String, default: "" },
        trainingDay: { type: String, default: "" },

        // Route info
        routeSize: { type: String, default: "" },
        van: { type: String, default: "" },
        serviceType: { type: String, default: "" },
        dashcam: { type: String, default: "" },
        routeNumber: { type: String, default: "" },
        stopCount: { type: Number, default: 0 },
        packageCount: { type: Number, default: 0 },
        routeDuration: { type: String, default: "" },
        waveTime: { type: String, default: "" },
        pad: { type: String, default: "" },
        wst: { type: String, default: "" },
        wstDuration: { type: Number, default: 0 },
        wstRevenue: { type: Number, default: 0 },
        notes: { type: String, default: "" },
        stagingLocation: { type: String, default: "" },
        extraStops: { type: Number, default: 0 },
        stopsRescued: { type: Number, default: 0 },

        // Departure & stems
        departureDelay: { type: String, default: "" },
        actualDepartureTime: { type: String, default: "" },
        plannedOutboundStem: { type: String, default: "" },
        actualOutboundStem: { type: String, default: "" },
        outboundDelay: { type: String, default: "" },

        // Stops
        plannedFirstStop: { type: String, default: "" },
        actualFirstStop: { type: String, default: "" },
        firstStopDelay: { type: String, default: "" },
        plannedLastStop: { type: String, default: "" },
        actualLastStop: { type: String, default: "" },
        lastStopDelay: { type: String, default: "" },

        // RTS
        plannedRTSTime: { type: String, default: "" },
        plannedInboundStem: { type: String, default: "" },
        estimatedRTSTime: { type: String, default: "" },
        plannedDuration1stToLast: { type: String, default: "" },
        actualDuration1stToLast: { type: String, default: "" },
        stopsPerHour: { type: Number, default: 0 },

        // Delivery
        deliveryCompletionTime: { type: String, default: "" },
        dctDelay: { type: String, default: "" },
        driverEfficiency: { type: Number, default: 0 },

        // Attendance
        attendance: { type: String, default: "" },
        attendanceTime: { type: String, default: "" },

        // Amazon & Paycom
        amazonOutLunch: { type: String, default: "" },
        amazonInLunch: { type: String, default: "" },
        amazonAppLogout: { type: String, default: "" },
        inspectionTime: { type: String, default: "" },
        inspectionId: { type: String, default: "" },
        paycomInDay: { type: String, default: "" },
        paycomOutLunch: { type: String, default: "" },
        paycomInLunch: { type: String, default: "" },
        paycomOutDay: { type: String, default: "" },
        driversUpdatedForLunch: { type: String, default: "" },

        // Hours & pay
        totalHours: { type: String, default: "" },
        regHrs: { type: String, default: "" },
        otHrs: { type: String, default: "" },
        totalCost: { type: Number, default: 0 },
        regPay: { type: Number, default: 0 },
        otPay: { type: Number, default: 0 },

        // Misc
        punchStatus: { type: String, default: "" },
        whc: { type: Date },
        bags: { type: String, default: "" },
        ov: { type: String, default: "" },
    },
    { timestamps: true, collection: "SYMXRoutes" }
);

// Compound index for upsert + fast lookups
SYMXRouteSchema.index({ transporterId: 1, date: 1 }, { unique: true });
SYMXRouteSchema.index({ yearWeek: 1, transporterId: 1 });
SYMXRouteSchema.index({ transporterId: 1, type: 1 });  // for routesCompleted aggregation
SYMXRouteSchema.index({ van: 1 });                      // for vehicle name lookups
SYMXRouteSchema.index({ date: 1 });                     // for daily filters

const SYMXRoute: Model<ISYMXRoute> =
    mongoose.models.SYMXRoute ||
    mongoose.model<ISYMXRoute>("SYMXRoute", SYMXRouteSchema);

export default SYMXRoute;
