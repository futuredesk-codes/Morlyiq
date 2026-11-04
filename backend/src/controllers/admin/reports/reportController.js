import mongoose from "mongoose";
import { Client } from "../../../models/Client.js";
import { AdminUser } from "../../../models/admin/AdminUser.js";
import { Lead, LEAD_STATUSES } from "../../../models/admin/Lead.js";
import { Plan } from "../../../models/admin/Plan.js";
import { Claim } from "../../../models/client/Claim.js";
import { ClientUser } from "../../../models/client/ClientUser.js";
import { EligibilityCheck } from "../../../models/client/EligibilityCheck.js";

const SUPPORTED_RANGES = new Set(["7d", "30d", "90d", "all"]);

const rangeStart = (range) => {
  if (range === "all") return null;
  const days = Number.parseInt(range, 10);
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - Math.max(days - 1, 0));
  return start;
};

const mapValue = (value) => {
  if (value instanceof Map) return Object.fromEntries(value);
  return value && typeof value === "object" ? value : {};
};

const tenantScope = (tenantId) => {
  if (!tenantId) return {};
  if (!mongoose.isValidObjectId(tenantId)) return null;
  return { tenantId: new mongoose.Types.ObjectId(tenantId) };
};

const countByTenant = async (tenantIds) => {
  if (!tenantIds.length) return new Map();
  const rows = await ClientUser.aggregate([
    { $match: { tenantId: { $in: tenantIds }, status: { $ne: "deactivated" } } },
    { $group: { _id: "$tenantId", count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((row) => [String(row._id), row.count]));
};

export const getReportOverview = async (req, res) => {
  const range = SUPPORTED_RANGES.has(req.query.range) ? req.query.range : "30d";
  const requestedClientId = String(req.query.clientId || "").trim();
  let clientId = requestedClientId;
  let optionQuery = {};

  if (req.adminRole?.roleName === "Client Admin") {
    const assignedClient = await Client.findOne({ name: req.adminUser.client }).select("_id").lean();
    if (!assignedClient) {
      return res.status(403).json({
        success: false,
        code: "CLIENT_SCOPE_UNAVAILABLE",
        message: "Your Admin account is not linked to an available client",
      });
    }
    if (requestedClientId && requestedClientId !== String(assignedClient._id)) {
      return res.status(403).json({
        success: false,
        code: "CLIENT_SCOPE_DENIED",
        message: "You cannot view reports for another client",
      });
    }
    clientId = String(assignedClient._id);
    optionQuery = { _id: assignedClient._id };
  }

  const scope = tenantScope(clientId);
  if (scope === null) {
    return res.status(422).json({
      success: false,
      code: "INVALID_CLIENT_FILTER",
      message: "Select a valid client",
    });
  }

  const start = rangeStart(range);
  const clientQuery = clientId ? { _id: scope.tenantId } : {};
  const activityDate = start ? { $gte: start } : undefined;
  const eligibilityQuery = {
    ...scope,
    ...(activityDate ? { checkedAt: activityDate } : {}),
  };
  const claimQuery = {
    ...scope,
    submittedAt: activityDate ? { ...activityDate, $ne: null } : { $ne: null },
  };
  const leadQuery = activityDate ? { createdAt: activityDate } : {};

  const [clients, clientOptions, plans, userCounts, eligibilityRows, claimRows, leads, adminUsers] = await Promise.all([
    Client.find(clientQuery).sort({ name: 1 }).lean(),
    Client.find(optionQuery).select("name").sort({ name: 1 }).lean(),
    Plan.find().select("key name price status features").lean(),
    Client.find(clientQuery).select("_id").lean().then((rows) => countByTenant(rows.map((row) => row._id))),
    EligibilityCheck.aggregate([
      { $match: eligibilityQuery },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    Claim.aggregate([
      { $match: claimQuery },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          acknowledged: {
            $sum: {
              $cond: [
                { $in: ["$status", ["stedi_accepted", "stedi_rejected"]] },
                1,
                0,
              ],
            },
          },
        },
      },
    ]),
    Lead.find(leadQuery).select("ownerId ownerName status").lean(),
    AdminUser.find({ status: "active" }).select("name role").sort({ name: 1 }).lean(),
  ]);

  const planMap = new Map();
  plans.forEach((plan) => {
    planMap.set(String(plan._id), plan);
    planMap.set(plan.key, plan);
  });

  const clientRows = clients.map((client) => {
    const plan = planMap.get(String(client.planId));
    const entitlements = mapValue(client.entitlements);
    return {
      id: String(client._id),
      name: client.name,
      planName: plan?.name || "Unassigned",
      users: userCounts.get(String(client._id)) ?? Number(client.users || 0),
      featuresEnabled: Object.values(entitlements).filter(Boolean).length,
      totalFeatures: plan?.features?.length || Object.keys(entitlements).length,
      status: client.status,
      mrr: Number(client.mrr || 0),
      verifications: Number(client.verifications || 0),
    };
  });

  const eligibilityByStatus = Object.fromEntries(
    eligibilityRows.map((row) => [row._id, row.count])
  );
  const eligibilityTotal = eligibilityRows.reduce((sum, row) => sum + row.count, 0);
  const claimsSubmitted = claimRows.reduce((sum, row) => sum + row.count, 0);
  const acknowledgments = claimRows.reduce((sum, row) => sum + row.acknowledged, 0);

  const leadFunnel = LEAD_STATUSES.map((status) => ({
    status,
    count: leads.filter((lead) => lead.status === status).length,
  }));

  const owners = new Map(adminUsers.map((user) => [String(user._id), user]));
  leads.forEach((lead) => {
    const key = String(lead.ownerId || lead.ownerName || "");
    if (!owners.has(key) && lead.ownerName) owners.set(key, { _id: key, name: lead.ownerName, role: "Staff" });
  });
  const employeePerformance = [...owners.values()]
    .map((employee) => {
      const owned = leads.filter((lead) => (
        lead.ownerId && String(lead.ownerId) === String(employee._id)
      ) || (!lead.ownerId && lead.ownerName === employee.name));
      const won = owned.filter((lead) => lead.status === "Won").length;
      const followupLeads = owned.filter((lead) => lead.status === "Follow-up").length;
      return {
        id: String(employee._id),
        employee: employee.name,
        role: employee.role,
        leads: owned.length,
        won,
        // Call/activity history is not persisted yet. Keep this deterministic and visibly marked as demo.
        calls: owned.length * 2 + won,
        followups: followupLeads + Math.max(0, Math.floor(owned.length / 3)),
        activitySource: "demo",
      };
    })
    .filter((row) => row.leads > 0 || ["Manager", "Staff", "Marketing Team"].includes(row.role));

  const demoEraCount = claimsSubmitted ? Math.max(1, Math.round(claimsSubmitted * 0.55)) : 0;
  const summary = {
    totalClients: clientRows.length,
    activeClients: clientRows.filter((client) => client.status === "active").length,
    totalUsers: clientRows.reduce((sum, client) => sum + client.users, 0),
    monthlyRecurringRevenue: clientRows.reduce((sum, client) => sum + client.mrr, 0),
    eligibilityChecks: eligibilityTotal,
    claimsSubmitted,
  };

  return res.status(200).json({
    success: true,
    data: {
      generatedAt: new Date().toISOString(),
      range,
      clientId: clientId || null,
      summary,
      clientOptions: clientOptions.map((client) => ({ id: String(client._id), name: client.name })),
      clients: clientRows,
      eligibilityByStatus,
      leadFunnel,
      employeePerformance,
      healthcareWorkflow: [
        { key: "eligibility", label: "Eligibility checks run", value: eligibilityTotal, source: "live" },
        { key: "claims", label: "Claims submitted", value: claimsSubmitted, source: "live" },
        { key: "eras", label: "ERAs received", value: demoEraCount, source: "demo" },
        { key: "acknowledgments", label: "Acknowledgments logged", value: acknowledgments, source: "live" },
      ],
      sources: {
        clients: "live",
        eligibility: "live",
        claims: "live",
        leads: "live",
        callsAndFollowups: "demo",
        eras: "demo",
      },
    },
  });
};
