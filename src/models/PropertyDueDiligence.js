
import mongoose from "mongoose";

const documentTypes = [
  "title_deed",
  "deed_of_assignment",
  "survey_plan",
  "certificate_of_occupancy",
  "allocation_letter",
  "proof_of_ownership",
  "authority_to_let",
  "authority_to_lease",
  "property_condition_report",
  "tenancy_agreement",
  "lease_agreement",
  "management_authorization",
  "building_approval",
  "approved_building_plan",
  "governor_consent",
  "land_registry_search",
  "encumbrance_search",
  "other",
];

const requirementSchema = new mongoose.Schema(
  {
    documentType: {
      type: String,
      enum: documentTypes,
      required: true,
    },

    label: {
      type: String,
      required: true,
      maxlength: 150,
    },

    required: {
      type: Boolean,
      default: true,
    },

    description: {
      type: String,
      maxlength: 500,
      default: "",
    },
  },
  { _id: false }
);

const documentSchema = new mongoose.Schema(
  {
    documentType: {
      type: String,
      enum: documentTypes,
      required: true,
    },

    originalName: {
      type: String,
      required: true,
      maxlength: 255,
    },

    mimeType: {
      type: String,
      required: true,
    },

    format: {
      type: String,
      required: true,
    },

    resourceType: {
      type: String,
      enum: ["image", "raw"],
      required: true,
    },

    publicId: {
      type: String,
      required: true,
    },

    bytes: {
      type: Number,
      required: true,
    },

    note: {
      type: String,
      maxlength: 1000,
      default: "",
    },

    status: {
      type: String,
      enum: ["submitted", "approved", "needs_correction", "rejected"],
      default: "submitted",
    },

    reviewNote: {
      type: String,
      maxlength: 2000,
      default: "",
    },

    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    reviewedAt: {
      type: Date,
      default: null,
    },

    uploadedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

const propertyDueDiligenceSchema = new mongoose.Schema(
  {
    property: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      required: true,
      index: true,
    },

    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    propertyType: {
      type: String,
      enum: ["land", "house", "apartment", "commercial", "other"],
      required: true,
    },

    transactionType: {
      type: String,
      enum: ["sale", "lease", "rent"],
      required: true,
    },

    requiredDocuments: {
      type: [requirementSchema],
      default: [],
    },

    status: {
      type: String,
      enum: [
        "documents_requested",
        "submitted",
        "under_review",
        "needs_correction",
        "verified",
        "rejected",
      ],
      default: "documents_requested",
      index: true,
    },

    documents: {
      type: [documentSchema],
      default: [],
    },

    adminNote: {
      type: String,
      maxlength: 3000,
      default: "",
    },

    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    reviewedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

propertyDueDiligenceSchema.index(
  { property: 1, owner: 1 },
  { unique: true }
);

export default mongoose.model(
  "PropertyDueDiligence",
  propertyDueDiligenceSchema
);

