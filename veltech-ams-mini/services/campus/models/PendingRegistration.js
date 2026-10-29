import mongoose from "mongoose";

/**
 * Temporary collection to hold user data until OTP is verified.
 * This prevents the main "users" collection from being filled with unverified accounts.
 */
const pendingRegistrationSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    username: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      minlength: 3,
      maxlength: 20,
      index: true,
    },

    password: {
      type: String, // Stored as a Hash from the controller
      required: true,
    },

    dob: {
      type: Date,
      required: true,
    },

    otp: {
      type: String,
      required: true,
    },

    otpExpires: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

/**
 * 🧹 AUTO-CLEANUP: 
 * This index automatically deletes the document 10 minutes after it is created.
 * This ensures the collection doesn't grow infinitely with failed registrations.
 */
pendingRegistrationSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 600 } // 10 minutes
);

// Prevent sensitive data leak even from the pending table
pendingRegistrationSchema.set("toJSON", {
  transform: (doc, ret) => {
    delete ret.password;
    delete ret.otp;
    return ret;
  },
});

const PendingRegistration =
  mongoose.models.PendingRegistration ||
  mongoose.model("PendingRegistration", pendingRegistrationSchema);

export default PendingRegistration;