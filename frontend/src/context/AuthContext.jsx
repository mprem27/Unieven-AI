import { createContext, useContext, useState, useEffect } from "react";
import { toast } from "react-toastify";
import API from "../api/axios";

const AuthContext = createContext();

const setAuthToken = (token) => {
  if (token) {
    API.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  } else {
    delete API.defaults.headers.common["Authorization"];
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUserState] = useState(null);
  const [loading, setLoading] = useState(true);

  const clearSession = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    setAuthToken(null);
    setUserState(null);
  };

  useEffect(() => {
    let isMounted = true;

    const loadUser = async () => {
      try {
        const token = localStorage.getItem("token");

        if (!token) {
          if (isMounted) {
            setUserState(null);
            setLoading(false);
          }
          return;
        }

        setAuthToken(token);

        const { data } = await API.get("/auth/me");

        if (!isMounted) return;

        // 🟦 FIX 1: Be flexible with the backend data structure
        // Checks if the user data is nested inside 'user', or if 'data' IS the user
        const userData = data?.user || data;

        // Verify we actually have a user object with an ID or email
        if (userData && (userData._id || userData.id || userData.email || userData.username)) {
          setUserState(userData);

          if (userData.role) {
            localStorage.setItem("role", userData.role);
          }
        } else {
          clearSession();
        }
      } catch (err) {
        console.error("Auth Error:", err?.response?.data || err.message);

        // Remove the hard toast error here so it doesn't spam the user on mount
        if (isMounted) {
          clearSession();
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadUser();

    return () => {
      isMounted = false;
    };
  }, []);

  const setUser = (updatedUser) => {
    if (!updatedUser) return;

    setUserState(updatedUser);

    if (updatedUser.role) {
      localStorage.setItem("role", updatedUser.role);
    }
  };

  const login = (data) => {
    // 🟦 FIX 2: Prevent the login function from crashing if the data shape changes
    const token = data?.token;
    const userData = data?.user || data;

    if (!token || !userData) {
       console.error("Login failed: Backend did not return a token or user data.", data);
       return;
    }

    localStorage.setItem("token", token);

    if (userData.role) {
      localStorage.setItem("role", userData.role);
    }

    setAuthToken(token);
    setUserState(userData);
  };

  const logout = () => {
    clearSession();
    toast.success("Logged out successfully");
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