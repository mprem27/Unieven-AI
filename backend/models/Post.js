import mongoose from "mongoose";

const postSchema = new mongoose.Schema(
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
    // MEDIA
    // =========================
    media: {
      type: String,
      required: true,
    },

    type: {
      type: String,
      enum: ["image", "video"],
      default: "image",
    },

    // =========================
    // BASIC CONTENT
    // =========================
    caption: {
      type: String,
      default: "",
      maxlength: 2200,
    },

    location: {
      type: String,
      default: "",
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

    // SAFE FONT KEY STORAGE
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

    // FILTERS
    filter: {
      type: String,
      default: "",
    },

    bgGradient: {
      type: String,
      default: "",
    },

    // =========================
    // TAGGING SYSTEM
    // =========================
    tags: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    // =========================
    // ENGAGEMENT
    // =========================
    likes: [
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

    views: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    // =========================
    // EVENT SYSTEM
    // =========================
    isEvent: {
      type: Boolean,
      default: false,
    },

    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      default: null,
    },

    // =========================
    // OPTIONAL LINK SUPPORT
    // =========================
    link: {
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

// Feed sorting
postSchema.index({ createdAt: -1 });

// User profile fast fetch
postSchema.index({
  user: 1,
  createdAt: -1,
});

// Event posts
postSchema.index({
  isEvent: 1,
  createdAt: -1,
});

// Popular content
postSchema.index({
  likes: -1,
});

// =========================
// SAFE MODEL EXPORT
// =========================
const postModel =
  mongoose.models.Post ||
  mongoose.model("Post", postSchema);

export default postModel;