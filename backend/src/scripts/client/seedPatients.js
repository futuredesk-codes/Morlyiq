// Adds the 10 sample patients (the ones the Client Panel used to show) to a practice's clinics. Run manually:
//
//   npm run seed:client-patients
//
// The practice comes from backend/.env (SEED_PRACTICE_NAME). Patients are spread over the practice's
// clinics (cl1, cl2) like the old demo data. Safe to re-run: a patient already in a clinic is skipped.
import dotenv from "dotenv";
import mongoose from "mongoose";
import { Client } from "../../models/Client.js";
import { Clinic } from "../../models/client/Clinic.js";
import { Patient } from "../../models/client/Patient.js";

dotenv.config();

const PRACTICE_NAME = process.env.SEED_PRACTICE_NAME?.trim();
const NAMES = ["Jane Doe", "Marcus Reyes", "Aisha Bello", "Tom Whitfield", "Priya Nair", "Carlos Mendez", "Linda Cho", "Evan Brooks", "Sofia Rinaldi", "Derek Youn"];
const PAYERS = ["Delta Dental PPO", "Cigna Dental", "MetLife", "Guardian", "Aetna DMO"];
const CODES = ["D0120", "D1110", "D2391", "D2740", "D2950", "D4341", "D7140"];

const finish = async (code, message) => {
  console.log(message);
  await mongoose.disconnect();
  process.exit(code);
};

if (!PRACTICE_NAME) await finish(1, "Missing in .env: SEED_PRACTICE_NAME");
await mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/morlyiq_db");

const practice = await Client.findOne({ name: PRACTICE_NAME });
if (!practice) await finish(1, `Practice "${PRACTICE_NAME}" not found. Run npm run seed:client-user first.`);
const clinicIds = new Set((await Clinic.find({ tenantId: practice._id })).map((c) => c.clinicId));
if (!clinicIds.size) await finish(1, "This practice has no clinics yet. Add one from the Clinics page first.");

let added = 0;
let skipped = 0;
const perClinic = {};
for (const [i, name] of NAMES.entries()) {
  // Same spread as the old demo data: every 3rd patient at cl2, the rest at cl1 (falls back to the first clinic)
  const wanted = i % 3 === 0 ? "cl2" : "cl1";
  const clinicId = clinicIds.has(wanted) ? wanted : [...clinicIds][0];

  if (await Patient.exists({ tenantId: practice._id, clinicId, name })) {
    skipped++;
    continue;
  }
  const appointment = new Date();
  appointment.setDate(appointment.getDate() + i + 1);
  appointment.setHours(9, (i % 6) * 10, 0, 0);

  const chosen = Array.from({ length: 1 + (i % 3) }, (_, k) => CODES[(i + k) % CODES.length]);
  await Patient.create({
    tenantId: practice._id,
    clinicId,
    name,
    dob: `19${70 + ((i * 3) % 30)}-0${1 + (i % 9)}-1${i % 9}`,
    payer: i === 9 ? "Unknown" : PAYERS[i % PAYERS.length], // one patient with an unknown payer, for Insurance Discovery
    appointment,
    codes: [...new Set(chosen)],
  });
  perClinic[clinicId] = (perClinic[clinicId] || 0) + 1;
  added++;
}

await finish(
  0,
  `Practice "${practice.name}": added ${added} patient(s)${added ? ` (${Object.entries(perClinic).map(([c, n]) => `${c}: ${n}`).join(", ")})` : ""}, skipped ${skipped} already present.`
);
