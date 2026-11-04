import mongoose from "mongoose";

const billingInvoiceSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client",
      required: true,
      index: true,
    },
    stripeInvoiceId: { type: String, required: true, unique: true, index: true },
    stripeCustomerId: { type: String, default: "", index: true },
    stripeSubscriptionId: { type: String, default: "", index: true },
    number: { type: String, default: "" },
    status: { type: String, default: "open", index: true },
    currency: { type: String, default: "usd" },
    subtotal: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    amountPaid: { type: Number, default: 0 },
    amountDue: { type: Number, default: 0 },
    hostedInvoiceUrl: { type: String, default: "" },
    invoicePdf: { type: String, default: "" },
    billingReason: { type: String, default: "" },
    periodStart: { type: Date, default: null },
    periodEnd: { type: Date, default: null },
    paidAt: { type: Date, default: null },
    stripeCreatedAt: { type: Date, default: null },
    livemode: { type: Boolean, default: false },
  },
  { timestamps: true }
);

billingInvoiceSchema.index({ tenantId: 1, stripeCreatedAt: -1 });

export const BillingInvoice = mongoose.model("BillingInvoice", billingInvoiceSchema);
