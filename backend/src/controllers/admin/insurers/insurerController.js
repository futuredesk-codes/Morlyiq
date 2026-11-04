import mongoose from "mongoose";
import { PlatformInsurer } from "../../../models/admin/PlatformInsurer.js";
import { StediPayer } from "../../../models/integrations/StediPayer.js";
import { Patient } from "../../../models/client/Patient.js";
import { getAllDentalPayerDirectory } from "../../../services/stedi/payerDirectoryService.js";
import { recordAdminAuditSafely } from "../../../services/admin/auditService.js";
import { notifyAdminSafely } from "../../../services/admin/notificationService.js";

const normalizeId = (value) => String(value || "").trim().toUpperCase();
const validStatus = (value) => ["active", "inactive"].includes(value);

const operationalState = (selection, payer) => {
  if (selection.configuredStatus === "inactive") {
    return { status: "inactive", reason: "Disabled for MorlyIQ client workflows." };
  }
  if (!payer) {
    return { status: "error", reason: "This payer is no longer available in the payer directory." };
  }
  if (!payer.active) {
    return { status: "error", reason: "This payer is currently closed or unavailable in the payer directory." };
  }
  const eligibility = payer.transactionSupport?.eligibilityCheck || "NOT_SUPPORTED";
  if (eligibility === "NOT_SUPPORTED") {
    return { status: "error", reason: "Eligibility transactions are not supported by this payer." };
  }
  return { status: "active", reason: "" };
};

const clientUsageByPayer = async (payerIds) => {
  if (!payerIds.length) return new Map();
  const rows = await Patient.aggregate([
    {
      $project: {
        tenantId: 1,
        payerIds: ["$payerStediId", "$cob.payerStediId"],
      },
    },
    { $unwind: "$payerIds" },
    { $match: { payerIds: { $in: payerIds } } },
    { $group: { _id: "$payerIds", tenants: { $addToSet: "$tenantId" } } },
    { $project: { clientsUsing: { $size: "$tenants" } } },
  ]);
  return new Map(rows.map((row) => [row._id, row.clientsUsing]));
};

const toInsurer = (selection, payer, clientsUsing = 0) => {
  const effective = operationalState(selection, payer);
  return {
    id: String(selection._id),
    stediId: selection.payerStediId,
    name: payer?.displayName || selection.name,
    primaryPayerId: payer?.primaryPayerId || selection.primaryPayerId,
    type: "Stedi / EDI Payer",
    clientsUsing,
    configuredStatus: selection.configuredStatus,
    status: effective.status,
    statusReason: effective.reason,
    directoryActive: Boolean(payer?.active),
    eligibilityCheck: payer?.transactionSupport?.eligibilityCheck || "NOT_SUPPORTED",
    lastDirectorySync: payer?.lastSyncedAt || null,
    createdAt: selection.createdAt,
    updatedAt: selection.updatedAt,
  };
};

const loadInsurer = async (selection) => {
  const payer = await StediPayer.findOne({ stediId: selection.payerStediId }).lean();
  const usage = await clientUsageByPayer([selection.payerStediId]);
  return toInsurer(selection.toObject ? selection.toObject() : selection, payer, usage.get(selection.payerStediId) || 0);
};

export const listInsurers = async (req, res) => {
  const selections = await PlatformInsurer.find().sort({ name: 1 }).lean();
  const payerIds = selections.map((item) => item.payerStediId);
  const [payers, usage] = await Promise.all([
    StediPayer.find({ stediId: { $in: payerIds } }).lean(),
    clientUsageByPayer(payerIds),
  ]);
  const payerById = new Map(payers.map((payer) => [payer.stediId, payer]));
  const insurers = selections.map((selection) => toInsurer(
    selection,
    payerById.get(selection.payerStediId),
    usage.get(selection.payerStediId) || 0
  ));
  return res.status(200).json({ success: true, count: insurers.length, data: { insurers } });
};

