import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    // =====================================================
    // 👤 BASIC USER INFO
    // =====================================================
    username: {
      type: String,
      required: true,
      unique: true,
      sparse: true, // Prevent null duplicate crash
      trim: true,
      lowercase: true,
      minlength: 3,
      maxlength: 30,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },

    password: {
      type: String,
      required: true,
    },

    name: {
      type: String,
      default: "",
      trim: true,
    },

    bio: {
      type: String,
      default: "",
      maxlength: 300,
    },

    image: {
      type: String,
      default: "",
    },

    gender: {
      type: String,
      default: "Prefer not to say",
    },

    dob: {
      type: Date,
      default: null,
    },

    role: {
      type: String,
      enum: [
        "student",
        "faculty",
        "admin",
      ],
      default: "student",
    },

    // =====================================================
    // 🔐 OTP SYSTEM
    // =====================================================
    registerOTP: {
      type: String,
      default: null,
    },

    resetOTP: {
      type: String,
      default: null,
    },

    otpExpires: {
      type: Date,
      default: null,
    },

    // =====================================================
    // ⚙️ ACCOUNT SETTINGS
    // =====================================================
    isPrivate: {
      type: Boolean,
      default: false,
    },

    isVerified: {
      type: Boolean,
      default: false,
    },

    // =====================================================
    // 👥 SOCIAL CONNECTIONS
    // =====================================================
    followers: [
      {
        type:
          mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    following: [
      {
        type:
          mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    followRequests: [
      {
        type:
          mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    // =====================================================
    // 📌 SAVED CONTENT
    // =====================================================
    savedPosts: [
      {
        type:
          mongoose.Schema.Types.ObjectId,
        ref: "Post",
      },
    ],

    savedReels: [
      {
        type:
          mongoose.Schema.Types.ObjectId,
        ref: "Reel",
      },
    ],

    // =====================================================
    // 🎓 CAMPUS DETAILS
    // =====================================================
    studentId: {
      type: String,
      default: "",
      trim: true,
    },

    department: {
      type: String,
      default: "",
      trim: true,
    },

    phone: {
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
// 🚀 SAFE EXPORT
// =====================================================
const userModel =
  mongoose.models.User ||
  mongoose.model(
    "User",
    userSchema
  );

export default userModel;