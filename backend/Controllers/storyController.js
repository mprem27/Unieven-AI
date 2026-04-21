import storyModel from "../models/Story.js";
import storyArchiveModel from "../models/StoryArchive.js";
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



// --- 2. GET STORIES (GROUPED + ROLE FIX) ---
export const getStories = async (req, res) => {
  try {
    const stories = await storyModel
      .find({})
      .populate("user", "username image role") // ✅ FIX
      .populate("tags", "username image role") // ✅ FIX
      .sort({ createdAt: -1 });

    // 🔥 GROUP BY USER
    const grouped = {};

    stories.forEach((story) => {
      const userId = story.user._id.toString();

      if (!grouped[userId]) {
        grouped[userId] = {
          user: story.user, // already includes role
          stories: [],
        };
      }

      grouped[userId].stories.push(story);
    });

    res.json({
      success: true,
      users: Object.values(grouped),
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
      .populate("tags", "username image role") // ✅ FIX
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