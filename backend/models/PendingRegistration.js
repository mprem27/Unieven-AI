import mongoose from "mongoose";

const pendingRegistrationSchema =
  new mongoose.Schema(
    {
      email: {
        type: String,
        required: true,
        unique: true,
      },

      name: {
        type: String,
        required: true,
      },

      username: {
        type: String,
        required: true,
      },

      password: {
        type: String,
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

// Auto delete after 15 mins
pendingRegistrationSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 900 }
);

export default mongoose.model(
  "PendingRegistration",
  pendingRegistrationSchema
);