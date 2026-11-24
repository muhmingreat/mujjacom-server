import mongoose from "mongoose";

const adminMemberAuditSchema = new mongoose.Schema(
  {
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },

    member: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },

    action: {
      type: String,
      enum: ["suspended", "reactivated"],
      required: true
    },

    previousStatus: {
      type: String,
      enum: ["active", "suspended"],
      required: true
    },

    newStatus: {
      type: String,
      enum: ["active", "suspended"],
      required: true
    },

    reason: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: ""
    }
  },
  {
    timestamps: true
  }
);

adminMemberAuditSchema.index({ member: 1, createdAt: -1 });
adminMemberAuditSchema.index({ admin: 1, createdAt: -1 });

export default mongoose.model(
  "AdminMemberAudit",
  adminMemberAuditSchema
);