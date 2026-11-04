import { ADMIN_ACTIONS, ADMIN_RESOURCES, AdminRole } from "../../models/admin/AdminRole.js";
import { AdminUser } from "../../models/admin/AdminUser.js";

const permissions = (entries) =>
  Object.entries(entries).map(([resource, actions]) => ({ resource, actions }));

export const DEFAULT_ADMIN_ROLES = [
  {
    roleName: "Super Admin",
    description: "Full platform access across every client, plan, feature, user and log.",
    isSystemRole: true,
    permissions: ADMIN_RESOURCES.map((resource) => ({ resource, actions: [...ADMIN_ACTIONS] })),
  },
  {
    roleName: "Manager",
    description: "Manages assigned staff, leads, tasks and reporting.",
    permissions: permissions({
      dashboard: ["view"],
      users: ["view"],
      leads: ["view", "create", "edit", "assign", "export"],
      calls: ["view", "create", "edit", "export"],
      tasks: ["view", "create", "edit", "assign", "approve"],
      reports: ["view", "export"],
    }),
  },
  {
    roleName: "Staff",
    description: "Works assigned leads, calls, notes and tasks.",
    permissions: permissions({
      dashboard: ["view"],
      leads: ["view", "edit"],
      calls: ["view", "create", "edit"],
      tasks: ["view", "create", "edit", "execute"],
    }),
  },
  {
    roleName: "Marketing Team",
    description: "Owns campaigns, lead sourcing and marketing reporting.",
    permissions: permissions({
      dashboard: ["view"],
      leads: ["view", "create", "edit"],
      reports: ["view", "export"],
    }),
  },
  {
    roleName: "Client Admin",
    description: "Manages their own tenant — users, leads and enabled features only.",
    permissions: permissions({
      dashboard: ["view"],
      users: ["view", "create", "edit", "delete", "assign"],
      leads: ["view", "create", "edit", "assign"],
      calls: ["view", "create", "edit"],
      tasks: ["view", "create", "edit", "assign"],
      claims: ["view"],
      eligibility: ["view"],
      pdfs: ["view", "export"],
      reports: ["view"],
    }),
  },
];

export const ensureDefaultAdminRoles = async () => {
  await Promise.all(
    DEFAULT_ADMIN_ROLES.map((role) =>
      AdminRole.updateOne(
        { roleName: role.roleName },
        { $setOnInsert: role },
        { upsert: true, runValidators: true }
      )
    )
  );
  await Promise.all(
    DEFAULT_ADMIN_ROLES.map((role) =>
      AdminRole.updateOne(
        {
          roleName: role.roleName,
          permissions: { $not: { $elemMatch: { resource: "dashboard" } } },
        },
        {
          $push: {
            permissions: {
              resource: "dashboard",
              actions: role.roleName === "Super Admin" ? [...ADMIN_ACTIONS] : ["view"],
            },
          },
        },
        { runValidators: true }
      )
    )
  );
  return AdminRole.find().sort({ isSystemRole: -1, createdAt: 1 });
};

export const permissionList = (role) => {
  if (!role) return [];
  return role.permissions.flatMap(({ resource, actions }) =>
    actions.map((action) => `${resource}:${action}`)
  );
};

export const roleHasPermission = (role, resource, action) =>
  role?.roleName === "Super Admin"
  || role?.permissions?.some(
    (entry) => entry.resource === resource && entry.actions.includes(action)
  );

export const getRoleForAdmin = async (user) => {
  if (!user) return null;
  let role = user.roleId ? await AdminRole.findById(user.roleId) : null;
  if (!role && user.role) role = await AdminRole.findOne({ roleName: user.role });
  if (!role) {
    await ensureDefaultAdminRoles();
    role = await AdminRole.findOne({ roleName: user.role || "Staff" });
  }
  const defaultRole = DEFAULT_ADMIN_ROLES.some((entry) => entry.roleName === role?.roleName);
  const hasDashboardEntry = role?.permissions?.some((entry) => entry.resource === "dashboard");
  if (role && defaultRole && role.roleName !== "Super Admin" && !hasDashboardEntry) {
    role.permissions.push({ resource: "dashboard", actions: ["view"] });
    await role.save();
  }
  if (role && (String(user.roleId || "") !== String(role._id) || user.role !== role.roleName)) {
    await AdminUser.updateOne(
      { _id: user._id },
      { $set: { roleId: role._id, role: role.roleName } }
    );
    user.roleId = role._id;
    user.role = role.roleName;
  }
  return role;
};
