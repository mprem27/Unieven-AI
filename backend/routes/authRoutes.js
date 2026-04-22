import express from "express";
import {
  registerUser,
  loginUser,
  sendRegisterOTP,
  sendResetOTP,
  resetPassword,
  getCurrentUser,
} from "../controllers/authController.js";

// Middlewares
import authMiddleware from "../middlewares/authMiddleware.js";
import { authLimiter } from "../middlewares/rateLimiter.js";
import { validateRequest } from "../middlewares/validateMiddleware.js";

const router = express.Router();

/**
 * 🔐 AUTH ROUTES
 */

// -----------------------------
// 🧑 SEND OTP FOR REGISTER
// -----------------------------
router.post(
  "/send-register-otp",
  authLimiter,
  validateRequest("email"), // ✅ correct
  sendRegisterOTP
);

// -----------------------------
// 🧑 REGISTER
// -----------------------------
router.post(
  "/register",
  authLimiter,
  validateRequest("register"),
  registerUser
);

// -----------------------------
// 🔐 LOGIN
// -----------------------------
router.post(
  "/login",
  authLimiter,
  validateRequest("auth"),
  loginUser
);

// -----------------------------
// 🔑 SEND OTP (FOR PASSWORD RESET)
// -----------------------------
router.post(
  "/send-otp",
  authLimiter,
  validateRequest("email"), // ✅ correct
  sendResetOTP
);

// -----------------------------
// 🔄 RESET PASSWORD
// -----------------------------
// 🔥 FIX: don't use "auth" here (it expects identity)
// use custom validation or skip
router.post(
  "/reset-password",
  validateRequest("email"), // ✅ FIXED (was wrong before)
  resetPassword
);

// -----------------------------
// 👤 CURRENT USER
// -----------------------------
router.get(
  "/me",
  authMiddleware,
  getCurrentUser
);

export default router;