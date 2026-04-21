import express from "express";
import {
  createEvent,
  getAllEvents,
  getSingleEvent,
  deleteEvent,
  updateEventStatus,
} from "../controllers/eventController.js";

// Middlewares
import authMiddleware from "../middlewares/authMiddleware.js";
import { checkRole } from "../middlewares/roleMiddleware.js";
import { uploadImage } from "../middlewares/uploadMiddleware.js";
import { validateRequest } from "../middlewares/validateMiddleware.js";
import asyncHandler from "../middlewares/asyncHandler.js";
import optionalAuth from "../middlewares/optionalAuth.js";

const router = express.Router();

/**
 * 🎉 EVENT ROUTES
 */

// -----------------------------
// ➕ CREATE EVENT
// -----------------------------
router.post(
  "/create",
  authMiddleware,
  checkRole("faculty", "admin"),
  uploadImage.single("image"),
  validateRequest("event"),
  asyncHandler(createEvent)
);

// -----------------------------
// 📅 GET ALL EVENTS
// -----------------------------
router.get(
  "/",
  optionalAuth, // 🔥 allow guests
  asyncHandler(getAllEvents)
);

// -----------------------------
// 🔍 SINGLE EVENT
// -----------------------------
router.get(
  "/:id",
  optionalAuth,
  asyncHandler(getSingleEvent)
);

// -----------------------------
// 🎟 JOIN / LEAVE EVENT
// -----------------------------
router.post(
  "/join/:id",
  authMiddleware,
  asyncHandler(updateEventStatus)
);

// -----------------------------
// 🗑 DELETE EVENT
// -----------------------------
router.delete(
  "/:id",
  authMiddleware,
  checkRole("faculty", "admin"),
  asyncHandler(deleteEvent)
);

export default router;