import mongoose from "mongoose";

// A physical location of a practice (tenant). `clinicId` is the short code the Client Panel
// uses everywhere (cl1, cl2, ...) to scope patients, claims, staff and reports.
const clinicSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Client", required: true, index: true },
    clinicId: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    // Canonical clinic provider identity. Eligibility reads organizationName/NPI;
    // 837D claims additionally use taxonomy, tax, contact and physical address.
    // Keeping one clinic-scoped record prevents eligibility and claims from
    // drifting to different provider identities.
    claimProvider: {
      organizationName: { type: String, default: "", trim: true, maxlength: 60 },
      providerType: { type: String, enum: ["organization", "individual"], default: "organization" },
      providerFirstName: { type: String, default: "", trim: true, maxlength: 35 },
      providerLastName: { type: String, default: "", trim: true, maxlength: 60 },
      npi: { type: String, default: "", trim: true },
      taxonomyCode: { type: String, default: "122300000X", trim: true, uppercase: true },
      taxIdType: { type: String, enum: ["EIN", "SSN"], default: "EIN" },
      employerId: { type: String, default: "", trim: true },
      contactType: { type: String, enum: ["organization"], default: "organization" },
      contactOrganizationName: { type: String, default: "", trim: true, maxlength: 60 },
      phoneNumber: { type: String, default: "", trim: true },
      submitterId: { type: String, default: "", trim: true },
      address1: { type: String, default: "", trim: true },
      address2: { type: String, default: "", trim: true },
      city: { type: String, default: "", trim: true },
      state: { type: String, default: "", trim: true, uppercase: true },
      postalCode: { type: String, default: "", trim: true },
      countryCode: { type: String, default: "US", trim: true, uppercase: true },
      enrollmentContactEmail: { type: String, default: "", trim: true, lowercase: true },
    },
    // IDs and status returned by Stedi's production-mode Transaction Enrollment API.
    // This automation is intentionally limited to the Stedi Test Payer; claims and
    // ERA retrieval continue to use test credentials.
    stediEnrollment: {
      providerId: { type: String, default: "", trim: true },
      enrollmentId: { type: String, default: "", trim: true },
      payerId: { type: String, default: "FRCPB", trim: true },
      payerAlias: { type: String, default: "STEDITEST", trim: true },
      transaction: { type: String, default: "claimPayment", trim: true },
      identityFingerprint: { type: String, default: "", trim: true },
      syncStatus: { type: String, default: "not_synced", trim: true },
      enrollmentStatus: { type: String, default: "", trim: true },
      providerSyncedAt: { type: Date, default: null },
      enrollmentCheckedAt: { type: Date, default: null },
      lastAttemptAt: { type: Date, default: null },
      errorCode: { type: String, default: "", trim: true },
      errorMessage: { type: String, default: "", trim: true },
    },
  },
  { timestamps: true }
);

clinicSchema.index({ tenantId: 1, clinicId: 1 }, { unique: true });

export const Clinic = mongoose.model("Clinic", clinicSchema);
