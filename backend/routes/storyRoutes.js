import express from "express";
import {
  uploadStory,
  getStories,
  viewStory,
  archiveStory,
  getStoryArchive,
  deleteStory,
} from "../controllers/storyController.js";

// Middlewares
import authMiddleware from "../middlewares/authMiddleware.js";
import { uploadAny } from "../middlewares/uploadMiddleware.js";
import { validateRequest } from "../middlewares/validateMiddleware.js";
import asyncHandler from "../middlewares/asyncHandler.js";
import optionalAuth from "../middlewares/optionalAuth.js";

const router = express.Router();

/**
 * 🧠 STORY ROUTES
 */

// -----------------------------
// ➕ UPLOAD STORY
// -----------------------------
router.post(
  "/upload",
  authMiddleware,
  uploadAny.single("media"),
  validateRequest("story"),
  asyncHandler(uploadStory)
);

// -----------------------------
// 📺 GET STORIES
// -----------------------------
router.get(
  "/",
  optionalAuth, // 🔥 allows viewing (can be private logic inside controller)
  asyncHandler(getStories)
);

// -----------------------------
// 👁 VIEW STORY
// -----------------------------
router.post(
  "/view/:storyId",
  authMiddleware,
  asyncHandler(viewStory)
);

// -----------------------------
// 📦 ARCHIVE STORY
// -----------------------------
router.post(
  "/archive/:storyId",
  authMiddleware,
  asyncHandler(archiveStory)
);

// -----------------------------
// 📚 GET ARCHIVE
// -----------------------------
router.get(
  "/archive",
  authMiddleware,
  asyncHandler(getStoryArchive)
);

// -----------------------------
// 🗑 DELETE STORY
// -----------------------------
router.delete(
  "/:id",
  authMiddleware,
  asyncHandler(deleteStory)
);

export default router;