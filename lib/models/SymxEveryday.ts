import mongoose, { Schema, Document } from 'mongoose';
import { siteOwned } from "./plugins/site-owned";

export interface ISymxEveryday extends Document {
  /** Owning station. Added by the siteOwned plugin; optional until
   *  siteId becomes required at the Phase 5 contract step. */
  siteId?: mongoose.Types.ObjectId;
  date: string;
  notes: string;
  attachments: string[];
  routesAssigned: number;
  endDay: boolean;
  SYMXRouteSheet: string;
  SYMXRouteSheetData: any[];
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
    SYMXRouteSheet: {
      type: String,
      default: '',
    },
    SYMXRouteSheetData: {
      type: Schema.Types.Mixed,
      default: [],
    },
  },
  {
    timestamps: true,
    collection: 'SYMXEveryday',
  }
);

// ── Multi-site ──
// Station that owns these records. Immutable: a later transfer does
// not move history. Optional during the migration window; required
// after the Phase 5 contract step.
SymxEverydaySchema.plugin(siteOwned, { sortField: "date", modelName: "SymxEveryday" });

const SymxEveryday =
  mongoose.models.SymxEveryday ||
  mongoose.model<ISymxEveryday>('SymxEveryday', SymxEverydaySchema);

export default SymxEveryday;
