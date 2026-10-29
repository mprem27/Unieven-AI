import axios from "axios";
import { sendOTPEmail } from "../utils/sendEmail.js";

// LIVE SPRING BOOT URL (DEPLOYED)
const SPRING_URL = "https://unieven-ai-1.onrender.com/api/auth";

/**
 * BRIDGE: Calls Spring Boot to generate OTP, then sends it via Resend API
 */
export const sendOtp = async (email) => {
  try {
    const cleanEmail = email.trim().toLowerCase();

    // 1. Call Spring Boot to generate the OTP and save it to MongoDB
    // Now Spring returns { success: true, otp: "123456" }
    const response = await axios.post(`${SPRING_URL}/forgot-password`, {
      email: cleanEmail,
    });

    if (response.data.success && response.data.otp) {
      const otp = response.data.otp;

      // 2. Use Node.js to send the email via Resend (HTTP Port 443 - Not Blocked)
      const mailResult = await sendOTPEmail(cleanEmail, otp, "Password Reset");

      if (!mailResult.success) {
        throw new Error("Email delivery failed via API");
      }

      return { 
        success: true, 
        message: "OTP sent successfully to your email" 
      };
    }

    throw new Error("Failed to generate OTP from security service");

  } catch (error) {
    // Extract the specific message from Spring Boot or the Mailer
    const errorMessage = 
      error.response?.data?.message || 
      error.message || 
      "Failed to process OTP request";
      
    console.error(" sendOtp bridge error:", errorMessage);
    throw new Error(errorMessage);
  }
};

/**
 * Calls Spring Boot to verify the OTP.
 * Logic stays in Spring Boot to ensure DB security.
 */
export const verifyOtp = async (email, otp) => {
  try {
    const response = await axios.post(`${SPRING_URL}/verify-otp`, {
      email: email.trim().toLowerCase(),
      otp: otp.trim(),
    });

    // Returns { success: true, message: "OTP verified" }
    return response.data;

  } catch (error) {
    const errorMessage = 
      error.response?.data?.message || 
      "OTP verification failed";

    console.error(" verifyOtp bridge error:", errorMessage);
    throw new Error(errorMessage);
  }
};