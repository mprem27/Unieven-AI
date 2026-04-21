import mongoose from "mongoose";

const storyArchiveSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    media: {
      type: String,
      required: true,
    },

    type: {
      type: String,
      enum: ["image", "video"],
      default: "image",
    },

    // 🔥 ADD THESE (IMPORTANT)
    text: {
      type: String,
      default: "",
    },

    link: {
      type: String,
      default: "",
    },

    tags: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    views: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    originalCreatedAt: {
      type: Date,
    },

    expiredAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// 🔥 INDEX FOR FAST QUERY
storyArchiveSchema.index({ originalCreatedAt: -1 });

const StoryArchive =
  mongoose.models.StoryArchive ||
  mongoose.model("StoryArchive", storyArchiveSchema);

export default StoryArchive;