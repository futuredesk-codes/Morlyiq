import dotenv from "dotenv";
import mongoose from "mongoose";
import { connectDB } from "../../config/db.js";
import { Feature } from "../../models/admin/Feature.js";

dotenv.config();

const defaults = [
  ["eligibility", "Eligibility Checks", "Run insurance eligibility checks and show request/result status."],
  ["insurance_discovery", "Insurance Discovery", "Discover/identify insurance coverage where supported by the connected service."],
  ["cob", "Coordination of Benefits", "Capture and manage COB information and workflow."],
  ["eligibility_pdfs", "Eligibility PDFs", "Generate, store and view eligibility result PDFs."],
  ["claims", "Claim Submission", "Create and submit claims and track submission state."],
  ["era", "ERAs", "Receive and process electronic remittance advice."],
  ["claim_status", "Real-Time Claim Status", "Check claim status and show the latest response."],
  ["era_pdfs", "ERA PDFs", "Generate, store and view ERA PDF documents."],
  ["acknowledgments", "Claim Acknowledgments", "Store and display acceptance/rejection responses."],
];

await connectDB();

for (const [index, [key, name, description]] of defaults.entries()) {
  await Feature.updateOne(
    { key },
    { $setOnInsert: { key, name, description, sortOrder: index, status: "active" } },
    { upsert: true }
  );
}

console.log(`Feature catalogue ready: ${await Feature.countDocuments()} feature(s)`);
await mongoose.disconnect();
