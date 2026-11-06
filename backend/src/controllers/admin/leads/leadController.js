import { AdminUser } from "../../../models/admin/AdminUser.js";
import mongoose from "mongoose";
import { Lead, LEAD_STATUSES, CALL_OUTCOMES } from "../../../models/admin/Lead.js";
import { adminLeadScope as scopeFor } from "../../../services/admin/leadAccessService.js";
import { roleHasPermission } from "../../../services/admin/roleService.js";
import { recordAdminAuditSafely } from "../../../services/admin/auditService.js";
import { resolveLeadActivityReminder } from "../../../services/admin/leadReminderService.js";
import { notifyAdminSafely } from "../../../services/admin/notificationService.js";

const publicLead = (lead, req, detail = false) => ({
  id: String(lead._id),
  name: lead.practiceName,
  contact: lead.contactName,
  phone: lead.phone || "",
  source: lead.source,
  ownerId: lead.ownerId?._id ? String(lead.ownerId._id) : lead.ownerId ? String(lead.ownerId) : null,
  owner: lead.ownerId?.name || lead.ownerName,
  status: lead.status,
  lastActivity: {
    label: roleHasPermission(req.adminRole, "calls", "view") && roleHasPermission(req.adminRole, "tasks", "view")
      ? lead.lastActivityLabel : "Lead updated",
    at: lead.lastActivityAt,
  },
  createdAt: lead.createdAt,
  ...(detail ? { activities: (lead.activities || []).filter((entry) => {
    const type = entry.relatedType || entry.type;
    return type === "call" ? roleHasPermission(req.adminRole, "calls", "view")
      : ["task", "followup"].includes(type) ? roleHasPermission(req.adminRole, "tasks", "view") : true;
  }).map((entry) => ({ ...entry.toObject(), id: String(entry._id) })) } : {}),
});

const invalid = (res, message) => res.status(422).json({ success: false, code: "VALIDATION_ERROR", message });
const missing = (res) => res.status(404).json({ success: false, code: "LEAD_NOT_FOUND", message: "Lead not found or unavailable" });
const clean = (value) => typeof value === "string" ? value.trim() : "";
export const normalizeLeadPhone = (value) => {
  if (typeof value !== "string") return null;
  const phone = clean(value).replace(/[\s().-]/g, "");
  return !phone || /^\+?[0-9]{7,15}$/.test(phone) ? phone : null;
};
const event = (req, type, title, fields = {}) => ({
  type, title, actorId: req.adminUser._id, actorName: req.adminUser.name, at: new Date(), ...fields,
});
const findScoped = async (req) => mongoose.isValidObjectId(req.params.id)
  ? Lead.findOne({ ...await scopeFor(req), _id: req.params.id }) : null;
const audit = (req, lead, action) => recordAdminAuditSafely({ user: req.adminUser, roleName: req.adminRole.roleName, action, target: lead.practiceName, req });
const respondLead = async (req, res, lead) => {
  await lead.populate("ownerId", "name email");
  return res.json({ success: true, data: publicLead(lead, req, true) });
};
// Keep the embedded timeline below MongoDB's document-size limit. Never discard history silently.
const historyCapacity = { $expr: { $lt: [{ $size: { $ifNull: ["$activities", []] } }, 2000] } };

export const getLeads = async (req, res) => {
  const scope = await scopeFor(req);
  const ownerScope = req.adminRole.roleName === "Client Admin" ? { client: req.adminUser.client }
    : req.adminRole.roleName === "Staff" ? { _id: req.adminUser._id } : {};
  const [leads, owners] = await Promise.all([
    Lead.find(scope).select("-activities")
      .populate("ownerId", "name email")
      .sort({ createdAt: -1 }),
    AdminUser.find({ status: "active", ...ownerScope })
      .select("name email role")
      .sort({ name: 1 })
      .lean(),
  ]);

  return res.status(200).json({
    success: true,
    count: leads.length,
    data: {
      leads: leads.map((lead) => publicLead(lead, req)),
      owners: owners.map((owner) => ({
        id: String(owner._id),
        name: owner.name,
        email: owner.email,
        role: owner.role,
      })),
    },
  });
};

