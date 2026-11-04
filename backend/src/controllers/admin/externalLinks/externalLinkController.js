import mongoose from "mongoose";
import { Client } from "../../../models/Client.js";
import { CLIENT_ROLES } from "../../../models/client/ClientUser.js";
import {
  EXTERNAL_LINK_OPEN_MODES,
  ExternalLink,
} from "../../../models/admin/ExternalLink.js";

const PUBLIC_LINK = "None (public link)";

const normalizeUrl = (value) => {
  try {
    const parsed = new URL(String(value || "").trim());
    const localHttp = parsed.protocol === "http:" && ["localhost", "127.0.0.1"].includes(parsed.hostname);
    if (parsed.protocol !== "https:" && !localHttp) return null;
    return parsed.toString();
  } catch {
    return null;
  }
};

const uniqueStrings = (values) => [...new Set((Array.isArray(values) ? values : []).map(String))];

const serialize = (link) => ({
  id: String(link._id),
  title: link.title,
  url: link.url,
  openMode: link.openMode,
  ssoType: link.ssoType,
  setupStatus: link.setupStatus,
  enabled: link.enabled,
  assignedClients: (link.assignedClients || []).map((client) => ({
    id: String(client?._id || client),
    name: client?.name || "Unknown client",
  })),
  restrictedRoles: link.restrictedRoles || [],
  createdAt: link.createdAt,
  updatedAt: link.updatedAt,
});

const populateLink = (query) => query.populate("assignedClients", "name");

const validateConfiguration = async (body, { partial = false } = {}) => {
  const value = {};

  if (!partial || body.title !== undefined) {
    value.title = String(body.title || "").trim();
    if (!value.title) return { error: "Tab / menu title is required" };
  }

  if (!partial || body.url !== undefined) {
    value.url = normalizeUrl(body.url);
    if (!value.url) return { error: "Enter a valid HTTPS URL (HTTP is allowed only for localhost)" };
  }

  if (!partial || body.openMode !== undefined) {
    value.openMode = body.openMode || "New tab";
    if (!EXTERNAL_LINK_OPEN_MODES.includes(value.openMode)) return { error: "Select a valid open mode" };
  }

  value.ssoType = PUBLIC_LINK;

  if (!partial || body.assignedClients !== undefined) {
    const ids = uniqueStrings(body.assignedClients);
    if (!ids.length || ids.some((id) => !mongoose.Types.ObjectId.isValid(id))) {
      return { error: "Assign the link to at least one valid client" };
    }
    const clients = await Client.countDocuments({ _id: { $in: ids } });
    if (clients !== ids.length) return { error: "One or more selected clients do not exist" };
    value.assignedClients = ids;
  }

  if (!partial || body.restrictedRoles !== undefined) {
    const roles = uniqueStrings(body.restrictedRoles);
    if (roles.some((role) => !CLIENT_ROLES.includes(role))) {
      return { error: "One or more selected client roles are invalid" };
    }
    value.restrictedRoles = roles;
  }

  return { value };
};

export const getExternalLinks = async (req, res) => {
  await ExternalLink.updateMany(
    { $or: [{ ssoType: { $ne: PUBLIC_LINK } }, { setupStatus: { $ne: "ready" } }] },
    { $set: { ssoType: PUBLIC_LINK, setupStatus: "ready" } },
  );
  const [links, clients] = await Promise.all([
    populateLink(ExternalLink.find().sort({ createdAt: -1 })),
    Client.find({ status: { $ne: "archived" } }).select("name status").sort({ name: 1 }),
  ]);

  return res.status(200).json({
    success: true,
    count: links.length,
    data: {
      links: links.map(serialize),
      clients: clients.map((client) => ({ id: String(client._id), name: client.name, status: client.status })),
      roleOptions: CLIENT_ROLES,
      openModeOptions: EXTERNAL_LINK_OPEN_MODES,
    },
  });
};

export const createExternalLink = async (req, res) => {
  const validation = await validateConfiguration(req.body || {});
  if (validation.error) {
    return res.status(422).json({ success: false, code: "VALIDATION_ERROR", message: validation.error });
  }

  const created = await ExternalLink.create({
    ...validation.value,
    ssoType: PUBLIC_LINK,
    enabled: true,
    setupStatus: "ready",
    createdBy: req.adminUser._id,
    updatedBy: req.adminUser._id,
  });
  await created.populate("assignedClients", "name");

  return res.status(201).json({
    success: true,
    message: "External link created",
    data: serialize(created),
  });
};

export const updateExternalLink = async (req, res) => {
  const link = await ExternalLink.findById(req.params.id);
  if (!link) {
    return res.status(404).json({ success: false, code: "EXTERNAL_LINK_NOT_FOUND", message: "External link not found" });
  }

  const validation = await validateConfiguration(req.body || {}, { partial: true });
  if (validation.error) {
    return res.status(422).json({ success: false, code: "VALIDATION_ERROR", message: validation.error });
  }

  Object.assign(link, validation.value);
  link.ssoType = PUBLIC_LINK;
  link.setupStatus = "ready";
  if (req.body?.enabled !== undefined) {
    link.enabled = Boolean(req.body.enabled);
  }
  link.updatedBy = req.adminUser._id;
  await link.save();
  await link.populate("assignedClients", "name");

  return res.status(200).json({ success: true, message: "External link updated", data: serialize(link) });
};

export const deleteExternalLink = async (req, res) => {
  const deleted = await ExternalLink.findByIdAndDelete(req.params.id);
  if (!deleted) {
    return res.status(404).json({ success: false, code: "EXTERNAL_LINK_NOT_FOUND", message: "External link not found" });
  }
  return res.status(200).json({
    success: true,
    message: "External link deleted",
    data: { id: String(deleted._id), title: deleted.title },
  });
};
