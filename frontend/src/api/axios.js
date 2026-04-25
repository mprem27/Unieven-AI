import axios from "axios";

// ✅ Base URL (use only ONE env name across project)
const API = axios.create({
  baseURL:
    import.meta.env.VITE_API_URL ||
    "https://unieven-ai.onrender.com/api",
});

// 🔐 Attach token to every request
API.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      // optional (only if backend needs it)
      config.headers.token = token;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// 🚨 Handle global errors (IMPORTANT)
API.interceptors.response.use(
  (response) => response,
  (error) => {
    // 🔥 If token invalid / expired
    if (error.response?.status === 401) {
      console.warn("🔐 Session expired. Logging out...");

      localStorage.removeItem("token");

      // redirect to login (optional)
      window.location.href = "/login";
    }

    return Promise.reject(error);
  }
);

export default API;