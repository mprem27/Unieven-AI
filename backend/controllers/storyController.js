import storyModel from "../models/Story.js";
import storyArchiveModel from "../models/StoryArchive.js";
import followModel from "../models/Follow.js";
import { v2 as cloudinary } from "cloudinary";

// 1. UPLOAD STORY (MULTIPLE FILES + TEXT SUPPORT)
export const uploadStory = async (req, res) => {
  try {
    const {
      type,
      text,
      link,
      tags,
      textColor,
      textFont,
      textStyle,
      textSize,
      textX,
      textY,
      bgGradient,
      filter,
    } = req.body;

    // MULTIPLE FILES SUPPORT
    const files = req.files || (req.file ? [req.file] : []);

    // TEXT-ONLY STORY SUPPORT
    if (files.length === 0 && !text) {
      return res.status(400).json({
        success: false,
        message: "Media or text required",
      });
    }

    const createdStories = [];

    // TEXT-ONLY STORY
    if (files.length === 0 && text) {
      const textStory = await storyModel.create({
        user: req.user.id,
        media: "",
        type: "text",
        text,
        textColor,
        textFont,
        textStyle,
        textSize,
        textX,
        textY,
        bgGradient,
        filter,
        link,
        tags: tags ? JSON.parse(tags || "[]") : [],
      });

      createdStories.push(textStory);
    }

    // MULTIPLE MEDIA STORIES
    for (const file of files) {
      const upload = await cloudinary.uploader.upload(
        file.path,
        {
          resource_type: "auto",
          folder: "unieven_stories",
        }
      );

      const story = await storyModel.create({
        user: req.user.id,
        media: upload.secure_url,
        type:
          file.mimetype?.startsWith("video")
            ? "video"
            : type || "image",

        text: text || "",
        textColor,
        textFont,
        textStyle,
        textSize,
        textX,
        textY,
        bgGradient,
        filter,

        link,
        tags: tags
          ? JSON.parse(tags || "[]")
          : [],
      });

      createdStories.push(story);
    }

    // RESPONSE
    return res.status(201).json({
      success: true,
      message:
        createdStories.length > 1
          ? `${createdStories.length} stories uploaded`
          : "Story uploaded",
      stories: createdStories,
    });

  } catch (error) {
    console.error("Upload Story Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// 2. GET STORIES (FOLLOWERS + SELF)
export const getStories = async (req, res) => {
  try {
    const userId = req.user.id;

    const acceptedFollows =
      await followModel.find({
        from: userId,
        status: "accepted",
      });

    const followingIds =
      acceptedFollows.map((f) =>
        f.to.toString()
      );

    const allowedUsers = [
      ...followingIds,
      userId,
    ];

    const stories = await storyModel
      .find({
        user: { $in: allowedUsers },
        createdAt: {
          $gte: new Date(
            Date.now() -
              24 * 60 * 60 * 1000
          ),
        },
      })
      .populate(
        "user",
        "username image role"
      )
      .populate(
        "tags",
        "username image role"
      )
      .sort({ createdAt: 1 });

    // GROUP STORIES BY USER
    const grouped = {};

    stories.forEach((story) => {
      const uid =
        story.user._id.toString();

      if (!grouped[uid]) {
        grouped[uid] = {
          user: story.user,
          stories: [],
        };
      }

      grouped[uid].stories.push(story);
    });

    let usersArray =
      Object.values(grouped);

    // SELF FIRST
    usersArray.sort((a, b) => {
      if (
        a.user._id.toString() === userId
      )
        return -1;

      if (
        b.user._id.toString() === userId
      )
        return 1;

      return 0;
    });

    return res.json({
      success: true,
      users: usersArray,
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// 3. VIEW STORY
export const viewStory = async (req, res) => {
  try {
    const { storyId } = req.params;
    const userId = req.user?.id;

    const story =
      await storyModel.findById(
        storyId
      );

    if (!story) {
      return res.status(404).json({
        success: false,
        message: "Story not found",
      });
    }

    if (
      userId &&
      !story.views.includes(userId)
    ) {
      story.views.push(userId);
      await story.save();
    }

    return res.json({
      success: true,
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// 4. ARCHIVE STORY
export const archiveStory = async (req, res) => {
  try {
    const { storyId } = req.params;

    const story =
      await storyModel.findById(
        storyId
      );

    if (!story) {
      return res.status(404).json({
        success: false,
        message: "Story not found",
      });
    }

    if (
      story.user.toString() !==
      req.user.id
    ) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized",
      });
    }

    await storyArchiveModel.create({
      user: story.user,
      media: story.media,
      type: story.type,

      text: story.text,
      textColor: story.textColor,
      textFont: story.textFont,
      textStyle: story.textStyle,
      textSize: story.textSize,
      textX: story.textX,
      textY: story.textY,
      bgGradient:
        story.bgGradient,
      filter: story.filter,

      link: story.link,
      tags: story.tags,
      views: story.views,

      originalCreatedAt:
        story.createdAt,

      expiredAt: Date.now(),
    });

    await storyModel.findByIdAndDelete(
      storyId
    );

    return res.json({
      success: true,
      message: "Archived",
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// 5. GET STORY ARCHIVE
export const getStoryArchive = async (
  req,
  res
) => {
  try {
    const archive =
      await storyArchiveModel
        .find({
          user: req.user.id,
        })
        .populate(
          "tags",
          "username image role"
        )
        .sort({
          originalCreatedAt: -1,
        });

    return res.json({
      success: true,
      archive,
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// 6. DELETE STORY
export const deleteStory = async (
  req,
  res
) => {
  try {
    const story =
      await storyModel.findById(
        req.params.id
      );

    if (!story) {
      return res.status(404).json({
        success: false,
        message: "Story not found",
      });
    }

    if (
      story.user.toString() !==
      req.user.id
    ) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized",
      });
    }

    await storyModel.findByIdAndDelete(
      req.params.id
    );

    return res.json({
      success: true,
      message: "Deleted",
      deletedId: req.params.id,
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};