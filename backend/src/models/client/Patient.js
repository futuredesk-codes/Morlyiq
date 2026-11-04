import mongoose from "mongoose";

const validDob = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year
    && parsed.getUTCMonth() === month - 1
    && parsed.getUTCDate() === day
    && parsed.getTime() <= Date.now();
};

const secondaryInsuranceSchema = new mongoose.Schema(
  {
    // Schema-level defaults keep older preview-only COB data loadable/removable.
    // The dedicated PUT controller requires every routing/member field.
    payer: { type: String, default: "", trim: true },
    payerStediId: { type: String, default: "", trim: true, uppercase: true },
    tradingPartnerServiceId: { type: String, default: "", trim: true },
    subscriberId: { type: String, default: "", trim: true, maxlength: 120 },
    groupNumber: { type: String, default: "", trim: true, maxlength: 120 },
    relationship: {
      type: String,
      enum: ["Self", "Spouse", "Parent", "Child", "Other"],
      default: "Spouse",
    },
  },
  { _id: false }
);

// A patient belongs to ONE clinic of a practice: the Client Panel only ever shows the active clinic's patients.
const patientSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Client", required: true, index: true },
    clinicId: { type: String, required: true, index: true }, // clinic code: cl1, cl2, ...
    name: { type: String, required: true, trim: true },
    // New patients require these insurance identity fields. `isNew` keeps legacy records
    // without them updateable while the POST controller enforces them for every new record.
    dob: {
      type: String,
      default: "",
      required: function requireDobForNewPatient() { return this.isNew; },
      trim: true,
      validate: {
        validator: function validateNewPatientDob(value) { return !this.isNew || validDob(value); },
        message: "Enter a valid date of birth that is not in the future",
      },
    }, // yyyy-mm-dd
    payer: {
      type: String,
      default: "Unknown",
      required: function requirePayerForNewPatient() { return this.isNew; },
      trim: true,
      validate: {
        validator: function validateNewPatientPayer(value) {
          return !this.isNew || (Boolean(value) && value.toLowerCase() !== "unknown");
        },
        message: "Insurance payer is required",
      },
    },
    // Stable Stedi directory key plus the primary payer ID used as tradingPartnerServiceId.
    payerStediId: { type: String, default: "", trim: true, uppercase: true },
    tradingPartnerServiceId: { type: String, default: "", trim: true },
    subscriberId: {
      type: String,
      default: "",
      required: function requireSubscriberForNewPatient() { return this.isNew; },
      trim: true,
      maxlength: 120,
    },
    groupNumber: { type: String, default: "", trim: true, maxlength: 120 },
    appointment: { type: Date, default: null },
    codes: { type: [String], default: ["D0120"] }, // CDT procedure codes planned for the visit
    status: { type: String, enum: ["not_verified", "in_progress", "completed", "partial", "failed"], default: "not_verified" },
    result: { type: mongoose.Schema.Types.Mixed, default: null }, // eligibility verification result
    aiSummary: { type: String, default: null },
    patientSummary: { type: String, default: null },
    aiReviewed: { type: Boolean, default: false },
    // Internal workflow state only. A future 837D integration should use a
    // dedicated Claim model and store the clearinghouse transaction ID there.
    claimStatus: { type: String, enum: ["not_submitted", "submitted"], default: "not_submitted" },
    claimSubmittedAt: { type: Date, default: null },
    // Secondary policy used for a second eligibility request. This is not a
    // Stedi COB response and is intentionally stored separately from `result`.
    cob: { type: secondaryInsuranceSchema, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "ClientUser", default: null },
  },
  { timestamps: true }
);

patientSchema.index({ tenantId: 1, clinicId: 1, appointment: 1 });

export const Patient = mongoose.model("Patient", patientSchema);
