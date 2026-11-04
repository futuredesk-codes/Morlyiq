import mongoose from "mongoose";

export const ANNOUNCEMENT_AUDIENCES = ["All clients", "Selected plans", "Trial accounts"];

const announcementSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Announcement title is required"],
      trim: true,
      maxlength: [160, "Announcement title cannot exceed 160 characters"],
    },
    body: {
      type: String,
      required: [true, "Announcement message is required"],
      trim: true,
      maxlength: [4000, "Announcement message cannot exceed 4000 characters"],
    },
    audience: {
      type: String,
      enum: ANNOUNCEMENT_AUDIENCES,
      default: "All clients",
    },
    targetPlans: [{ type: mongoose.Schema.Types.ObjectId, ref: "Plan" }],
    published: { type: Boolean, default: false },
    publishedAt: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "AdminUser", required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "AdminUser", required: true },
  },
  { timestamps: true, collection: "announcements" }
);

announcementSchema.index({ published: 1, createdAt: -1 });
announcementSchema.index({ audience: 1, targetPlans: 1 });

export const Announcement = mongoose.model("Announcement", announcementSchema);
