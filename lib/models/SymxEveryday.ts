import mongoose, { Schema, Document } from 'mongoose';

export interface ISymxEveryday extends Document {
  date: string;
  notes: string;
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
  },
  {
    timestamps: true,
    collection: 'SYMXEveryday',
  }
);

export const SymxEveryday =
  mongoose.models.SymxEveryday ||
  mongoose.model<ISymxEveryday>('SymxEveryday', SymxEverydaySchema);
