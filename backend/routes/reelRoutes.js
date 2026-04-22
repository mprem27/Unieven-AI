import express from "express";
import {
  createReel,
  getReels,
  likeReel,
  addCommentToReel,
  incrementViews,
} from "../controllers/reelController.js";

// Middlewares
import authMiddleware from "../middlewares/authMiddleware.js";
import { uploadVideo } from "../middlewares/uploadMiddleware.js";
import { commentLimiter, postLimiter } from "../middlewares/rateLimiter.js";
import { validateRequest } from "../middlewares/validateMiddleware.js";
import asyncHandler from "../middlewares/asyncHandler.js";
import optionalAuth from "../middlewares/optionalAuth.js";

const router = express.Router();


router.post(
  "/create",
  authMiddleware,
  postLimiter,
  uploadVideo.single("video"),
  validateRequest("reel"),
  asyncHandler(createReel)
);


router.get(
  "/",
  optionalAuth, 
  asyncHandler(getReels)
);

router.post(
  "/like/:id",
  authMiddleware,
  asyncHandler(likeReel)
);


router.post(
  "/comment/:id",
  authMiddleware,
  commentLimiter,
  validateRequest("comment"),
  asyncHandler(addCommentToReel)
);

router.post(
  "/view/:id",
  optionalAuth, 
  asyncHandler(incrementViews)
);

export default router;