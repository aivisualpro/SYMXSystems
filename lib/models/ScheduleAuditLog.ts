import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IScheduleAuditLog extends Document {
    yearWeek: string;           // e.g. "2026-W10"
    transporterId: string;      // Employee transporter ID
    employeeName: string;       // Snapshot of employee name at time of action
    action: string;             // e.g. "type_changed", "note_updated", "schedule_created"
    field: string;              // e.g. "type", "note", "startTime"
    oldValue: string;           // Previous value
    newValue: string;           // New value
    date?: Date;                // Schedule date (which day was changed)
    dayOfWeek?: string;         // e.g. "Monday"
    performedBy: string;        // User email / session user
    performedByName?: string;   // User display name
    createdAt: Date;
}

const ScheduleAuditLogSchema: Schema = new Schema({
    yearWeek: { type: String, required: true },
    transporterId: { type: String, required: true, index: true },
    employeeName: { type: String, default: '' },
    action: { type: String, required: true },
    field: { type: String, required: true },
    oldValue: { type: String, default: '' },
    newValue: { type: String, default: '' },
    date: { type: Date },
    dayOfWeek: { type: String, default: '' },
    performedBy: { type: String, required: true },
    performedByName: { type: String, default: '' },
}, { timestamps: true, collection: 'ScheduleAuditLogs' });

// Compound index for fast querying
ScheduleAuditLogSchema.index({ yearWeek: 1, createdAt: -1 });
ScheduleAuditLogSchema.index({ transporterId: 1, yearWeek: 1 });

const ScheduleAuditLog: Model<IScheduleAuditLog> =
    mongoose.models.ScheduleAuditLog ||
    mongoose.model<IScheduleAuditLog>('ScheduleAuditLog', ScheduleAuditLogSchema);

export default ScheduleAuditLog;
