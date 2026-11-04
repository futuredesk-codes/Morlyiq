import "dotenv/config";
import mongoose from "mongoose";
import { AdminUser } from "../../models/admin/AdminUser.js";
import { AdminRole } from "../../models/admin/AdminRole.js";
import { ensureDefaultAdminRoles } from "../../services/admin/roleService.js";

if (!process.env.MONGODB_URI) {
  throw new Error("MONGODB_URI is required");
}

await mongoose.connect(process.env.MONGODB_URI);
const roles = await ensureDefaultAdminRoles();
const roleByName = new Map(roles.map((role) => [role.roleName, role]));
const users = await AdminUser.find();
let linked = 0;

for (const user of users) {
  const role = roleByName.get(user.role) || roleByName.get("Staff");
  if (!role) continue;
  if (String(user.roleId || "") !== String(role._id) || user.role !== role.roleName) {
    user.roleId = role._id;
    user.role = role.roleName;
    await user.save();
    linked += 1;
  }
}

console.log(`Admin roles ready: ${roles.length}; users linked: ${linked}`);
await mongoose.disconnect();
