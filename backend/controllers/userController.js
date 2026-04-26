import userModel from "../models/User.js";
import postModel from "../models/Post.js";
import followModel from "../models/Follow.js";
import { v2 as cloudinary } from "cloudinary";


//  1. GET USER PROFILE (FULLY FIXED)
export const getUserProfile = async (req, res) => {
  try {
    const { username } = req.params;

    //  Find target profile
    const user = await userModel
      .findOne({ username: username.toLowerCase() })
      .select("-password -resetOTP -otpExpires");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    
    //  FOLLOW STATE CHECK (IMPORTANT FIX)
    let isFollowing = false;
    let isRequested = false;

    if (req.user?.id) {
      const followRelation = await followModel.findOne({
        from: req.user.id,
        to: user._id,
      });

      if (followRelation?.status === "accepted") {
        isFollowing = true;
      } else if (followRelation?.status === "requested") {
        isRequested = true;
      }
    }

    //  RESPONSE WITH STATE
    return res.json({
      success: true,
      user: {
        ...user._doc,
        isFollowing,
        isRequested,
      },
    });

  } catch (error) {
    console.error("GET PROFILE ERROR:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// 2. UPDATE USER PROFILE

export const updateUserProfile = async (req, res) => {
  try {
    const { name, bio, gender, username, isPrivate } = req.body;
    const imageFile = req.file;

    const user = await userModel.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    //  USERNAME UNIQUE CHECK
    if (username && username.toLowerCase() !== user.username) {
      const exists = await userModel.findOne({
        username: username.toLowerCase(),
        _id: { $ne: user._id },
      });

      if (exists) {
        return res.status(400).json({
          success: false,
          message: "Username already taken",
        });
      }

      user.username = username.toLowerCase();
    }

    //  SAFE FIELD UPDATES
    if (name) user.name = name;
    if (bio !== undefined) user.bio = bio;
    if (gender) user.gender = gender;

    //  FIX BOOLEAN PRIVATE MODE
    if (isPrivate !== undefined) {
      user.isPrivate =
        isPrivate === true || isPrivate === "true";
    }

    // IMAGE UPLOAD
    if (imageFile && imageFile.path) {
      try {
        const fixedPath = imageFile.path.replace(/\\/g, "/");

        const uploadRes = await cloudinary.uploader.upload(
          fixedPath
        );

        user.image = uploadRes.secure_url;

      } catch (err) {
        console.error("Cloudinary Error:", err);

        return res.status(500).json({
          success: false,
          message: "Image upload failed",
        });
      }
    }

    await user.save();

    return res.json({
      success: true,
      message: "Profile updated",
      user,
    });

  } catch (error) {
    console.error("UPDATE ERROR:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// 3. GET USER POSTS
export const getUserPosts = async (req, res) => {
  try {
    const { userId } = req.params;

    const posts = await postModel
      .find({ user: userId })
      .sort({ createdAt: -1 })
      .populate("user", "username image role");

    return res.json({
      success: true,
      posts,
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

//  4. GET SAVED POSTS

export const getSavedPosts = async (req, res) => {
  try {
    const user = await userModel
      .findById(req.user.id)
      .populate({
        path: "savedPosts",
        populate: {
          path: "user",
          select: "username image role",
        },
      });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.json({
      success: true,
      savedPosts: user.savedPosts,
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


//  5. SEARCH USERS

export const searchUsers = async (req, res) => {
  try {
    const { query } = req.query;

    if (!query || query.trim() === "") {
      return res.json({
        success: true,
        users: [],
      });
    }

    const users = await userModel
      .find({
        $or: [
          { username: { $regex: query, $options: "i" } },
          { name: { $regex: query, $options: "i" } },
        ],
      })
      .select("username name image role")
      .limit(10);

    return res.json({
      success: true,
      users,
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

//  6. CHECK USERNAME AVAILABILITY
export const checkUsernameAvailability = async (req, res) => {
  try {
    const { username } = req.query;

    if (!username || username.trim().length < 3) {
      return res.json({
        success: true,
        available: false,
      });
    }

    const existingUser = await userModel.findOne({
      username: username.toLowerCase(),
    });

    return res.json({
      success: true,
      available: !existingUser,
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

//  7. SUGGEST USERS
export const getSuggestedUsers = async (req, res) => {
  try {
    const currentUserId = req.user.id;

    const users = await userModel
      .find({
        _id: { $ne: currentUserId },
      })
      .select("username image role")
      .limit(10)
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      users,
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};