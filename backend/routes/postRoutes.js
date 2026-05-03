import express from "express";
import {
  createPost,
  getFeedPosts,
  getSinglePost,
  deletePost,
  likePost,
  addComment,
  deleteComment,
  likeComment,
  savePost,
  unsavePost,
} from "../controllers/postController.js";

// Middlewares
import authMiddleware from "../middlewares/authMiddleware.js";
import { uploadAny } from "../middlewares/uploadMiddleware.js";
import { validateRequest } from "../middlewares/validateMiddleware.js";
import { commentLimiter, postLimiter } from "../middlewares/rateLimiter.js";
import asyncHandler from "../middlewares/asyncHandler.js";
import optionalAuth from "../middlewares/optionalAuth.js";

const router = express.Router();

/**
 * 📸 POST ROUTES (FEED SYSTEM)
 */

// -----------------------------
// ➕ CREATE POST
// -----------------------------
router.post(
  "/create",
  authMiddleware,
  postLimiter,
 uploadAny.fields([
  { name: "media", maxCount: 1 },
  { name: "image", maxCount: 1 },
  { name: "file", maxCount: 1 }
]),
  validateRequest("post"),
  asyncHandler(createPost)
);

// -----------------------------
// 📰 FEED
// -----------------------------
router.get(
  "/feed",
  optionalAuth, // 🔥 allows guest + logged user
  asyncHandler(getFeedPosts)
);

// -----------------------------
// 🔍 SINGLE POST
// -----------------------------
router.get(
  "/:id",
  optionalAuth,
  asyncHandler(getSinglePost)
);

// -----------------------------
// 🗑 DELETE POST
// -----------------------------
router.delete(
  "/:id",
  authMiddleware,
  asyncHandler(deletePost)
);


// =============================
// ❤️ SOCIAL ACTIONS
// =============================

// LIKE / UNLIKE
router.post(
  "/like/:id",
  authMiddleware,
  asyncHandler(likePost)
);

// COMMENT
router.post(
  "/comment/:id",
  authMiddleware,
  commentLimiter,
  validateRequest("comment"),
  asyncHandler(addComment)
);

// DELETE COMMENT
router.delete(
  "/comment/:commentId",
  authMiddleware,
  asyncHandler(deleteComment)
);

router.post(
  "/comment/like/:commentId",
  authMiddleware,
  likeComment
);


// =============================
// 🔖 SAVE SYSTEM
// =============================

// SAVE
router.post(
  "/save/:id",
  authMiddleware,
  asyncHandler(savePost)
);

// UNSAVE
router.delete(
  "/unsave/:id",
  authMiddleware,
  asyncHandler(unsavePost)
);
export default router;