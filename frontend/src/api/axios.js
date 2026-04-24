import axios from "axios";

const API = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_URL || "https://unieven-ai.onrender.com/api",
  // baseURL: import.meta.env.VITE_BACKEND_URL || "http://localhost:4000/api",
});

// 🔐 Attach token
API.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
    config.headers.token = token; // keep if your backend uses it
  }

  return config;
});

export default API;
