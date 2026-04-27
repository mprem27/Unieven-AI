import postModel from "../models/Post.js";
import userModel from "../models/User.js";
import commentModel from "../models/Comment.js";
import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

// --- 1. CREATE POST ---
export const createPost = async (req, res) => {
  try {
    const {
      caption,
      isEvent,
      location,
      tags,
      overlayText,
      overlayFont,
    } = req.body;

    const file = req.file;

    if (!file) {
      return res.status(400).json({
        success: false,
        message: "No media provided",
      });
    }

    let upload;

    try {
      upload = await cloudinary.uploader.upload(file.path, {
        resource_type: "image",
      });
    } catch (err) {
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);

      return res.status(500).json({
        success: false,
        message: "Image upload failed",
      });
    }

    // delete local file
    if (fs.existsSync(file.path)) fs.unlinkSync(file.path);

    // parse tags
    let parsedTags = [];
    try {
      parsedTags = tags ? JSON.parse(tags) : [];
    } catch {
      parsedTags = [];
    }

    const newPost = await postModel.create({
      user: req.user.id,
      media: upload.secure_url,
      type: "image",
      caption: caption?.trim() || "",
      location: location?.trim() || "",
      tags: parsedTags,
      overlayText: overlayText?.trim() || "",
      overlayFont: overlayFont || "font-sans",
      isEvent: isEvent === "true" || isEvent === true,
    });

    res.status(201).json({
      success: true,
      message: "Post created",
      post: newPost,
    });

  } catch (error) {
    console.log("createPost error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// --- 2. GET FEED POSTS ---
export const getFeedPosts = async (req, res) => {
  try {
    const posts = await postModel
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

    res.json({ success: true, posts });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// --- 3. GET SINGLE POST ---
export const getSinglePost = async (req, res) => {
  try {
    const post = await postModel
      .findById(req.params.id)
      .populate("user", "username image role")
      .populate({
        path: "comments",
        populate: {
          path: "user",
          select: "username image role",
        },
      });

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    res.json({ success: true, post });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// --- 4. LIKE ---
export const likePost = async (req, res) => {
  try {
    const post = await postModel.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    const isLiked = post.likes.some(
      (id) => id.toString() === req.user.id.toString()
    );

    await post.updateOne({
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

// --- 5. ADD COMMENT ---
export const addComment = async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || text.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Empty comment",
      });
    }

    const post = await postModel.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    const comment = await commentModel.create({
      user: req.user.id,
      post: post._id,
      targetId: post._id,
      targetType: "post",
      text: text.trim(),
    });

    post.comments.push(comment._id);
    await post.save();

    const updatedPost = await postModel
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
      item: updatedPost,
    });

  } catch (error) {
    console.error("addComment error:", error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// --- 6. DELETE COMMENT ---
export const deleteComment = async (req, res) => {
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

    await postModel.findByIdAndUpdate(comment.post, {
      $pull: { comments: comment._id },
    });

    await commentModel.findByIdAndDelete(comment._id);

    const updatedPost = await postModel
      .findById(comment.post)
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
      item: updatedPost,
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


// like comment

export const likeComment = async (req, res) => {
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
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
// saved post 

export const savePost = async (req, res) => {
  try {
    const user = await userModel.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const isSaved = user.savedPosts.some(
      (id) => id.toString() === req.params.id.toString()
    );

    if (isSaved) {
      return res.status(400).json({
        success: false,
        message: "Already saved",
      });
    }

    await userModel.findByIdAndUpdate(req.user.id, {
      $push: { savedPosts: req.params.id },
    });

    res.json({
      success: true,
      message: "Post saved",
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
// --- 8. UNSAVE ---
export const unsavePost = async (req, res) => {
  try {
    await userModel.findByIdAndUpdate(req.user.id, {
      $pull: { savedPosts: req.params.id },
    });

    res.json({ success: true, message: "Removed from saved" });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// --- 9. DELETE POST (🔥 UPDATED)
export const deletePost = async (req, res) => {
  try {
    const post = await postModel.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    if (post.user.toString() !== req.user.id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized",
      });
    }

    // 🔥 DELETE IMAGE FROM CLOUDINARY
    if (post.media) {
      try {
        const publicId = post.media.split("/").pop().split(".")[0];
        await cloudinary.uploader.destroy(publicId);
      } catch (err) {
        console.log("Cloudinary delete error:", err.message);
      }
    }

    // DELETE COMMENTS
    await commentModel.deleteMany({ post: post._id });

    // DELETE POST
    await postModel.findByIdAndDelete(post._id);

    res.json({
      success: true,
      message: "Post deleted successfully",
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};