import dotenv from "dotenv";
import mongoose from "mongoose";
import { connectDB } from "../../config/db.js";
import { AdminUser } from "../../models/admin/AdminUser.js";
import { ensureDefaultAdminRoles } from "../../services/admin/roleService.js";

dotenv.config();

const email = String(process.env.ADMIN_SEED_EMAIL || "").trim().toLowerCase();
const password = String(process.env.ADMIN_SEED_PASSWORD || "");
const name = String(process.env.ADMIN_SEED_NAME || "Super Admin").trim();

if (!email || password.length < 8) {
  console.error("Set ADMIN_SEED_EMAIL and ADMIN_SEED_PASSWORD (minimum 8 characters) in backend/.env");
  process.exit(1);
}

await connectDB();
const roles = await ensureDefaultAdminRoles();
const superAdminRole = roles.find((role) => role.roleName === "Super Admin");

let user = await AdminUser.findOne({ email }).select("+password");
if (user) {
  user.name = name;
  user.password = password;
  user.role = "Super Admin";
  user.roleId = superAdminRole?._id || null;
  user.status = "active";
  user.organization = process.env.ADMIN_SEED_ORGANIZATION || "FutureDesks Services";
  await user.save();
  console.log(`Updated Super Admin: ${email}`);
} else {
  user = await AdminUser.create({
    name,
    email,
    password,
    role: "Super Admin",
    roleId: superAdminRole?._id || null,
    status: "active",
    organization: process.env.ADMIN_SEED_ORGANIZATION || "FutureDesks Services",
  });
  console.log(`Created Super Admin: ${user.email}`);
}

await mongoose.disconnect();
