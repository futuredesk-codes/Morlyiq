import mongoose from "mongoose";
import { CLIENT_ROLES } from "../client/ClientUser.js";

export const EXTERNAL_LINK_SSO_TYPES = ["None (public link)"];

export const EXTERNAL_LINK_OPEN_MODES = ["New tab", "Embedded"];

const externalLinkSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    url: { type: String, required: true, trim: true, maxlength: 2048 },
    openMode: {
      type: String,
      enum: EXTERNAL_LINK_OPEN_MODES,
      default: "New tab",
    },
    ssoType: {
      type: String,
      enum: EXTERNAL_LINK_SSO_TYPES,
      default: "None (public link)",
    },
    setupStatus: {
      type: String,
      enum: ["ready", "configuration_required"],
      default: "ready",
    },
    enabled: { type: Boolean, default: true },
    assignedClients: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Client" }],
      validate: {
        validator: (value) => Array.isArray(value) && value.length > 0,
        message: "Assign the link to at least one client",
      },
    },
    restrictedRoles: [{ type: String, enum: CLIENT_ROLES }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "AdminUser", required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "AdminUser", required: true },
  },
  { timestamps: true, collection: "externallinks" }
);

externalLinkSchema.index({ title: 1 });
externalLinkSchema.index({ assignedClients: 1, enabled: 1 });

export const ExternalLink = mongoose.model("ExternalLink", externalLinkSchema);
