import reelModel from "../models/Reel.js";
import commentModel from "../models/Comment.js";
import { v2 as cloudinary } from "cloudinary";

//////////////////////////////////////////////////////
// CREATE REEL
//////////////////////////////////////////////////////
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

    const upload = await cloudinary.uploader.upload(
      videoFile.path,
      {
        resource_type: "video",
        folder: "unieven_reels",
      }
    );

    const reel = await reelModel.create({
      user: req.user.id,
      video: upload.secure_url,
      caption: caption || "",
      views: 0,
      comments: [],
      likes: [],
    });

    res.status(201).json({
      success: true,
      message: "Reel created",
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

//////////////////////////////////////////////////////
// GET ALL REELS
//////////////////////////////////////////////////////
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

//////////////////////////////////////////////////////
// LIKE / UNLIKE REEL
//////////////////////////////////////////////////////
export const likeReel = async (req, res) => {
  try {
    const reel = await reelModel.findById(
      req.params.id
    );

    if (!reel) {
      return res.status(404).json({
        success: false,
        message: "Reel not found",
      });
    }

    const isLiked =
      reel.likes.some(
        (id) =>
          id.toString() ===
          req.user.id.toString()
      );

    await reel.updateOne({
      [isLiked ? "$pull" : "$push"]: {
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
    console.error("likeReel error:", error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

//////////////////////////////////////////////////////
// ADD COMMENT TO REEL
//////////////////////////////////////////////////////
export const addCommentToReel = async (
  req,
  res
) => {
  try {
    const { text } = req.body;

    if (!text || text.trim() === "") {
      return res.status(400).json({
        success: false,
        message:
          "Comment cannot be empty",
      });
    }

    const reel = await reelModel.findById(
      req.params.id
    );

    if (!reel) {
      return res.status(404).json({
        success: false,
        message: "Reel not found",
      });
    }

    const comment =
      await commentModel.create({
        user: req.user.id,
        reel: reel._id,
        targetId: reel._id,
        targetType: "reel",
        text: text.trim(),
        likes: [],
      });

    reel.comments.push(comment._id);

    await reel.save();

    const updatedReel =
      await reelModel
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
      item: updatedReel,
    });

  } catch (error) {
    console.error(
      "addCommentToReel error:",
      error
    );

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

//////////////////////////////////////////////////////
// DELETE REEL COMMENT
//////////////////////////////////////////////////////
export const deleteReelComment = async (
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

    if (
      comment.user.toString() !==
      req.user.id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Unauthorized",
      });
    }

    await reelModel.findByIdAndUpdate(
      comment.reel,
      {
        $pull: {
          comments:
            comment._id,
        },
      }
    );

    await commentModel.findByIdAndDelete(
      comment._id
    );

    const updatedReel =
      await reelModel
        .findById(comment.reel)
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
      item: updatedReel,
    });

  } catch (error) {
    console.error(
      "deleteReelComment error:",
      error
    );

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

//////////////////////////////////////////////////////
// LIKE / UNLIKE REEL COMMENT
//////////////////////////////////////////////////////
export const likeReelComment = async (
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
      [isLiked ? "$pull" : "$push"]: {
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
    console.error(
      "likeReelComment error:",
      error
    );

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

//////////////////////////////////////////////////////
// INCREMENT REEL VIEWS
//////////////////////////////////////////////////////
export const incrementViews = async (
  req,
  res
) => {
  try {
    const reel =
      await reelModel.findById(
        req.params.id
      );

    if (!reel) {
      return res.status(404).json({
        success: false,
        message: "Reel not found",
      });
    }

    if (
      req.user &&
      !reel.viewedBy?.includes(
        req.user.id
      )
    ) {
      await reel.updateOne({
        $inc: {
          views: 1,
        },
        $push: {
          viewedBy:
            req.user.id,
        },
      });
    }

    res.json({
      success: true,
      views:
        reel.views + 1,
    });

  } catch (error) {
    console.error(
      "incrementViews error:",
      error
    );

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

//////////////////////////////////////////////////////
// DELETE REEL
//////////////////////////////////////////////////////
export const deleteReel = async (
  req,
  res
) => {
  try {
    const reel =
      await reelModel.findById(
        req.params.id
      );

    if (!reel) {
      return res.status(404).json({
        success: false,
        message: "Reel not found",
      });
    }

    if (
      reel.user.toString() !==
      req.user.id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Unauthorized",
      });
    }

    if (reel.video) {
      try {
        const publicId =
          reel.video
            .split("/")
            .pop()
            .split(".")[0];

        await cloudinary.uploader.destroy(
          `unieven_reels/${publicId}`,
          {
            resource_type:
              "video",
          }
        );

      } catch (err) {
        console.log(
          "Cloudinary delete error:",
          err.message
        );
      }
    }

    await commentModel.deleteMany({
      reel: reel._id,
    });

    await reelModel.findByIdAndDelete(
      reel._id
    );

    res.json({
      success: true,
      message:
        "Reel deleted successfully",
    });

  } catch (error) {
    console.error(
      "deleteReel error:",
      error
    );

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};