import reelModel from "../models/Reel.js";
import commentModel from "../models/Comment.js";
import { v2 as cloudinary } from "cloudinary";


// --- 1. CREATE REEL ---
export const createReel = async (req, res) => {
  try {
    const { caption } = req.body;
    const videoFile = req.file;

    if (!videoFile) {
      return res.status(400).json({
        success: false,
        message: "Video is required",
      });
    }

    const upload = await cloudinary.uploader.upload(videoFile.path, {
      resource_type: "video",
      folder: "unieven_reels",
    });

    const reel = await reelModel.create({
      user: req.user.id,
      video: upload.secure_url,
      caption: caption || "",
      views: 0,
    });

    res.status(201).json({
      success: true,
      message: "Reel created",
      reel,
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


// --- 2. GET REELS ---
export const getReels = async (req, res) => {
  try {
    const reels = await reelModel
      .find({})
      .populate("user", "username image role") // ✅ role added
      .populate({
        path: "comments",
        populate: {
          path: "user",
          select: "username image role", // 🔥 FIX
        },
      })
      .sort({ createdAt: -1 });

    res.json({ success: true, reels });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


// --- 3. LIKE / UNLIKE REEL ---
export const likeReel = async (req, res) => {
  try {
    const reel = await reelModel.findById(req.params.id);

    if (!reel) {
      return res.status(404).json({
        success: false,
        message: "Reel not found",
      });
    }

    const isLiked = reel.likes.includes(req.user.id);

    await reel.updateOne({
      [isLiked ? "$pull" : "$push"]: { likes: req.user.id },
    });

    res.json({
      success: true,
      message: isLiked ? "Unliked" : "Liked",
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


// --- 4. ADD COMMENT TO REEL ---
export const addCommentToReel = async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || text.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Comment cannot be empty",
      });
    }

    const reel = await reelModel.findById(req.params.id);
    if (!reel) {
      return res.status(404).json({
        success: false,
        message: "Reel not found",
      });
    }

    const comment = await commentModel.create({
      user: req.user.id,
      reel: reel._id,
      text,
    });

    await reel.updateOne({
      $push: { comments: comment._id },
    });

    // 🔥 RETURN COMMENT WITH USER + ROLE
    const populatedComment = await comment.populate(
      "user",
      "username image role"
    );

    res.json({
      success: true,
      message: "Comment added",
      comment: populatedComment,
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


// --- 5. INCREMENT VIEWS ---
export const incrementViews = async (req, res) => {
  try {
    const reel = await reelModel.findById(req.params.id);

    if (!reel) {
      return res.status(404).json({
        success: false,
        message: "Reel not found",
      });
    }

    if (!reel.viewedBy?.includes(req.user.id)) {
      await reel.updateOne({
        $inc: { views: 1 },
        $push: { viewedBy: req.user.id },
      });
    }

    res.json({
      success: true,
      views: reel.views + 1,
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};