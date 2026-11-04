import mongoose from "mongoose";

const replySchema = new mongoose.Schema(
  {
    sender: {
      type: String,
      required: true,
      default: "Support Specialist",
    },
    message: {
      type: String,
      required: [true, "Reply message cannot be empty"],
      trim: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const ticketSchema = new mongoose.Schema(
  {
    ticketId: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
    subject: {
      type: String,
      required: [true, "Subject is required"],
      trim: true,
    },
    desc: {
      type: String,
      default: "",
      trim: true,
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium",
    },
    status: {
      type: String,
      enum: ["open", "pending", "closed", "resolved"],
      default: "open",
    },
    client: {
      type: String,
      default: "Bright Smiles Dental",
    },
    createdBy: {
      type: String,
      default: "Jane Whitfield",
    },
    // Client Panel only: who raised it and at which clinic (clinic code, e.g. "cl1"). Empty on older tickets.
    createdById: { type: mongoose.Schema.Types.ObjectId, ref: "ClientUser", default: null },
    clinicId: { type: String, default: null, index: true },
    // "system" = a technical / system-wide issue that every role at the clinic can see (so nobody files a duplicate
    // of a known outage). "request" = a practice-management request, visible to its author and to Owner / Manager only.
    category: { type: String, enum: ["system", "request"], default: "request" },
    // Official response from Admin / Support
    response: {
      type: String,
      default: "",
      trim: true,
    },
    respondedAt: {
      type: Date,
      default: null,
    },
    respondedBy: {
      type: String,
      default: "",
    },
    replies: [replySchema],
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: function (doc, ret) {
        ret.id = ret.ticketId || ret._id.toString();
        return ret;
      },
    },
    toObject: {
      virtuals: true,
      transform: function (doc, ret) {
        ret.id = ret.ticketId || ret._id.toString();
        return ret;
      },
    },
  }
);

// Pre-save hook to generate human-readable ticketId if not present
ticketSchema.pre("save", async function () {
  if (!this.ticketId) {
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    this.ticketId = `TICK-${randomSuffix}`;
  }
});

export const Ticket = mongoose.model("Ticket", ticketSchema);
