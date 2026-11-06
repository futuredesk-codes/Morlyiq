import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import net from "node:net";
import { once } from "node:events";
import express from "express";
import mongoose from "mongoose";
import { Lead } from "../src/models/admin/Lead.js";
import { AdminUser } from "../src/models/admin/AdminUser.js";
import { Client } from "../src/models/Client.js";
import { AdminNotification } from "../src/models/admin/AdminNotification.js";
import { AdminRole } from "../src/models/admin/AdminRole.js";
import { runLeadReminderSweep } from "../src/services/admin/leadReminderService.js";
import { listNotifications, markNotificationRead } from "../src/controllers/admin/notifications/notificationController.js";
import { loginDestination } from "../../Admin/src/utils/loginDestination.js";
import settingsRoutes from "../src/routes/admin/settings/settingsRoutes.js";
import { requireAdminRoles } from "../src/middlewares/admin/adminAuth.js";
import { createClient, updateClient } from "../src/controllers/admin/clients/clientController.js";
import { getPublicPlatformSettings, requireClientPlatformAvailable } from "../src/middlewares/client/platformAccess.js";
import { getOnboarding } from "../src/controllers/client/onboarding/onboardingController.js";
import { createInvitationToken } from "../src/services/client/onboardingService.js";
import { PlatformSettings } from "../src/models/admin/PlatformSettings.js";
import { Plan } from "../src/models/admin/Plan.js";
import { ClientInvitation } from "../src/models/client/ClientInvitation.js";
import { ClientUser } from "../src/models/client/ClientUser.js";
import { ClientSession } from "../src/models/client/ClientSession.js";
import { protectClient, signClientToken } from "../src/middlewares/client/auth/clientAuth.js";
import leadRoutes from "../src/routes/admin/leads/leadRoutes.js";
import dashboardRoutes from "../src/routes/admin/dashboard/dashboardRoutes.js";
import searchRoutes from "../src/routes/admin/search/searchRoutes.js";
import { EligibilityCheck } from "../src/models/client/EligibilityCheck.js";
import { errorHandler } from "../src/middlewares/errorHandler.js";

// Runs against a disposable, isolated MongoDB process; never reads .env or the app database.
let mongo, dbPath, server, base, users, leadId, client;
const full = { roleName: "Super Admin", permissions: [] };
const roles = {
  full,
  viewer: { roleName: "Marketing Team", permissions: [{ resource: "leads", actions: ["view"] }] },
  staff: { roleName: "Staff", permissions: [{ resource: "leads", actions: ["view", "edit"] }, { resource: "calls", actions: ["view", "create"] }, { resource: "tasks", actions: ["view", "create", "execute"] }] },
  client: { roleName: "Client Admin", permissions: [{ resource: "leads", actions: ["view", "create", "edit"] }] },
  dashboardOnly: { roleName: "Dashboard viewer", permissions: [{ resource: "dashboard", actions: ["view"] }] },
  dashboardReports: { roleName: "Reporting user", permissions: [{ resource: "dashboard", actions: ["view"] }, { resource: "reports", actions: ["view"] }] },
  dashboardLeads: { roleName: "Marketing Team", permissions: [{ resource: "dashboard", actions: ["view"] }, { resource: "leads", actions: ["view"] }] },
  dashboardStaff: { roleName: "Staff", permissions: [{ resource: "dashboard", actions: ["view"] }, { resource: "leads", actions: ["view"] }] },
  dashboardEligibility: { roleName: "Verification reviewer", permissions: [{ resource: "dashboard", actions: ["view"] }, { resource: "eligibility", actions: ["view"] }] },
  dashboardClient: { roleName: "Client Admin", permissions: [{ resource: "dashboard", actions: ["view"] }, { resource: "leads", actions: ["view"] }, { resource: "eligibility", actions: ["view"] }] },
};

