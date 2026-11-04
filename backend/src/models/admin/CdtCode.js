import mongoose from "mongoose";

const cdtCodeSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: [true, "CDT code is required"],
      unique: true,
      uppercase: true,
      trim: true,
      match: [/^D\d{4}$/, "CDT code must use the format D followed by four digits"],
    },
    description: {
      type: String,
      required: [true, "Description is required"],
      trim: true,
    },
    defaultCoverage: {
      type: Number,
      required: [true, "Default coverage is required"],
      min: [0, "Default coverage cannot be below 0"],
      max: [100, "Default coverage cannot exceed 100"],
    },
    frequency: {
      type: String,
      default: "—",
      trim: true,
    },
  },
  { timestamps: true, collection: "cdtcodes" }
);

export const CdtCode = mongoose.model("CdtCode", cdtCodeSchema);
