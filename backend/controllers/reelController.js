import reelModel from "../models/Reel.js";
import commentModel from "../models/Comment.js";
import userModel from "../models/User.js";
import cloudinary from "../configs/cloudinary.js";
import fs from "fs";

// =============================
// SAFE FONT/STYLES
// =============================
const allowedFonts = [
  "classic",
  "typewriter",
  "modern",
  "impact",
  "cursive",
  "marker",
  "sleek",
];

const allowedStyles = [
  "classic",
  "highlight",
  "neon",
  "playful",
  "outline",
  "glitch",
  "3d-pop",
  "elegant",
];

// =============================
// CREATE REEL
// =============================
export const createReel = async (req, res) => {
  try {
    const {
      caption,
      overlayText,
      textColor,
      textFont,
      textStyle,
      textSize,
      textX,
      textY,
      filter,
      bgGradient,
      link,
      location,
    } = req.body;

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

    // Remove local temp file
    if (videoFile.path && fs.existsSync(videoFile.path)) {
      fs.unlinkSync(videoFile.path);
    }

    const safeTextX = Math.max(0, Math.min(1, Number(textX) || 0.5));
    const safeTextY = Math.max(0, Math.min(1, Number(textY) || 0.5));
    const safeTextSize = Math.max(
      16,
      Math.min(100, Number(textSize) || 42)
    );

    const safeFont = allowedFonts.includes(textFont)
      ? textFont
      : "classic";

    const safeStyle = allowedStyles.includes(textStyle)
      ? textStyle
      : "classic";

    const reel = await reelModel.create({
      user: req.user.id,
      video: upload.secure_url,
      caption: caption || "",

      // DESIGN SYSTEM
      overlayText: overlayText?.trim() || "",
      textColor: textColor || "white",
      textFont: safeFont,
      textStyle: safeStyle,
      textSize: safeTextSize,
      textX: safeTextX,
      textY: safeTextY,
      filter: filter || "",
      bgGradient: bgGradient || "",

      // OPTIONAL FEATURES
      link: link || "",
      location: location || "",
      thumbnail: upload.secure_url,

      // ENGAGEMENT
      likes: [],
      comments: [],
      views: 0,
      viewedBy: [],
    });

    // Add reel to creator profile
    await userModel.findByIdAndUpdate(req.user.id, {
      $addToSet: {
        reels: reel._id,
      },
    });

    res.status(201).json({
      success: true,
      message: "Reel created successfully",
      reel,
    });
  } catch (error) {
    console.error("createReel error:", error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// =============================
// GET ALL REELS
// =============================
export const getReels = async (req, res) => {
  try {
    const reels = await reelModel
      .find({})
      .populate("user", "username image role")
      .populate({
        path: "comments",
        populate: {
          path: "user",
          select: "username image role",
        },
      })
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      reels,
    });
  } catch (error) {
    console.error("getReels error:", error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// =============================
// LIKE / UNLIKE REEL
// =============================
export const likeReel = async (req, res) => {
  try {
    const reel = await reelModel.findById(req.params.id);

    if (!reel) {
      return res.status(404).json({
        success: false,
        message: "Reel not found",
      });
    }

    const isLiked = reel.likes.some(
      (id) => id.toString() === req.user.id.toString()
    );

    await reel.updateOne({
      [isLiked ? "$pull" : "$push"]: {
        likes: req.user.id,
      },
    });

    res.json({
      success: true,
      message: isLiked ? "Unliked" : "Liked",
    });
  } catch (error) {
    console.error("likeReel error:", error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// =============================
// ADD COMMENT TO REEL
// =============================
export const addCommentToReel = async (req, res) => {
  try {
    const { text } = req.body;

    if (!text?.trim()) {
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
      targetId: reel._id,
      targetType: "reel",
      text: text.trim(),
      likes: [],
    });

    reel.comments.push(comment._id);
    await reel.save();

    const updatedReel = await reelModel
      .findById(req.params.id)
      .populate("user", "username image role")
      .populate({
        path: "comments",
        populate: {
          path: "user",
          select: "username image role",
        },
      });

    res.status(200).json({
      success: true,
      message: "Comment added",
      item: updatedReel,
    });
  } catch (error) {
    console.error("addCommentToReel error:", error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// =============================
// DELETE REEL COMMENT
// =============================
export const deleteReelComment = async (req, res) => {
  try {
    const comment = await commentModel.findById(req.params.commentId);

    if (!comment) {
      return res.status(404).json({
        success: false,
        message: "Comment not found",
      });
    }

    if (comment.user.toString() !== req.user.id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized",
      });
    }

    await reelModel.findByIdAndUpdate(comment.reel, {
      $pull: {
        comments: comment._id,
      },
    });

    await commentModel.findByIdAndDelete(comment._id);

    const updatedReel = await reelModel
      .findById(comment.reel)
      .populate("user", "username image role")
      .populate({
        path: "comments",
        populate: {
          path: "user",
          select: "username image role",
        },
      });

    res.json({
      success: true,
      message: "Comment deleted",
      item: updatedReel,
    });
  } catch (error) {
    console.error("deleteReelComment error:", error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// =============================
// LIKE REEL COMMENT
// =============================
export const likeReelComment = async (req, res) => {
  try {
    const comment = await commentModel.findById(req.params.commentId);

    if (!comment) {
      return res.status(404).json({
        success: false,
        message: "Comment not found",
      });
    }

    const isLiked = comment.likes.some(
      (id) => id.toString() === req.user.id.toString()
    );

    await comment.updateOne({
      [isLiked ? "$pull" : "$push"]: {
        likes: req.user.id,
      },
    });

    const updatedComment = await commentModel.findById(
      req.params.commentId
    );

    res.json({
      success: true,
      likes: updatedComment.likes,
    });
  } catch (error) {
    console.error("likeReelComment error:", error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// =============================
// INCREMENT VIEWS
// =============================
export const incrementViews = async (req, res) => {
  try {
    const reel = await reelModel.findById(req.params.id);

    if (!reel) {
      return res.status(404).json({
        success: false,
        message: "Reel not found",
      });
    }

    if (
      req.user &&
      !reel.viewedBy?.some(
        (id) => id.toString() === req.user.id.toString()
      )
    ) {
      reel.views += 1;
      reel.viewedBy.push(req.user.id);

      await reel.save();
    }

    res.json({
      success: true,
      views: reel.views,
    });
  } catch (error) {
    console.error("incrementViews error:", error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// =============================
// DELETE REEL
// =============================
export const deleteReel = async (req, res) => {
  try {
    const reel = await reelModel.findById(req.params.id);

    if (!reel) {
      return res.status(404).json({
        success: false,
        message: "Reel not found",
      });
    }

    if (reel.user.toString() !== req.user.id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized",
      });
    }

    // =============================
    // CLOUDINARY DELETE
    // =============================
    if (reel.video) {
      try {
        const urlParts = reel.video.split("/");
        const fileName = urlParts[urlParts.length - 1];
        const publicIdWithoutExt = fileName.substring(
          0,
          fileName.lastIndexOf(".")
        );

        const publicId = `unieven_reels/${publicIdWithoutExt}`;

        await cloudinary.uploader.destroy(publicId, {
          resource_type: "video",
        });
      } catch (err) {
        console.log(
          "Cloudinary delete error:",
          err.message
        );
      }
    }

    // =============================
    // DELETE COMMENTS
    // =============================
    await commentModel.deleteMany({
      reel: reel._id,
    });

    // =============================
    // REMOVE REEL REFERENCES
    // =============================
    await userModel.updateMany(
      {},
      {
        $pull: {
          savedPosts: reel._id,
          savedReels: reel._id,
          reels: reel._id,
        },
      }
    );

    // Remove from creator profile
    await userModel.findByIdAndUpdate(
      reel.user,
      {
        $pull: {
          reels: reel._id,
        },
      }
    );

    // =============================
    // DELETE REEL
    // =============================
    await reelModel.findByIdAndDelete(reel._id);

    res.json({
      success: true,
      message: "Reel deleted successfully",
    });
  } catch (error) {
    console.error("deleteReel error:", error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};