before(async () => {
  const portFinder = net.createServer();
  portFinder.listen(0, "127.0.0.1");
  await once(portFinder, "listening");
  const port = portFinder.address().port;
  await new Promise((resolve) => portFinder.close(resolve));
  dbPath = mkdtempSync(path.join(tmpdir(), "morly-lead-test-"));
  const binary = process.env.MONGOD_BINARY || (process.platform === "win32" ? "C:/Program Files/MongoDB/Server/7.0/bin/mongod.exe" : "mongod");
  mongo = spawn(binary, ["--dbpath", dbPath, "--port", String(port), "--bind_ip", "127.0.0.1", "--quiet"], { windowsHide: true, stdio: "ignore" });
  let spawnError;
  mongo.on("error", (error) => { spawnError = error; });
  let connected = false;
  for (let attempt = 0; attempt < 50; attempt++) {
    if (spawnError) throw spawnError;
    try {
      await mongoose.connect(`mongodb://127.0.0.1:${port}/morly_lead_workflow_test`, { serverSelectionTimeoutMS: 300 });
      connected = true;
      break;
    } catch { await new Promise((resolve) => setTimeout(resolve, 100)); }
  }
  assert.ok(connected, "Disposable MongoDB started");
  client = await Client.create({ name: "Test Practice", status: "active" });
  users = await AdminUser.insertMany([
    { name: "Platform", email: "platform@example.test", password: "not-used-in-test", role: "Super Admin" },
    { name: "Assigned Staff", email: "staff@example.test", password: "not-used-in-test", role: "Staff" },
    { name: "Client User", email: "client@example.test", password: "not-used-in-test", role: "Client Admin", client: client.name },
  ]);
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.adminRole = roles[req.headers["x-test-role"] || "full"];
    req.adminPermissions = new Set(req.adminRole.permissions.flatMap((entry) => entry.actions.map((action) => `${entry.resource}:${action}`)));
    req.adminUser = users[Number(req.headers["x-test-user"] || 0)];
    next();
  });
  app.get("/leads/_test/notifications", listNotifications);
  app.use("/leads/_test/dashboard", dashboardRoutes);
  app.use("/leads/_test/search", searchRoutes);
  app.post("/leads/_test/notifications/:id/read", markNotificationRead);
  app.use("/leads/_test/settings", requireAdminRoles("Super Admin"), settingsRoutes);
  app.post("/leads/_test/clients", requireAdminRoles("Super Admin"), createClient);
  app.patch("/leads/_test/clients/:id", requireAdminRoles("Super Admin"), updateClient);
  app.get("/leads/_test/onboarding/:token", getOnboarding);
  app.get("/leads/_test/platform", getPublicPlatformSettings);
  app.use("/leads/_test/client", requireClientPlatformAvailable, (_req, res) => res.json({ success: true }));
  app.get("/api/client-panel/patients/trial-check", protectClient, (_req, res) => res.json({ success: true }));
  app.get("/api/client-panel/billing/trial-check", protectClient, (_req, res) => res.json({ success: true }));
  app.use("/leads", leadRoutes);
  app.use(errorHandler);
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  base = `http://127.0.0.1:${server.address().port}/leads`;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
  if (mongo?.pid && mongo.exitCode === null) {
    const exited = once(mongo, "exit");
    mongo.kill();
    await exited;
  }
  if (dbPath) {
    const target = path.resolve(dbPath);
    assert.equal(path.dirname(target), path.resolve(tmpdir()));
    assert.ok(path.basename(target).startsWith("morly-lead-test-"));
    rmSync(target, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});

