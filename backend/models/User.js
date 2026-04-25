import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      sparse: true,   // 🔥 FIX (prevents null duplicate error)
    },

    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },

    name: String,
    bio: String,
    image: String,
    gender: String,

    role: {
      type: String,
      enum: ["student", "faculty", "admin"],
      default: "student",
    },

    registerOTP: { type: String, default: null }, // 🔥 ADD THIS
    resetOTP: { type: String, default: null },
    otpExpires: { type: Date, default: null },

    isPrivate: { type: Boolean, default: false },

    followers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    following: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    savedPosts: [{ type: mongoose.Schema.Types.ObjectId, ref: "Post" }],
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);