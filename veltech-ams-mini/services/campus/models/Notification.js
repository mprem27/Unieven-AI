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
      required: false,
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
        "reply",
        "mention",
        "follow_accepted",
        "event_update",
        "event_reminder",
        "event_attendance",
        "campus_notice",
        "app_feedback_reply",
        "moderation","campus_message","exam_update","placement_update",
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
    title: String,
    link: String,
    category: String,
    comment: mongoose.Schema.Types.ObjectId,
    notice: {type:mongoose.Schema.Types.ObjectId,ref:'CampusNotice'},
    eventKey: String,
    dismissedAt: {type:Date,default:null},
  },
  { timestamps: true }
);

notificationSchema.index({ toUser: 1, createdAt: -1 });
notificationSchema.index({toUser:1,eventKey:1},{unique:true,partialFilterExpression:{eventKey:{$type:'string'}}});

const Notification =
  mongoose.models.Notification ||
  mongoose.model("Notification", notificationSchema);

export default Notification;
