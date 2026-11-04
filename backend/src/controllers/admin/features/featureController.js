import { Client } from "../../../models/Client.js";
import { Feature } from "../../../models/admin/Feature.js";
import { Plan } from "../../../models/admin/Plan.js";

const slug = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

export const getFeatures = async (req, res) => {
  const features = await Feature.find().sort({ sortOrder: 1, createdAt: 1 });
  return res.status(200).json({ success: true, count: features.length, data: features });
};

export const createFeature = async (req, res) => {
  const name = String(req.body?.name || "").trim();
  const key = slug(req.body?.key || name);
  if (!name || !key) {
    return res.status(422).json({ success: false, code: "VALIDATION_ERROR", message: "Feature name is required" });
  }

  const feature = await Feature.create({
    key,
    name,
    description: String(req.body?.description ?? req.body?.desc ?? "").trim(),
    sortOrder: req.body?.sortOrder ?? (await Feature.countDocuments()),
  });
  return res.status(201).json({ success: true, message: "Feature created", data: feature });
};

export const updateFeature = async (req, res) => {
  const changes = {};
  if (req.body?.name !== undefined) changes.name = String(req.body.name).trim();
  if (req.body?.description !== undefined || req.body?.desc !== undefined) {
    changes.description = String(req.body.description ?? req.body.desc ?? "").trim();
  }
  if (req.body?.status !== undefined) changes.status = req.body.status;
  if (req.body?.sortOrder !== undefined) changes.sortOrder = req.body.sortOrder;
  if (changes.name === "") {
    return res.status(422).json({ success: false, code: "VALIDATION_ERROR", message: "Feature name is required" });
  }

  const feature = await Feature.findByIdAndUpdate(req.params.id, changes, { new: true, runValidators: true });
  if (!feature) {
    return res.status(404).json({ success: false, code: "FEATURE_NOT_FOUND", message: "Feature not found" });
  }
  return res.status(200).json({ success: true, message: "Feature updated", data: feature });
};

export const deleteFeature = async (req, res) => {
  const feature = await Feature.findByIdAndDelete(req.params.id);
  if (!feature) {
    return res.status(404).json({ success: false, code: "FEATURE_NOT_FOUND", message: "Feature not found" });
  }

  await Client.updateMany({}, { $unset: { [`entitlements.${feature.key}`]: "" } });
  await Plan.updateMany({}, { $pull: { features: feature.key } });
  return res.status(200).json({ success: true, message: "Feature deleted", data: { id: String(feature._id), key: feature.key } });
};
