import postModel from "../models/Post.js";
import userModel from "../models/User.js";
import commentModel from "../models/Comment.js";
import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

// =============================
// FONT SAFETY MAP
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
// 1. CREATE POST
// =============================
export const createPost = async (req, res) => {
  try {
    const {
      caption,
      isEvent,
      location,
      tags,

      // 🔥 TEXT OVERLAY SYSTEM
      overlayText,
      textColor,
      textFont,
      textStyle,
      textSize,
      textX,
      textY,
      filter,
      bgGradient,
    } = req.body;

    const file =
      req.files?.media?.[0] ||
      req.files?.image?.[0] ||
      req.files?.file?.[0];

    if (!file) {
      return res.status(400).json({
        success: false,
        message: "No media provided",
      });
    }

    let upload;

    try {
      upload = await cloudinary.uploader.upload(file.path, {
        resource_type: "auto",
      });
    } catch (err) {
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }

      return res.status(500).json({
        success: false,
        message: "Media upload failed",
      });
    }

    // Delete local temp file
    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }

    // Parse tags safely
    let parsedTags = [];
    try {
      parsedTags = tags ? JSON.parse(tags) : [];
    } catch {
      parsedTags = [];
    }

    // Detect media type
    const mediaType =
      file.mimetype.startsWith("video/")
        ? "video"
        : "image";

    // Safe normalized values
    const safeTextX = Math.max(
      0,
      Math.min(1, Number(textX) || 0.5)
    );

    const safeTextY = Math.max(
      0,
      Math.min(1, Number(textY) || 0.5)
    );

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

    const newPost = await postModel.create({
      user: req.user.id,

      media: upload.secure_url,
      type: mediaType,

      caption: caption?.trim() || "",
      location: location?.trim() || "",

      tags: parsedTags,

      // 🔥 FULL TEXT OVERLAY DATA
      overlayText: overlayText?.trim() || "",
      textColor: textColor || "white",
      textFont: safeFont,
      textStyle: safeStyle,
      textSize: safeTextSize,
      textX: safeTextX,
      textY: safeTextY,

      filter: filter || "",
      bgGradient: bgGradient || "",

      isEvent:
        isEvent === "true" ||
        isEvent === true,
    });

    res.status(201).json({
      success: true,
      message: "Post created successfully",
      post: newPost,
    });
  } catch (error) {
    console.error(
      "createPost error:",
      error
    );

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// =============================
// 2. GET FEED POSTS
// =============================
export const getFeedPosts = async (req, res) => {
  try {
    const posts = await postModel
      .find({})
      .populate(
        "user",
        "username image role"
      )
      .populate({
        path: "comments",
        populate: {
          path: "user",
          select:
            "username image role",
        },
      })
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      posts,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// =============================
// 3. GET SINGLE POST
// =============================
export const getSinglePost = async (
  req,
  res
) => {
  try {
    const post = await postModel
      .findById(req.params.id)
      .populate(
        "user",
        "username image role"
      )
      .populate({
        path: "comments",
        populate: {
          path: "user",
          select:
            "username image role",
        },
      });

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    // 🔥 VIEW COUNT TRACKING
    if (
      req.user &&
      !post.views.includes(req.user.id)
    ) {
      post.views.push(req.user.id);
      await post.save();
    }

    res.json({
      success: true,
      post,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// =============================
// 4. LIKE POST
// =============================
export const likePost = async (
  req,
  res
) => {
  try {
    const post = await postModel.findById(
      req.params.id
    );

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    const isLiked =
      post.likes.some(
        (id) =>
          id.toString() ===
          req.user.id.toString()
      );

    await post.updateOne({
      [isLiked
        ? "$pull"
        : "$push"]: {
        likes: req.user.id,
      },
    });

    res.json({
      success: true,
      message: isLiked
        ? "Unliked"
        : "Liked",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// =============================
// 5. ADD COMMENT
// =============================
export const addComment = async (
  req,
  res
) => {
  try {
    const { text } = req.body;

    if (!text?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Empty comment",
      });
    }

    const post = await postModel.findById(
      req.params.id
    );

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    const comment =
      await commentModel.create({
        user: req.user.id,
        post: post._id,
        targetId: post._id,
        targetType: "post",
        text: text.trim(),
      });

    post.comments.push(comment._id);
    await post.save();

    const updatedPost =
      await postModel
        .findById(req.params.id)
        .populate(
          "user",
          "username image role"
        )
        .populate({
          path: "comments",
          populate: {
            path: "user",
            select:
              "username image role",
          },
        });

    res.status(200).json({
      success: true,
      message: "Comment added",
      item: updatedPost,
    });
  } catch (error) {
    console.error(
      "addComment error:",
      error
    );

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// =============================
// 6. DELETE COMMENT
// =============================
export const deleteComment = async (
  req,
  res
) => {
  try {
    const comment =
      await commentModel.findById(
        req.params.commentId
      );

    if (!comment) {
      return res.status(404).json({
        success: false,
        message: "Comment not found",
      });
    }

    if (
      comment.user.toString() !==
      req.user.id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized",
      });
    }

    await postModel.findByIdAndUpdate(
      comment.post,
      {
        $pull: {
          comments: comment._id,
        },
      }
    );

    await commentModel.findByIdAndDelete(
      comment._id
    );

    const updatedPost =
      await postModel
        .findById(comment.post)
        .populate(
          "user",
          "username image role"
        )
        .populate({
          path: "comments",
          populate: {
            path: "user",
            select:
              "username image role",
          },
        });

    res.json({
      success: true,
      message:
        "Comment deleted",
      item: updatedPost,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// =============================
// 7. LIKE COMMENT
// =============================
export const likeComment = async (
  req,
  res
) => {
  try {
    const comment =
      await commentModel.findById(
        req.params.commentId
      );

    if (!comment) {
      return res.status(404).json({
        success: false,
        message:
          "Comment not found",
      });
    }

    const isLiked =
      comment.likes.some(
        (id) =>
          id.toString() ===
          req.user.id.toString()
      );

    await comment.updateOne({
      [isLiked
        ? "$pull"
        : "$push"]: {
        likes: req.user.id,
      },
    });

    const updatedComment =
      await commentModel.findById(
        req.params.commentId
      );

    res.json({
      success: true,
      likes:
        updatedComment.likes,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// =============================
// 8. SAVE POST
// =============================
export const savePost = async (
  req,
  res
) => {
  try {
    const user =
      await userModel.findById(
        req.user.id
      );

    if (!user) {
      return res.status(404).json({
        success: false,
        message:
          "User not found",
      });
    }

    const isSaved =
      user.savedPosts.some(
        (id) =>
          id.toString() ===
          req.params.id.toString()
      );

    if (isSaved) {
      return res.status(400).json({
        success: false,
        message:
          "Already saved",
      });
    }

    await userModel.findByIdAndUpdate(
      req.user.id,
      {
        $push: {
          savedPosts:
            req.params.id,
        },
      }
    );

    res.json({
      success: true,
      message:
        "Post saved",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// =============================
// 9. UNSAVE POST
// =============================
export const unsavePost = async (
  req,
  res
) => {
  try {
    await userModel.findByIdAndUpdate(
      req.user.id,
      {
        $pull: {
          savedPosts:
            req.params.id,
        },
      }
    );

    res.json({
      success: true,
      message:
        "Removed from saved",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// =============================
// 10. DELETE POST
// =============================
export const deletePost = async (
  req,
  res
) => {
  try {
    const post =
      await postModel.findById(
        req.params.id
      );

    if (!post) {
      return res.status(404).json({
        success: false,
        message:
          "Post not found",
      });
    }

    if (
      post.user.toString() !==
      req.user.id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Unauthorized",
      });
    }

    // Delete media from Cloudinary
    if (post.media) {
      try {
        const publicId =
          post.media
            .split("/")
            .pop()
            .split(".")[0];

        await cloudinary.uploader.destroy(
          publicId,
          {
            resource_type:
              post.type ===
                "video"
                ? "video"
                : "image",
          }
        );
      } catch (err) {
        console.log(
          "Cloudinary delete error:",
          err.message
        );
      }
    }

    // Delete related comments
    await commentModel.deleteMany({
      post: post._id,
    });

    // Remove from saved posts
    await userModel.updateMany(
      {},
      {
        $pull: {
          savedPosts:
            post._id,
        },
      }
    );

    // Delete post
    await postModel.findByIdAndDelete(
      post._id
    );

    res.json({
      success: true,
      message:
        "Post deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};