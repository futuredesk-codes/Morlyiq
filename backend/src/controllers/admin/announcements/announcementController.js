import mongoose from "mongoose";
import { Announcement, ANNOUNCEMENT_AUDIENCES } from "../../../models/admin/Announcement.js";
import { Plan } from "../../../models/admin/Plan.js";

const uniqueIds = (values) => [...new Set((Array.isArray(values) ? values : []).map(String))];

const serialize = (announcement) => ({
  id: String(announcement._id),
  title: announcement.title,
  body: announcement.body,
  audience: announcement.audience,
  targetPlans: (announcement.targetPlans || []).map((plan) => ({
    id: String(plan?._id || plan),
    name: plan?.name || "Unknown plan",
  })),
  published: announcement.published,
  publishedAt: announcement.publishedAt,
  createdAt: announcement.createdAt,
  updatedAt: announcement.updatedAt,
});

export const getAnnouncements = async (req, res) => {
  const [announcements, plans] = await Promise.all([
    Announcement.find().populate("targetPlans", "name").sort({ createdAt: -1 }),
    Plan.find({ status: { $ne: "Archived" } }).select("name status").sort({ name: 1 }),
  ]);

  return res.status(200).json({
    success: true,
    count: announcements.length,
    data: {
      announcements: announcements.map(serialize),
      plans: plans.map((plan) => ({ id: String(plan._id), name: plan.name, status: plan.status })),
      audienceOptions: ANNOUNCEMENT_AUDIENCES,
    },
  });
};

export const createAnnouncement = async (req, res) => {
  const title = String(req.body?.title || "").trim();
  const body = String(req.body?.body || "").trim();
  const audience = String(req.body?.audience || "All clients");
  let targetPlans = uniqueIds(req.body?.targetPlans);

  if (!title || !body || !ANNOUNCEMENT_AUDIENCES.includes(audience)) {
    return res.status(422).json({
      success: false,
      code: "VALIDATION_ERROR",
      message: "Enter a title, message, and valid audience",
    });
  }

  if (audience === "Selected plans") {
    if (!targetPlans.length || targetPlans.some((id) => !mongoose.Types.ObjectId.isValid(id))) {
      return res.status(422).json({
        success: false,
        code: "VALIDATION_ERROR",
        message: "Select at least one valid plan for this audience",
      });
    }
    const planCount = await Plan.countDocuments({ _id: { $in: targetPlans }, status: { $ne: "Archived" } });
    if (planCount !== targetPlans.length) {
      return res.status(422).json({
        success: false,
        code: "VALIDATION_ERROR",
        message: "One or more selected plans do not exist or are archived",
      });
    }
  } else {
    targetPlans = [];
  }

  const announcement = await Announcement.create({
    title,
    body,
    audience,
    targetPlans,
    published: false,
    createdBy: req.adminUser._id,
    updatedBy: req.adminUser._id,
  });
  await announcement.populate("targetPlans", "name");

  return res.status(201).json({
    success: true,
    message: "Announcement saved as draft",
    data: serialize(announcement),
  });
};

export const updateAnnouncement = async (req, res) => {
  if (typeof req.body?.published !== "boolean") {
    return res.status(422).json({
      success: false,
      code: "VALIDATION_ERROR",
      message: "Provide the published status to update",
    });
  }

  const announcement = await Announcement.findById(req.params.id);
  if (!announcement) {
    return res.status(404).json({
      success: false,
      code: "ANNOUNCEMENT_NOT_FOUND",
      message: "Announcement not found",
    });
  }

  announcement.published = req.body.published;
  announcement.publishedAt = req.body.published ? new Date() : null;
  announcement.updatedBy = req.adminUser._id;
  await announcement.save();
  await announcement.populate("targetPlans", "name");

  return res.status(200).json({
    success: true,
    message: req.body.published ? "Announcement published" : "Announcement unpublished",
    data: serialize(announcement),
  });
};

export const deleteAnnouncement = async (req, res) => {
  const announcement = await Announcement.findByIdAndDelete(req.params.id);
  if (!announcement) {
    return res.status(404).json({
      success: false,
      code: "ANNOUNCEMENT_NOT_FOUND",
      message: "Announcement not found",
    });
  }

  return res.status(200).json({
    success: true,
    message: "Announcement deleted",
    data: { id: String(announcement._id), title: announcement.title },
  });
};
