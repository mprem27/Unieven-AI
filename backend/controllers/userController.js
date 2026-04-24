import userModel from "../models/User.js";
import postModel from "../models/Post.js";
import { v2 as cloudinary } from "cloudinary";


// --- 1. GET USER PROFILE ---
export const getUserProfile = async (req, res) => {
  try {
    const { username } = req.params;

    const user = await userModel
      .findOne({ username: username.toLowerCase() })
      .select("-password -resetOTP -otpExpires"); // ✅ includes role automatically

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({ success: true, user });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


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

    // ✅ USERNAME UNIQUE CHECK
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

    // ✅ SAFE FIELD UPDATES
    if (name) user.name = name;
    if (bio !== undefined) user.bio = bio;
    if (gender) user.gender = gender;

    // 🔥 FIX BOOLEAN (IMPORTANT)
    if (isPrivate !== undefined) {
      user.isPrivate =
        isPrivate === "true" || isPrivate === true;
    }

    
 if (imageFile && imageFile.path) {
  try {
    
    const fixedPath = imageFile.path.replace(/\\/g, "/");

    const uploadRes = await cloudinary.uploader.upload(fixedPath);

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

    res.json({
      success: true,
      message: "Profile updated",
      user,
    });

  } catch (error) {
    console.error("UPDATE ERROR:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// --- 3. GET USER POSTS ---
export const getUserPosts = async (req, res) => {
  try {
    const { userId } = req.params;

    const posts = await postModel
      .find({ user: userId })
      .sort({ createdAt: -1 })
      .populate("user", "username image role"); // 🔥 FIX

    res.json({ success: true, posts });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


// --- 4. GET SAVED POSTS ---
export const getSavedPosts = async (req, res) => {
  try {
    const user = await userModel
      .findById(req.user.id)
      .populate({
        path: "savedPosts",
        populate: {
          path: "user",
          select: "username image role", // 🔥 FIX
        },
      });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      savedPosts: user.savedPosts,
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


// --- 5. SEARCH USERS ---
export const searchUsers = async (req, res) => {
  try {
    const { query } = req.query;

    if (!query || query.trim() === "") {
      return res.json({ success: true, users: [] });
    }

    const users = await userModel
      .find({
        $or: [
          { username: { $regex: query, $options: "i" } },
          { name: { $regex: query, $options: "i" } },
        ],
      })
      .select("username name image role") // ✅ already correct
      .limit(10);

    res.json({ success: true, users });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


// --- 6. CHECK USERNAME AVAILABILITY ---
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

    res.json({
      success: true,
      available: !existingUser,
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// 🔥 SUGGEST USERS
export const getSuggestedUsers = async (req, res) => {
  try {
    const currentUserId = req.user.id;

    const users = await userModel
      .find({ _id: { $ne: currentUserId } })
      .select("username image role")
      .limit(10)
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      users,
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};