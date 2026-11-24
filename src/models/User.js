
import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 60
  },
  lastName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 60
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    maxlength: 254,
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Please provide a valid email address."]
  },
  phone: {
    type: String,
    trim: true,
    maxlength: 25,
    default: null
  },
  password: {
    type: String,
    required: true,
    minlength: 8,
    select: false
  },
  tokenVersion: {
  type: Number,
  default: 0,
  min: 0
},
  role: {
    type: String,
    enum: ["user", "agent", "developer", "admin", "superadmin"],
    default: "user",
    index: true
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationTokenHash: {
    type: String,
    select: false
  },
  emailVerificationExpiresAt: {
    type: Date,
    select: false
  },
  passwordResetTokenHash: {
    type: String,
    select: false
  },
  passwordResetExpiresAt: {
    type: Date,
    select: false
  },
  accountStatus: {
    type: String,
    enum: ["active", "suspended", "deactivated"],
    default: "active",
    index: true
  },
  lastLoginAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true,
  toJSON: {
    transform(_doc, ret) {
      delete ret.password;
      delete ret.emailVerificationTokenHash;
      delete ret.emailVerificationExpiresAt;
      delete ret.passwordResetTokenHash;
      delete ret.passwordResetExpiresAt;
      delete ret.__v;
      return ret;
    }
  }
});

// userSchema.index({ email: 1 }, { unique: true });

export default mongoose.model("User", userSchema);
