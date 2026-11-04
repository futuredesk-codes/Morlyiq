import { ADMIN_ACTIONS, ADMIN_RESOURCES, AdminRole } from "../../../models/admin/AdminRole.js";
import { AdminUser } from "../../../models/admin/AdminUser.js";
import { ensureDefaultAdminRoles } from "../../../services/admin/roleService.js";
import { notifyAdminSafely } from "../../../services/admin/notificationService.js";

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const normalizePermissions = (value) => {
  if (!Array.isArray(value)) return null;
  const byResource = new Map();
  for (const entry of value) {
    const resource = String(entry?.resource || "").trim().toLowerCase();
    if (!ADMIN_RESOURCES.includes(resource) || !Array.isArray(entry?.actions)) return null;
    const actions = [...new Set(entry.actions.map((action) => String(action).trim().toLowerCase()))];
    if (actions.some((action) => !ADMIN_ACTIONS.includes(action))) return null;
    byResource.set(resource, actions);
  }
  return [...byResource].map(([resource, actions]) => ({ resource, actions }));
};

const publicRole = async (role) => ({
  id: String(role._id),
  name: role.roleName,
  desc: role.description,
  system: role.isSystemRole,
  permissions: role.permissions.map((entry) => ({
    resource: entry.resource,
    actions: [...entry.actions],
  })),
  userCount: await AdminUser.countDocuments({ roleId: role._id }),
  createdAt: role.createdAt,
  updatedAt: role.updatedAt,
});

export const getRoles = async (req, res) => {
  await ensureDefaultAdminRoles();
  const roles = await AdminRole.find().sort({ isSystemRole: -1, createdAt: 1 });
  const data = await Promise.all(roles.map(publicRole));
  return res.status(200).json({ success: true, count: data.length, data });
};

export const createRole = async (req, res) => {
  const name = String(req.body?.name || "").trim();
  const description = String(req.body?.description || "").trim() || "Custom role.";
  const rolePermissions = normalizePermissions(req.body?.permissions || []);
  if (!name || !rolePermissions) {
    return res.status(422).json({ success: false, code: "VALIDATION_ERROR", message: "Enter a valid role name and permission matrix" });
  }
  const exists = await AdminRole.exists({ roleName: { $regex: `^${escapeRegex(name)}$`, $options: "i" } });
  if (exists) {
    return res.status(409).json({ success: false, code: "ROLE_EXISTS", message: "A role with this name already exists" });
  }
  const role = await AdminRole.create({
    roleName: name,
    description,
    isSystemRole: false,
    permissions: rolePermissions,
  });
  return res.status(201).json({ success: true, message: "Role created", data: await publicRole(role) });
};

export const updateRole = async (req, res) => {
  const role = await AdminRole.findById(req.params.id).catch(() => null);
  if (!role) return res.status(404).json({ success: false, code: "ROLE_NOT_FOUND", message: "Role not found" });
  if (role.isSystemRole) {
    return res.status(403).json({ success: false, code: "SYSTEM_ROLE_IMMUTABLE", message: "System roles cannot be edited" });
  }

  const previousName = role.roleName;
  if (req.body?.name !== undefined) {
    const name = String(req.body.name).trim();
    if (!name) return res.status(422).json({ success: false, code: "VALIDATION_ERROR", message: "Role name is required" });
    const duplicate = await AdminRole.exists({
      _id: { $ne: role._id },
      roleName: { $regex: `^${escapeRegex(name)}$`, $options: "i" },
    });
    if (duplicate) return res.status(409).json({ success: false, code: "ROLE_EXISTS", message: "A role with this name already exists" });
    role.roleName = name;
  }
  if (req.body?.description !== undefined) {
    role.description = String(req.body.description).trim() || "Custom role.";
  }
  if (req.body?.permissions !== undefined) {
    const rolePermissions = normalizePermissions(req.body.permissions);
    if (!rolePermissions) {
      return res.status(422).json({ success: false, code: "VALIDATION_ERROR", message: "Permission matrix contains an invalid resource or action" });
    }
    role.permissions = rolePermissions;
  }
  await role.save();
  if (previousName !== role.roleName) {
    await AdminUser.updateMany({ roleId: role._id }, { $set: { role: role.roleName } });
  }
  if (req.body?.permissions !== undefined || previousName !== role.roleName) {
    const assignedUsers = await AdminUser.find({ roleId: role._id, status: "active" }).select("_id").lean();
    if (assignedUsers.length) {
      await notifyAdminSafely({
        category: "access",
        type: "info",
        title: "Your Admin permissions changed",
        message: `The ${role.roleName} role was updated. Your navigation and available actions now reflect the latest permissions.`,
        actionUrl: "/dashboard",
        recipientUserIds: assignedUsers.map((user) => user._id),
        sourceType: "admin_role",
        sourceId: String(role._id),
        dedupeKey: `role:${role._id}:access:${role.updatedAt.getTime()}`,
      });
    }
  }
  return res.status(200).json({ success: true, message: "Role updated", data: await publicRole(role) });
};

export const deleteRole = async (req, res) => {
  const role = await AdminRole.findById(req.params.id).catch(() => null);
  if (!role) return res.status(404).json({ success: false, code: "ROLE_NOT_FOUND", message: "Role not found" });
  if (role.isSystemRole) {
    return res.status(403).json({ success: false, code: "SYSTEM_ROLE_IMMUTABLE", message: "System roles cannot be deleted" });
  }
  const assigned = await AdminUser.countDocuments({ roleId: role._id });
  if (assigned) {
    return res.status(409).json({
      success: false,
      code: "ROLE_IN_USE",
      message: `Reassign ${assigned} user(s) before deleting this role`,
    });
  }
  await role.deleteOne();
  return res.status(200).json({ success: true, message: "Role deleted", data: { id: String(role._id) } });
};
