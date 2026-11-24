import mongoose from "mongoose";

const savedPropertySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },

    property: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      required: true
    }
  },
  {
    timestamps: true
  }
);

// A member cannot save the same property more than once.
savedPropertySchema.index(
  { user: 1, property: 1 },
  { unique: true }
);

// Efficient retrieval of a member's saved properties.
savedPropertySchema.index({ user: 1, createdAt: -1 });

export default mongoose.model("SavedProperty", savedPropertySchema);