import express from "express";
import {
  registerEvent,
  markAttendance,
  getUserEvents,
  getEventParticipants,
} from "../controllers/eventRegistrationController.js";

// MIDDLEWARES
import authMiddleware from "../middlewares/authMiddleware.js";
import { checkRole } from "../middlewares/roleMiddleware.js";
import asyncHandler from "../middlewares/asyncHandler.js";
import { apiLimiter } from "../middlewares/rateLimiter.js";

const router = express.Router();

/**
 * 🎟 EVENT REGISTRATION ROUTES
 * Base URL → /api/event-registration
 */

// ---------------------------------------------------
// 📝 REGISTER / UNREGISTER EVENT
// ---------------------------------------------------
router.post(
  "/register",
  authMiddleware,
  apiLimiter, // prevent spam clicks
  asyncHandler(registerEvent)
);


// ---------------------------------------------------
// 📅 GET MY REGISTERED EVENTS
// ---------------------------------------------------
router.get(
  "/my-events",
  authMiddleware,
  asyncHandler(getUserEvents)
);


// ---------------------------------------------------
// 👥 GET EVENT PARTICIPANTS (FACULTY / ADMIN)
// ---------------------------------------------------
router.get(
  "/participants/:eventId",
  authMiddleware,
  checkRole("faculty", "admin"),
  asyncHandler(getEventParticipants)
);


// ---------------------------------------------------
// ✅ MARK ATTENDANCE (FACULTY / ADMIN)
// ---------------------------------------------------
router.put(
  "/attendance/:registrationId",
  authMiddleware,
  checkRole("faculty", "admin"),
  asyncHandler(markAttendance)
);


export default router;