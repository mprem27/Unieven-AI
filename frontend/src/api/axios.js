import axios from "axios";

const API = axios.create({
  baseURL:
    import.meta.env.VITE_API_URL ||
    "https://unieven-ai.onrender.com/api", // Node.js Server URL
  timeout: 30000, // Increased timeout for cross-server calls
  headers: {
    "Content-Type": "application/json",
  },
});

// Helper to manage tokens
const saveToken = (token) => {
  if (token) localStorage.setItem("token", token);
};

const clearToken = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("role");
};

const getToken = () => localStorage.getItem("token");

// Request Interceptor: Attach JWT to every request
API.interceptors.request.use(
  (config) => {
    const token = getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Handle Global Errors (like 401 Unauthorized)
API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      clearToken();
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

/**
 * Enhanced error handler to extract messages from the backend
 */
const handleError = (error, fallbackMessage) => {
  const message =
    error.response?.data?.message || 
    error.message || 
    fallbackMessage;

  console.error("🌐 API ERROR:", message);

  throw {
    success: false,
    message: message,
  };
};

// ======================================================
// 🔐 AUTH API CALLS
// ======================================================

export const login = async (formData) => {
  try {
    const { data } = await API.post("/auth/login", formData);
    saveToken(data?.token);
    return data;
  } catch (error) {
    handleError(error, "Login failed");
  }
};

export const sendRegisterOtp = async (formData) => {
  try {
    const { data } = await API.post("/auth/send-register-otp", formData);
    return data;
  } catch (error) {
    handleError(error, "Registration OTP failed");
  }
};

export const register = async (formData) => {
  try {
    const { data } = await API.post("/auth/register", formData);
    saveToken(data?.token);
    return data;
  } catch (error) {
    handleError(error, "Registration failed");
  }
};

export const getMe = async () => {
  try {
    const { data } = await API.get("/auth/me");
    return data;
  } catch (error) {
    handleError(error, "Session expired");
  }
};

// ======================================================
// 🔄 FORGOT PASSWORD API CALLS (Bridged to Spring Boot)
// ======================================================

export const forgotPassword = async (email) => {
  try {
    const { data } = await API.post("/auth/forgot-password", {
      email: email.trim().toLowerCase(),
    });
    return data;
  } catch (error) {
    handleError(error, "Failed to send reset OTP");
  }
};

export const verifyOtp = async (email, otp) => {
  try {
    const { data } = await API.post("/auth/verify-otp", {
      email: email.trim().toLowerCase(),
      otp: otp.trim(),
    });
    return data;
  } catch (error) {
    handleError(error, "OTP verification failed");
  }
};

export const resetPassword = async (email, newPassword) => {
  try {
    const { data } = await API.post("/auth/reset-password", {
      email: email.trim().toLowerCase(),
      newPassword,
    });
    return data;
  } catch (error) {
    handleError(error, "Password reset failed");
  }
};

export const logout = () => clearToken();

export default API;