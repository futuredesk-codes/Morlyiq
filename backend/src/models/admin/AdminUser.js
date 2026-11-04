import mongoose from "mongoose";
import bcrypt from "bcryptjs";

export const ADMIN_ROLES = ["Super Admin", "Manager", "Staff", "Marketing Team", "Client Admin"];

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [8, "Password must be at least 8 characters"],
      select: false,
    },
    client: {
      type: String,
      default: "Bright Smiles Dental",
      trim: true,
    },
    role: {
      type: String,
      default: "Staff",
      trim: true,
    },
    roleId: { type: mongoose.Schema.Types.ObjectId, ref: "AdminRole", default: null, index: true },
    organization: {
      type: String,
      default: "FutureDesks Services",
      trim: true,
    },
    passwordChangedAt: { type: Date, default: null },
    passwordReset: {
      hash: { type: String, default: null, select: false },
      expiresAt: { type: Date, default: null, select: false },
      sentAt: { type: Date, default: null, select: false },
    },
    invitation: {
      tokenHash: { type: String, default: null, select: false },
      expiresAt: { type: Date, default: null },
      sentAt: { type: Date, default: null },
      acceptedAt: { type: Date, default: null },
    },
    mfa: {
      emailCode: {
        hash: { type: String, default: null, select: false },
        expiresAt: { type: Date, default: null, select: false },
        sentAt: { type: Date, default: null, select: false },
      },
    },
    status: {
      type: String,
      enum: ["active", "invited", "deactivated"],
      default: "active",
    },
    lastActive: {
      type: String,
      default: "just now",
    },
    lastActiveAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    collection: "adminusers",
  }
);

userSchema.pre("save", async function hashPassword() {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.matchesPassword = function matchesPassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

export const AdminUser = mongoose.model("AdminUser", userSchema); 
