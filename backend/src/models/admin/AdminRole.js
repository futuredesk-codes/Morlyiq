import mongoose from "mongoose";

export const ADMIN_RESOURCES = [
  "dashboard",
  "users",
  "leads",
  "calls",
  "tasks",
  "claims",
  "eligibility",
  "pdfs",
  "reports",
  "external_links",
];

export const ADMIN_ACTIONS = [
  "view",
  "create",
  "edit",
  "delete",
  "assign",
  "export",
  "approve",
  "execute",
  "administer",
];

const permissionSchema = new mongoose.Schema(
  {
    resource: { type: String, enum: ADMIN_RESOURCES, required: true },
    actions: [{ type: String, enum: ADMIN_ACTIONS }],
  },
  { _id: false }
);

const adminRoleSchema = new mongoose.Schema(
  {
    roleName: { type: String, required: true, unique: true, trim: true },
    description: { type: String, default: "Custom role.", trim: true },
    isSystemRole: { type: Boolean, default: false },
    permissions: { type: [permissionSchema], default: [] },
  },
  { timestamps: true, collection: "roles" }
);

export const AdminRole = mongoose.model("AdminRole", adminRoleSchema);
