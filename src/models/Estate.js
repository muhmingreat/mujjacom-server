import mongoose from "mongoose";

const estateMediaSchema = new mongoose.Schema(
  {
    url: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ["image", "video"],
      default: "image",
    },
    publicId: {
      type: String,
      default: "",
    },
    caption: {
      type: String,
      trim: true,
      maxlength: 300,
      default: "",
    },
  },
  { _id: true }
);

const estateMilestoneSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: "",
    },
    date: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ["planned", "in_progress", "completed", "delayed"],
      default: "planned",
    },
    progressPercentage: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    media: {
      type: [estateMediaSchema],
      default: [],
    },
  },
  { timestamps: true }
);

const estateSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 180,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 10000,
    },

    estateType: {
      type: String,
      enum: ["residential", "commercial", "mixed_use"],
      required: true,
      default: "residential",
    },

    location: {
      address: {
        type: String,
        trim: true,
        default: "",
      },
      area: {
        type: String,
        trim: true,
        default: "",
      },
      city: {
        type: String,
        required: true,
        trim: true,
      },
      state: {
        type: String,
        required: true,
        trim: true,
      },
      country: {
        type: String,
        required: true,
        trim: true,
        default: "Nigeria",
      },
      coordinates: {
        latitude: {
          type: Number,
          default: null,
        },
        longitude: {
          type: Number,
          default: null,
        },
      },
    },

    developmentStatus: {
      type: String,
      enum: ["under_construction", "completed", "paused"],
      default: "under_construction",
      index: true,
    },

    publicationStatus: {
      type: String,
      enum: ["draft", "published", "archived"],
      default: "draft",
      index: true,
    },

   coverImage: {
  type: String,
  default: "",
  trim: true,
},

coverImagePublicId: {
  type: String,
  default: "",
  trim: true,
},

gallery: {
  type: [estateMediaSchema],
  default: [],
},


    construction: {
      startDate: {
        type: Date,
        default: null,
      },
      estimatedCompletionDate: {
        type: Date,
        default: null,
      },
      actualCompletionDate: {
        type: Date,
        default: null,
      },
      progressPercentage: {
        type: Number,
        min: 0,
        max: 100,
        default: 0,
      },
    },

    milestones: {
      type: [estateMilestoneSchema],
      default: [],
    },

    amenities: {
      type: [String],
      default: [],
    },

    highlights: {
      type: [String],
      default: [],
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    publishedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

estateSchema.index({
  name: "text",
  description: "text",
  "location.city": "text",
  "location.state": "text",
});

estateSchema.index({
  publicationStatus: 1,
  developmentStatus: 1,
  createdAt: -1,
});

const Estate = mongoose.model("Estate", estateSchema);

export default Estate;
