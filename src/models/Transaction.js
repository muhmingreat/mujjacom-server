
import mongoose from "mongoose";

const transactionStatusHistorySchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: [
        "initiated",
        "terms_pending",
        "agreement_pending",
        "payment_pending",
        "in_progress",
        "completed",
        "cancelled",
        "disputed"
      ],
      required: true
    },

    note: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: ""
    },

    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    changedAt: {
      type: Date,
      default: Date.now
    }
  },
  { _id: false }
);

const transactionSchema = new mongoose.Schema(
  {
    transactionReference: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true
    },

    application: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Application",
      required: true,
      unique: true
    },

    property: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      required: true,
      index: true
    },

    buyer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },

    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },

    transactionType: {
      type: String,
      enum: ["purchase", "rent", "lease"],
      required: true
    },

    agreedAmount: {
      type: Number,
      required: true,
      min: 0
    },

    currency: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      default: "NGN",
      maxlength: 3
    },

    status: {
      type: String,
      enum: [
        "initiated",
        "terms_pending",
        "agreement_pending",
        "payment_pending",
        "in_progress",
        "completed",
        "cancelled",
        "disputed"
      ],
      default: "initiated",
      index: true
    },

    statusHistory: {
      type: [transactionStatusHistorySchema],
      default: []
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    completedAt: {
      type: Date,
      default: null
    },

    cancelledAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

transactionSchema.index({ buyer: 1, createdAt: -1 });
transactionSchema.index({ seller: 1, createdAt: -1 });
transactionSchema.index({ property: 1, status: 1 });

export default mongoose.model("Transaction", transactionSchema);
