import axios from "axios";

// LIVE SPRING BOOT URL (DEPLOYED)
const SPRING_URL = "https://unieven-ai-1.onrender.com/api/auth";

/**
 * Calls Spring Boot to generate and send a reset OTP via email
 */
export const sendOtp = async (email) => {
  try {
    const response = await axios.post(`${SPRING_URL}/forgot-password`, {
      email: email.trim().toLowerCase(),
    });

    // Returns { success: true, message: "..." }
    return response.data;

  } catch (error) {
    // Extract the specific message from Spring Boot's ResponseEntity
    const errorMessage = 
      error.response?.data?.message || 
      "Failed to connect to the OTP service";
      
    console.error("sendOtp error:", errorMessage);
    
    throw new Error(errorMessage);
  }
};

/**
 * Calls Spring Boot to verify the OTP.
 * If correct, Spring Boot updates the user's resetOTP field to "VERIFIED"
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
    // Extract the specific message (e.g., "Invalid OTP" or "OTP expired")
    const errorMessage = 
      error.response?.data?.message || 
      "OTP verification failed";

    console.error("verifyOtp error:", errorMessage);
    
    throw new Error(errorMessage);
  }
};