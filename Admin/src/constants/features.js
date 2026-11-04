/* ---------------------------------------------------------------------
   MASTER FEATURE CATALOGUE (Section 2 of the requirements doc)
--------------------------------------------------------------------- */
export const FEATURES = [
  { key: "eligibility", name: "Eligibility Checks", desc: "Run insurance eligibility checks and show request/result status." },
  { key: "insurance_discovery", name: "Insurance Discovery", desc: "Discover/identify insurance coverage where supported by the connected service." },
  { key: "cob", name: "Coordination of Benefits", desc: "Capture and manage COB information and workflow." },
  { key: "eligibility_pdfs", name: "Eligibility PDFs", desc: "Generate, store and view eligibility result PDFs." },
  { key: "claims", name: "Claim Submission", desc: "Create and submit claims and track submission state." },
  { key: "era", name: "ERAs", desc: "Receive and process electronic remittance advice." },
  { key: "claim_status", name: "Real-Time Claim Status", desc: "Check claim status and show the latest response." },
  { key: "era_pdfs", name: "ERA PDFs", desc: "Generate, store and view ERA PDF documents." },
  { key: "acknowledgments", name: "Claim Acknowledgments", desc: "Store and display acceptance/rejection responses." },
];

export const FEATURE_MAP = Object.fromEntries(FEATURES.map((f) => [f.key, f]));
