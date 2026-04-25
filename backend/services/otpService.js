import axios from "axios";

const SPRING_URL = "http://localhost:8081/api/auth";

export const sendOtp = async (email) => {
  return axios.post(`${SPRING_URL}/forgot-password`, { email });
};

export const verifyOtp = async (email, otp) => {
  return axios.post(`${SPRING_URL}/verify-otp`, { email, otp });
};