export const listInsurerDirectory = async (req, res) => {
  try {
    const [{ payers, cache }, selected] = await Promise.all([
      getAllDentalPayerDirectory(),
      PlatformInsurer.find().select("payerStediId").lean(),
    ]);
    const selectedIds = new Set(selected.map((item) => item.payerStediId));
    return res.status(200).json({
      success: true,
      count: payers.length,
      data: {
        payers: payers.map((payer) => ({
          ...payer,
          alreadySelected: selectedIds.has(payer.stediId),
        })),
        cache,
      },
    });
  } catch (error) {
    console.error(`[Admin insurers] directory unavailable: ${error.code || error.message}`);
    return res.status(503).json({
      success: false,
      code: error.code === "STEDI_NOT_CONFIGURED"
        ? "PAYER_DIRECTORY_NOT_CONFIGURED"
        : "PAYER_DIRECTORY_UNAVAILABLE",
      message: "The payer directory is temporarily unavailable",
    });
  }
};

export const createInsurer = async (req, res) => {
  const stediId = normalizeId(req.body?.stediId);
  const configuredStatus = String(req.body?.status || "active").trim().toLowerCase();
  if (!stediId || !validStatus(configuredStatus)) {
    return res.status(422).json({
      success: false,
      code: "VALIDATION_ERROR",
      message: "Select a payer and a valid application status",
    });
  }

  const [payer, existing] = await Promise.all([
    StediPayer.findOne({ stediId }).lean(),
    PlatformInsurer.findOne({ payerStediId: stediId }).lean(),
  ]);
  if (!payer) {
    return res.status(422).json({ success: false, code: "PAYER_NOT_FOUND", message: "Select a payer from the directory" });
  }
  if (existing) {
    return res.status(409).json({ success: false, code: "INSURER_EXISTS", message: "This insurer is already configured" });
  }

  const created = await PlatformInsurer.create({
    payerStediId: payer.stediId,
    name: payer.displayName,
    primaryPayerId: payer.primaryPayerId,
    configuredStatus,
    createdBy: req.adminUser?._id || null,
    updatedBy: req.adminUser?._id || null,
  });
  const insurer = await loadInsurer(created);
  await recordAdminAuditSafely({
    user: req.adminUser,
    roleName: req.adminRole?.roleName,
    action: "Insurer added",
    target: `${insurer.name} (${insurer.primaryPayerId}) - ${insurer.status}`,
    req,
  });
  if (insurer.status === "error") {
    await notifyAdminSafely({
      category: "insurer",
      type: "error",
      title: "Insurer connection needs attention",
      message: `${insurer.name}: ${insurer.statusReason}`,
      actionUrl: "/insurers",
      audienceRoles: ["Super Admin"],
      sourceType: "insurer",
      sourceId: String(created._id),
      dedupeKey: `insurer:${created._id}:error:${insurer.statusReason}`,
    });
  }
  return res.status(201).json({ success: true, message: "Insurer added", data: insurer });
};

export const updateInsurerStatus = async (req, res) => {
  const configuredStatus = String(req.body?.status || "").trim().toLowerCase();
  if (!validStatus(configuredStatus)) {
    return res.status(422).json({ success: false, code: "VALIDATION_ERROR", message: "Status must be active or inactive" });
  }
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(404).json({ success: false, code: "INSURER_NOT_FOUND", message: "Insurer not found" });
  }

  const updated = await PlatformInsurer.findByIdAndUpdate(
    req.params.id,
    { configuredStatus, updatedBy: req.adminUser?._id || null },
    { returnDocument: "after", runValidators: true }
  );
  if (!updated) {
    return res.status(404).json({ success: false, code: "INSURER_NOT_FOUND", message: "Insurer not found" });
  }
  const insurer = await loadInsurer(updated);
  await recordAdminAuditSafely({
    user: req.adminUser,
    roleName: req.adminRole?.roleName,
    action: "Insurer status changed",
    target: `${insurer.name} - ${configuredStatus}${insurer.status === "error" ? " (directory error)" : ""}`,
    req,
  });
  if (insurer.status === "error") {
    await notifyAdminSafely({
      category: "insurer",
      type: "error",
      title: "Insurer connection needs attention",
      message: `${insurer.name}: ${insurer.statusReason}`,
      actionUrl: "/insurers",
      audienceRoles: ["Super Admin"],
      sourceType: "insurer",
      sourceId: String(updated._id),
      dedupeKey: `insurer:${updated._id}:error:${insurer.statusReason}`,
    });
  }
  return res.status(200).json({ success: true, message: "Insurer status updated", data: insurer });
};
