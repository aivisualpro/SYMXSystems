import mongoose, { Schema, Document } from "mongoose";

export interface IMessagingTemplate extends Document {
  type: string; // future-shift, shift, off-tomorrow, week-schedule, route-itinerary
  template: string;
  updatedAt: Date;
  createdAt: Date;
}

const MessagingTemplateSchema = new Schema<IMessagingTemplate>(
  {
    type: {
      type: String,
      required: true,
      unique: true,
      enum: ["future-shift", "shift", "off-tomorrow", "week-schedule", "route-itinerary"],
    },
    template: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

export default mongoose.models.MessagingTemplate ||
  mongoose.model<IMessagingTemplate>("MessagingTemplate", MessagingTemplateSchema);
