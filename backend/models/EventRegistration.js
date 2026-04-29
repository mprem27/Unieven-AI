import mongoose from "mongoose";

const eventRegistrationSchema =
  new mongoose.Schema(
    {

      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },

      event: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Event",
        required: true,
      },

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


      status: {
        type: String,
        enum: [
          "registered",
          "attended",
          "cancelled",
        ],
        default: "registered",
      },


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

eventRegistrationSchema.index(
  {
    user: 1,
    event: 1,
  },
  {
    unique: true,
  }
);


eventRegistrationSchema.index({
  event: 1,
  createdAt: -1,
});


eventRegistrationSchema.index({
  qrToken: 1,
});


eventRegistrationSchema.index({
  event: 1,
  status: 1,
});


const EventRegistration =
  mongoose.models.EventRegistration ||
  mongoose.model(
    "EventRegistration",
    eventRegistrationSchema
  );

export default EventRegistration;