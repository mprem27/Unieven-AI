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


import authMiddleware from "../middlewares/authMiddleware.js";
import { uploadImage } from "../middlewares/uploadMiddleware.js";
import asyncHandler from "../middlewares/asyncHandler.js";

const router = express.Router();


router.get("/search", asyncHandler(searchUsers));


router.get("/profile/:username", asyncHandler(getUserProfile));

router.get("/posts/:userId", asyncHandler(getUserPosts));
router.get("/suggested", authMiddleware, getSuggestedUsers);

router.put(
  "/update",
  authMiddleware,
  uploadImage.single("image"),
  asyncHandler(updateUserProfile)
);

router.get(
  "/check-username",
  asyncHandler(checkUsernameAvailability)
);

router.get(
  "/saved",
  authMiddleware,
  asyncHandler(getSavedPosts)
);

export default router;