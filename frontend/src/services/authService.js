import API from "../api/axios";

// 🔐 LOGIN
export const login = async (formData) => {
  try {
    const { data } = await API.post("/auth/login", formData);

    // ✅ Save token automatically
    if (data.token) {
      localStorage.setItem("token", data.token);
    }

    return data;
  } catch (error) {
    throw error.response?.data || { message: "Login failed" };
  }
};

// 🧑 REGISTER
export const register = async (formData) => {
  try {
    const { data } = await API.post("/auth/register", formData);

    if (data.token) {
      localStorage.setItem("token", data.token);
    }

    return data;
  } catch (error) {
    throw error.response?.data || { message: "Register failed" };
  }
};

// 👤 GET CURRENT USER
export const getMe = async () => {
  try {
    const { data } = await API.get("/auth/me");
    return data;
  } catch (error) {
    throw error.response?.data || { message: "Failed to fetch user" };
  }
};

// 🚪 LOGOUT (NEW 🔥)
export const logout = () => {
  localStorage.removeItem("token");
};