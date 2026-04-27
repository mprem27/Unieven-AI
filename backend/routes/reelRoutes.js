import express from "express";
import {
  createReel,
  getReels,
  likeReel,
  addCommentToReel,
  deleteReelComment,
  likeReelComment,
  incrementViews,
  deleteReel,
} from "../controllers/reelController.js";

import authMiddleware from "../middlewares/authMiddleware.js";
import optionalAuth from "../middlewares/optionalAuth.js";
import { uploadVideo } from "../middlewares/uploadMiddleware.js";
import {
  commentLimiter,
  postLimiter,
} from "../middlewares/rateLimiter.js";
import { validateRequest } from "../middlewares/validateMiddleware.js";
import asyncHandler from "../middlewares/asyncHandler.js";

const router = express.Router();

// ============================================
// CREATE REEL
// ============================================
router.post(
  "/create",
  authMiddleware,
  postLimiter,
  uploadVideo.single("video"),
  validateRequest("reel"),
  asyncHandler(createReel)
);

// ============================================
// GET ALL REELS
// ============================================
router.get(
  "/",
  optionalAuth,
  asyncHandler(getReels)
);

// ============================================
// LIKE / UNLIKE REEL
// ============================================
router.post(
  "/like/:id",
  authMiddleware,
  asyncHandler(likeReel)
);

// ============================================
// ADD COMMENT TO REEL
// ============================================
router.post(
  "/comment/:id",
  authMiddleware,
  commentLimiter,
  validateRequest("comment"),
  asyncHandler(addCommentToReel)
);

// ============================================
// DELETE REEL COMMENT
// ============================================
router.delete(
  "/comment/:commentId",
  authMiddleware,
  asyncHandler(deleteReelComment)
);

// ============================================
// LIKE / UNLIKE REEL COMMENT
// ============================================
router.post(
  "/comment/like/:commentId",
  authMiddleware,
  asyncHandler(likeReelComment)
);

// ============================================
// INCREMENT REEL VIEW COUNT
// ============================================
router.post(
  "/view/:id",
  optionalAuth,
  asyncHandler(incrementViews)
);

// ============================================
// DELETE REEL (🔥 FIXED ROUTE)
// ============================================
router.delete(
  "/:id",
  authMiddleware,
  asyncHandler(deleteReel)
);

export default router;