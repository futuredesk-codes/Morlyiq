import { AdminUser } from "../../../models/admin/AdminUser.js";
import { Lead } from "../../../models/admin/Lead.js";
import { notifyAdminSafely } from "../../../services/admin/notificationService.js";

const publicLead = (lead) => ({
  id: String(lead._id),
  name: lead.practiceName,
  contact: lead.contactName,
  source: lead.source,
  ownerId: lead.ownerId?._id ? String(lead.ownerId._id) : lead.ownerId ? String(lead.ownerId) : null,
  owner: lead.ownerId?.name || lead.ownerName,
  status: lead.status,
  lastActivity: {
    label: lead.lastActivityLabel,
    at: lead.lastActivityAt,
  },
  createdAt: lead.createdAt,
});

export const getLeads = async (req, res) => {
  const [leads, owners] = await Promise.all([
    Lead.find()
      .populate("ownerId", "name email")
      .sort({ createdAt: -1 }),
    AdminUser.find({ status: "active" })
      .select("name email role")
      .sort({ name: 1 })
      .lean(),
  ]);

  return res.status(200).json({
    success: true,
    count: leads.length,
    data: {
      leads: leads.map(publicLead),
      owners: owners.map((owner) => ({
        id: String(owner._id),
        name: owner.name,
        email: owner.email,
        role: owner.role,
      })),
    },
  });
};

export const createLead = async (req, res) => {
  const practiceName = String(req.body?.practiceName ?? req.body?.name ?? "").trim();
  const contactName = String(req.body?.contactName ?? req.body?.contact ?? "").trim();
  const source = String(req.body?.source || "").trim();
  const ownerId = String(req.body?.ownerId || "").trim();

  if (!practiceName || !contactName || !source || !ownerId) {
    return res.status(422).json({
      success: false,
      code: "VALIDATION_ERROR",
      message: "Practice name, contact, source, and owner are required",
    });
  }

  const owner = await AdminUser.findOne({ _id: ownerId, status: "active" })
    .select("name email")
    .catch(() => null);
  if (!owner) {
    return res.status(422).json({
      success: false,
      code: "OWNER_NOT_FOUND",
      message: "Select a valid active Admin user as the lead owner",
    });
  }

  const lead = await Lead.create({
    practiceName,
    contactName,
    source,
    ownerId: owner._id,
    ownerName: owner.name,
    status: "Open",
    lastActivityLabel: "Lead created",
    lastActivityAt: new Date(),
  });
  await lead.populate("ownerId", "name email");

  await notifyAdminSafely({
    category: "lead",
    type: "info",
    title: "New lead assigned to you",
    message: `${practiceName} was assigned by ${req.adminUser.name}.`,
    actionUrl: "/leads",
    recipientUserIds: [owner._id],
    requiredPermission: "leads:view",
    sourceType: "lead",
    sourceId: String(lead._id),
    dedupeKey: `lead:${lead._id}:owner:${owner._id}:status:Open`,
  });

  return res.status(201).json({
    success: true,
    message: "Lead created",
    data: publicLead(lead),
  });
};
