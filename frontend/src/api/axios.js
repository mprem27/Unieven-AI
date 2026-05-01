import axios from "axios";

const API = axios.create({
  baseURL:
    import.meta.env.VITE_API_URL ||
    "https://unieven-ai.onrender.com/api",
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

const saveToken = (token) => {
  if (token) {
    localStorage.setItem("token", token);
  }
};

const clearToken = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("role");
};

const getToken = () =>
  localStorage.getItem("token");

API.interceptors.request.use(
  (config) => {
    const token = getToken();

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) =>
    Promise.reject(error)
);

API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      error.response?.status === 401
    ) {
      clearToken();

      if (
        window.location.pathname !==
        "/login"
      ) {
        window.location.href =
          "/login";
      }
    }

    return Promise.reject(error);
  }
);

const handleError = (
  error,
  fallbackMessage
) => {
  console.error(
    "API ERROR:",
    error?.response?.data ||
      error.message ||
      error
  );

  throw {
    success: false,
    message:
      error?.response?.data
        ?.message ||
      error?.message ||
      fallbackMessage,
  };
};

export const login = async (
  formData
) => {
  try {
    const { data } =
      await API.post(
        "/auth/login",
        formData
      );

    saveToken(data?.token);

    return data;
  } catch (error) {
    if (
      error.response
        ?.status === 401 ||
      error.response
        ?.status === 404
    ) {
      throw {
        success: false,
        message:
          "Invalid email/username or password",
      };
    }

    handleError(
      error,
      "Login failed"
    );
  }
};

export const sendRegisterOtp =
  async (formData) => {
    try {
      const { data } =
        await API.post(
          "/auth/send-register-otp",
          formData
        );

      return data;
    } catch (error) {
      handleError(
        error,
        "Failed to send OTP. Please try again."
      );
    }
  };

export const register = async (
  formData
) => {
  try {
    const { data } =
      await API.post(
        "/auth/register",
        formData
      );

    saveToken(data?.token);

    return data;
  } catch (error) {
    handleError(
      error,
      "Registration failed"
    );
  }
};

export const getMe = async () => {
  try {
    const { data } =
      await API.get(
        "/auth/me"
      );

    return data;
  } catch (error) {
    if (
      error.response
        ?.status === 401
    ) {
      clearToken();

      throw {
        success: false,
        message:
          "Session expired. Please login again.",
      };
    }

    handleError(
      error,
      "Failed to fetch user"
    );
  }
};

export const forgotPassword =
  async (email) => {
    try {
      const { data } =
        await API.post(
          "/auth/forgot-password",
          { email }
        );

      return data;
    } catch (error) {
      handleError(
        error,
        "Failed to send reset OTP"
      );
    }
  };

export const verifyOtp =
  async (
    email,
    otp
  ) => {
    try {
      const { data } =
        await API.post(
          "/auth/verify-otp",
          {
            email,
            otp,
          }
        );

      return data;
    } catch (error) {
      handleError(
        error,
        "OTP verification failed"
      );
    }
  };

export const resetPassword =
  async (
    email,
    newPassword
  ) => {
    try {
      const { data } =
        await API.post(
          "/auth/reset-password",
          {
            email,
            newPassword,
          }
        );

      return data;
    } catch (error) {
      handleError(
        error,
        "Password reset failed"
      );
    }
  };

export const logout = () => {
  clearToken();
};

export default API;