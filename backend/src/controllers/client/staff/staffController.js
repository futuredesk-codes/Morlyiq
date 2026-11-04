import crypto from "crypto";
import bcrypt from "bcryptjs";
import { ClientUser, CLIENT_ROLES } from "../../../models/client/ClientUser.js";
import { Clinic } from "../../../models/client/Clinic.js";
import { ALL_CLINICS, roleForClinic } from "../../../middlewares/client/clinic/clinicAccess.js";
import { sendStaffInvite } from "../../../services/client/emailService.js";
import { logActivity } from "../../../services/client/activityService.js";
import { ok, created, fail, invalid } from "../../../utils/client/apiResponse.js";
import { notifyClientSafely } from "../../../services/client/notificationService.js";

// Owner is created by the seed script only, so it can never be assigned from the Staff page
const ASSIGNABLE_ROLES = CLIENT_ROLES.filter((r) => r !== "Owner");

// Owner manages everyone; a Manager manages everyone except other Managers and Owners
const canManage = (actorRole, targetRole) => actorRole === "Owner" || (actorRole === "Manager" && !["Owner", "Manager"].includes(targetRole));

/** The user's membership that applies at a clinic (their own, or the Owner's "all clinics" one). */
const membershipAt = (user, clinicId) =>
  user.memberships.find((m) => m.clinicId === clinicId) || user.memberships.find((m) => m.clinicId === ALL_CLINICS) || null;

const timeAgo = (date) => {
  if (!date) return "—";
  const s = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (s < 60) return "Just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
};

// Shape the Staff page expects: one row per person, with their role and status AT one clinic
const toStaff = (user, clinicId) => {
  const m = membershipAt(user, clinicId);
  const status = user.status === "deactivated" || (m && !m.active) ? "deactivated" : user.status;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    clinicId,
    role: m?.role,
    status,
    lastActive: timeAgo(user.lastLoginAt),
  };
};

const tenantOf = (req) => req.user.tenantId._id;
const atClinic = (clinicId) => ({ memberships: { $elemMatch: { clinicId: { $in: [clinicId, ALL_CLINICS] } } } });

// GET /api/client-panel/staff — people assigned to the ACTIVE clinic (X-Clinic-Id), with their role there
export const listStaff = async (req, res) => {
  const users = await ClientUser.find({ tenantId: tenantOf(req), ...atClinic(req.clinicId) }).sort({ createdAt: 1 });
  ok(res, "Staff loaded", users.map((u) => toStaff(u, req.clinicId)));
};

// POST /api/client-panel/staff — adds someone to a clinic. New people get a one-time temporary
// password; people who already exist in this practice are simply added to the clinic.
export const inviteStaff = async (req, res) => {
  const name = String(req.body.name || "").trim();
  const email = String(req.body.email || "").trim().toLowerCase();
  const role = req.body.role;
  const clinicId = req.body.clinicId || req.clinicId;

  const errors = [];
  if (!name) errors.push({ field: "name", message: "Name is required" });
  if (!email) errors.push({ field: "email", message: "Email is required" });
  else if (!/^\S+@\S+\.\S+$/.test(email)) errors.push({ field: "email", message: "Enter a valid email address" });
  if (!ASSIGNABLE_ROLES.includes(role)) errors.push({ field: "role", message: `Role must be one of: ${ASSIGNABLE_ROLES.join(", ")}` });
  if (errors.length) return invalid(res, errors);
  if (!(await Clinic.exists({ tenantId: tenantOf(req), clinicId }))) return invalid(res, [{ field: "clinicId", message: "Invalid clinic" }]);

  const actorRole = roleForClinic(req.user, clinicId);
  if (!["Owner", "Manager"].includes(actorRole)) return fail(res, 403, "You cannot add staff to that clinic");
  if (!canManage(actorRole, role)) return fail(res, 403, `Only an Owner can add ${role} accounts`);

  const clinic = await Clinic.findOne({ tenantId: tenantOf(req), clinicId });
  const mail = { to: email, name, role, clinicName: clinic.name, practiceName: req.user.tenantId.name, invitedBy: req.user.name };

  const existing = await ClientUser.findOne({ email });
  if (existing) {
    if (String(existing.tenantId) !== String(tenantOf(req))) return fail(res, 409, "A user with this email already exists", { code: "EMAIL_TAKEN" });
    if (membershipAt(existing, clinicId)) return fail(res, 409, "This person is already on this clinic's staff", { code: "ALREADY_STAFF" });
    existing.memberships.push({ clinicId, role });
    await existing.save();
    logActivity(req.user, "Added staff member to clinic", `${existing.name} (${role}) — ${clinic.name}`);
    await notifyClientSafely({
      tenantId: tenantOf(req), clinicId, category: "staff", type: "info",
      title: "Staff member added",
      message: `${existing.name} was added to ${clinic.name} as ${role}.`,
      audienceRoles: ["Owner", "Manager"], actionUrl: "/staff",
      sourceType: "staff", sourceId: existing._id,
    });
    const { sent } = await sendStaffInvite({ ...mail, name: existing.name, temporaryPassword: null });
    return ok(res, `${existing.name} added to the clinic`, { staff: toStaff(existing, clinicId), temporaryPassword: null, emailSent: sent, emailError: null });
  }

  const temporaryPassword = crypto.randomBytes(9).toString("base64url");
  const user = await ClientUser.create({
    tenantId: tenantOf(req),
    name,
    email,
    status: "invited",
    memberships: [{ clinicId, role }],
    password: await bcrypt.hash(temporaryPassword, 10),
  });

  // The password travels by email. It is returned to the page only if the email could not be sent,
  // so the inviter can pass it on by hand. It is never stored in plain text.
  logActivity(req.user, "Invited staff member", `${name} (${role}) — ${clinic.name}`);
  const { sent, reason } = await sendStaffInvite({ ...mail, temporaryPassword });
  await notifyClientSafely({
    tenantId: tenantOf(req), clinicId, category: "staff", type: sent ? "info" : "warn",
    title: sent ? "Staff invitation sent" : "Staff invitation email failed",
    message: sent
      ? `${name} was invited to ${clinic.name} as ${role}.`
      : `${name}'s account was created, but the invitation email was not delivered.`,
    audienceRoles: ["Owner", "Manager"], actionUrl: "/staff",
    sourceType: "staff", sourceId: user._id,
  });
  created(res, sent ? `Invitation email sent to ${email}` : `Account created for ${email}, but the email was not sent`, {
    staff: toStaff(user, clinicId),
    emailSent: sent,
    emailError: sent ? null : reason,
    temporaryPassword: sent ? null : temporaryPassword,
  });
};

