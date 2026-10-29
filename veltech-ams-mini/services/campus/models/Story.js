import mongoose from "mongoose";
import {OVERLAY_FONTS,OVERLAY_STYLES,MEDIA_FILTERS,OVERLAY_LIMITS} from "../../../shared/social-overlay.mjs";

const storySchema = new mongoose.Schema(
  {
    hashtags: [{type:String,maxlength:30}],
    mentions: [{type:String,maxlength:30}],
    visibility: {type:String,enum:["account","followers","private"],default:"account"},
    // =====================================================
    // 👤 USER
    // =====================================================
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // =====================================================
    // 📸 MEDIA
    // =====================================================
    media: {
      type: String,
      default: "",
    },

    // =====================================================
    // 📱 STORY TYPE
    // =====================================================
    type: {
      type: String,
      enum: ["image", "video", "text"],
      default: "image",
    },

    // =====================================================
    // 📝 STORY TEXT
    // =====================================================
    text: {
      type: String,
      default: "",
      maxlength: 250,
      trim: true,
    },

    // =====================================================
    // 🎨 TEXT COLOR
    // =====================================================
    textColor: {
      type: String,
      default: "white",
      trim: true,
    },

    // =====================================================
    // 🔤 TEXT FONT
    // =====================================================
    textFont: {
      type: String,
      enum: OVERLAY_FONTS,
      default: "classic",
      trim: true,
    },

    // =====================================================
    // 🎭 TEXT STYLE
    // =====================================================
    textStyle: {
      type: String,
      enum: OVERLAY_STYLES,
      default: "classic",
      trim: true,
    },

    // =====================================================
    // 📏 TEXT SIZE
    // =====================================================
    textSize: {
      type: Number,
      default: 36,
      min: OVERLAY_LIMITS.textSize.min,
      max: OVERLAY_LIMITS.textSize.max,
    },

    // =====================================================
    // 📍 TEXT POSITION
    // =====================================================
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

    // =====================================================
    // 🌈 TEXT STORY BACKGROUND
    // =====================================================
    bgGradient: {
      type: String,
      default: "",
      trim: true,
    },

    // =====================================================
    // 🖼️ IMAGE / VIDEO FILTER
    // =====================================================
    filter: {
      type: String,
      enum: ["",...MEDIA_FILTERS],
      default: "",
      trim: true,
    },

    // =====================================================
    // 🔗 LINK
    // =====================================================
    link: {
      type: String,
      default: "",
      trim: true,
    },

    // =====================================================
    // 👥 TAGGED USERS
    // =====================================================
    tags: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    // =====================================================
    // 👁️ STORY VIEWS
    // =====================================================
    views: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    // =====================================================
    // 💬 COMMENTS
    // =====================================================
    comments: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Comment",
      },
    ],

    // =====================================================
    // ⏰ AUTO EXPIRY
    // =====================================================
    expiresAt: {
      type: Date,
      default: () =>
        new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  },
  {
    timestamps: true,
    autoIndex: false,
  }
);

// =====================================================
// 🔄 NORMALIZE OLD / FRONTEND FONT VALUES
// =====================================================


storySchema.pre("validate", function () {
  const fontMap = {
    "font-sans": "classic",
    "font-mono": "typewriter",
    "font-serif": "cursive",

    // Additional possible old values
    sans: "classic",
    mono: "typewriter",
    serif: "cursive",
  };

  // Convert old frontend value
  if (this.textFont && fontMap[this.textFont]) {
    this.textFont = fontMap[this.textFont];
  }

  // Allowed database values
  const allowedFonts = OVERLAY_FONTS;

  // Fallback for empty/unknown values
  if (!this.textFont || !allowedFonts.includes(this.textFont)) {
    this.textFont = "classic";
  }
});

// =====================================================
// ⏰ TTL INDEX
// =====================================================
// The service archives expired stories before removing them.
// Archive first in the application; a TTL delete would lose the student archive.
storySchema.index({expiresAt:1});

// =====================================================
// ⚡ FAST USER QUERY
// =====================================================
storySchema.index({
  user: 1,
  createdAt: -1,
});

// =====================================================
// 📦 MODEL
// =====================================================
const storyModel =
  mongoose.models.Story ||
  mongoose.model("Story", storySchema);

export default storyModel;