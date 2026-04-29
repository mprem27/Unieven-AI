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
//  REGISTER / UNREGISTER EVENT
// =====================================================
router.post(
  "/register",
  authMiddleware,
  apiLimiter,
  validateRequest("eventRegistration"),
  asyncHandler(registerEvent)
);

// =====================================================
//  GET USER REGISTERED EVENTS
// =====================================================
router.get(
  "/my-events",
  authMiddleware,
  asyncHandler(getUserEvents)
);

// =====================================================
//  GET EVENT PARTICIPANTS
// =====================================================
router.get(
  "/participants/:eventId",
  authMiddleware,
  checkRole("faculty", "admin"),
  asyncHandler(getEventParticipants)
);

// =====================================================
//  MANUAL ATTENDANCE MARKING
// =====================================================
router.put(
  "/attendance/:registrationId",
  authMiddleware,
  checkRole("faculty", "admin"),
  asyncHandler(markAttendance)
);

// =====================================================
//  VERIFY QR CODE ATTENDANCE
// =====================================================
router.post(
  "/verify-qr",
  authMiddleware,
  checkRole("faculty", "admin"),
  asyncHandler(verifyEventQR)
);

// =====================================================
//  EVENT ANALYTICS
// =====================================================
router.get(
  "/analytics/:eventId",
  authMiddleware,
  checkRole("faculty", "admin"),
  asyncHandler(getEventAnalytics)
);

// =====================================================
//  EXPORT PARTICIPANTS CSV
// =====================================================
router.get(
  "/export/:eventId",
  authMiddleware,
  checkRole("faculty", "admin"),
  asyncHandler(exportParticipantsCSV)
);

export default router;