// PATCH /api/client-panel/staff/:id — change role / (de)activate, at the ACTIVE clinic only
export const updateStaff = async (req, res) => {
  const user = await ClientUser.findOne({ _id: req.params.id, tenantId: tenantOf(req) }).catch(() => null);
  const m = user && user.memberships.find((x) => x.clinicId === req.clinicId);
  if (!user || (!m && !membershipAt(user, req.clinicId))) return fail(res, 404, "Staff member not found at this clinic");
  if (!m) return fail(res, 403, "Owner accounts cannot be modified here");
  if (m.role === "Owner") return fail(res, 403, "Owner accounts cannot be modified here");
  if (user.id === req.user.id) return fail(res, 400, "You cannot change your own role or status", { code: "SELF_CHANGE_NOT_ALLOWED" });
  if (!canManage(req.clinicRole, m.role)) return fail(res, 403, `Only an Owner can modify ${m.role} accounts`);

  const { role, status } = req.body;
  const was = m.role;
  if (role !== undefined) {
    if (!ASSIGNABLE_ROLES.includes(role)) return invalid(res, [{ field: "role", message: `Role must be one of: ${ASSIGNABLE_ROLES.join(", ")}` }]);
    if (!canManage(req.clinicRole, role)) return fail(res, 403, `Only an Owner can assign the ${role} role`);
    m.role = role;
  }
  if (status !== undefined) {
    if (!["active", "deactivated"].includes(status)) return invalid(res, [{ field: "status", message: "Status must be active or deactivated" }]);
    m.active = status === "active";
  }
  await user.save();
  if (role !== undefined && role !== was) {
    logActivity(req.user, "Changed staff role", `${user.name}: ${was} -> ${role}`);
    await notifyClientSafely({
      tenantId: tenantOf(req), clinicId: req.clinicId, category: "staff", type: "info",
      title: "Staff role changed", message: `${user.name}'s role changed from ${was} to ${role}.`,
      audienceRoles: ["Owner", "Manager"], actionUrl: "/staff",
      sourceType: "staff", sourceId: user._id,
    });
  }
  if (status !== undefined) {
    logActivity(req.user, status === "active" ? "Reactivated staff member" : "Deactivated staff member", user.name);
    await notifyClientSafely({
      tenantId: tenantOf(req), clinicId: req.clinicId, category: "staff",
      type: status === "active" ? "success" : "warn",
      title: status === "active" ? "Staff access restored" : "Staff access removed",
      message: `${user.name} was ${status === "active" ? "reactivated" : "deactivated"} at this clinic.`,
      audienceRoles: ["Owner", "Manager"], actionUrl: "/staff",
      sourceType: "staff", sourceId: user._id,
    });
  }
  ok(res, "Staff member updated", toStaff(user, req.clinicId));
};
