import API from "../api/axios";

//  LOGIN
export const login = async (formData) => {
  try {
    const { data } = await API.post("/auth/login", formData, {
      headers: {
        "Content-Type": "application/json",
      },
    });

    // ✅ Save token
    if (data?.token) {
      localStorage.setItem("token", data.token);
      console.log(" Token saved:", data.token);
    } else {
      console.warn("⚠️ No token received from backend");
    }

    return data;

  } catch (error) {
    console.error(" Login Error:", error?.response?.data || error);

    if (error.response?.status === 401) {
      throw { message: "Invalid email or password" };
    }

    throw error.response?.data || { message: "Login failed" };
  }
};


// 🧑 REGISTER
export const register = async (formData) => {
  try {
    const { data } = await API.post("/auth/register", formData, {
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (data?.token) {
      localStorage.setItem("token", data.token);
      console.log(" Registered & token saved");
    }

    return data;

  } catch (error) {
    console.error(" Register Error:", error?.response?.data || error);
    throw error.response?.data || { message: "Register failed" };
  }
};


// 👤 GET CURRENT USER
export const getMe = async () => {
  try {
    const { data } = await API.get("/auth/me");
    return data;

  } catch (error) {
    console.error("❌ getMe Error:", error?.response?.data || error);

    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      throw { message: "Session expired. Please login again." };
    }

    throw error.response?.data || { message: "Failed to fetch user" };
  }
};


// 🚪 LOGOUT
export const logout = () => {
  localStorage.removeItem("token");
  console.log("🚪 User logged out");
};