export const createLead = async (req, res) => {
  const practiceName = String(req.body?.practiceName ?? req.body?.name ?? "").trim();
  const contactName = String(req.body?.contactName ?? req.body?.contact ?? "").trim();
  const source = String(req.body?.source || "").trim();
  const ownerId = String(req.body?.ownerId || "").trim();
  const phone = normalizeLeadPhone(req.body?.phone ?? "");
  if (phone === null) return invalid(res, "Enter a valid phone number with 7–15 digits and optional + country code");
  const scope = await scopeFor(req);
  if (scope._id === null) return invalid(res, "Your account is not linked to an available client");

  if (!practiceName || !contactName || !source || !ownerId) {
    return res.status(422).json({
      success: false,
      code: "VALIDATION_ERROR",
      message: "Practice name, contact, source, and owner are required",
    });
  }

  if (!mongoose.isValidObjectId(ownerId)) return invalid(res, "Select a valid lead owner");
  const ownerScope = req.adminRole.roleName === "Client Admin" ? { client: req.adminUser.client }
    : req.adminRole.roleName === "Staff" ? { _id: req.adminUser._id } : {};
  const owner = await AdminUser.findOne({ $and: [{ _id: ownerId, status: "active" }, ownerScope] })
    .select("name email")
    .catch(() => null);
  if (!owner) {
    return res.status(422).json({
      success: false,
      code: "OWNER_NOT_FOUND",
      message: "Select a valid active Admin user as the lead owner",
    });
  }

  const lead = await Lead.create({
    practiceName,
    contactName,
    phone,
    clientId: scope.clientId || null,
    activities: [event(req, "created", "Lead created")],
    source,
    ownerId: owner._id,
    ownerName: owner.name,
    status: "Open",
    lastActivityLabel: "Lead created",
    lastActivityAt: new Date(),
  });
  await lead.populate("ownerId", "name email");

  await notifyAdminSafely({
    category: "lead",
    type: "info",
    title: "New lead assigned to you",
    message: `${practiceName} was assigned by ${req.adminUser.name}.`,
    actionUrl: "/leads",
    recipientUserIds: [owner._id],
    requiredPermission: "leads:view",
    sourceType: "lead",
    sourceId: String(lead._id),
    dedupeKey: `lead:${lead._id}:owner:${owner._id}:status:Open`,
  });

  return res.status(201).json({
    success: true,
    message: "Lead created",
    data: publicLead(lead, req),
  });
};

export const getLead = async (req, res) => {
  const lead = await findScoped(req);
  return lead ? respondLead(req, res, lead) : missing(res);
};

export const updateLead = async (req, res) => {
  const lead = await findScoped(req);
  if (!lead) return missing(res);
  const changes = {};
  const entries = [];
  if (req.body?.status !== undefined) {
    if (!LEAD_STATUSES.includes(req.body.status)) return invalid(res, "Select a valid lead status");
    if (req.body.status !== lead.status) {
      changes.status = req.body.status;
      entries.push(event(req, "status", `Status changed: ${lead.status} → ${changes.status}`));
    }
  }
  if (req.body?.phone !== undefined) {
    const phone = normalizeLeadPhone(req.body.phone);
    if (phone === null) return invalid(res, "Enter a valid phone number with 7–15 digits and optional + country code");
    if (phone !== (lead.phone || "")) {
      changes.phone = phone;
      entries.push(event(req, "contact", "Contact number updated"));
    }
  }
  if (!entries.length) return respondLead(req, res, lead);
  const updated = await Lead.findOneAndUpdate(
    { _id: lead._id, ...await scopeFor(req), updatedAt: lead.updatedAt, ...historyCapacity },
    { $set: { ...changes, lastActivityLabel: entries.at(-1).title, lastActivityAt: new Date() }, $push: { activities: { $each: entries } } },
    { returnDocument: "after", runValidators: true },
  );
  if (!updated) return res.status(409).json({ success: false, message: "Lead changed or timeline is full. Refresh and try again." });
  await audit(req, updated, "Lead updated");
  return respondLead(req, res, updated);
};

