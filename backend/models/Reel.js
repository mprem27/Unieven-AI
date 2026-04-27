import mongoose from "mongoose";

const reelSchema = new mongoose.Schema(
  {
    // =========================
    // USER
    // =========================
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // =========================
    // VIDEO
    // =========================
    video: {
      type: String,
      required: true,
    },

    // =========================
    // BASIC CONTENT
    // =========================
    caption: {
      type: String,
      default: "",
      maxlength: 2200,
    },

    // =========================
    // ADVANCED TEXT OVERLAY SYSTEM
    // =========================
    overlayText: {
      type: String,
      default: "",
      maxlength: 300,
    },

    textColor: {
      type: String,
      default: "white",
    },

    // SAFE FONT STORAGE
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
      default: 42,
      min: 16,
      max: 120,
    },

    // NORMALIZED POSITION
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

    // =========================
    // VISUAL EFFECTS
    // =========================
    filter: {
      type: String,
      default: "",
    },

    bgGradient: {
      type: String,
      default: "",
    },

    // =========================
    // ENGAGEMENT
    // =========================
    likes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    views: {
      type: Number,
      default: 0,
      min: 0,
    },

    viewedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    comments: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Comment",
      },
    ],

    // =========================
    // AUDIO CONTROL
    // =========================
    isMuted: {
      type: Boolean,
      default: false,
    },

    // =========================
    // OPTIONAL FEATURES
    // =========================
    location: {
      type: String,
      default: "",
    },

    tags: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    link: {
      type: String,
      default: "",
    },

    thumbnail: {
      type: String,
      default: "",
    },

    // =========================
    // ARCHIVE / STATUS
    // =========================
    isArchived: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// =========================
// PERFORMANCE INDEXES
// =========================

// Main reel feed
reelSchema.index({
  createdAt: -1,
});

// User profile reels
reelSchema.index({
  user: 1,
  createdAt: -1,
});

// Trending reels
reelSchema.index({
  views: -1,
});

// Popular reels
reelSchema.index({
  likes: -1,
});

// =========================
// SAFE EXPORT
// =========================
const reelModel =
  mongoose.models.Reel ||
  mongoose.model("Reel", reelSchema);

export default reelModel;