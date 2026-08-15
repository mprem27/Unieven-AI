import mongoose from "mongoose";

const storySchema = new mongoose.Schema(
  {
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
      trim: true,
    },

    // =====================================================
    // 🎭 TEXT STYLE
    // =====================================================
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
      trim: true,
    },

    // =====================================================
    // 📏 TEXT SIZE
    // =====================================================
    textSize: {
      type: Number,
      default: 36,
      min: 16,
      max: 100,
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
  const allowedFonts = [
    "classic",
    "typewriter",
    "modern",
    "impact",
    "cursive",
    "marker",
    "sleek",
  ];

  // Fallback for empty/unknown values
  if (!this.textFont || !allowedFonts.includes(this.textFont)) {
    this.textFont = "classic";
  }
});

// =====================================================
// ⏰ TTL INDEX
// =====================================================
// MongoDB automatically removes expired stories.
storySchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0 }
);

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