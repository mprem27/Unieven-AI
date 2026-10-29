
import mongoose from "mongoose";
import {OVERLAY_FONTS,OVERLAY_STYLES,MEDIA_FILTERS,OVERLAY_LIMITS} from "../../../shared/social-overlay.mjs";

const storyArchiveSchema = new mongoose.Schema(
  {
    originalStory: {type:mongoose.Schema.Types.ObjectId,ref:"Story"},
    hashtags: [{type:String,maxlength:30}],
    mentions: [{type:String,maxlength:30}],
    visibility: {type:String,enum:["account","followers","private"],default:"account"},
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
      default: 36,
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

    bgGradient: {
      type: String,
      default: "",
    },

    filter: {
      type: String,
      enum: ["",...MEDIA_FILTERS],
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

storyArchiveSchema.index({originalStory:1},{unique:true,sparse:true});

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