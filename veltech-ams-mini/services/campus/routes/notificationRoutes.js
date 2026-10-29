import express from "express";
import {
  getNotifications,
  markAsRead,
  deleteNotification,
} from "../controllers/notificationController.js";


import authMiddleware from "../middlewares/authMiddleware.js";
import asyncHandler from "../middlewares/asyncHandler.js";
import { apiLimiter } from "../middlewares/rateLimiter.js";

const router = express.Router();


router.get(
  "/",
  authMiddleware,
  apiLimiter,
  asyncHandler(getNotifications)
);

router.post(
  "/read",
  authMiddleware,
  asyncHandler(markAsRead)
);


router.delete(
  "/:id", 
  authMiddleware,
  asyncHandler(deleteNotification)
);

export default router;