async function request(suffix = "", method = "GET", body, role = "full", user = 0) {
  const response = await fetch(`${base}${suffix}`, {
    method,
    headers: { "Content-Type": "application/json", "x-test-role": role, "x-test-user": String(user) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, ...await response.json() };
}

test("creates a lead with normalized dialer number and persisted creation event", async () => {
  const result = await request("", "POST", { name: "Dental Prospect", contact: "Dr Example", source: "Referral", ownerId: String(users[1]._id), phone: "+1 (303) 555-0123" });
  assert.equal(result.status, 201);
  assert.equal(result.data.phone, "+13035550123");
  leadId = result.data.id;
  const detail = await request(`/${leadId}`);
  assert.equal(detail.data.activities[0].type, "created");
  assert.equal(detail.data.activities[0].actorName, "Platform");
});

test("status updates persist and produce timeline entries; unchanged statuses do not duplicate", async () => {
  const result = await request(`/${leadId}`, "PATCH", { status: "Contacted" });
  assert.equal(result.status, 200);
  assert.equal(result.data.status, "Contacted");
  const repeated = await request(`/${leadId}`, "PATCH", { status: "Contacted" });
  assert.equal(repeated.data.activities.filter((entry) => entry.type === "status").length, 1);
});

test("rejects invalid status and unsafe or malformed telephone values", async () => {
  for (const body of [{ status: "Invalid" }, { phone: "javascript:alert(1)" }, { phone: "123" }, { phone: {} }]) {
    assert.equal((await request(`/${leadId}`, "PATCH", body)).status, 422);
  }
  const result = await request(`/${leadId}`, "PATCH", { phone: "+91 98765 43210" });
  assert.equal(result.data.phone, "+919876543210");
});

test("backend permissions reject unauthorized status changes and activity creation", async () => {
  assert.equal((await request(`/${leadId}`, "PATCH", { status: "Won" }, "viewer")).status, 403);
  assert.equal((await request(`/${leadId}/activities`, "POST", { type: "call", outcome: "Interested", durationMinutes: 3 }, "viewer")).status, 403);
  assert.equal((await request(`/${leadId}/activities`, "POST", { type: "task", title: "Task" }, "viewer")).status, 403);
});

test("call logging validates duration/outcomes and preserves notes after reload", async () => {
  for (const body of [{ outcome: "fake", durationMinutes: 2 }, { outcome: "Interested", durationMinutes: -1 }, { outcome: "Busy", durationMinutes: "3" }]) {
    assert.equal((await request(`/${leadId}/activities`, "POST", { type: "call", ...body })).status, 422);
  }
  const result = await request(`/${leadId}/activities`, "POST", { type: "call", outcome: "Interested", durationMinutes: 4.5, notes: "Requested proposal" });
  assert.equal(result.status, 200);
  const reloaded = await request(`/${leadId}`);
  assert.equal(reloaded.data.activities.find((entry) => entry.type === "call").notes, "Requested proposal");
});

test("tasks and follow-ups persist; completion atomically saves history and rejects duplicates", async () => {
  assert.equal((await request(`/${leadId}/activities`, "POST", { type: "followup", title: "Call back" })).status, 422);
  assert.equal((await request(`/${leadId}/activities`, "POST", { type: "followup", title: "Call back", dueAt: "2020-01-01" })).status, 422);
  for (const type of ["task", "followup"]) {
    const result = await request(`/${leadId}/activities`, "POST", { type, title: "Send proposal", dueAt: new Date(Date.now() + 86400000).toISOString(), notes: "Discuss pricing" });
    assert.equal(result.status, 200);
    const entry = result.data.activities.filter((item) => item.type === type).at(-1);
    assert.equal((await request(`/${leadId}/activities/${entry.id}/complete`, "POST", {}, "viewer")).status, 403);
    const results = await Promise.all([request(`/${leadId}/activities/${entry.id}/complete`, "POST"), request(`/${leadId}/activities/${entry.id}/complete`, "POST")]);
    assert.deepEqual(results.map((item) => item.status).sort(), [200, 409]);
    const detail = await request(`/${leadId}`);
    assert.ok(detail.data.activities.find((item) => item.id === entry.id).completedAt);
    assert.equal(detail.data.activities.filter((item) => item.relatedId === entry.id).length, 1);
  }
});

test("timeline respects Calls and Tasks view permissions", async () => {
  const result = await request(`/${leadId}`, "GET", undefined, "viewer");
  assert.equal(result.status, 200);
  assert.ok(!result.data.activities.some((entry) => ["call", "task", "followup", "completed"].includes(entry.type)));
});

test("staff can access assigned leads but cannot read or mutate other leads", async () => {
  assert.equal((await request(`/${leadId}`, "GET", undefined, "staff", 1)).status, 200);
  const other = await Lead.create({ practiceName: "Other", contactName: "Other", source: "Referral", ownerId: users[0]._id, ownerName: users[0].name });
  assert.equal((await request(`/${other.id}`, "GET", undefined, "staff", 1)).status, 404);
  assert.equal((await request(`/${other.id}`, "PATCH", { status: "Won" }, "staff", 1)).status, 404);
  const result = await request("", "GET", undefined, "staff", 1);
  assert.ok(result.data.leads.every((lead) => lead.ownerId === String(users[1]._id)));
});

test("Client Admin scope excludes platform and other-tenant leads, including mutations", async () => {
  assert.equal((await request(`/${leadId}`, "GET", undefined, "client", 2)).status, 404);
  assert.equal((await request(`/${leadId}`, "PATCH", { status: "Won" }, "client", 2)).status, 404);
  const result = await request("", "POST", { name: "Tenant Lead", contact: "Contact", source: "Referral", ownerId: String(users[2]._id) }, "client", 2);
  assert.equal(result.status, 201);
  assert.equal(String((await Lead.findById(result.data.id)).clientId), String(client._id));
  const list = await request("", "GET", undefined, "client", 2);
  assert.deepEqual(list.data.leads.map((lead) => lead.id), [result.data.id]);
  assert.equal(list.data.owners.length, 1);
  assert.equal((await request("", "POST", { name: "Tenant Lead", contact: "Contact", source: "Referral", ownerId: String(users[0]._id) }, "client", 2)).status, 422);
});

test("legacy leads without activities remain usable; malformed IDs return controlled errors", async () => {
  const legacy = await Lead.create({ practiceName: "Legacy", contactName: "Contact", source: "Other", ownerName: "Old owner" });
  const result = await request(`/${legacy.id}`);
  assert.equal(result.status, 200);
  assert.deepEqual(result.data.activities, []);
  assert.equal((await request("/bad-id")).status, 404);
  assert.equal((await request(`/${legacy.id}/activities`, "POST", { type: "task", title: "New task" })).status, 200);
});

async function reminderLead({ dueAt = new Date(Date.now() - 60_000), completedAt = null, ownerId = users[0]._id, type = "task", clientId = null } = {}) {
  return Lead.create({ practiceName: "Reminder Prospect", contactName: "Contact", source: "Referral", ownerId, ownerName: "Owner", clientId,
    activities: [{ type, title: "Discuss proposal", actorId: users[0]._id, actorName: "Platform", dueAt, completedAt }],
  });
}

test("due reminder automatically targets the owner; concurrent sweeps do not duplicate delivery", async () => {
  await AdminNotification.init();
  const lead = await reminderLead({ type: "followup" });
  const deliveries = [];
  const sendEmail = async (payload) => { deliveries.push(payload); return { sent: true }; };
  await Promise.all([runLeadReminderSweep({ sendEmail }), runLeadReminderSweep({ sendEmail })]);
  assert.equal(deliveries.length, 1);
  assert.equal(deliveries[0].to, users[0].email);
  assert.equal(deliveries[0].actionPath, `/leads?leadId=${lead.id}`);
  const notifications = await AdminNotification.find({ sourceType: "lead_activity", sourceId: `${lead.id}:${lead.activities[0].id}` });
  assert.equal(notifications.length, 1);
  assert.deepEqual(notifications[0].recipientUserIds.map(String), [String(users[0]._id)]);
  const stored = await Lead.findById(lead._id);
  assert.ok(stored.activities[0].reminderNotificationSentAt);
  assert.ok(stored.activities[0].reminderEmailSentAt);
  await runLeadReminderSweep({ sendEmail });
  assert.equal(deliveries.length, 1, "persisted delivery state prevents repeats on later sweeps");
});

test("future, completed and undated tasks do not generate reminders", async () => {
  for (const fields of [{ dueAt: new Date(Date.now() + 3600000) }, { completedAt: new Date() }, { dueAt: null }]) await reminderLead(fields);
  const results = await runLeadReminderSweep({ sendEmail: async () => { assert.fail("Should not send an email"); } });
  assert.equal(results.claimed, 0);
});

test("email failure retries independently without duplicating in-app notifications", async () => {
  const lead = await reminderLead();
  await runLeadReminderSweep({ sendEmail: async () => ({ sent: false }) });
  let stored = await Lead.findById(lead._id);
  assert.ok(stored.activities[0].reminderNotificationSentAt);
  assert.equal(stored.activities[0].reminderEmailSentAt, null);
  assert.ok(stored.activities[0].reminderRetryAt > new Date());
  assert.equal((await runLeadReminderSweep({ sendEmail: async () => { assert.fail("Retry delay must be respected"); } })).claimed, 0);
  await Lead.updateOne({ _id: lead._id }, { $set: { "activities.0.reminderRetryAt": new Date(Date.now() - 1) } });
  const stats = await runLeadReminderSweep({ sendEmail: async () => ({ sent: true }) });
  assert.equal(stats.emails, 1);
  assert.equal(stats.notifications, 0);
  assert.equal(await AdminNotification.countDocuments({ sourceId: `${lead.id}:${lead.activities[0].id}` }), 1);
  stored = await Lead.findById(lead._id);
  assert.ok(stored.activities[0].reminderEmailSentAt);
});

test("completing a due activity resolves its notification and stops further reminders", async () => {
  const lead = await reminderLead();
  await runLeadReminderSweep({ sendEmail: async () => ({ sent: false }) });
  assert.equal((await request(`/${lead.id}/activities/${lead.activities[0].id}/complete`, "POST")).status, 200);
  const notification = await AdminNotification.findOne({ sourceId: `${lead.id}:${lead.activities[0].id}` });
  assert.ok(notification.resolvedAt);
  assert.equal((await runLeadReminderSweep({ sendEmail: async () => { assert.fail("Completed items must not send"); } })).claimed, 0);
});

test("a stale worker lease is recovered and deactivated owners receive no reminders", async () => {
  const lead = await reminderLead();
  await Lead.updateOne({ _id: lead._id }, { $set: { "activities.0.reminderLockedUntil": new Date(Date.now() - 1), "activities.0.reminderLockToken": "old-worker" } });
  assert.equal((await runLeadReminderSweep({ sendEmail: async () => ({ sent: true }) })).emails, 1);
  const inactive = await AdminUser.create({ name: "Inactive", email: "inactive@example.test", password: "UnusedPassword123", status: "deactivated", role: "Super Admin" });
  const skipped = await reminderLead({ ownerId: inactive._id });
  await runLeadReminderSweep({ sendEmail: async () => { assert.fail("Inactive users must not receive email"); } });
  assert.equal(await AdminNotification.countDocuments({ sourceId: `${skipped.id}:${skipped.activities[0].id}` }), 0);
});

test("reminders require current Leads and Tasks permissions and correct Client Admin scope", async () => {
  const restricted = await AdminRole.create({ roleName: "Reminder viewer", permissions: [{ resource: "leads", actions: ["view"] }] });
  const owner = await AdminUser.create({ name: "Restricted", email: "restricted@example.test", password: "UnusedPassword123", role: restricted.roleName, roleId: restricted._id });
  const denied = await reminderLead({ ownerId: owner._id });
  const wrongTenant = await reminderLead({ ownerId: users[2]._id });
  await runLeadReminderSweep({ sendEmail: async () => { assert.fail("Unauthorized reminders must not send"); } });
  for (const lead of [denied, wrongTenant]) {
    assert.equal(await AdminNotification.countDocuments({ sourceId: `${lead.id}:${lead.activities[0].id}` }), 0);
  }
});

test("reminder visibility/read access follows current permissions and lead ownership", async () => {
  const lead = await reminderLead({ ownerId: users[1]._id });
  await runLeadReminderSweep({ sendEmail: async () => ({ sent: true }) });
  const sourceId = `${lead.id}:${lead.activities[0].id}`;
  const notification = await AdminNotification.findOne({ sourceId });
  assert.ok(notification);
  const visible = await request("/_test/notifications", "GET", undefined, "staff", 1);
  assert.ok(visible.data.notifications.some((entry) => entry.id === notification.id));
  const restricted = await request("/_test/notifications", "GET", undefined, "viewer", 1);
  assert.ok(!restricted.data.notifications.some((entry) => entry.id === notification.id));
  assert.equal((await request(`/_test/notifications/${notification.id}/read`, "POST", {}, "viewer", 1)).status, 404);
  await Lead.updateOne({ _id: lead._id }, { $set: { ownerId: users[0]._id } });
  const reassigned = await request("/_test/notifications", "GET", undefined, "staff", 1);
  assert.ok(!reassigned.data.notifications.some((entry) => entry.id === notification.id));
  assert.equal((await request(`/_test/notifications/${notification.id}/read`, "POST", {}, "staff", 1)).status, 404);
});

test("reminder destination survives login while external redirects are rejected", () => {
  const destination = `/leads?leadId=${leadId}`;
  assert.equal(loginDestination(destination), destination);
  for (const value of [undefined, "https://outside.test", "//outside.test", "/\\outside.test", "/login"]) {
    assert.equal(loginDestination(value), "/dashboard");
  }
});

test("platform settings persist, preserve MFA, and are Super Admin-only", async () => {
  assert.equal((await request("/_test/settings", "GET", undefined, "viewer")).status, 403);
  assert.equal((await request("/_test/settings", "PUT", { supportEmail: "new@example.test" }, "viewer")).status, 403);
  await PlatformSettings.findOneAndUpdate({ key: "global" }, { $set: { "security.requireMfaForSuperAdmins": true } }, { upsert: true });
  const result = await request("/_test/settings", "PUT", { supportEmail: " Help@Example.test ", trialLengthDays: 30, maintenanceMode: false, allowSignups: true, verificationProvider: "stedi" });
  assert.equal(result.status, 200);
  assert.equal(result.data.supportEmail, "help@example.test");
  assert.equal(result.data.trialLengthDays, 30);
  assert.equal(result.data.security.requireMfaForSuperAdmins, true);
  const loaded = await request("/_test/settings");
  assert.equal(loaded.data.supportEmail, "help@example.test");
  assert.equal(loaded.data.updatedAt, result.data.updatedAt, "reading settings does not write timestamps");
});

test("settings validate types, bounds and provider, and cannot bypass password-protected MFA", async () => {
  for (const body of [{ supportEmail: "invalid" }, { trialLengthDays: 0 }, { trialLengthDays: 366 }, { trialLengthDays: 1.5 }, { trialLengthDays: "14" }, { maintenanceMode: "false" }, { allowSignups: 1 }, { verificationProvider: "direct" }, { security: { requireMfaForSuperAdmins: false } }]) {
    assert.equal((await request("/_test/settings", "PUT", body)).status, 422);
  }
  assert.equal((await request("/_test/settings")).data.security.requireMfaForSuperAdmins, true);
});

test("maintenance blocks client API requests while public status, logout and Admin remain available", async () => {
  await request("/_test/settings", "PUT", { maintenanceMode: true });
  const denied = await request("/_test/client/patients");
  assert.equal(denied.status, 503);
  assert.equal(denied.code, "PLATFORM_MAINTENANCE");
  assert.equal(denied.data.supportEmail, "help@example.test");
  const status = await request("/_test/platform");
  assert.equal(status.status, 200);
  assert.equal(status.data.maintenanceMode, true);
  assert.equal(status.data.verificationProvider, "stedi");
  assert.equal(status.data.security, undefined, "public config never exposes security policy");
  assert.equal((await request("/_test/client/auth/logout", "POST")).status, 200);
  assert.equal((await request("/_test/settings")).status, 200);
  await request("/_test/settings", "PUT", { maintenanceMode: false });
  assert.equal((await request("/_test/client/patients")).status, 200);
});

test("signup switch blocks new clients while existing invitations remain accessible", async () => {
  await request("/_test/settings", "PUT", { allowSignups: false });
  const denied = await request("/_test/clients", "POST", {});
  assert.equal(denied.status, 403);
  assert.equal(denied.code, "SIGNUPS_DISABLED");
  const plan = await Plan.create({ key: "settings-test", name: "Settings test plan", price: 100, period: "1 month", status: "Active" });
  const invited = await Client.create({ name: "Previously invited", status: "invited", planId: plan.key });
  const { token, tokenHash } = createInvitationToken();
  await ClientInvitation.create({ clientId: invited._id, ownerUserId: new mongoose.Types.ObjectId(), email: "invited@example.test", tokenHash, expiresAt: new Date(Date.now() + 86400000) });
  assert.equal((await request(`/_test/onboarding/${token}`)).status, 200);
  await request("/_test/settings", "PUT", { allowSignups: true });
  assert.equal((await request("/_test/clients", "POST", {})).status, 422, "enabled signups proceed to normal validation");
});

test("new trials use configured length; dated trials and paid clients are unchanged", async () => {
  await request("/_test/settings", "PUT", { trialLengthDays: 30 });
  const first = await Client.create({ name: "Thirty-day trial", status: "trial" });
  assert.equal(first.trialEndsAt - first.trialStartedAt, 30 * 86400000);
  await request("/_test/settings", "PUT", { trialLengthDays: 7 });
  const second = await Client.create({ name: "Seven-day trial", status: "trial" });
  assert.equal(second.trialEndsAt - second.trialStartedAt, 7 * 86400000);
  assert.equal((await Client.findById(first._id)).trialEndsAt.getTime(), first.trialEndsAt.getTime());
  const paid = await Client.create({ name: "Paid client", status: "active" });
  assert.equal(paid.trialEndsAt, null);
  const converted = await request(`/_test/clients/${paid.id}`, "PATCH", { status: "trial" });
  assert.equal(converted.status, 200);
  assert.equal(new Date(converted.data.trialEndsAt) - new Date(converted.data.trialStartedAt), 7 * 86400000);
  const unchanged = await request(`/_test/clients/${paid.id}`, "PATCH", { status: "trial" });
  assert.equal(unchanged.data.trialEndsAt, converted.data.trialEndsAt);
});

test("expired trials block operational APIs but retain billing/account access", async () => {
  const trial = await Client.create({ name: "Expired trial", status: "trial", trialStartedAt: new Date(Date.now() - 86400000), trialEndsAt: new Date(Date.now() - 1000) });
  const user = await ClientUser.create({ tenantId: trial._id, name: "Trial owner", email: "trial-owner@example.test", password: "unused-test-hash", memberships: [{ clinicId: "*", role: "Owner" }] });
  const session = await ClientSession.create({ userId: user._id, tenantId: trial._id, expiresAt: new Date(Date.now() + 3600000) });
  const token = signClientToken(user, session._id);
  const origin = base.replace(/\/leads$/, "");
  const headers = { Authorization: `Bearer ${token}` };
  const denied = await fetch(`${origin}/api/client-panel/patients/trial-check`, { headers });
  assert.equal(denied.status, 403);
  assert.equal((await denied.json()).code, "TRIAL_EXPIRED");
  assert.equal((await fetch(`${origin}/api/client-panel/billing/trial-check`, { headers })).status, 200);
  await Client.updateOne({ _id: trial._id }, { $set: { status: "active" } });
  assert.equal((await fetch(`${origin}/api/client-panel/patients/trial-check`, { headers })).status, 200);
});

test("dashboard:view alone exposes no platform data or related-resource metrics", async () => {
  assert.equal((await request("/_test/dashboard/stats", "GET", undefined, "viewer")).status, 403);
  for (const role of ["dashboardOnly", "dashboardReports"]) {
    const result = await request("/_test/dashboard/stats", "GET", undefined, role);
    assert.equal(result.status, 200);
    assert.deepEqual(result.data.kpis, { series: {} });
    assert.ok(Object.values(result.data.visibility).every((value) => value === false));
    for (const field of ["plans", "leadFunnel", "recentActivity"]) assert.equal(result.data[field], undefined);
  }
});

test("dashboard lead funnel requires leads:view and Staff aggregates only assigned leads", async () => {
  const marketing = await request("/_test/dashboard/stats", "GET", undefined, "dashboardLeads");
  assert.equal(marketing.status, 200);
  assert.equal(marketing.data.visibility.leads, true);
  assert.equal(marketing.data.leadFunnel.reduce((total, row) => total + row.count, 0), await Lead.countDocuments());
  assert.deepEqual(marketing.data.kpis, { series: {} });
  const staff = await request("/_test/dashboard/stats", "GET", undefined, "dashboardStaff", 1);
  assert.equal(staff.status, 200);
  assert.equal(staff.data.leadFunnel.reduce((total, row) => total + row.count, 0), await Lead.countDocuments({ ownerId: users[1]._id }));
  assert.equal(staff.data.recentActivity, undefined);
});

test("verification card requires eligibility:view; Client Admin results stay tenant-scoped", async () => {
  const other = await Client.create({ name: "Other dashboard tenant", status: "active" });
  const check = (tenantId) => ({ tenantId, clinicId: "cl1", patientId: new mongoose.Types.ObjectId(), requestedBy: new mongoose.Types.ObjectId(), status: "completed", primary: { outcome: "completed" }, checkedAt: new Date() });
  await EligibilityCheck.insertMany([check(client._id), check(other._id), check(other._id)]);
  const reviewer = await request("/_test/dashboard/stats", "GET", undefined, "dashboardEligibility");
  assert.equal(reviewer.status, 200);
  assert.equal(reviewer.data.kpis.verificationsThisMonth, 3);
  assert.equal(reviewer.data.kpis.monthlyRecurringRevenue, undefined);
  assert.equal(reviewer.data.leadFunnel, undefined);
  const tenant = await request("/_test/dashboard/stats", "GET", undefined, "dashboardClient", 2);
  assert.equal(tenant.status, 200);
  assert.equal(tenant.data.kpis.verificationsThisMonth, 1);
  assert.equal(tenant.data.leadFunnel.reduce((total, row) => total + row.count, 0), await Lead.countDocuments({ clientId: client._id }));
  assert.equal(tenant.data.kpis.activeClients, undefined);
  assert.equal(tenant.data.plans, undefined);
});

test("Super Admin retains all dashboard sections and aggregates", async () => {
  const result = await request("/_test/dashboard/stats");
  assert.equal(result.status, 200);
  assert.ok(Object.values(result.data.visibility).every(Boolean));
  for (const key of ["monthlyRecurringRevenue", "activeClients", "trialClients", "verificationsThisMonth", "openTickets", "overdueInvoices", "insurerIssues"]) {
    assert.equal(typeof result.data.kpis[key], "number");
  }
  for (const key of ["plans", "leadFunnel", "recentActivity"]) assert.ok(Array.isArray(result.data[key]));
});

test("global search returns client, user and lead matches with safe navigation URLs", async () => {
  await Client.create({ name: "OmniSearch Dental", ownerName: "Search Owner", email: "clinic-search@example.test", status: "active" });
  await AdminUser.insertMany([{ name: "OmniSearch Admin", email: "omnisearch@example.test", password: "not-used", role: "Staff" }]);
  await Lead.create({ practiceName: "OmniSearch Assigned", contactName: "Dr Search", source: "Referral", ownerId: users[1]._id, ownerName: users[1].name, phone: "+13035550123" });
  await Lead.create({ practiceName: "OmniSearch Tenant", contactName: "Dr Search", source: "Referral", ownerId: users[2]._id, ownerName: users[2].name, clientId: client._id });
  await Lead.create({ practiceName: "OmniSearch Platform", contactName: "Dr Search", source: "Referral", ownerId: users[0]._id, ownerName: users[0].name });
  const result = await request("/_test/search?q=omnisearch");
  assert.equal(result.status, 200);
  assert.deepEqual([...new Set(result.data.results.map((row) => row.type))].sort(), ["client", "lead", "user"]);
  for (const row of result.data.results) {
    assert.deepEqual(Object.keys(row).sort(), ["id", "subtitle", "title", "type", "url"]);
    assert.ok(row.url.startsWith("/"));
    assert.ok(!row.url.startsWith("//"));
  }
  assert.ok(result.data.results.find((row) => row.type === "client").url.startsWith("/clients?clientId="));
  assert.ok(result.data.results.find((row) => row.type === "user").url.startsWith("/users?q="));
  assert.ok(result.data.results.find((row) => row.type === "lead").url.startsWith("/leads?leadId="));
});

test("global search enforces module permissions and the same lead scopes as the lead API", async () => {
  const none = await request("/_test/search?q=omnisearch", "GET", undefined, "dashboardOnly");
  assert.equal(none.status, 200);
  assert.deepEqual(none.data.results, []);
  const staff = await request("/_test/search?q=omnisearch", "GET", undefined, "staff", 1);
  assert.deepEqual(staff.data.results.map((row) => row.title), ["OmniSearch Assigned"]);
  const tenant = await request("/_test/search?q=omnisearch", "GET", undefined, "client", 2);
  assert.deepEqual(tenant.data.results.map((row) => row.title), ["OmniSearch Tenant"]);
  const marketing = await request("/_test/search?q=omnisearch", "GET", undefined, "viewer");
  assert.equal(marketing.data.results.length, 3);
  assert.ok(marketing.data.results.every((row) => row.type === "lead"));
});

test("global search treats regex characters literally and validates query bounds", async () => {
  await Lead.create({ practiceName: "Literal [A+B] Dental", contactName: "Contact", source: "Other", ownerName: "Owner" });
  const literal = await request(`/_test/search?q=${encodeURIComponent("[A+B]")}`);
  assert.equal(literal.status, 200);
  assert.deepEqual(literal.data.results.map((row) => row.title), ["Literal [A+B] Dental"]);
  const wildcard = await request(`/_test/search?q=${encodeURIComponent(".*")}`);
  assert.deepEqual(wildcard.data.results, []);
  for (const suffix of ["", "?q=a", "?q=%20%20", `?q=${"a".repeat(101)}`, "?q=aa&q=bb"]) {
    assert.equal((await request(`/_test/search${suffix}`)).status, 422);
  }
});

test("global search accepts formatted phone input and caps results per entity type", async () => {
  const phone = await request(`/_test/search?q=${encodeURIComponent("+1 (303) 555-0123")}`, "GET", undefined, "staff", 1);
  assert.deepEqual(phone.data.results.map((row) => row.title), ["OmniSearch Assigned"]);
  await Lead.insertMany(Array.from({ length: 8 }, (_, index) => ({ practiceName: `SearchLimit ${index}`, contactName: "Contact", source: "Other", ownerName: "Owner" })));
  const limited = await request("/_test/search?q=searchlimit");
  assert.equal(limited.status, 200);
  assert.equal(limited.data.results.length, 5);
});
