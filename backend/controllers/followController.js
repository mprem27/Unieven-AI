import followModel from "../models/Follow.js";
import userModel from "../models/User.js";
import notificationModel from "../models/Notification.js";


//  FOLLOW / REQUEST / UNFOLLOW SMART TOGGLE

export const followUser = async (req, res) => {
  try {
    const fromUserId = req.user.id;
    const { toUserId } = req.params;

    if (fromUserId === toUserId) {
      return res.status(400).json({
        success: false,
        message: "You cannot follow yourself",
      });
    }

    const targetUser = await userModel.findById(toUserId);

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const existingFollow = await followModel.findOne({
      from: fromUserId,
      to: toUserId,
    });

    
    //  IF ALREADY EXISTS → UNFOLLOW / CANCEL REQUEST
    
    if (existingFollow) {
      await followModel.deleteOne({ _id: existingFollow._id });

      if (existingFollow.status === "accepted") {
        await userModel.findByIdAndUpdate(fromUserId, {
          $pull: { following: toUserId },
        });

        await userModel.findByIdAndUpdate(toUserId, {
          $pull: { followers: fromUserId },
        });
      }

      await notificationModel.deleteMany({
        toUser: toUserId,
        fromUser: fromUserId,
        type: { $in: ["follow", "follow_request"] },
      });

      return res.json({
        success: true,
        status: "follow",
        message: "Unfollowed / Request cancelled",
      });
    }

    
    //  NEW FOLLOW / REQUEST
    
    const status = targetUser.isPrivate
      ? "requested"
      : "accepted";

    await followModel.create({
      from: fromUserId,
      to: toUserId,
      status,
    });

    if (status === "accepted") {
      await userModel.findByIdAndUpdate(fromUserId, {
        $addToSet: { following: toUserId },
      });

      await userModel.findByIdAndUpdate(toUserId, {
        $addToSet: { followers: fromUserId },
      });
    }

    await notificationModel.create({
      toUser: toUserId,
      fromUser: fromUserId,
      type:
        status === "requested"
          ? "follow_request"
          : "follow",
    });

    return res.json({
      success: true,
      status,
      message:
        status === "requested"
          ? "Follow request sent"
          : "Connected successfully",
    });

  } catch (error) {
    console.error("Follow Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


//  EXPLICIT UNFOLLOW SUPPORT (FOR ROUTES)

export const unfollowUser = async (req, res) => {
  try {
    const fromUserId = req.user.id;
    const { toUserId } = req.params;

    const existingFollow = await followModel.findOne({
      from: fromUserId,
      to: toUserId,
    });

    if (!existingFollow) {
      return res.status(404).json({
        success: false,
        message: "Follow relationship not found",
      });
    }

    await followModel.deleteOne({
      _id: existingFollow._id,
    });

    if (existingFollow.status === "accepted") {
      await userModel.findByIdAndUpdate(fromUserId, {
        $pull: { following: toUserId },
      });

      await userModel.findByIdAndUpdate(toUserId, {
        $pull: { followers: fromUserId },
      });
    }

    await notificationModel.deleteMany({
      toUser: toUserId,
      fromUser: fromUserId,
      type: { $in: ["follow", "follow_request"] },
    });

    return res.json({
      success: true,
      status: "follow",
      message: "Unfollowed successfully",
    });

  } catch (error) {
    console.error("Unfollow Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

//  ACCEPT FOLLOW REQUEST

export const acceptFollowRequest = async (req, res) => {
  try {
    const { requestId } = req.params;

    const followReq = await followModel.findById(
      requestId
    );

    if (
      !followReq ||
      followReq.to.toString() !== req.user.id
    ) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized",
      });
    }

    followReq.status = "accepted";
    await followReq.save();

    await userModel.findByIdAndUpdate(followReq.from, {
      $addToSet: { following: followReq.to },
    });

    await userModel.findByIdAndUpdate(followReq.to, {
      $addToSet: { followers: followReq.from },
    });

    await notificationModel.create({
      toUser: followReq.from,
      fromUser: req.user.id,
      type: "request_accepted",
    });

    return res.json({
      success: true,
      message: "Request accepted",
    });

  } catch (error) {
    console.error("Accept Request Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


// REJECT FOLLOW REQUEST

export const rejectFollowRequest = async (req, res) => {
  try {
    const { requestId } = req.params;

    const followReq = await followModel.findById(
      requestId
    );

    if (
      !followReq ||
      (followReq.to.toString() !== req.user.id &&
        followReq.from.toString() !== req.user.id)
    ) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized",
      });
    }

    await followModel.findByIdAndDelete(requestId);

    await notificationModel.deleteMany({
      toUser: followReq.to,
      fromUser: followReq.from,
      type: "follow_request",
    });

    return res.json({
      success: true,
      message: "Request removed",
    });

  } catch (error) {
    console.error("Reject Request Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


//  GET FOLLOWERS

export const getFollowers = async (req, res) => {
  try {
    const user = await userModel.findById(
      req.params.userId
    ).populate(
      "followers",
      "username name image role"
    );

    return res.json({
      success: true,
      followers: user?.followers || [],
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

//  GET FOLLOWING
export const getFollowing = async (req, res) => {
  try {
    const user = await userModel.findById(
      req.params.userId
    ).populate(
      "following",
      "username name image role"
    );

    return res.json({
      success: true,
      following: user?.following || [],
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};