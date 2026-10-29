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
import multerErrorHandler from "../middlewares/multerErrorHandler.js"; // ✅ FIXED

const router = express.Router();

// =============================
// 📝 CREATE POST
// =============================
router.post(
  "/create",
  authMiddleware,
  postLimiter,

  uploadAny.fields([
    { name: "media", maxCount: 1 },
    { name: "image", maxCount: 1 },
    { name: "file", maxCount: 1 },
  ]),

  multerErrorHandler, // ✅ important

  validateRequest("post"),
  asyncHandler(createPost)
);

// =============================
// 📰 FEED
// =============================
router.get(
  "/feed",
  optionalAuth,
  asyncHandler(getFeedPosts)
);

// =============================
// 🔍 SINGLE POST
// =============================
router.get(
  "/:id",
  optionalAuth,
  asyncHandler(getSinglePost)
);

// =============================
// 🗑 DELETE POST
// =============================
router.delete(
  "/:id",
  authMiddleware,
  asyncHandler(deletePost)
);

// =============================
// ❤️ LIKE POST
// =============================
router.post(
  "/like/:id",
  authMiddleware,
  asyncHandler(likePost)
);

// =============================
// 💬 COMMENT
// =============================
router.post(
  "/comment/:id",
  authMiddleware,
  commentLimiter,
  validateRequest("comment"),
  asyncHandler(addComment)
);

// =============================
// ❌ DELETE COMMENT
// =============================
router.delete(
  "/comment/:commentId",
  authMiddleware,
  asyncHandler(deleteComment)
);

// =============================
// ❤️ LIKE COMMENT
// =============================
router.post(
  "/comment/like/:commentId",
  authMiddleware,
  asyncHandler(likeComment)
);

// =============================
// 🔖 SAVE POST
// =============================
router.post(
  "/save/:id",
  authMiddleware,
  asyncHandler(savePost)
);

// =============================
// 🔓 UNSAVE POST
// =============================
router.delete(
  "/unsave/:id",
  authMiddleware,
  asyncHandler(unsavePost)
);

export default router;