import mongoose from "mongoose";

const addressSchema = new mongoose.Schema(
  {
    address1: { type: String, default: "", trim: true },
    address2: { type: String, default: "", trim: true },
    city: { type: String, default: "", trim: true },
    state: { type: String, default: "", trim: true, uppercase: true },
    postalCode: { type: String, default: "", trim: true },
    countryCode: { type: String, default: "US", trim: true, uppercase: true },
  },
  { _id: false }
);

const serviceLineSchema = new mongoose.Schema(
  {
    code: { type: String, default: "", trim: true, uppercase: true },
    description: { type: String, default: "", trim: true },
    serviceDate: { type: String, default: "", trim: true },
    // Drafts may be incomplete; submission validation requires a positive charge.
    chargeCents: { type: Number, default: 0, min: 0 },
    units: { type: Number, default: 1, min: 1, max: 99 },
    toothNumber: { type: String, default: "", trim: true },
    toothSurfaces: [{ type: String, trim: true, uppercase: true }],
    providerControlNumber: { type: String, required: true, trim: true },
  },
  { _id: true }
);

const problemSchema = new mongoose.Schema(
  {
    field: { type: String, default: "", trim: true },
    code: { type: String, default: "", trim: true },
    message: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const claimSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Client", required: true, index: true },
    clinicId: { type: String, required: true, index: true },
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: true, index: true },
    claimNumber: { type: String, required: true, unique: true, trim: true, uppercase: true },
    environment: { type: String, enum: ["test", "production"], default: "test", index: true },
    patient: {
      fullName: { type: String, required: true, trim: true },
      firstName: { type: String, required: true, trim: true },
      lastName: { type: String, required: true, trim: true },
      dob: { type: String, required: true, trim: true },
      gender: { type: String, enum: ["M", "F", "U"], required: true },
      address: { type: addressSchema, default: () => ({}) },
    },
    payer: {
      name: { type: String, required: true, trim: true },
      stediId: { type: String, default: "", trim: true, uppercase: true },
      tradingPartnerServiceId: { type: String, required: true, trim: true },
      memberId: { type: String, required: true, trim: true },
      groupNumber: { type: String, default: "", trim: true },
    },
    billingProvider: {
      organizationName: { type: String, default: "", trim: true },
      providerType: { type: String, enum: ["organization", "individual"], default: "organization" },
      providerFirstName: { type: String, default: "", trim: true },
      providerLastName: { type: String, default: "", trim: true },
      npi: { type: String, default: "", trim: true },
      taxonomyCode: { type: String, default: "", trim: true, uppercase: true },
      taxIdType: { type: String, enum: ["EIN", "SSN"], default: "EIN" },
      employerId: { type: String, default: "", trim: true },
      phoneNumber: { type: String, default: "", trim: true },
      submitterId: { type: String, default: "", trim: true },
      address: { type: addressSchema, default: () => ({}) },
    },
    diagnosisCode: { type: String, default: "", trim: true, uppercase: true },
    placeOfServiceCode: { type: String, default: "11", trim: true },
    claimFilingCode: { type: String, default: "CI", trim: true, uppercase: true },
    serviceLines: { type: [serviceLineSchema], default: [] },
    totalChargeCents: { type: Number, default: 0, min: 0 },
    testDataConfirmed: { type: Boolean, default: false },
    status: {
      type: String,
      enum: [
        "draft",
        "validation_failed",
        "ready",
        "submitting",
        "test_submitted",
        "stedi_accepted",
        "stedi_rejected",
        "submission_error",
      ],
      default: "draft",
      index: true,
    },
    validationErrors: { type: [problemSchema], default: [] },
    validationWarnings: { type: [problemSchema], default: [] },
    validatedAt: { type: Date, default: null },
    idempotencyKey: { type: String, required: true, trim: true },
    submissionAttempts: { type: Number, default: 0 },
    submittedAt: { type: Date, default: null },
    stedi: {
      correlationId: { type: String, default: "", trim: true },
      controlNumber: { type: String, default: "", trim: true },
      traceId: { type: String, default: "", trim: true },
      status: { type: String, default: "", trim: true },
      httpStatusCode: { type: String, default: "", trim: true },
      payerId: { type: String, default: "", trim: true },
      submissionDataSource: {
        type: String,
        enum: ["application", "env_mock", "code_fixture"],
        default: "application",
      },
      errors: { type: [problemSchema], default: [] },
      responseReceivedAt: { type: Date, default: null },
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "ClientUser", required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "ClientUser", required: true },
  },
  { timestamps: true, collection: "claims" }
);

claimSchema.index({ tenantId: 1, clinicId: 1, createdAt: -1 });
claimSchema.index({ tenantId: 1, clinicId: 1, patientId: 1 });

export const Claim = mongoose.model("Claim", claimSchema);
