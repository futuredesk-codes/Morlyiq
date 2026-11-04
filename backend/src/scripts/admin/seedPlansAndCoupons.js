import dotenv from "dotenv";
import mongoose from "mongoose";
import { connectDB } from "../../config/db.js";
import { Coupon } from "../../models/admin/Coupon.js";
import { Plan } from "../../models/admin/Plan.js";

dotenv.config();

const allFeatures = ["eligibility", "insurance_discovery", "cob", "eligibility_pdfs", "claims", "era", "claim_status", "era_pdfs", "acknowledgments"];
const plans = [
  { key: "pl1", name: "Starter Eligibility", price: 149, currency: "USD", period: "1 month", usageLimit: 150, status: "Active", features: ["eligibility", "eligibility_pdfs"] },
  { key: "pl2", name: "Growth Claims Bundle", price: 399, currency: "USD", period: "3 months", usageLimit: 500, status: "Active", features: ["eligibility", "insurance_discovery", "claims", "claim_status"] },
  { key: "pl3", name: "Full Revenue Cycle", price: 899, currency: "USD", period: "6 months", usageLimit: 2000, status: "Active", features: allFeatures },
  { key: "pl4", name: "Enterprise Custom", price: null, currency: "USD", period: "12 months", usageLimit: null, status: "Active", features: allFeatures },
  { key: "pl5", name: "Early Access Trial", price: 0, currency: "USD", period: "14 days", usageLimit: 50, status: "Draft", features: ["eligibility"] },
];
const coupons = [
  { code: "LAUNCH25", pct: 25, active: true, redemptions: 34, expiresAt: new Date("2026-09-30T23:59:59.999Z") },
  { code: "REFDENTIST10", pct: 10, active: true, redemptions: 118, expiresAt: new Date("2026-12-31T23:59:59.999Z") },
  { code: "WINTER2025", pct: 20, active: false, redemptions: 61, expiresAt: new Date("2026-01-15T23:59:59.999Z") },
];

await connectDB();
for (const plan of plans) {
  await Plan.updateOne({ key: plan.key }, { $setOnInsert: plan }, { upsert: true });
}
for (const coupon of coupons) {
  await Coupon.updateOne({ code: coupon.code }, { $setOnInsert: coupon }, { upsert: true });
}

console.log(`Plans ready: ${await Plan.countDocuments()}; coupons ready: ${await Coupon.countDocuments()}`);
await mongoose.disconnect();
