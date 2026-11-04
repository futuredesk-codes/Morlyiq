import { Client } from "../../../models/Client.js";
import { Ticket } from "../../../models/Ticket.js";
import { AuditLog } from "../../../models/admin/AuditLog.js";
import { Lead, LEAD_STATUSES } from "../../../models/admin/Lead.js";
import { Plan } from "../../../models/admin/Plan.js";
import { PlatformInsurer } from "../../../models/admin/PlatformInsurer.js";
import { BillingInvoice } from "../../../models/client/BillingInvoice.js";
import { EligibilityCheck } from "../../../models/client/EligibilityCheck.js";
import { StediPayer } from "../../../models/integrations/StediPayer.js";

const startOfMonth = () => {
  const date = new Date();
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
};

const startOfUtcDay = (value = new Date()) => {
  const date = new Date(value);
  date.setUTCHours(0, 0, 0, 0);
  return date;
};

const dailySeries = (rows, dateField, days = 7) => {
  const start = startOfUtcDay();
  start.setUTCDate(start.getUTCDate() - (days - 1));
  const values = Array.from({ length: days }, () => 0);
  rows.forEach((row) => {
    const date = new Date(row[dateField]);
    const index = Math.floor((startOfUtcDay(date) - start) / 86_400_000);
    if (index >= 0 && index < days) values[index] += 1;
  });
  return values;
};

const monthlyClientSeries = (clients, valueForClient, months = 7) => {
  const now = new Date();
  return Array.from({ length: months }, (_, index) => {
    const offset = months - 1 - index;
    const boundary = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset + 1, 1));
    return clients
      .filter((client) => new Date(client.createdAt) < boundary)
      .reduce((sum, client) => sum + valueForClient(client), 0);
  });
};

const timeAgo = (value) => {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

const activityKind = (log) => {
  const text = `${log.action} ${log.target}`.toLowerCase();
  if (text.includes("ticket") || text.includes("support")) return "ticket";
  if (text.includes("insurer") || text.includes("payer") || text.includes("stedi")) return "insurer";
  if (text.includes("lead") || text.includes("call")) return "lead";
  if (log.level === "warn" || log.level === "error" || text.includes("failed")) return "warning";
  return "client";
};

const insurerIssueCount = async () => {
  const selections = await PlatformInsurer.find({ configuredStatus: "active" })
    .select("payerStediId")
    .lean();
  if (!selections.length) return 0;
  const payers = await StediPayer.find({
    stediId: { $in: selections.map((item) => item.payerStediId) },
  }).select("stediId active transactionSupport").lean();
  const payerMap = new Map(payers.map((payer) => [payer.stediId, payer]));
  return selections.filter((selection) => {
    const payer = payerMap.get(selection.payerStediId);
    return !payer || !payer.active || payer.transactionSupport?.eligibilityCheck === "NOT_SUPPORTED";
  }).length;
};

export const getAdminDashboardStats = async (req, res) => {
  const clientScoped = req.adminRole?.roleName === "Client Admin";
  let assignedClient = null;
  if (clientScoped) {
    assignedClient = await Client.findOne({ name: req.adminUser.client }).lean();
    if (!assignedClient) {
      return res.status(403).json({
        success: false,
        code: "CLIENT_SCOPE_UNAVAILABLE",
        message: "Your Admin account is not linked to an available client",
      });
    }
  }

  const clientQuery = assignedClient ? { _id: assignedClient._id } : {};
  const tenantQuery = assignedClient ? { tenantId: assignedClient._id } : {};
  const ticketQuery = {
    status: "open",
    ...(assignedClient ? { client: assignedClient.name } : {}),
  };
  const auditQuery = assignedClient ? { clientId: assignedClient._id } : {};
  const seriesStart = startOfUtcDay();
  seriesStart.setUTCDate(seriesStart.getUTCDate() - 6);

  const [clients, plans, verificationCount, recentChecks, openTickets, recentTickets, failedBilling, invoiceFailures, leads, auditLogs, issues] = await Promise.all([
    Client.find(clientQuery).select("name planId status mrr createdAt billing.paymentStatus").lean(),
    Plan.find().select("key name").sort({ name: 1 }).lean(),
    EligibilityCheck.countDocuments({ ...tenantQuery, checkedAt: { $gte: startOfMonth() } }),
    EligibilityCheck.find({ ...tenantQuery, checkedAt: { $gte: seriesStart } }).select("checkedAt").lean(),
    Ticket.countDocuments(ticketQuery),
    Ticket.find({ ...(assignedClient ? { client: assignedClient.name } : {}), createdAt: { $gte: seriesStart } }).select("createdAt").lean(),
    Client.countDocuments({ ...clientQuery, "billing.paymentStatus": "failed" }),
    BillingInvoice.countDocuments({ ...tenantQuery, status: "uncollectible" }),
    clientScoped ? [] : Lead.find().select("status").lean(),
    AuditLog.find(auditQuery).sort({ createdAt: -1 }).limit(5).lean(),
    clientScoped ? 0 : insurerIssueCount(),
  ]);

  const activeClients = clients.filter((client) => client.status === "active").length;
  const trialClients = clients.filter((client) => client.status === "trial").length;
  const mrr = clients.reduce((sum, client) => sum + Number(client.mrr || 0), 0);
  const overdueInvoices = failedBilling + invoiceFailures;
  const planCounts = new Map();
  clients.forEach((client) => planCounts.set(String(client.planId), (planCounts.get(String(client.planId)) || 0) + 1));

  return res.status(200).json({
    success: true,
    data: {
      generatedAt: new Date().toISOString(),
      scope: clientScoped ? "client" : "platform",
      kpis: {
        monthlyRecurringRevenue: mrr,
        activeClients,
        trialClients,
        verificationsThisMonth: verificationCount,
        openTickets,
        overdueInvoices,
        insurerIssues: issues,
        series: {
          revenue: monthlyClientSeries(clients, (client) => Number(client.mrr || 0)),
          activeClients: monthlyClientSeries(clients, (client) => client.status === "active" ? 1 : 0),
          verifications: dailySeries(recentChecks, "checkedAt"),
          tickets: dailySeries(recentTickets, "createdAt"),
        },
      },
      plans: plans.map((plan) => ({
        id: String(plan._id),
        key: plan.key,
        name: plan.name,
        count: planCounts.get(plan.key) || planCounts.get(String(plan._id)) || 0,
      })),
      leadFunnel: LEAD_STATUSES.map((status) => ({
        status,
        count: leads.filter((lead) => lead.status === status).length,
      })),
      recentActivity: auditLogs.map((log) => ({
        id: String(log._id),
        kind: activityKind(log),
        text: log.target ? `${log.action} — ${log.target}` : log.action,
        time: timeAgo(log.createdAt),
      })),
    },
  });
};
