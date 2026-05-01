import mongoose from "mongoose";

const eventRegistrationSchema =
  new mongoose.Schema(
    {
      // =====================================================
      // 👤 USER
      // =====================================================
      user: {
        type:
          mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },

      // =====================================================
      // 🎉 EVENT
      // =====================================================
      event: {
        type:
          mongoose.Schema.Types.ObjectId,
        ref: "Event",
        required: true,
      },

      // =====================================================
      // 🎓 STUDENT DETAILS
      // =====================================================
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

      // =====================================================
      // 📌 REGISTRATION STATUS
      // =====================================================
      status: {
        type: String,
        enum: [
          "registered",
          "attended",
          "cancelled",
        ],
        default: "registered",
      },

      // =====================================================
      // 🔥 QR SYSTEM
      // =====================================================
      qrCode: {
        type: String,
        default: "",
      },

      qrToken: {
        type: String,
        default: "",
        unique: true,
        sparse: true,
      },

      // =====================================================
      // ✅ ATTENDANCE
      // =====================================================
      attendanceTime: {
        type: Date,
        default: null,
      },

      attendanceMarkedBy: {
        type:
          mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },

      checkInMethod: {
        type: String,
        enum: [
          "manual",
          "qr",
          "",
        ],
        default: "",
      },

      deviceInfo: {
        type: String,
        default: "",
      },

      locationVerified: {
        type: Boolean,
        default: false,
      },

      // =====================================================
      // 🏆 CERTIFICATE
      // =====================================================
      certificateIssued: {
        type: Boolean,
        default: false,
      },

      certificateUrl: {
        type: String,
        default: "",
      },

      certificateIssuedAt: {
        type: Date,
        default: null,
      },

      // =====================================================
      // 📝 NOTES
      // =====================================================
      notes: {
        type: String,
        default: "",
        trim: true,
      },
    },
    {
      timestamps: true,
    }
  );

// =====================================================
// 🔥 INDEXES
// =====================================================

// Prevent duplicate registration per event
eventRegistrationSchema.index(
  {
    user: 1,
    event: 1,
  },
  {
    unique: true,
  }
);

// Event participant analytics
eventRegistrationSchema.index({
  event: 1,
  createdAt: -1,
});

// Event attendance analytics
eventRegistrationSchema.index({
  event: 1,
  status: 1,
});

// =====================================================
// 🚀 SAFE EXPORT
// =====================================================
const EventRegistration =
  mongoose.models.EventRegistration ||
  mongoose.model(
    "EventRegistration",
    eventRegistrationSchema
  );

export default EventRegistration;