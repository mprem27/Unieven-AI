import express from "express";
import {
  uploadImage as uploadImageController,
  uploadVideo as uploadVideoController,
} from "../controllers/uploadController.js";

// Middlewares
import authMiddleware from "../middlewares/authMiddleware.js";
import {
  uploadImage as uploadImageMiddleware,
  uploadVideo as uploadVideoMiddleware,
} from "../middlewares/uploadMiddleware.js";
import asyncHandler from "../middlewares/asyncHandler.js";

const router = express.Router();

/**
 * 📤 UPLOAD ROUTES (OPTIONAL)
 */

// -----------------------------
// 🖼 UPLOAD IMAGE
// -----------------------------
router.post(
  "/image",
  authMiddleware,
  uploadImageMiddleware.single("image"),
  asyncHandler(uploadImageController)
);

// -----------------------------
// 🎬 UPLOAD VIDEO
// -----------------------------
router.post(
  "/video",
  authMiddleware,
  uploadVideoMiddleware.single("video"),
  asyncHandler(uploadVideoController)
);

export default router;