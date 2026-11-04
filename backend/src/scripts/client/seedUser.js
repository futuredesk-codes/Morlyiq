// Seeds Client Panel (MorlyCLient) users, one per role. Run manually:
//
//   npm run seed:client-user
//
// - The Owner comes from backend/.env (SEED_PRACTICE_NAME, SEED_USER_NAME, SEED_USER_EMAIL,
//   SEED_USER_PASSWORD).
// - The other roles are the dummy users in DUMMY_USERS below (edit freely).
// Safe to re-run: users whose email already exists are skipped.
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { ClientUser, CLIENT_ROLES } from "../../models/client/ClientUser.js";
import { Client } from "../../models/Client.js";

dotenv.config();

const env = process.env;
const PRACTICE_NAME = env.SEED_PRACTICE_NAME?.trim();

// Clinics are NOT seeded: the Owner adds them from the Clinics page ("Add clinic"). They are numbered
// cl1, cl2, ... in the order they are created, which is what the clinicId values below refer to.

// memberships = role PER CLINIC. clinicId "*" = every clinic of the practice (account-level Owner).
const OWNER = {
  name: env.SEED_USER_NAME?.trim(),
  email: env.SEED_USER_EMAIL?.trim(),
  password: env.SEED_USER_PASSWORD,
  memberships: [{ clinicId: "*", role: "Owner" }],
};

// Dummy users for testing each role's access. Same password for all (min 8 characters).
const DUMMY_PASSWORD = "Password@123";
const DUMMY_USERS = [
  // Manager at Downtown but only Front Desk at Uptown — shows role changing with the clinic
  { name: "Robert Kim2", email: "manager2@dummy.morlyiq.com", memberships: [{ clinicId: "cl1", role: "Manager" }, { clinicId: "cl2", role: "Front Desk" }] },
  { name: "Chen Wu2", email: "billing2@dummy.morlyiq.com", memberships: [{ clinicId: "cl1", role: "Billing" }] },
  { name: "Maria Alvarez2", email: "frontdesk2@dummy.morlyiq.com", memberships: [{ clinicId: "cl1", role: "Front Desk" }] },
  { name: "Dr. Sarah Palmer2", email: "dentist2@dummy.morlyiq.com", memberships: [{ clinicId: "cl2", role: "Dentist" }] },
].map((u) => ({ ...u, password: DUMMY_PASSWORD }));

// Only used when the practice has to be created (Admin console normally manages these)
const NEW_PRACTICE = {
  status: "active",
  clinics: 2,
  entitlements: {
    eligibility: true,
    insurance_discovery: true,
    cob: true,
    eligibility_pdfs: true,
    claims: true,
    era: true,
    claim_status: true,
    acknowledgments: true,
  },
};

const finish = async (code, message) => {
  console.log(message);
  await mongoose.disconnect();
  process.exit(code);
};

const missing = [
  ["SEED_PRACTICE_NAME", PRACTICE_NAME],
  ["SEED_USER_NAME", OWNER.name],
  ["SEED_USER_EMAIL", OWNER.email],
  ["SEED_USER_PASSWORD", OWNER.password],
].filter(([, v]) => !v);
if (missing.length) await finish(1, `Missing in .env: ${missing.map(([k]) => k).join(", ")}`);

const users = [OWNER, ...DUMMY_USERS];
for (const u of users) {
  for (const m of u.memberships) {
    if (!CLIENT_ROLES.includes(m.role)) await finish(1, `Invalid role "${m.role}" for ${u.email}`);
  }
  if (u.password.length < 8) await finish(1, `Password too short for ${u.email} (min 8 characters)`);
}

await mongoose.connect(env.MONGODB_URI || "mongodb://127.0.0.1:27017/morlyiq_db");

const practice =
  (await Client.findOne({ name: PRACTICE_NAME })) ||
  (await Client.create({ name: PRACTICE_NAME, ...NEW_PRACTICE }));

const lines = [];
for (const u of users) {
  if (await ClientUser.exists({ email: u.email.toLowerCase() })) {
    lines.push(`  skipped  ${u.memberships.map((m) => `${m.clinicId}:${m.role}`).join(", ").padEnd(24)} ${u.email} (already exists)`);
    continue;
  }
  await ClientUser.create({
    tenantId: practice._id,
    name: u.name,
    email: u.email,
    memberships: u.memberships,
    password: await bcrypt.hash(u.password, 10),
  });
  lines.push(`  seeded   ${u.memberships.map((m) => `${m.clinicId}:${m.role}`).join(", ").padEnd(24)} ${u.email}`);
}

await finish(0, `Practice "${practice.name}"\n${lines.join("\n")}`);
