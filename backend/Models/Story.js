import mongoose from "mongoose";

const storySchema = new mongoose.Schema(
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

    text: String,
    link: String,

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

    // 🔥 ADD COMMENTS HERE
    comments: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Comment",
      },
    ],

    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  },
  { timestamps: true }
);

// TTL auto delete after 24h
storySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const storyModel =
  mongoose.models.Story || mongoose.model("Story", storySchema);

export default storyModel;