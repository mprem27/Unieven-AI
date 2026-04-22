import mongoose from "mongoose";

const reelSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    video: {
      type: String,
      required: true,
    },

    caption: {
      type: String,
      default: "",
    },

    likes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    views: {
      type: Number,
      default: 0,
    },

    viewedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    // 🔥 LINK COMMENTS
    comments: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Comment",
      },
    ],

    isMuted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

reelSchema.index({ createdAt: -1 });

const reelModel =
  mongoose.models.Reel || mongoose.model("Reel", reelSchema);

export default reelModel;