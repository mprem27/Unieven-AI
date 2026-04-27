
import mongoose from "mongoose";

const storyArchiveSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // MEDIA OPTIONAL
    media: {
      type: String,
      default: "",
    },

    // SUPPORT FULL STORY TYPES
    type: {
      type: String,
      enum: ["image", "video", "text"],
      default: "image",
    },

    // STORY TEXT
    text: {
      type: String,
      default: "",
      maxlength: 250,
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
      default: 36,
      min: 16,
      max: 100,
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

    comments: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Comment",
      },
    ],

    // ORIGINAL STORY CREATED TIME
    originalCreatedAt: {
      type: Date,
      required: true,
    },

    // WHEN ARCHIVED
    expiredAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// FAST ARCHIVE QUERY
storyArchiveSchema.index({
  user: 1,
  originalCreatedAt: -1,
});

// BACKUP GLOBAL INDEX
storyArchiveSchema.index({
  originalCreatedAt: -1,
});

const StoryArchive =
  mongoose.models.StoryArchive ||
  mongoose.model(
    "StoryArchive",
    storyArchiveSchema
  );

export default StoryArchive;