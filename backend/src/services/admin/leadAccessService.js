import { Client } from "../../models/Client.js";

// Shared by lead APIs and dashboard aggregates so their access scopes agree.
export async function adminLeadScope(req) {
  if (req.adminRole.roleName === "Staff") return { ownerId: req.adminUser._id };
  if (req.adminRole.roleName === "Client Admin") {
    const client = await Client.findOne({ name: req.adminUser.client }).select("_id").lean();
    return client ? { clientId: client._id } : { _id: null };
  }
  return {};
}
