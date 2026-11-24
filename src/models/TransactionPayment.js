
import mongoose from "mongoose";

const transactionPaymentSchema = new mongoose.Schema(
  {
    transaction: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Transaction",
      required: true,
      index: true
    },

    payer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    amount: {
      type: Number,
      required: true,
      min: 0.01
    },

    currency: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      minlength: 3,
      maxlength: 3
    },

    paymentType: {
      type: String,
      enum: ["deposit", "installment", "balance", "other"],
      required: true
    },

    paymentMethod: {
      type: String,
      enum: ["bank_transfer", "cash", "other"],
      required: true
    },

    paymentReference: {
      type: String,
      trim: true,
      maxlength: 150,
      default: ""
    },

    evidenceUrl: {
      type: String,
      trim: true,
      default: ""
    },
    evidencePublicId: {
  type: String,
  trim: true,
  default: ""
},

evidenceResourceType: {
  type: String,
  enum: ["image", "raw"],
  default: null
},

evidenceFormat: {
  type: String,
  trim: true,
  default: ""
},

    status: {
      type: String,
      enum: ["pending", "verified", "rejected"],
      default: "pending",
      index: true
    },

    submittedAt: {
      type: Date,
      default: Date.now
    },

    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },

    verifiedAt: {
      type: Date,
      default: null
    },

    reviewNote: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: ""
    },

    note: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: ""
    }
  },
  { timestamps: true }
);

transactionPaymentSchema.index({
  transaction: 1,
  status: 1,
  submittedAt: -1
});

transactionPaymentSchema.index({
  payer: 1,
  submittedAt: -1
});

export default mongoose.model(
  "TransactionPayment",
  transactionPaymentSchema
);
