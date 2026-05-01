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

        if (data?.success && data?.user) {
          setUserState(data.user);

          if (data.user.role) {
            localStorage.setItem("role", data.user.role);
          }
        } else {
          clearSession();
        }
      } catch (err) {
        console.error("Auth Error:", err?.response?.data || err.message);

        if (err.response?.status === 401) {
          toast.error("Session expired. Please login again.");
        }

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
    if (!data?.token || !data?.user) return;

    localStorage.setItem("token", data.token);

    if (data.user.role) {
      localStorage.setItem("role", data.user.role);
    }

    setAuthToken(data.token);
    setUserState(data.user);
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