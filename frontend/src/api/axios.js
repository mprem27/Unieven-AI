import axios from "axios";

// ======================================================
//  AXIOS INSTANCE
// ======================================================
const API = axios.create({
  baseURL:
    import.meta.env.VITE_API_URL ||
    "https://unieven-ai.onrender.com/api",
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

// ======================================================
//  TOKEN HELPERS
// ======================================================
const saveToken = (token) => {
  if (token) {
    localStorage.setItem("token", token);
  }
};

const clearToken = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("role");
};

const getToken = () => localStorage.getItem("token");

// ======================================================
//  REQUEST INTERCEPTOR
// ======================================================
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

// ======================================================
//  RESPONSE INTERCEPTOR (IMPROVED 🔥)
// ======================================================
API.interceptors.response.use(
  (response) => response,
  (error) => {
    // 🔥 NETWORK ERROR (server down / CORS / timeout)
    if (!error.response) {
      console.error("🌐 NETWORK ERROR:", error.message);
      return Promise.reject({
        success: false,
        message: "Server not reachable. Try again later.",
      });
    }

    const status = error.response.status;

    //  HANDLE 401 (ONLY IF TOKEN EXISTS)
    if (status === 401 && getToken()) {
      console.warn("⚠️ Unauthorized → Logging out");

      clearToken();

      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }

    return Promise.reject(error);
  }
);

// ======================================================
//  GLOBAL ERROR HANDLER
// ======================================================
const handleError = (error, fallbackMessage) => {
  const message =
    error?.response?.data?.message ||
    error?.message ||
    fallbackMessage;

  console.error("🌐 API ERROR:", message);

  throw {
    success: false,
    message,
  };
};

// ======================================================
//  AUTH API CALLS
// ======================================================

export const login = async (formData) => {
  try {
    const { data } = await API.post("/auth/login", formData);

    // ✅ Save token safely
    if (data?.token) {
      saveToken(data.token);
    }

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

    //  Save token after register
    if (data?.token) {
      saveToken(data.token);
    }

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
//  FORGOT PASSWORD (SPRING BRIDGE)
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

// ======================================================
//  LOGOUT
// ======================================================
export const logout = () => {
  clearToken();
  window.location.href = "/login"; // 🔥 ensure redirect
};

export default API;