export const addLeadActivity = async (req, res) => {
  const lead = await findScoped(req);
  if (!lead) return missing(res);
  const { type } = req.body || {};
  if (!["call", "followup", "task"].includes(type)) return invalid(res, "Select a valid activity type");
  const resource = type === "call" ? "calls" : "tasks";
  if (!roleHasPermission(req.adminRole, resource, "create")) {
    return res.status(403).json({ success: false, code: "PERMISSION_DENIED", message: `Missing permission: ${resource}:create` });
  }
  const notes = clean(req.body.notes);
  if (notes.length > 4000) return invalid(res, "Notes must be 4000 characters or fewer");
  let entry;
  if (type === "call") {
    const duration = req.body.durationMinutes;
    if (!CALL_OUTCOMES.includes(req.body.outcome) || typeof duration !== "number" || !Number.isFinite(duration) || duration < 0 || duration > 1440) {
      return invalid(res, "Choose a call outcome and a duration between 0 and 1440 minutes");
    }
    entry = event(req, type, `Call logged: ${req.body.outcome}`, { outcome: req.body.outcome, durationMinutes: duration, notes });
  } else {
    const title = clean(req.body.title);
    const dueAt = req.body.dueAt ? new Date(req.body.dueAt) : null;
    if (!title || title.length > 200) return invalid(res, "Enter an activity title of 200 characters or fewer");
    if ((type === "followup" && !dueAt) || (dueAt && (Number.isNaN(dueAt.getTime()) || dueAt <= new Date()))) {
      return invalid(res, "Choose a future date and time");
    }
    entry = event(req, type, title, { notes, dueAt });
  }
  const updated = await Lead.findOneAndUpdate(
    { _id: lead._id, ...await scopeFor(req), ...historyCapacity },
    { $push: { activities: entry }, $set: { lastActivityLabel: entry.title, lastActivityAt: entry.at } },
    { returnDocument: "after", runValidators: true },
  );
  if (!updated) return res.status(409).json({ success: false, message: "Lead unavailable or timeline is full. Refresh and try again." });
  await audit(req, updated, `${type === "call" ? "Call logged" : type === "followup" ? "Follow-up scheduled" : "Task added"}`);
  return respondLead(req, res, updated);
};

export const completeLeadActivity = async (req, res) => {
  const lead = await findScoped(req);
  if (!lead) return missing(res);
  const activity = mongoose.isValidObjectId(req.params.activityId) ? lead.activities.id(req.params.activityId) : null;
  if (!activity || !["task", "followup"].includes(activity.type)) return missing(res);
  if (activity.completedAt) return res.status(409).json({ success: false, message: "This activity is already completed" });
  const entry = event(req, "completed", `Completed: ${activity.title}`, { relatedType: activity.type, relatedId: activity._id });
  const storedEntry = lead.activities.create(entry).toObject();
  const updated = await Lead.findOneAndUpdate(
    { _id: lead._id, ...await scopeFor(req), ...historyCapacity, activities: { $elemMatch: { _id: activity._id, completedAt: null } } },
    [
      { $set: { activities: { $map: { input: "$activities", as: "activity", in: {
        $cond: [{ $eq: ["$$activity._id", activity._id] }, { $mergeObjects: ["$$activity", { completedAt: entry.at }] }, "$$activity"],
      } } } } },
      { $set: { activities: { $concatArrays: ["$activities", { $literal: [storedEntry] }] }, lastActivityLabel: { $literal: entry.title }, lastActivityAt: entry.at } },
    ],
    { returnDocument: "after", updatePipeline: true },
  );
  if (!updated) return res.status(409).json({ success: false, message: "Activity changed or timeline is full. Refresh and try again." });
  await audit(req, updated, "Lead activity completed");
  await resolveLeadActivityReminder(updated._id, activity._id).catch(() => {
    console.error(`[Lead Reminder] Could not resolve completed activity ${activity._id}`);
  });
  return respondLead(req, res, updated);
};
