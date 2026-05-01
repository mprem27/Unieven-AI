import API from "../api/axios";

// =====================================================
// 🔓 LOGIN
// =====================================================
export const login =
  async (formData) => {
    try {
      const { data } =
        await API.post(
          "/auth/login",
          formData,
          {
            headers: {
              "Content-Type":
                "application/json",
            },
          }
        );

      // Save token
      if (
        data?.token
      ) {
        localStorage.setItem(
          "token",
          data.token
        );

        console.log(
          "✅ Token saved:",
          data.token
        );
      } else {
        console.warn(
          "⚠️ No token received from backend"
        );
      }

      return data;
    } catch (error) {
      console.error(
        "❌ Login Error:",
        error?.response
          ?.data || error
      );

      if (
        error.response
          ?.status ===
        401
      ) {
        throw {
          message:
            "Invalid email/username or password",
        };
      }

      throw (
        error.response
          ?.data || {
          message:
            "Login failed",
        }
      );
    }
  };

// =====================================================
// 📩 SEND REGISTER OTP
// 🔥 NEW PROFESSIONAL FLOW
// =====================================================
export const sendRegisterOtp =
  async (
    formData
  ) => {
    try {
      const { data } =
        await API.post(
          "/auth/send-register-otp",
          formData,
          {
            headers: {
              "Content-Type":
                "application/json",
            },
          }
        );

      return data;
    } catch (error) {
      console.error(
        "❌ Send OTP Error:",
        error?.response
          ?.data || error
      );

      throw (
        error.response
          ?.data || {
          message:
            "Failed to send OTP",
        }
      );
    }
  };

// =====================================================
// 🧑 FINAL REGISTER
// 🔥 ONLY EMAIL + OTP
// =====================================================
export const register =
  async (formData) => {
    try {
      const { data } =
        await API.post(
          "/auth/register",
          formData,
          {
            headers: {
              "Content-Type":
                "application/json",
            },
          }
        );

      if (
        data?.token
      ) {
        localStorage.setItem(
          "token",
          data.token
        );

        console.log(
          "✅ Registered & token saved"
        );
      }

      return data;
    } catch (error) {
      console.error(
        "❌ Register Error:",
        error?.response
          ?.data || error
      );

      throw (
        error.response
          ?.data || {
          message:
            "Register failed",
        }
      );
    }
  };

// =====================================================
// 👤 GET CURRENT USER
// =====================================================
export const getMe =
  async () => {
    try {
      const { data } =
        await API.get(
          "/auth/me"
        );

      return data;
    } catch (error) {
      console.error(
        "❌ getMe Error:",
        error?.response
          ?.data || error
      );

      if (
        error.response
          ?.status ===
        401
      ) {
        localStorage.removeItem(
          "token"
        );

        throw {
          message:
            "Session expired. Please login again.",
        };
      }

      throw (
        error.response
          ?.data || {
          message:
            "Failed to fetch user",
        }
      );
    }
  };

// =====================================================
// 🔑 FORGOT PASSWORD
// =====================================================
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
      console.error(
        "❌ Forgot Password Error:",
        error?.response
          ?.data || error
      );

      throw (
        error.response
          ?.data || {
          message:
            "Failed to send reset OTP",
        }
      );
    }
  };

// =====================================================
// ✅ VERIFY RESET OTP
// =====================================================
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
      console.error(
        "❌ Verify OTP Error:",
        error?.response
          ?.data || error
      );

      throw (
        error.response
          ?.data || {
          message:
            "OTP verification failed",
        }
      );
    }
  };

// =====================================================
// 🔁 RESET PASSWORD
// =====================================================
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
      console.error(
        "❌ Reset Password Error:",
        error?.response
          ?.data || error
      );

      throw (
        error.response
          ?.data || {
          message:
            "Password reset failed",
        }
      );
    }
  };

// =====================================================
// 🚪 LOGOUT
// =====================================================
export const logout =
  () => {
    localStorage.removeItem(
      "token"
    );

    console.log(
      "🚪 User logged out"
    );
  };