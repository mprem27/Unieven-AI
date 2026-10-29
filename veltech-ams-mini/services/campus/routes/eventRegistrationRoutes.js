import express from "express";

import {
  registerEvent,
  markAttendance,
  getUserEvents,
  getEventParticipants,
  verifyEventQR,
  getEventAnalytics,
  exportParticipantsCSV,
} from "../controllers/eventRegistrationController.js";

// ============================================
// MIDDLEWARES
// ============================================
import authMiddleware from "../middlewares/authMiddleware.js";
import { checkRole } from "../middlewares/roleMiddleware.js";
import asyncHandler from "../middlewares/asyncHandler.js";
import { apiLimiter } from "../middlewares/rateLimiter.js";
import { validateRequest } from "../middlewares/validateMiddleware.js";

const router = express.Router();

/**
 * 🎟 EVENT REGISTRATION ROUTES
 * BASE URL → /api/event-registration
 */

// =====================================================
// 📝 REGISTER / UNREGISTER EVENT
// =====================================================
router.post(
  "/register",
  authMiddleware,
  apiLimiter,
  validateRequest("eventRegistration"), // ⚠️ Make sure to add the new fields (email, degree, etc.) to this validation schema!
  asyncHandler(registerEvent)
);

// =====================================================
// 📅 GET USER REGISTERED EVENTS
// =====================================================
router.get(
  "/my-events",
  authMiddleware,
  asyncHandler(getUserEvents)
);

// =====================================================
// 👥 GET EVENT PARTICIPANTS
// =====================================================
// Removed checkRole so Student Organizers can view participants of their own events.
// The controller handles the specific authorization check.
router.get(
  "/participants/:eventId",
  authMiddleware,
  asyncHandler(getEventParticipants)
);

// =====================================================
// ✅ MANUAL ATTENDANCE MARKING
// =====================================================
// Removed checkRole so Student Organizers can mark attendance for their events.
router.put(
  "/attendance/:registrationId",
  authMiddleware,
  asyncHandler(markAttendance)
);

// =====================================================
// 📱 VERIFY QR CODE ATTENDANCE
// =====================================================
// Removed checkRole so Student Organizers can scan QR codes at their events.
router.post(
  "/verify-qr",
  authMiddleware,
  asyncHandler(verifyEventQR)
);

// =====================================================
// 📊 EVENT ANALYTICS
// =====================================================
// Removed checkRole so Student Organizers can view their event stats.
router.get(
  "/analytics/:eventId",
  authMiddleware,
  asyncHandler(getEventAnalytics)
);

// =====================================================
// 📥 EXPORT PARTICIPANTS CSV
// =====================================================
// Removed checkRole so Student Organizers can download their attendee list.
router.get(
  "/export/:eventId",
  authMiddleware,
  asyncHandler(exportParticipantsCSV)
);

export default router;