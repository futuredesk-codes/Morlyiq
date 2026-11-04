import crypto from "crypto";
import { Client } from "../../../models/Client.js";
import { Feature } from "../../../models/admin/Feature.js";
import { Plan } from "../../../models/admin/Plan.js";

const planKey = () => `pl_${crypto.randomUUID().split("-")[0]}`;

async function validateFeatureKeys(keys) {
  const unique = [...new Set((keys || []).map(String))];
  const found = await Feature.countDocuments({ key: { $in: unique }, status: "active" });
  return { keys: unique, valid: found === unique.length };
}

async function withClientCounts(plans) {
  const counts = await Client.aggregate([{ $group: { _id: "$planId", count: { $sum: 1 } } }]);
  const map = new Map(counts.map((row) => [row._id, row.count]));
  return plans.map((plan) => ({ ...plan, clientCount: map.get(plan.key) || 0 }));
}

export const getPlans = async (req, res) => {
  const plans = await Plan.find().sort({ createdAt: 1 }).lean();
  return res.status(200).json({ success: true, count: plans.length, data: await withClientCounts(plans) });
};

export const createPlan = async (req, res) => {
  const name = String(req.body?.name || "").trim();
  const period = String(req.body?.period || "").trim();
  if (!name || !period) {
    return res.status(422).json({ success: false, code: "VALIDATION_ERROR", message: "Plan name and billing period are required" });
  }

  const featureResult = await validateFeatureKeys(req.body?.features);
  if (!featureResult.valid) {
    return res.status(422).json({ success: false, code: "INVALID_FEATURES", message: "One or more selected features are not available" });
  }

  const plan = await Plan.create({
    key: planKey(),
    name,
    price: req.body.price ?? null,
    currency: req.body.currency || "USD",
    period,
    usageLimit: req.body.usageLimit ?? null,
    status: req.body.status || "Draft",
    features: featureResult.keys,
  });
  return res.status(201).json({ success: true, message: "Plan created", data: { ...plan.toObject(), clientCount: 0 } });
};

export const updatePlan = async (req, res) => {
  const changes = {};
  for (const key of ["name", "price", "currency", "period", "usageLimit", "status"]) {
    if (req.body?.[key] !== undefined) changes[key] = req.body[key];
  }
  if (changes.name !== undefined) changes.name = String(changes.name).trim();
  if (changes.period !== undefined) changes.period = String(changes.period).trim();
  if (changes.name === "" || changes.period === "") {
    return res.status(422).json({ success: false, code: "VALIDATION_ERROR", message: "Plan name and billing period are required" });
  }
  if (req.body?.features !== undefined) {
    const featureResult = await validateFeatureKeys(req.body.features);
    if (!featureResult.valid) {
      return res.status(422).json({ success: false, code: "INVALID_FEATURES", message: "One or more selected features are not available" });
    }
    changes.features = featureResult.keys;
  }

  const plan = await Plan.findOneAndUpdate({ key: req.params.key }, changes, { new: true, runValidators: true });
  if (!plan) return res.status(404).json({ success: false, code: "PLAN_NOT_FOUND", message: "Plan not found" });
  const clientCount = await Client.countDocuments({ planId: plan.key });
  return res.status(200).json({ success: true, message: "Plan updated", data: { ...plan.toObject(), clientCount } });
};

export const deletePlan = async (req, res) => {
  const assigned = await Client.countDocuments({ planId: req.params.key });
  if (assigned) {
    return res.status(409).json({ success: false, code: "PLAN_IN_USE", message: "Move assigned clients before deleting this plan" });
  }
  const plan = await Plan.findOneAndDelete({ key: req.params.key });
  if (!plan) return res.status(404).json({ success: false, code: "PLAN_NOT_FOUND", message: "Plan not found" });
  return res.status(200).json({ success: true, message: "Plan deleted", data: { key: plan.key } });
};
