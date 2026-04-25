import storyModel from "../models/Story.js";
import storyArchiveModel from "../models/StoryArchive.js";
import followModel from "../models/Follow.js"; // ✅ ADDED: Required to fetch followers
import { v2 as cloudinary } from "cloudinary";

// --- 1. UPLOAD STORY ---
export const uploadStory = async (req, res) => {
  try {
    const { type, text, link, tags } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({
        success: false,
        message: "Media required",
      });
    }

    const upload = await cloudinary.uploader.upload(file.path, {
      resource_type: "auto",
      folder: "unieven_stories",
    });

    const story = await storyModel.create({
      user: req.user.id,
      media: upload.secure_url,
      type: type || "image",
      text,
      link,
      tags: tags ? JSON.parse(tags || "[]") : [],
    });

    res.status(201).json({
      success: true,
      message: "Story uploaded",
      story,
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


// --- 2. GET STORIES (FOLLOWERS ONLY + SELF FIRST) ---
export const getStories = async (req, res) => {
  try {
    const userId = req.user.id;

    // 🔥 Get accepted follows to only show stories of people the user follows
    const acceptedFollows = await followModel.find({
      from: userId,
      status: "accepted",
    });

    const followingIds = acceptedFollows.map(f => f.to.toString());

    // ✅ Include self in the allowed users array
    const allowedUsers = [...followingIds, userId];

    // 🔥 Fetch stories from the last 24 hours strictly for allowed users
    const stories = await storyModel
      .find({
        user: { $in: allowedUsers },
        createdAt: {
          $gte: new Date(Date.now() - 24 * 60 * 60 * 1000), 
        },
      })
      .populate("user", "username image role") 
      .populate("tags", "username image role") 
      .sort({ createdAt: 1 }); // ✅ FIX: Oldest → newest for correct story playback

    // 🔥 GROUP BY USER
    const grouped = {};

    stories.forEach((story) => {
      const uid = story.user._id.toString();

      if (!grouped[uid]) {
        grouped[uid] = {
          user: story.user, 
          stories: [],
        };
      }

      grouped[uid].stories.push(story);
    });

    let usersArray = Object.values(grouped);

    // 🔥 Sort to ensure the current logged-in user is ALWAYS first in the row
    usersArray.sort((a, b) => {
      if (a.user._id.toString() === userId) return -1;
      if (b.user._id.toString() === userId) return 1;
      return 0;
    });

    res.json({
      success: true,
      users: usersArray,
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


// --- 3. VIEW STORY ---
export const viewStory = async (req, res) => {
  try {
    const { storyId } = req.params;
    const userId = req.user?.id;

    const story = await storyModel.findById(storyId);

    if (!story) {
      return res.status(404).json({
        success: false,
        message: "Story not found",
      });
    }

    if (userId && !story.views.includes(userId)) {
      story.views.push(userId);
      await story.save();
    }

    res.json({ success: true });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


// --- 4. ARCHIVE STORY ---
export const archiveStory = async (req, res) => {
  try {
    const { storyId } = req.params;

    const story = await storyModel.findById(storyId);

    if (!story) {
      return res.status(404).json({
        success: false,
        message: "Story not found",
      });
    }

    if (story.user.toString() !== req.user.id) {
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
      link: story.link,
      tags: story.tags,
      views: story.views,
      originalCreatedAt: story.createdAt,
      expiredAt: Date.now(),
    });

    await storyModel.findByIdAndDelete(storyId);

    res.json({
      success: true,
      message: "Archived",
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


// --- 5. GET ARCHIVE ---
export const getStoryArchive = async (req, res) => {
  try {
    const archive = await storyArchiveModel
      .find({ user: req.user.id })
      .populate("tags", "username image role") 
      .sort({ originalCreatedAt: -1 });

    res.json({ success: true, archive });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


// --- 6. DELETE STORY ---
export const deleteStory = async (req, res) => {
  try {
    const story = await storyModel.findById(req.params.id);

    if (!story) {
      return res.status(404).json({
        success: false,
        message: "Story not found",
      });
    }

    if (story.user.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized",
      });
    }

    await storyModel.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: "Deleted",
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};