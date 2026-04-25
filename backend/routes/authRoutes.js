import express from "express";
import {
  registerUser,
  loginUser,
  sendRegisterOTP,
  resetPassword,
  getCurrentUser,

  // ✅ NEW
  forgotPassword,
  verifyOtpController,

} from "../controllers/authController.js";

// Middlewares
import authMiddleware from "../middlewares/authMiddleware.js";
import { authLimiter } from "../middlewares/rateLimiter.js";
import { validateRequest } from "../middlewares/validateMiddleware.js";

const router = express.Router();

//  SEND OTP FOR REGISTER
router.post(
  "/send-register-otp",
  authLimiter,
  validateRequest("email"),
  sendRegisterOTP
);

//  REGISTER
router.post(
  "/register",
  authLimiter,
  validateRequest("register"),
  registerUser
);

//  LOGIN
router.post(
  "/login",
  authLimiter,
  validateRequest("auth"),
  loginUser
);

//  FORGOT PASSWORD 
router.post(
  "/forgot-password",
  authLimiter,
  validateRequest("email"),
  forgotPassword
);
// VERIFY OTP 
router.post(
  "/verify-otp",
  authLimiter,
  validateRequest("email"),
  verifyOtpController
);

// RESET PASSWORD
router.post(
  "/reset-password",
  validateRequest("email"),
  resetPassword
);
//  CURRENT USER
router.get(
  "/me",
  authMiddleware,
  getCurrentUser
);

export default router;