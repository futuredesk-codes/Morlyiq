import mongoose from "mongoose";

export const LEAD_STATUSES = ["Open", "Contacted", "Follow-up", "Won", "Lost"];

const leadSchema = new mongoose.Schema(
  {
    practiceName: {
      type: String,
      required: [true, "Practice name is required"],
      trim: true,
      maxlength: [160, "Practice name is too long"],
    },
    contactName: {
      type: String,
      required: [true, "Contact name is required"],
      trim: true,
      maxlength: [160, "Contact name is too long"],
    },
    source: {
      type: String,
      required: [true, "Lead source is required"],
      trim: true,
      maxlength: [120, "Lead source is too long"],
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AdminUser",
      default: null,
      index: true,
    },
    ownerName: {
      type: String,
      required: [true, "Lead owner is required"],
      trim: true,
    },
    status: {
      type: String,
      enum: LEAD_STATUSES,
      default: "Open",
      index: true,
    },
    lastActivityLabel: {
      type: String,
      default: "Lead created",
      trim: true,
    },
    lastActivityAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true, collection: "adminleads" }
);

export const Lead = mongoose.model("AdminLead", leadSchema);
