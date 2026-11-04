import mongoose from "mongoose";

const stediPayerSchema = new mongoose.Schema(
  {
    stediId: { type: String, required: true, unique: true, trim: true, uppercase: true },
    displayName: { type: String, required: true, trim: true },
    conciseName: { type: String, default: "", trim: true },
    primaryPayerId: { type: String, required: true, trim: true },
    aliases: [{ type: String, trim: true }],
    coverageTypes: [{ type: String, trim: true }],
    transactionSupport: { type: mongoose.Schema.Types.Mixed, default: {} },
    active: { type: Boolean, default: true, index: true },
    syncId: { type: String, required: true, index: true },
    lastSyncedAt: { type: Date, required: true },
  },
  { timestamps: true, collection: "stedi_payers" }
);

stediPayerSchema.index({ active: 1, displayName: 1 });
stediPayerSchema.index({ primaryPayerId: 1 });

export const StediPayer = mongoose.model("StediPayer", stediPayerSchema);
