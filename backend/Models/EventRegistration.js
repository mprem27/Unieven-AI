import mongoose from "mongoose";

const eventRegistrationSchema = new mongoose.Schema(
  {
    // 👤 USER
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // 🎉 EVENT
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
    },

    // 🔥 NEW: STUDENT DETAILS
    studentId: {
      type: String,
      required: true,
      trim: true,
    },

    department: {
      type: String,
      required: true,
      trim: true,
    },

    phone: {
      type: String,
      required: true,
      trim: true,
    },

    // ✅ STATUS
    status: {
      type: String,
      enum: ["registered", "attended"],
      default: "registered",
    },
  },
  { timestamps: true }
);


// 🔥 PREVENT DUPLICATE REGISTRATION (VERY IMPORTANT)
eventRegistrationSchema.index(
  { user: 1, event: 1 },
  { unique: true }
);

export default mongoose.model("EventRegistration", eventRegistrationSchema);