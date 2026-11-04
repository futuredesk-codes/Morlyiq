import "dotenv/config";
import mongoose from "mongoose";
import { CdtCode } from "../../models/admin/CdtCode.js";

const defaults = [
  { code: "D0120", description: "Periodic Oral Evaluation", defaultCoverage: 100, frequency: "2x / 12 mo" },
  { code: "D1110", description: "Prophylaxis — Adult", defaultCoverage: 100, frequency: "2x / 12 mo" },
  { code: "D2391", description: "Resin Composite — 1 Surface, Posterior", defaultCoverage: 80, frequency: "—" },
  { code: "D2740", description: "Crown — Porcelain/Ceramic", defaultCoverage: 50, frequency: "1x / 60 mo" },
  { code: "D2950", description: "Core Buildup", defaultCoverage: 50, frequency: "—" },
  { code: "D4341", description: "Periodontal Scaling & Root Planing", defaultCoverage: 80, frequency: "1x / 24 mo" },
  { code: "D7140", description: "Extraction, Erupted Tooth", defaultCoverage: 80, frequency: "—" },
];

if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is required");

await mongoose.connect(process.env.MONGODB_URI);
await Promise.all(
  defaults.map((entry) =>
    CdtCode.updateOne(
      { code: entry.code },
      { $setOnInsert: entry },
      { upsert: true, runValidators: true }
    )
  )
);
console.log(`CDT codes ready: ${await CdtCode.countDocuments()}`);
await mongoose.disconnect();
