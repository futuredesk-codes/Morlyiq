import crypto from "crypto";
import { AdminUser } from "../../../models/admin/AdminUser.js";
import { AdminRole } from "../../../models/admin/AdminRole.js";
import { Client } from "../../../models/Client.js";
import { ClientUser } from "../../../models/client/ClientUser.js";
import { sendAdminInvite } from "../../../services/admin/emailService.js";
import { ensureDefaultAdminRoles } from "../../../services/admin/roleService.js";
import {
  ADMIN_INVITATION_DAYS,
  ADMIN_INVITATION_SELECT,
  adminInvitationUrl,
  createAdminInvitation,
} from "../../../services/admin/invitationService.js";
import { notifyAdminSafely } from "../../../services/admin/notificationService.js";

const displayLastActive = (user) => {
  if (user.status === "invited") return "—";
  if (!user.lastActiveAt) return user.lastActive || "—";
  const seconds = Math.max(0, Math.floor((Date.now() - user.lastActiveAt.getTime()) / 1000));
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
};

const publicUser = (user) => ({
  id: String(user._id),
  name: user.name,
  email: user.email,
  client: user.client || "—",
  roleId: user.roleId ? String(user.roleId) : null,
  role: user.role,
  status: user.status,
  lastActive: displayLastActive(user),
  createdAt: user.createdAt,
});

export const getUsers = async (req, res) => {
  await ensureDefaultAdminRoles();
  const [users, roles, clients] = await Promise.all([
    AdminUser.find().sort({ createdAt: -1 }),
    AdminRole.find().sort({ isSystemRole: -1, createdAt: 1 }),
    Client.find().select("name").sort({ name: 1 }).lean(),
  ]);
  return res.status(200).json({
    success: true,
    count: users.length,
    data: {
      users: users.map(publicUser),
      roles: roles.map((role) => ({
        id: String(role._id),
        name: role.roleName,
        system: role.isSystemRole,
      })),
      clients: clients.map((client) => ({ id: String(client._id), name: client.name })),
    },
  });
};

export const getClientUserOptions = async (req, res) => {
  const tenantId = String(req.query?.tenantId || "").trim();
  const client = await Client.findById(tenantId).select("name").lean().catch(() => null);
  if (!client) {
    return res.status(422).json({ success: false, code: "CLIENT_NOT_FOUND", message: "Select a valid client tenant" });
  }

  const users = await ClientUser.find({
    tenantId: client._id,
    status: { $ne: "deactivated" },
  })
    .select("name email status memberships")
    .sort({ name: 1 })
    .lean();
  const existingAdmins = await AdminUser.find({
    email: { $in: users.map((user) => user.email) },
  }).select("email role status").lean();
  const adminByEmail = new Map(existingAdmins.map((admin) => [admin.email, admin]));

  return res.status(200).json({
    success: true,
    count: users.length,
    data: users.map((user) => {
      const admin = adminByEmail.get(user.email);
      return {
        id: String(user._id),
        name: user.name,
        email: user.email,
        status: user.status,
        client: client.name,
        clientRoles: [...new Set((user.memberships || []).map((membership) => membership.role))],
        hasAdminAccess: Boolean(admin),
        adminRole: admin?.role || null,
        adminStatus: admin?.status || null,
      };
    }),
  });
};

export const inviteUser = async (req, res) => {
  const tenantId = String(req.body?.tenantId || "").trim();
  const clientUserId = String(req.body?.clientUserId || "").trim();
  const roleId = String(req.body?.roleId || "").trim();
  if (!tenantId || !clientUserId || !roleId) {
    return res.status(422).json({ success: false, code: "VALIDATION_ERROR", message: "Select a valid client, client user, and role" });
  }

  const [client, role] = await Promise.all([
    Client.findById(tenantId).select("name").lean().catch(() => null),
    AdminRole.findById(roleId).catch(() => null),
  ]);
  if (!client) {
    return res.status(422).json({ success: false, code: "CLIENT_NOT_FOUND", message: "Select a valid client tenant" });
  }
  if (!role) {
    return res.status(422).json({ success: false, code: "ROLE_NOT_FOUND", message: "Select a valid role" });
  }

  const sourceUser = await ClientUser.findOne({
    _id: clientUserId,
    tenantId: client._id,
    status: { $ne: "deactivated" },
  }).select("name email").lean().catch(() => null);
  if (!sourceUser) {
    return res.status(422).json({ success: false, code: "CLIENT_USER_NOT_FOUND", message: "Select a valid user from this client tenant" });
  }

  const name = sourceUser.name;
  const email = sourceUser.email;
  const clientName = client.name;
  if (!process.env.SMTP_HOST) {
    return res.status(503).json({ success: false, code: "EMAIL_UNAVAILABLE", message: "User invitations are unavailable until email is configured" });
  }
  if (await AdminUser.exists({ email })) {
    return res.status(409).json({ success: false, code: "EMAIL_EXISTS", message: "This client user already has Admin access" });
  }

  const invitation = createAdminInvitation();
  // This required placeholder is never shared. The invitee replaces it through
  // the single-use invitation link before the account can become active.
  const inactivePassword = `${crypto.randomBytes(32).toString("base64url")}aA1!`;
  const user = await AdminUser.create({
    name,
    email,
    password: inactivePassword,
    client: clientName,
    roleId: role._id,
    role: role.roleName,
    status: "invited",
    lastActive: "—",
    invitation: {
      tokenHash: invitation.tokenHash,
      expiresAt: invitation.expiresAt,
      sentAt: new Date(),
      acceptedAt: null,
    },
  });
  const delivery = await sendAdminInvite({
    to: email,
    name,
    role: role.roleName,
    client: clientName,
    invitationUrl: adminInvitationUrl(invitation.token),
    expiresInDays: ADMIN_INVITATION_DAYS,
    invitedBy: req.adminUser.name,
  });
  if (!delivery.sent) {
    await AdminUser.deleteOne({ _id: user._id });
    return res.status(502).json({ success: false, code: "INVITE_EMAIL_FAILED", message: delivery.reason || "The invitation email could not be sent" });
  }

  return res.status(201).json({ success: true, message: "Invitation sent", data: publicUser(user) });
};

