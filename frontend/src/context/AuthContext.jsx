import { createContext, useContext, useState, useEffect } from "react";
// 🟦 STEP 3: Need toast for session expiry
import { toast } from "react-toastify";
import API from "../api/axios";

const AuthContext = createContext();

// =====================================================
// 🟦 STEP 2: CENTRALIZE TOKEN SETTER (Enterprise Architecture)
// =====================================================
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

  // =====================================================
  // 🔥 LOAD USER FROM TOKEN (AUTO LOGIN)
  // =====================================================
  useEffect(() => {
    // 🟦 STEP 1: PREVENT FAIL LOOPS / MEMORY LEAKS
    let isMounted = true;

    const loadUser = async () => {
      try {
        const token = localStorage.getItem("token");

        // ❌ No token → Stop
        if (!token) {
          // Wrap state updates in mounted check
          if (isMounted) {
            setUserState(null);
            setLoading(false);
          }
          return;
        }

        // ✅ Attach token using localized helper (Step 2)
        setAuthToken(token);

        const { data } = await API.get("/auth/me");

        // ✅ Check mounted status before update
        if (isMounted) {
          // ✅ VALID USER FROM BACKEND
          if (data?.success && data?.user) {
            setUserState(data.user);
            
            // 🟦 STEP 5: ROLE PERSISTENCE
            if (data.user.role) {
              localStorage.setItem("role", data.user.role);
            }
          } else {
            // ❌ Invalid token structure → Clear storage and local state
            localStorage.removeItem("token");
            localStorage.removeItem("role"); // Step 5 cleanup
            setAuthToken(null); // Step 2 helper
            setUserState(null);
          }
        }

      } catch (err) {
        // Step 6 improvement: changed console.log to console.error
        console.error("Auth Error:", err?.response?.data || err.message);

        // 🟦 STEP 3: SESSION EXPIRED HANDLER
        if (err.response?.status === 401) {
          // Using standard toast config (ensure <ToastContainer /> is present in App.js)
          toast.error("Session expired. Please login again.");
        }

        // ❌ Clear token (DO NOT call logout function here to avoid loops)
        if (isMounted) {
          localStorage.removeItem("token");
          localStorage.removeItem("role"); // Step 5 cleanup
          setAuthToken(null); // Step 2 helper
          setUserState(null);
        }

      } finally {
        // ✅ End loading state only on mounted component
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadUser();

    // 🟦 STEP 1: CLEANUP FUNCTION
    return () => {
      isMounted = false;
    };
  }, []);

  // =====================================================
  // 🔥 GLOBAL USER STATE SETTER (PROFILE UPDATE, ETC)
  // =====================================================
  // 🟦 STEP 4: SAFE setUser (Prevent accidentally nulling out user object)
  const setUser = (updatedUser) => {
    if (!updatedUser) return;
    setUserState(updatedUser);
    
    // Step 5 sync: If user details change, update role in storage too
    if (updatedUser.role) {
      localStorage.setItem("role", updatedUser.role);
    }
  };

  // =====================================================
  // 🔥 LOGIN ACTION
  // =====================================================
  const login = (data) => {
    if (!data?.token) return;

    // Save token
    localStorage.setItem("token", data.token);
    
    // 🟦 STEP 5: ROLE PERSISTENCE
    if (data.user?.role) {
      localStorage.setItem("role", data.user.role);
    }

    // Set header using centralized helper (Step 2)
    setAuthToken(data.token);

    // Update global state
    setUserState(data.user);
  };

  // =====================================================
  // 🔥 LOGOUT ACTION
  // =====================================================
  const logout = () => {
    // Clear storage
    localStorage.removeItem("token");
    localStorage.removeItem("role"); // Step 5 cleanup

    // Clear axios header using helper (Step 2)
    setAuthToken(null);

    // Clear global state
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