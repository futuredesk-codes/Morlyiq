import dotenv from "dotenv";
import mongoose from "mongoose";
import { fileURLToPath } from "node:url";

dotenv.config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)), quiet: true });

await mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/morlyiq_db");

const clinics = mongoose.connection.collection("clinics");
const records = await clinics.find({}).toArray();
let migrated = 0;

for (const clinic of records) {
  const legacyProvider = clinic.eligibilityProvider || {};
  const currentProvider = clinic.claimProvider || {};
  const claimProvider = {
    organizationName: currentProvider.organizationName || legacyProvider.organizationName || clinic.name || "",
    providerType: currentProvider.providerType || (currentProvider.taxIdType === "SSN" ? "individual" : "organization"),
    providerFirstName: currentProvider.providerFirstName || "",
    providerLastName: currentProvider.providerLastName || "",
    npi: currentProvider.npi || legacyProvider.npi || "",
    taxonomyCode: currentProvider.taxonomyCode || "122300000X",
    taxIdType: currentProvider.taxIdType || "EIN",
    employerId: currentProvider.employerId || "",
    contactType: currentProvider.contactType || "organization",
    contactOrganizationName: currentProvider.contactOrganizationName || currentProvider.organizationName || clinic.name || "",
    phoneNumber: currentProvider.phoneNumber || "",
    submitterId: currentProvider.submitterId || "",
    address1: currentProvider.address1 || clinic.address || "",
    address2: currentProvider.address2 || "",
    city: currentProvider.city || "",
    state: currentProvider.state || "",
    postalCode: currentProvider.postalCode || "",
    countryCode: currentProvider.countryCode || "US",
  };

  const result = await clinics.updateOne(
    { _id: clinic._id },
    {
      $set: { claimProvider },
      $unset: { address: "", eligibilityProvider: "" },
    }
  );
  migrated += result.modifiedCount;
}

console.log(`Consolidated ${migrated} of ${records.length} clinic provider records.`);
await mongoose.disconnect();
