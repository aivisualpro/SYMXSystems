import { Schema } from "mongoose";

export function importProvenance(schema: Schema) {
  schema.add({
    sourceImportIds: { type: [{ type: Schema.Types.ObjectId, ref: "AmazonReportImport" }], default: undefined },
  });
  schema.index({ siteId: 1, sourceImportIds: 1 });
}
