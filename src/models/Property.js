import mongoose from "mongoose";

const propertySchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    slug: {
      type: String,
      trim: true,
      lowercase: true,
      unique: true,
      sparse: true,
    },
    description: { type: String, trim: true, maxlength: 10000 },
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
   
    price: { type: Number, min: 0 },

priceFrequency: {
  type: String,
  enum: [
    "one_time",
    "monthly",
    "quarterly",
    "biannually",
    "annually"
  ],
  default: null
},

currency: { type: String, default: "NGN", uppercase: true },
    location: {
      address: String,
      area: String,
      city: String,
      state: String,
      country: { type: String, default: "Nigeria" },
      coordinates: {
        latitude: Number,
        longitude: Number,
      },
    },
    landSize: {
      value: Number,
      unit: { type: String, enum: ["sqm", "hectare", "acre"] },
    },
    bedrooms: { type: Number, min: 0 },
    bathrooms: { type: Number, min: 0 },
    features: [{ type: String, trim: true }],
    coverImage: String,

    media: [
      {
        url: {
          type: String,
          required: true,
        },
        type: {
          type: String,
          enum: ["image", "video"],
          required: true,
        },
        publicId: {
          type: String,
        },
        format: {
          type: String,
        },
        width: {
          type: Number,
        },
        height: {
          type: Number,
        },
        duration: {
          type: Number,
        },
        caption: {
          type: String,
          trim: true,
        },
      },
    ],
    verificationStatus: {
      type: String,
      enum: [
        "not_submitted",
        "pending_review",
        "under_review",
        "verified",
        "rejected",
      ],
      default: "not_submitted",
    },
    developmentStatus: {
      type: String,
      enum: ["available", "in_development", "completed", "unavailable"],
      default: "available",
    },
    status: {
      type: String,
      enum: [
        "draft",
        "published",
        "reserved",
        "sold",
        "leased",
        "rented",
        "archived",
      ],
      default: "draft",
      index: true,
    },
    publishedAt: Date,

    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    reviewedAt: {
      type: Date,
      default: null,
    },

    reviewNote: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: "",
    },
  },
  { timestamps: true },
);

propertySchema.index({
  title: "text",
  description: "text",
  "location.city": "text",
  "location.state": "text",
});
propertySchema.index({ transactionType: 1, propertyType: 1, status: 1 });

export default mongoose.model("Property", propertySchema);
