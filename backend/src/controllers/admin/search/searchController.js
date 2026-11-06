import { Client } from "../../../models/Client.js";
import { AdminUser } from "../../../models/admin/AdminUser.js";
import { Lead } from "../../../models/admin/Lead.js";
import { roleHasPermission } from "../../../services/admin/roleService.js";
import { adminLeadScope } from "../../../services/admin/leadAccessService.js";

export const searchAdmin = async (req, res) => {
  res.set("Cache-Control", "no-store");
  if (typeof req.query.q !== "string" || req.query.q.trim().length < 2 || req.query.q.trim().length > 100) {
    return res.status(422).json({ success: false, code: "INVALID_SEARCH", message: "Enter between 2 and 100 characters to search" });
  }
  const query = req.query.q.trim();
  const expression = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  const matches = (fields) => ({ $or: fields.map((field) => ({ [field]: expression })) });
  const superAdmin = req.adminRole?.roleName === "Super Admin";
  const canReadLeads = roleHasPermission(req.adminRole, "leads", "view");
  const leadScope = canReadLeads ? await adminLeadScope(req) : null;
  const leadMatch = matches(["practiceName", "contactName", "phone", "source"]);
  const phone = query.replace(/[\s().-]/g, "");
  if (/^\+?\d{2,15}$/.test(phone)) leadMatch.$or.push({ phone: new RegExp(phone.replace(/\+/g, "\\+")) });
  const [clients, users, leads] = await Promise.all([
    superAdmin ? Client.find(matches(["name", "ownerName", "email"]))
      .select("name ownerName email status").sort({ name: 1, _id: 1 }).limit(5).maxTimeMS(2000).lean() : [],
    superAdmin ? AdminUser.find(matches(["name", "email", "client", "role"]))
      .select("name email role").sort({ name: 1, _id: 1 }).limit(5).maxTimeMS(2000).lean() : [],
    canReadLeads ? Lead.find({ ...leadScope, ...leadMatch })
      .select("practiceName contactName status").sort({ updatedAt: -1, _id: 1 }).limit(5).maxTimeMS(2000).lean() : [],
  ]);
  const results = [
    ...clients.map((client) => ({ type: "client", id: String(client._id), title: client.name, subtitle: client.ownerName || client.email || client.status, url: `/clients?clientId=${client._id}` })),
    ...users.map((user) => ({ type: "user", id: String(user._id), title: user.name, subtitle: `${user.email} · ${user.role}`, url: `/users?q=${encodeURIComponent(user.email)}` })),
    ...leads.map((lead) => ({ type: "lead", id: String(lead._id), title: lead.practiceName, subtitle: `${lead.contactName} · ${lead.status}`, url: `/leads?leadId=${lead._id}` })),
  ];
  return res.json({ success: true, data: { results } });
};
