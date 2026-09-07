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
      // NOT globally unique — see the siteId+date compound index below.
      // This used to be a bare `unique: true`, a leftover from before
      // multi-site. DFO2 has been the only station writing here for so
      // long that it already holds a document for nearly every calendar
      // date, so any OTHER station (especially a brand new one) saving
      // Routes Assigned/notes for a date DFO2 already touched hit
      // `E11000 duplicate key ... date_1` on the very first save — the
      // exact same shape of bug fixed for SymxAvailableWeeks' `week`
      // field in migration 07.
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

// Unique PER STATION, not globally — each station owns its own row per
// calendar date, so two stations can legitimately share the same date
// string. See the comment on the `date` field above for how the old
// global-unique index broke new stations.
SymxEverydaySchema.index({ siteId: 1, date: 1 }, { unique: true });

const SymxEveryday =
  mongoose.models.SymxEveryday ||
  mongoose.model<ISymxEveryday>('SymxEveryday', SymxEverydaySchema);

export default SymxEveryday;
