import { CDT_LIB, PAYERS, NAMES } from "../constants/cdt.js";
import { nextId } from "../utils/id.js";

export const CLINICS = [
  { id: "cl1", name: "Bright Smiles Dental — Downtown", address: "214 Market St, Springfield" },
  { id: "cl2", name: "Bright Smiles Dental — Uptown", address: "58 Maple Ave, Springfield" },
];

export function seedPatients() {
  const codes = Object.keys(CDT_LIB);
  const patients = NAMES.map((name, i) => {
    const n = 1 + (i % 3);
    const chosen = Array.from({ length: n }, (_, k) => codes[(i + k) % codes.length]);
    return {
      id: `p${i + 1}`,
      name,
      dob: `19${70 + ((i * 3) % 30)}-0${1 + ((i % 9) % 9)}-1${i % 9}`,
      clinicId: i % 3 === 0 ? "cl2" : "cl1",
      payer: PAYERS[i % PAYERS.length],
      appt: `Jul ${13 + i}, 2026 · 9:${(i * 7) % 6}0 AM`,
      codes: [...new Set(chosen)],
      status: "not_verified",
      result: null,
      aiSummary: null,
      patientSummary: null,
      aiReviewed: false,
      cob: null,
    };
  });
  // Demo case for Insurance Discovery: payer not yet known at intake.
  patients[9] = { ...patients[9], payer: "Unknown" };
  return patients;
}

export function runVerification(patient) {
  const seed = patient.id.charCodeAt(1);
  const deductibleTotal = 50;
  const deductibleRemaining = seed % 3 === 0 ? 0 : 50;
  const annualMax = 1500;
  const annualUsed = 200 + ((seed * 37) % 1200);
  const cdtResults = patient.codes.map((code) => {
    const base = CDT_LIB[code];
    const covered = seed % 11 !== 0;
    const insPayPct = covered ? base.pct : 0;
    const feeCents = 8000 + code.charCodeAt(3) * 550;
    const insPay = Math.round((feeCents * insPayPct) / 100);
    return {
      code,
      desc: base.desc,
      covered,
      pct: insPayPct,
      insPay,
      ptPay: feeCents - insPay,
      freq: base.freq,
      freqOk: seed % 7 !== 0,
      notes: !covered
        ? "Not covered under current plan year."
        : insPayPct < 100
        ? "Subject to coinsurance; deductible may apply."
        : "Fully covered — no waiting period on file.",
    };
  });
  const claimRisk =
    seed % 6 === 0
      ? {
          level: "high",
          reason: "Frequency limit likely exceeded for D4341 — verify last service date before submitting.",
        }
      : seed % 4 === 0
      ? {
          level: "medium",
          reason: "Deductible not yet met — patient portion may be higher than usual.",
        }
      : {
          level: "low",
          reason: "No unusual risk factors detected for this claim.",
        };
  return {
    coverageStatus: seed % 13 === 0 ? "Inactive" : "Active",
    network: seed % 5 === 0 ? "Out of Network" : "In Network",
    effectiveDate: "2026-01-01",
    deductibleTotal,
    deductibleRemaining,
    annualMax,
    annualRemaining: Math.max(annualMax - annualUsed, 0),
    preauthRequired: seed % 4 === 0,
    waitingPeriod: seed % 8 === 0 ? "6 months remaining on major services" : "None",
    cdtResults,
    claimRisk,
  };
}

export function generateAISummary(patient, result) {
  const covered = result.cdtResults.filter((c) => c.covered);
  const notCovered = result.cdtResults.filter((c) => !c.covered);
  let text = `${patient.name.split(" ")[0]}'s ${patient.payer} plan is currently ${result.coverageStatus.toLowerCase()} and ${result.network.toLowerCase()}. `;
  text += `They have $${result.deductibleRemaining} remaining on a $${result.deductibleTotal} deductible, and $${result.annualRemaining} left of a $${result.annualMax} annual maximum. `;
  if (covered.length) {
    text += `Planned treatment (${covered.map((c) => c.code).join(", ")}) is covered at this visit, with an estimated patient responsibility of $${(
      covered.reduce((s, c) => s + c.ptPay, 0) / 100
    ).toFixed(2)}. `;
  }
  if (notCovered.length) {
    text += `Note: ${notCovered.map((c) => c.code).join(", ")} may not be covered under the current plan year — confirm with the patient before treatment. `;
  }
  if (result.preauthRequired) {
    text += `This plan requires preauthorization for major services — recommend submitting before the appointment.`;
  }
  return text;
}

export function generatePatientSummary(patient, result) {
  const covered = result.cdtResults.filter((c) => c.covered);
  const owed = (covered.reduce((s, c) => s + c.ptPay, 0) / 100).toFixed(2);
  return `Hi ${patient.name.split(" ")[0]}, good news — your ${patient.payer} insurance is active. Based on today's visit, your estimated out-of-pocket cost is about $${owed}. This is an estimate; your final amount may vary slightly depending on your treatment.`;
}

