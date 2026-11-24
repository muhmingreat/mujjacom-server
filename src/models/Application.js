
import mongoose from "mongoose";

const applicationSchema = new mongoose.Schema(
  {
    applicant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },

    property: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      required: true,
      index: true
    },

    applicationType: {
      type: String,
      enum: ["purchase", "rent", "lease"],
      required: true
    },

    message: {
      type: String,
      trim: true,
      maxlength: 3000,
      default: ""
    },

    status: {
      type: String,
      enum: [
        "pending",
        "under_review",
        "approved",
        "rejected",
        "withdrawn"
      ],
      default: "pending",
      index: true
    },

    applicantPhone: {
      type: String,
      trim: true,
      maxlength: 25
    },

    reviewedAt: {
      type: Date,
      default: null
    },

    reviewNote: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: ""
    }
  },
  { timestamps: true }
);

// Prevent duplicate active applications for the same property.
applicationSchema.index(
  { applicant: 1, property: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: { $in: ["pending", "under_review", "approved"] }
    }
  }
);

applicationSchema.index({ applicant: 1, createdAt: -1 });
applicationSchema.index({ property: 1, createdAt: -1 });

export default mongoose.model("Application", applicationSchema);