export const resendUserInvitation = async (req, res) => {
  if (!process.env.SMTP_HOST) {
    return res.status(503).json({ success: false, code: "EMAIL_UNAVAILABLE", message: "User invitations are unavailable until email is configured" });
  }
  const user = await AdminUser.findById(req.params.id).select(ADMIN_INVITATION_SELECT);
  if (!user) {
    return res.status(404).json({ success: false, code: "USER_NOT_FOUND", message: "User not found" });
  }
  if (user.status !== "invited" || !user.invitation?.tokenHash) {
    return res.status(409).json({ success: false, code: "INVITATION_NOT_PENDING", message: "Only a pending invitation can be resent" });
  }

  const previousInvitation = {
    tokenHash: user.invitation.tokenHash,
    expiresAt: user.invitation.expiresAt,
    sentAt: user.invitation.sentAt,
  };
  const invitation = createAdminInvitation();
  user.invitation.tokenHash = invitation.tokenHash;
  user.invitation.expiresAt = invitation.expiresAt;
  user.invitation.sentAt = new Date();
  await user.save();

  const delivery = await sendAdminInvite({
    to: user.email,
    name: user.name,
    role: user.role,
    client: user.client,
    invitationUrl: adminInvitationUrl(invitation.token),
    expiresInDays: ADMIN_INVITATION_DAYS,
    invitedBy: req.adminUser.name,
  });
  if (!delivery.sent) {
    user.invitation.tokenHash = previousInvitation.tokenHash;
    user.invitation.expiresAt = previousInvitation.expiresAt;
    user.invitation.sentAt = previousInvitation.sentAt;
    await user.save();
    return res.status(502).json({ success: false, code: "INVITE_EMAIL_FAILED", message: delivery.reason || "The invitation email could not be sent" });
  }

  return res.status(200).json({ success: true, message: "A new invitation link was sent", data: publicUser(user) });
};

export const updateUser = async (req, res) => {
  const user = await AdminUser.findById(req.params.id).select(ADMIN_INVITATION_SELECT);
  if (!user) return res.status(404).json({ success: false, code: "USER_NOT_FOUND", message: "User not found" });

  const nextRoleId = req.body?.roleId;
  const nextStatus = req.body?.status;
  if (nextStatus !== undefined && !["active", "invited", "deactivated"].includes(nextStatus)) {
    return res.status(422).json({ success: false, code: "VALIDATION_ERROR", message: "Select a valid status" });
  }

  let nextRole = null;
  if (nextRoleId !== undefined) {
    nextRole = await AdminRole.findById(nextRoleId).catch(() => null);
    if (!nextRole) {
      return res.status(422).json({ success: false, code: "VALIDATION_ERROR", message: "Select a valid role" });
    }
  }

  const isSelf = String(req.adminUser._id) === String(user._id);
  if (isSelf && (nextRole || nextStatus === "deactivated")) {
    return res.status(409).json({ success: false, code: "SELF_LOCKOUT_BLOCKED", message: "You cannot change your own role or deactivate your own account" });
  }

  const removesSuperAdmin = user.role === "Super Admin"
    && ((nextRole && nextRole.roleName !== "Super Admin") || nextStatus === "deactivated");
  if (removesSuperAdmin) {
    const activeSuperAdmins = await AdminUser.countDocuments({ role: "Super Admin", status: "active" });
    if (activeSuperAdmins <= 1) {
      return res.status(409).json({ success: false, code: "LAST_SUPER_ADMIN", message: "At least one active Super Admin is required" });
    }
  }

  const previousRole = user.role;
  const previousStatus = user.status;
  if (nextRole) {
    user.roleId = nextRole._id;
    user.role = nextRole.roleName;
  }
  if (nextStatus !== undefined) {
    // A reactivation action must not skip the invitation's password setup.
    user.status = nextStatus === "active" && user.invitation?.tokenHash ? "invited" : nextStatus;
  }
  await user.save();
  if (user.status === "active" && (previousRole !== user.role || previousStatus !== user.status)) {
    await notifyAdminSafely({
      category: "access",
      type: "info",
      title: "Your Admin access changed",
      message: `Your Admin role is ${user.role} and your account status is ${user.status}.`,
      actionUrl: "/dashboard",
      recipientUserIds: [user._id],
      clientName: user.client || "",
      sourceType: "admin_user",
      sourceId: String(user._id),
      dedupeKey: `admin-user:${user._id}:access:${user.updatedAt.getTime()}`,
    });
  }
  return res.status(200).json({ success: true, message: "User updated", data: publicUser(user) });
};