export const seedClaims = () => [
  {
    id: "clm1",
    patientId: "p2",
    patientName: "Marcus Reyes",
    clinicId: "cl1",
    payer: "Cigna Dental",
    codes: ["D2391", "D2740"],
    billed: 15400,
    status: "accepted",
    submitted: "2026-07-14",
    ack: "Claim acknowledged and accepted by Cigna Dental on 2026-07-16.",
    era: {
      received: "2026-07-17",
      paid: 10780,
      adjustment: "Standard fee schedule adjustment applied.",
      lines: [
        { code: "D2391", paid: 4680 },
        { code: "D2740", paid: 6100 },
      ],
    },
  },
  {
    id: "clm2",
    patientId: "p4",
    patientName: "Tom Whitfield",
    clinicId: "cl1",
    payer: "Guardian",
    codes: ["D0120", "D1110"],
    billed: 9200,
    status: "submitted",
    submitted: "2026-07-19",
    ack: null,
    era: null,
  },
  {
    id: "clm3",
    patientId: "p6",
    patientName: "Carlos Mendez",
    clinicId: "cl1",
    payer: "MetLife",
    codes: ["D4341"],
    billed: 11800,
    status: "pending",
    submitted: "2026-07-15",
    ack: "MetLife has requested additional documentation before this claim can be finalized.",
    era: null,
  },
  {
    id: "clm4",
    patientId: "p7",
    patientName: "Linda Cho",
    clinicId: "cl2",
    payer: "Delta Dental PPO",
    codes: ["D7140"],
    billed: 12300,
    status: "rejected",
    submitted: "2026-07-12",
    ack: "Rejected — frequency limit exceeded for D7140 on this plan year.",
    era: null,
  },
];

export function generateClaimFromPatient(patient) {
  const billed = patient.result.cdtResults.reduce((s, c) => s + c.insPay + c.ptPay, 0);
  return {
    id: nextId("clm"),
    patientId: patient.id,
    patientName: patient.name,
    clinicId: patient.clinicId,
    payer: patient.payer,
    codes: patient.result.cdtResults.map((c) => c.code),
    billed,
    status: "submitted",
    submitted: "2026-07-20",
    ack: null,
    era: null,
  };
}

export function checkClaimStatus(claim) {
  const seed = claim.id.length + claim.patientId.charCodeAt(1);
  if (seed % 5 === 0) {
    return {
      status: "rejected",
      ack: "Rejected — payer could not match subscriber ID on file. Verify eligibility again before resubmitting.",
      era: null,
    };
  }
  if (seed % 4 === 0) {
    return {
      status: "pending",
      ack: `${claim.payer} has requested additional documentation before this claim can be finalized.`,
      era: null,
    };
  }
  const billed = claim.billed;
  const paid = Math.round(billed * 0.72);
  return {
    status: "accepted",
    ack: `Claim acknowledged and accepted by ${claim.payer} on 2026-07-22.`,
    era: {
      received: "2026-07-23",
      paid,
      adjustment: "Standard fee schedule adjustment applied.",
      lines: claim.codes.map((code) => ({ code, paid: Math.round(paid / claim.codes.length) })),
    },
  };
}

export const seedClinics = () => CLINICS;

export const seedStaff = () => [
  { id: "s1", name: "Jane Whitfield", email: "jane@brightsmiles.com", role: "Owner", clinicId: "cl1", status: "active", lastActive: "Just now" },
  { id: "s2", name: "Robert Kim", email: "robert@brightsmiles.com", role: "Manager", clinicId: "cl1", status: "active", lastActive: "1h ago" },
  { id: "s3", name: "Maria Alvarez", email: "maria@brightsmiles.com", role: "Front Desk", clinicId: "cl1", status: "active", lastActive: "20m ago" },
  { id: "s4", name: "Chen Wu", email: "chen@brightsmiles.com", role: "Billing", clinicId: "cl1", status: "active", lastActive: "3h ago" },
  { id: "s5", name: "Dr. Sarah Palmer", email: "sarah@brightsmiles.com", role: "Dentist", clinicId: "cl2", status: "active", lastActive: "5h ago" },
  { id: "s6", name: "Dr. Omar Farouk", email: "omar@brightsmiles.com", role: "Dentist", clinicId: "cl2", status: "invited", lastActive: "—" },
];

export const seedInvoices = () => [
  { id: "inv2001", period: "Jul 2026", amount: 4166, status: "paid", date: "2026-07-06" },
  { id: "inv2002", period: "Jun 2026", amount: 4166, status: "paid", date: "2026-06-06" },
  { id: "inv2003", period: "May 2026", amount: 4166, status: "paid", date: "2026-05-06" },
  { id: "inv2004", period: "Apr 2026", amount: 4166, status: "paid", date: "2026-04-06" },
];

export const seedTickets = () => [
  { id: "t1", subject: "MetLife verification timing out", priority: "high", status: "open", updated: "10m ago" },
  { id: "t2", subject: "Request: add 3rd clinic location", priority: "low", status: "pending", updated: "2d ago" },
];
