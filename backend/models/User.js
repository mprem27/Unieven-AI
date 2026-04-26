import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      sparse: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
    },

    password: {
      type: String,
      required: true,
    },

    name: String,
    bio: {
      type: String,
      default: "",
    },

    image: {
      type: String,
      default: "",
    },

    gender: {
      type: String,
      default: "Prefer not to say",
    },

    role: {
      type: String,
      enum: ["student", "faculty", "admin"],
      default: "student",
    },

  
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

    
    isPrivate: {
      type: Boolean,
      default: false,
    },

  
    followers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    following: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

  
    followRequests: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    savedPosts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Post",
      },
    ],
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("User", userSchema);