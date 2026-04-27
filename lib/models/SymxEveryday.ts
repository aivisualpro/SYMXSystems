import mongoose, { Schema, Document } from 'mongoose';

export interface ISymxEveryday extends Document {
  date: string;
  notes: string;
  attachments: string[];
  routesAssigned: number;
  endDay: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SymxEverydaySchema: Schema = new Schema(
  {
    date: {
      type: String,
      required: true,
      unique: true,
    },
    notes: {
      type: String,
      default: '',
    },
    attachments: {
      type: [String],
      default: [],
    },
    routesAssigned: {
      type: Number,
      default: 0,
    },
    endDay: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    collection: 'SYMXEveryday',
  }
);

const SymxEveryday =
  mongoose.models.SymxEveryday ||
  mongoose.model<ISymxEveryday>('SymxEveryday', SymxEverydaySchema);

export default SymxEveryday;
