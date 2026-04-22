import express from "express";
import {
  followUser,
  acceptFollowRequest,
  rejectFollowRequest,
  unfollowUser,
  getFollowers,
  getFollowing,
} from "../controllers/followController.js";

// Middlewares
import authMiddleware from "../middlewares/authMiddleware.js";
import { followLimiter } from "../middlewares/rateLimiter.js";
import asyncHandler from "../middlewares/asyncHandler.js";
import optionalAuth from "../middlewares/optionalAuth.js";

const router = express.Router();

/**
 * 👥 FOLLOW ROUTES
 */

// -----------------------------
// ➕ FOLLOW / REQUEST
// -----------------------------
router.post(
  "/:toUserId",
  authMiddleware,
  followLimiter,
  asyncHandler(followUser)
);

// -----------------------------
// ✅ ACCEPT REQUEST
// -----------------------------
router.post(
  "/accept/:requestId",
  authMiddleware,
  followLimiter,
  asyncHandler(acceptFollowRequest)
);

// -----------------------------
// ❌ REJECT / CANCEL
// -----------------------------
router.post(
  "/reject/:requestId",
  authMiddleware,
  followLimiter,
  asyncHandler(rejectFollowRequest)
);

// -----------------------------
// ➖ UNFOLLOW
// -----------------------------
router.post(
  "/unfollow/:toUserId",
  authMiddleware,
  followLimiter,
  asyncHandler(unfollowUser)
);

// -----------------------------
// 👀 FOLLOWERS
// -----------------------------
router.get(
  "/followers/:userId",
  optionalAuth,
  asyncHandler(getFollowers)
);

// -----------------------------
// 👀 FOLLOWING
// -----------------------------
router.get(
  "/following/:userId",
  optionalAuth,
  asyncHandler(getFollowing)
);

export default router;