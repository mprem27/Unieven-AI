import notificationModel from "../models/Notification.js";
import followModel from "../models/Follow.js";


// --- HELPER: MESSAGE GENERATOR ---
const generateMessage = (type, username) => {
  const map = {
    like: `${username} liked your post`,
    comment: `${username} commented on your post`,
    follow: `${username} started following you`,
    follow_request: `${username} requested to follow you`,
    event_registration: `${username} registered for your event`,
  };
  return map[type] || "New notification";
};



// --- 1. GET NOTIFICATIONS ---
export const getNotifications = async (req, res) => {
  try {
    const userId = req.user.id;

    const notifications = await notificationModel
      .find({ toUser: userId })
      .populate("fromUser", "username image name role")
      .populate("post", "media type caption")
      .sort({ createdAt: -1 })
      .limit(50);

    // 🔥 Optimize follow request lookup (single query)
    const followRequests = await followModel.find({
      to: userId,
      status: "requested",
    });

    const requestMap = {};
    followRequests.forEach((req) => {
      requestMap[req.from.toString()] = req._id;
    });

    const enriched = notifications.map((notif) => {
      let followRequestData = null;

      if (notif.type === "follow_request") {
        const requestId = requestMap[notif.fromUser?._id?.toString()];

        followRequestData = requestId
          ? { requestId, status: "pending" }
          : { status: "processed" };
      }

      return {
        ...notif._doc,
        message: generateMessage(notif.type, notif.fromUser?.username),
        followRequestData,
      };
    });

    res.json({ success: true, notifications: enriched });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};



// --- 2. MARK AS READ ---
export const markAsRead = async (req, res) => {
  try {
    await notificationModel.updateMany(
      { toUser: req.user.id, isRead: false },
      { $set: { isRead: true } }
    );

    res.json({
      success: true,
      message: "Notifications marked as read",
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};



// --- 3. DELETE NOTIFICATION ---
export const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;

    const notification = await notificationModel.findById(id);

    if (!notification || notification.toUser.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized",
      });
    }

    await notificationModel.findByIdAndDelete(id);

    res.json({
      success: true,
      message: "Notification deleted",
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};