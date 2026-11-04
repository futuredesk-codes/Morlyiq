import mongoose from "mongoose";

// Stores a safe, normalized snapshot for audit/history. Raw 270/271 X12 and
// the outbound request payload are deliberately not retained here.
const eligibilityCheckSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Client", required: true, index: true },
    clinicId: { type: String, required: true, index: true },
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: true, index: true },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: "ClientUser", required: true },
    status: { type: String, enum: ["completed", "partial", "failed"], required: true },
    primary: { type: mongoose.Schema.Types.Mixed, required: true },
    secondary: { type: mongoose.Schema.Types.Mixed, default: null },
    checkedAt: { type: Date, required: true },
  },
  { timestamps: true }
);

eligibilityCheckSchema.index({ tenantId: 1, clinicId: 1, patientId: 1, createdAt: -1 });

export const EligibilityCheck = mongoose.model("EligibilityCheck", eligibilityCheckSchema);
