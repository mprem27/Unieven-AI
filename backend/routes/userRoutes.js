import express from "express";

import {
  getUserProfile,
  updateUserProfile,
  getUserPosts,
  getSavedPosts,
  searchUsers,
  checkUsernameAvailability,
  getSuggestedUsers,
} from "../controllers/userController.js";

// =====================================================
// MIDDLEWARES
// =====================================================
import authMiddleware from "../middlewares/authMiddleware.js";
import optionalAuth from "../middlewares/optionalAuth.js";
import { uploadImage } from "../middlewares/uploadMiddleware.js";
import asyncHandler from "../middlewares/asyncHandler.js";

const router = express.Router();

// =====================================================
//  SEARCH USERS
// =====================================================
router.get(
  "/search",
  asyncHandler(searchUsers)
);

// =====================================================
//  GET USER PROFILE
// =====================================================
router.get(
  "/profile/:username",
  optionalAuth,
  asyncHandler(getUserProfile)
);

// =====================================================
// GET USER PROFILE CONTENT
// POSTS + REELS + EVENTS
// =====================================================
router.get(
  "/profile-content/:userId",
  optionalAuth,
  asyncHandler(getUserPosts)
);

// =====================================================
//  LEGACY POSTS ROUTE (KEEP FOR BACKWARD SUPPORT)
// =====================================================
router.get(
  "/posts/:userId",
  optionalAuth,
  asyncHandler(getUserPosts)
);

// =====================================================
//  SUGGESTED USERS
// =====================================================
router.get(
  "/suggested",
  authMiddleware,
  asyncHandler(getSuggestedUsers)
);

// =====================================================
//  UPDATE USER PROFILE
// =====================================================
router.put(
  "/update",
  authMiddleware,
  uploadImage.single("image"),
  (req, res, next) => {
    console.log(
      "FILE:",
      req.file
    );

    console.log(
      "BODY:",
      req.body
    );

    next();
  },
  asyncHandler(updateUserProfile)
);

// =====================================================
//  CHECK USERNAME AVAILABILITY
// =====================================================
router.get(
  "/check-username",
  asyncHandler(
    checkUsernameAvailability
  )
);

// =====================================================
//  SAVED POSTS + REELS
// =====================================================
router.get(
  "/saved",
  authMiddleware,
  asyncHandler(getSavedPosts)
);

export default router;