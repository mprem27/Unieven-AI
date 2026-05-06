import express from "express";

// ============================================
// UNIFIED EVENT CONTROLLER
// ============================================
import {
  createEvent,
  getAllEvents,
  getSingleEvent,
  deleteEvent,
  registerForEvent,
  verifyAttendanceQR,
  getEventParticipants,
  getEventAnalytics,
  exportParticipantsCSV,
} from "../controllers/eventController.js";

// ============================================
// MIDDLEWARES
// ============================================
import authMiddleware from "../middlewares/authMiddleware.js";
import optionalAuth from "../middlewares/optionalAuth.js";
import { checkRole } from "../middlewares/roleMiddleware.js";
import { uploadImage } from "../middlewares/uploadMiddleware.js";
import { validateRequest } from "../middlewares/validateMiddleware.js";
import asyncHandler from "../middlewares/asyncHandler.js";

const router = express.Router();

// =====================================================
// 🎉 EVENT CREATION
// =====================================================
router.post(
  "/create",
  authMiddleware,
  checkRole("faculty", "admin"),
  uploadImage.single("image"),
  validateRequest("event"),
  asyncHandler(createEvent)
);

// =====================================================
// 📅 GET ALL EVENTS
// =====================================================
router.get(
  "/",
  optionalAuth,
  asyncHandler(getAllEvents)
);

// =====================================================
// 📷 QR ATTENDANCE VERIFICATION
// =====================================================
router.post(
  "/verify-qr",
  authMiddleware,
  checkRole("faculty", "admin"),
  asyncHandler(verifyAttendanceQR)
);

// =====================================================
// 👥 EVENT PARTICIPANTS
// =====================================================
router.get(
  "/participants/:id", // 🔥 FIXED: Controller expects req.params.id
  authMiddleware,
  checkRole("faculty", "admin"),
  asyncHandler(getEventParticipants)
);

// =====================================================
// 📊 EVENT ANALYTICS
// =====================================================
router.get(
  "/analytics/:id", // 🔥 FIXED: Controller expects req.params.id
  authMiddleware,
  checkRole("faculty", "admin"),
  asyncHandler(getEventAnalytics)
);

// =====================================================
// 📁 EXPORT PARTICIPANTS CSV
// =====================================================
router.get(
  "/export/:id", // 🔥 FIXED: Controller expects req.params.id
  authMiddleware,
  checkRole("faculty", "admin"),
  asyncHandler(exportParticipantsCSV)
);

// =====================================================
// 🎟 REGISTER FOR EVENT
// =====================================================
router.post(
  "/:id/register", // 🔥 FIXED: Controller expects req.params.id to find the event
  authMiddleware,
  validateRequest("eventRegistration"),
  asyncHandler(registerForEvent)
);

// =====================================================
// 🔍 GET SINGLE EVENT
// =====================================================
router.get(
  "/:id",
  optionalAuth,
  asyncHandler(getSingleEvent)
);

// =====================================================
// 🗑 DELETE EVENT
// =====================================================
router.delete(
  "/:id",
  authMiddleware,
  checkRole("faculty", "admin"),
  asyncHandler(deleteEvent)
);

export default router;