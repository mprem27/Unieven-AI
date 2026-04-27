
import mongoose from "mongoose";

const storySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // MEDIA OPTIONAL FOR TEXT STORIES
    media: {
      type: String,
      default: "",
    },

    // SUPPORT IMAGE + VIDEO + TEXT STORIES
    type: {
      type: String,
      enum: ["image", "video", "text"],
      default: "image",
    },

    // STORY TEXT CONTENT
    text: {
      type: String,
      default: "",
      maxlength: 250,
    },

    // SAFE STYLE SYSTEM
    textColor: {
      type: String,
      default: "white",
    },

    // STORE FONT KEY ONLY (NOT RAW TAILWIND CLASSES)
    textFont: {
      type: String,
      enum: [
        "classic",
        "typewriter",
        "modern",
        "impact",
        "cursive",
        "marker",
        "sleek",
      ],
      default: "classic",
    },

    textStyle: {
      type: String,
      enum: [
        "classic",
        "highlight",
        "neon",
        "playful",
        "outline",
        "glitch",
        "3d-pop",
        "elegant",
      ],
      default: "classic",
    },

    textSize: {
      type: Number,
      default: 36,
      min: 16,
      max: 100,
    },

    // NORMALIZED POSITION (0 to 1)
    textX: {
      type: Number,
      default: 0.5,
      min: 0,
      max: 1,
    },

    textY: {
      type: Number,
      default: 0.5,
      min: 0,
      max: 1,
    },

    // TEXT STORY BACKGROUND
    bgGradient: {
      type: String,
      default: "",
    },

    // IMAGE/VIDEO FILTER
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

    // COMMENTS SUPPORT
    comments: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Comment",
      },
    ],

    // AUTO EXPIRE AFTER 24H
    expiresAt: {
      type: Date,
      default: () =>
        new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  },
  {
    timestamps: true,
  }
);

// TTL INDEX
storySchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0 }
);

// FAST USER QUERY
storySchema.index({ user: 1, createdAt: -1 });

const storyModel =
  mongoose.models.Story ||
  mongoose.model("Story", storySchema);

export default storyModel;