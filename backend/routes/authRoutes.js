import express from "express";

import {
  registerUser,
  loginUser,
  sendRegisterOTP,
  resetPassword,
  getCurrentUser,
  forgotPassword,
  verifyOtpController,
} from "../controllers/authController.js";

import authMiddleware from "../middlewares/authMiddleware.js";
import { authLimiter } from "../middlewares/rateLimiter.js";
import { validateRequest } from "../middlewares/validateMiddleware.js";
import asyncHandler from "../middlewares/asyncHandler.js";

const router = express.Router();

// ======================================================
// 📝 REGISTRATION (Handled by Node.js)
// ======================================================
router.post(
  "/send-register-otp",
  authLimiter,
  validateRequest("sendRegisterOtp"),
  asyncHandler(sendRegisterOTP)
);

router.post(
  "/register",
  authLimiter,
  validateRequest("register"),
  asyncHandler(registerUser)
);

// ======================================================
// 🔑 LOGIN
// ======================================================
router.post(
  "/login",
  authLimiter,
  validateRequest("auth"),
  asyncHandler(loginUser)
);

// ======================================================
// 🔄 FORGOT PASSWORD (Bridged to Spring Boot)
// ======================================================
router.post(
  "/forgot-password",
  authLimiter,
  validateRequest("email"),
  asyncHandler(forgotPassword)
);

router.post(
  "/verify-otp",
  authLimiter,
  validateRequest("verifyOtp"),
  asyncHandler(verifyOtpController)
);

router.post(
  "/reset-password",
  authLimiter,
  validateRequest("resetPassword"),
  asyncHandler(resetPassword)
);

// ======================================================
// 👤 USER SESSION
// ======================================================
router.get(
  "/me",
  authMiddleware,
  asyncHandler(getCurrentUser)
);

export default router;