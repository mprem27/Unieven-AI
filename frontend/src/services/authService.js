import API from "../api/axios";

/**
 * 💡 NOTE: 
 * Token management (save/clear) is now handled automatically 
 * by interceptors in axios.js. This service focuses on calling endpoints.
 */

const handleError = (error, fallbackMessage) => {
  const message = error.response?.data?.message || error.message || fallbackMessage;
  console.error("AUTH_SERVICE_ERROR:", message);
  throw { success: false, message };
};

// ======================================================
// 🔐 LOGIN / LOGOUT
// ======================================================

export const login = async (formData) => {
  try {
    const { data } = await API.post("/auth/login", formData);
    // Token is saved in axios.js interceptor or response handler
    return data;
  } catch (error) {
    if (error.response?.status === 401 || error.response?.status === 404) {
      throw { success: false, message: "Invalid email/username or password" };
    }
    handleError(error, "Login failed");
  }
};

export const logout = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("role");
  window.location.href = "/login";
};

// ======================================================
// 📝 REGISTRATION (Node.js Flow)
// ======================================================

export const sendRegisterOtp = async (formData) => {
  try {
    const { data } = await API.post("/auth/send-register-otp", formData);
    return data;
  } catch (error) {
    handleError(error, "Failed to send registration OTP");
  }
};

export const register = async (formData) => {
  try {
    const { data } = await API.post("/auth/register", formData);
    return data;
  } catch (error) {
    handleError(error, "Registration completion failed");
  }
};

// ======================================================
// 🔄 FORGOT PASSWORD (Spring Boot Flow via Node Bridge)
// ======================================================

export const forgotPassword = async (email) => {
  try {
    // Sends request to Node.js -> Node calls Spring Boot
    const { data } = await API.post("/auth/forgot-password", { 
      email: email.trim().toLowerCase() 
    });
    return data;
  } catch (error) {
    handleError(error, "Failed to request reset code");
  }
};

export const verifyOtp = async (email, otp) => {
  try {
    // Node.js -> Spring Boot (Spring updates DB status to "VERIFIED")
    const { data } = await API.post("/auth/verify-otp", {
      email: email.trim().toLowerCase(),
      otp: otp.trim(),
    });
    return data;
  } catch (error) {
    handleError(error, "Invalid or expired OTP code");
  }
};

export const resetPassword = async (email, newPassword) => {
  try {
    // Node.js checks if DB status is "VERIFIED", then hashes new password
    const { data } = await API.post("/auth/reset-password", {
      email: email.trim().toLowerCase(),
      newPassword,
    });
    return data;
  } catch (error) {
    handleError(error, "Failed to update password");
  }
};

// ======================================================
// 👤 USER DATA
// ======================================================

export const getMe = async () => {
  try {
    const { data } = await API.get("/auth/me");
    return data;
  } catch (error) {
    handleError(error, "Failed to fetch user profile");
  }
};