import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    // 👤 Receiver
    toUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // 👤 Actor
    fromUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // 🔔 Type
    type: {
      type: String,
      enum: [
        "like",
        "comment",
        "follow",
        "follow_request",
        "event_registration",
      ],
      required: true,
    },

    // 📸 Related Post
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
    },

    // 🎬 Related Reel
    reel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Reel",
    },

    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
    },

    follow: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Follow",
    },

    isRead: {
      type: Boolean,
      default: false,
    },

    message: {
      type: String,
    },
  },
  { timestamps: true }
);

notificationSchema.index({ toUser: 1, createdAt: -1 });

const Notification =
  mongoose.models.Notification ||
  mongoose.model("Notification", notificationSchema);

export default Notification;