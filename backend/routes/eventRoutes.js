import express from "express";

// ============================================
// EVENT CONTROLLERS
// ============================================
import {
  createEvent,
  getAllEvents,
  getSingleEvent,
  deleteEvent,
  registerForEvent,
} from "../controllers/eventController.js";

// ============================================
// EVENT REGISTRATION CONTROLLERS
// ============================================
import {
  registerEvent,
  getUserEvents,
  markAttendance,
  verifyEventQR,
  getEventParticipants,
  getEventAnalytics,
  exportParticipantsCSV,
} from "../controllers/eventRegistrationController.js";

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
// 🔍 GET SINGLE EVENT
// =====================================================
router.get(
  "/:id",
  optionalAuth,
  asyncHandler(getSingleEvent)
);

// =====================================================
// 🎟 REGISTER / UNREGISTER EVENT
// =====================================================
router.post(
  "/register",
  authMiddleware,
  validateRequest("eventRegistration"),
  asyncHandler(registerEvent)
);

// =====================================================
// 👤 USER REGISTERED EVENTS
// =====================================================
router.get(
  "/my-events",
  authMiddleware,
  asyncHandler(getUserEvents)
);

// =====================================================
// 📝 MANUAL ATTENDANCE MARKING (FACULTY)
// =====================================================
router.post(
  "/attendance/:registrationId",
  authMiddleware,
  checkRole("faculty", "admin"),
  asyncHandler(markAttendance)
);

// =====================================================
// 📷 QR ATTENDANCE VERIFICATION
// =====================================================
router.post(
  "/verify-qr",
  authMiddleware,
  checkRole("faculty", "admin"),
  asyncHandler(verifyEventQR)
);

// =====================================================
// 👥 EVENT PARTICIPANTS
// =====================================================
router.get(
  "/participants/:eventId",
  authMiddleware,
  checkRole("faculty", "admin"),
  asyncHandler(getEventParticipants)
);

// =====================================================
// 📊 EVENT ANALYTICS
// =====================================================
router.get(
  "/analytics/:eventId",
  authMiddleware,
  checkRole("faculty", "admin"),
  asyncHandler(getEventAnalytics)
);

// =====================================================
// 📁 EXPORT PARTICIPANTS CSV
// =====================================================
router.get(
  "/export/:eventId",
  authMiddleware,
  checkRole("faculty", "admin"),
  asyncHandler(exportParticipantsCSV)
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