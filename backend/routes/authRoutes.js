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

router.post(
  "/login",
  authLimiter,
  validateRequest("auth"),
  asyncHandler(loginUser)
);

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


router.get(
  "/me",
  authMiddleware,
  asyncHandler(getCurrentUser)
);

export default router;