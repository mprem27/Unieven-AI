import { createContext, useContext, useState, useEffect } from "react";
import API from "../api/axios";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUserState] = useState(null);
  const [loading, setLoading] = useState(true);

  // 🔥 LOAD USER FROM TOKEN (AUTO LOGIN)
  useEffect(() => {
    const loadUser = async () => {
      try {
        const token = localStorage.getItem("token");

        // ❌ no token → stop
        if (!token) {
          setUserState(null);
          setLoading(false);
          return;
        }

        // ✅ attach token
        API.defaults.headers.common["Authorization"] = `Bearer ${token}`;

        const { data } = await API.get("/auth/me");

        // ✅ VALID USER
        if (data?.success && data?.user) {
          setUserState(data.user);
        } else {
          // ❌ invalid token → clear only
          localStorage.removeItem("token");
          setUserState(null);
        }

      } catch (err) {
        console.log("Auth Error:", err?.response?.data || err.message);

        // ❌ ONLY clear token (DO NOT call logout here)
        localStorage.removeItem("token");
        delete API.defaults.headers.common["Authorization"];
        setUserState(null);

      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, []);

  // 🔥 GLOBAL UPDATE (PROFILE UPDATE)
  const setUser = (updatedUser) => {
    setUserState(updatedUser);
  };

  // 🔥 LOGIN
  const login = (data) => {
    if (!data?.token) return;

    localStorage.setItem("token", data.token);

    API.defaults.headers.common["Authorization"] =
      `Bearer ${data.token}`;

    setUserState(data.user);
  };

  // 🔥 LOGOUT
  const logout = () => {
    localStorage.removeItem("token");

    delete API.defaults.headers.common["Authorization"];

    setUserState(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        login,
        logout,
        loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);