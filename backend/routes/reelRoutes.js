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
import { uploadVideo } from "../middlewares/uploadMiddleware.js";
import {
  commentLimiter,
  postLimiter,
} from "../middlewares/rateLimiter.js";
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


router.delete(
  "/comment/:commentId",
  authMiddleware,
  asyncHandler(deleteReelComment)
);


router.post(
  "/comment/like/:commentId",
  authMiddleware,
  asyncHandler(likeReelComment)
);


router.post(
  "/view/:id",
  optionalAuth,
  asyncHandler(incrementViews)
);

router.delete(
  "/delete/:id",
  authMiddleware,
  asyncHandler(deleteReel)
);

export default router;