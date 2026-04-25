import axios from "axios";

//  LIVE SPRING BOOT URL (DEPLOYED)
const SPRING_URL = "https://unieven-ai-1.onrender.com/api/auth";

//  SEND OTP
export const sendOtp = async (email) => {
  try {
    const response = await axios.post(`${SPRING_URL}/forgot-password`, {
      email,
    });

    return response.data;

  } catch (error) {
    console.error(" sendOtp error:", error?.response?.data || error);
    throw error.response?.data || { message: "Failed to send OTP" };
  }
};

//  VERIFY OTP
export const verifyOtp = async (email, otp) => {
  try {
    const response = await axios.post(`${SPRING_URL}/verify-otp`, {
      email,
      otp,
    });

    return response.data;

  } catch (error) {
    console.error(" verifyOtp error:", error?.response?.data || error);
    throw error.response?.data || { message: "OTP verification failed" };
  }
};