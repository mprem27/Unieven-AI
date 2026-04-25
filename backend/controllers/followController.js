import followModel from "../models/Follow.js";
import userModel from "../models/User.js";
import notificationModel from "../models/Notification.js";

// --- 1. FOLLOW / REQUEST / CANCEL (SMART TOGGLE) ---
export const followUser = async (req, res) => {
  try {
    const fromUserId = req.user.id;
    const { toUserId } = req.params;

    if (fromUserId === toUserId) {
      return res.status(400).json({ success: false, message: "You cannot follow yourself" });
    }

    const targetUser = await userModel.findById(toUserId);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const existing = await followModel.findOne({ from: fromUserId, to: toUserId });

    // 🔥 TOGGLE LOGIC: UNFOLLOW / CANCEL
    if (existing) {
      await followModel.deleteOne({ _id: existing._id });

      if (existing.status === "accepted") {
        await userModel.findByIdAndUpdate(fromUserId, { $pull: { following: toUserId } });
        await userModel.findByIdAndUpdate(toUserId, { $pull: { followers: fromUserId } });
      }

      // Cleanup pending notifications to prevent dead links
      await notificationModel.deleteMany({
        toUser: toUserId,
        fromUser: fromUserId,
        type: { $in: ["follow", "follow_request"] }
      });

      return res.json({ success: true, message: "Unfollowed / Request cancelled" });
    }

    // 🔥 FOLLOW / REQUEST
    const status = targetUser.isPrivate ? "requested" : "accepted";

    await followModel.create({ from: fromUserId, to: toUserId, status });

    if (status === "accepted") {
      await userModel.findByIdAndUpdate(fromUserId, { $addToSet: { following: toUserId } });
      await userModel.findByIdAndUpdate(toUserId, { $addToSet: { followers: fromUserId } });
    }

    // 🔔 Notification
    await notificationModel.create({
      toUser: toUserId,
      fromUser: fromUserId,
      type: status === "requested" ? "follow_request" : "follow",
    });

    res.json({
      success: true,
      status,
      message: status === "requested" ? "Request sent" : "Following",
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// --- 2. ACCEPT FOLLOW REQUEST ---
export const acceptFollowRequest = async (req, res) => {
  try {
    const { requestId } = req.params;

    const followReq = await followModel.findById(requestId);

    if (!followReq || followReq.to.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    followReq.status = "accepted";
    await followReq.save();

    await userModel.findByIdAndUpdate(followReq.from, { $addToSet: { following: followReq.to } });
    await userModel.findByIdAndUpdate(followReq.to, { $addToSet: { followers: followReq.from } });

    // 🔔 Notify the requester that their request was accepted
    await notificationModel.create({
      toUser: followReq.from,
      fromUser: req.user.id,
      type: "request_accepted",
    });

    res.json({ success: true, message: "Request accepted" });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// --- 3. REJECT / CANCEL ---
export const rejectFollowRequest = async (req, res) => {
  try {
    const { requestId } = req.params;

    const followReq = await followModel.findById(requestId);

    if (!followReq || (followReq.to.toString() !== req.user.id && followReq.from.toString() !== req.user.id)) {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    await followModel.findByIdAndDelete(requestId);

    // Cleanup associated notification
    await notificationModel.deleteMany({
      toUser: followReq.to,
      fromUser: followReq.from,
      type: "follow_request"
    });

    res.json({ success: true, message: "Request removed" });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// --- 4. UNFOLLOW (EXPLICIT) ---
export const unfollowUser = async (req, res) => {
  try {
    const fromUserId = req.user.id;
    const { toUserId } = req.params;

    const followReq = await followModel.findOneAndDelete({ from: fromUserId, to: toUserId });

    if (followReq && followReq.status === "accepted") {
      await userModel.findByIdAndUpdate(fromUserId, { $pull: { following: toUserId } });
      await userModel.findByIdAndUpdate(toUserId, { $pull: { followers: fromUserId } });
    }

    // Cleanup associated notifications
    await notificationModel.deleteMany({
      toUser: toUserId,
      fromUser: fromUserId,
      type: { $in: ["follow", "follow_request"] }
    });

    res.json({ success: true, message: "Unfollowed" });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// --- 5. GET FOLLOWERS ---
export const getFollowers = async (req, res) => {
  try {
    const user = await userModel
      .findById(req.params.userId)
      .populate("followers", "username name image role");

    res.json({ success: true, followers: user?.followers || [] });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// --- 6. GET FOLLOWING ---
export const getFollowing = async (req, res) => {
  try {
    const user = await userModel
      .findById(req.params.userId)
      .populate("following", "username name image role");

    res.json({ success: true, following: user?.following || [] });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};