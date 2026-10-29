import mongoose from "mongoose";
import {OVERLAY_FONTS,OVERLAY_STYLES,MEDIA_FILTERS,OVERLAY_LIMITS} from "../../../shared/social-overlay.mjs";

const reelSchema = new mongoose.Schema(
  {
    hashtags: [{type:String,maxlength:30}],
    mentions: [{type:String,maxlength:30}],
    visibility: {type:String,enum:["account","followers","private"],default:"account"},
    eventId: {type:mongoose.Schema.Types.ObjectId,ref:"Event",default:null},
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
      enum: OVERLAY_FONTS,
      default: "classic",
    },

    textStyle: {
      type: String,
      enum: OVERLAY_STYLES,
      default: "classic",
    },

    textSize: {
      type: Number,
      default: 42,
      min: OVERLAY_LIMITS.textSize.min,
      max: OVERLAY_LIMITS.textSize.max,
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
      enum: ["",...MEDIA_FILTERS],
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
    moderationLocked: {type:Boolean,default:false},
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
