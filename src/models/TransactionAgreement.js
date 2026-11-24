
import mongoose from "mongoose";

const partyResponseSchema = new mongoose.Schema(
  {
    decision: {
      type: String,
      enum: ["pending", "accepted", "rejected"],
      default: "pending"
    },

    note: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: ""
    },

    respondedAt: {
      type: Date,
      default: null
    },

    respondedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    }
  },
  { _id: false }
);

const tenancyTermsSchema = new mongoose.Schema(
  {
    startDate: {
      type: Date,
      required: true
    },

    endDate: {
      type: Date,
      required: true
    },

    paymentFrequency: {
      type: String,
      enum: [
        "monthly",
        "quarterly",
        "biannually",
        "annually"
      ],
      required: true
    },

    nextPaymentDate: {
      type: Date,
      default: null
    },

    renewalOption: {
      type: String,
      enum: [
        "renewable",
        "not_renewable",
        "subject_to_agreement"
      ],
      default: "subject_to_agreement"
    }
  },
  { _id: false }
);


const transactionAgreementSchema = new mongoose.Schema(
  {
    transaction: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Transaction",
      required: true,
      index: true
    },

    version: {
      type: Number,
      required: true,
      min: 1
    },

    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200
    },

    terms: {
      type: String,
      required: true,
      trim: true,
      maxlength: 20000
    },

    documentUrl: {
      type: String,
      trim: true,
      default: ""
    },

        tenancyTerms: {
      type: tenancyTermsSchema,
      default: undefined
    },


    status: {
      type: String,
      enum: [
        "draft",
        "pending_review",
        "accepted",
        "rejected",
        "superseded"
      ],
      default: "draft",
      index: true
    },

    buyerResponse: {
      type: partyResponseSchema,
      default: () => ({})
    },

    sellerResponse: {
      type: partyResponseSchema,
      default: () => ({})
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    publishedAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

// Each transaction can have only one agreement per version.
transactionAgreementSchema.index(
  { transaction: 1, version: 1 },
  { unique: true }
);

// Efficient retrieval of the latest agreement.
transactionAgreementSchema.index({
  transaction: 1,
  createdAt: -1
});

export default mongoose.model(
  "TransactionAgreement",
  transactionAgreementSchema
);
