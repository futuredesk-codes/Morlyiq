import mongoose from "mongoose";

const integrationSyncStateSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, trim: true },
    provider: { type: String, required: true, trim: true },
    status: { type: String, enum: ["ready", "failed"], required: true },
    completedAt: { type: Date, default: null },
    recordCount: { type: Number, default: 0, min: 0 },
    lastError: { type: String, default: "", trim: true },
  },
  { timestamps: true, collection: "integration_sync_states" }
);

export const IntegrationSyncState = mongoose.model("IntegrationSyncState", integrationSyncStateSchema);
