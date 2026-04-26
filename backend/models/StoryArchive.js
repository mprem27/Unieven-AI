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
      default: "", // Removed required:true to support text-only stories
    },

    type: {
      type: String,
      enum: ["image", "video", "text"], // Added "text" to support text stories
      default: "image",
    },

    // STORY EDITOR FIELDS (Keeps text in the exact position with correct styles)
    text: {
      type: String,
      default: "",
    },
    textColor: {
      type: String,
      default: "white",
    },
    textFont: {
      type: String,
      default: "font-sans",
    },
    textStyle: {
      type: String,
      default: "classic",
    },
    textSize: {
      type: Number,
      default: 36,
    },
    textX: {
      type: Number,
      default: 0,
    },
    textY: {
      type: Number,
      default: 0,
    },
    bgGradient: {
      type: String,
      default: "", 
    },
    filter: {
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