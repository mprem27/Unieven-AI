import { useState } from "react";
import { Routes, Route, useLocation, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";

// TOAST
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

// Components
import Navbar from "./components/Navbar";
import Sidebar from "./components/Sidebar";
import FloatingSidebarButton from "./components/FloatingSidebarButton";
import CornerSidebar from "./components/CornerSidebar";
import Loader from "./components/Loader"; // ✅ FIXED: Added missing Loader import

// pages
import Login from "./pages/Login";
import Register from "./pages/Register";
import Feed from "./pages/Feed";
import AddStory from "./pages/AddStory";
import Reels from "./pages/Reels";
import Profile from "./components/Profile";
import EditProfile from "./pages/EditProfile";
import UserProfile from "./pages/UserProfile";
import Search from "./pages/Search";

// CREATE
import CreatePost from "./pages/CreatePost";
import CreateReel from "./pages/CreateReel";
import CreateEvent from "./pages/CreateEvent";

// EVENTS
import Events from "./pages/Events";

// FORGOT PASSWORD
import ForgotPassword from "./pages/ForgotPassword";
import VerifyOtp from "./pages/VerifyOtp";
import ResetPassword from "./pages/ResetPassword";

const PrivateRoute = ({ children }) => {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" />;
};

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, loading } = useAuth();
  const location = useLocation();

  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState(null);

  // 🔥 PAGE CHECKS (FIXED: Added all auth-related pages)
  const authRoutes = ["/login", "/register", "/forgot-password", "/verify-otp", "/reset-password"];
  const isAuthPage = authRoutes.includes(location.pathname);

  const isReelsPage = location.pathname.startsWith("/reels");

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center text-gray-500">
        <Loader size="40px" color="#3b82f6" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafafa]">

      {/* TOAST */}
      <ToastContainer
        position="bottom-center"
        autoClose={2000}
        hideProgressBar
        theme="dark"
      />

      {/* ✅ NAVBAR (hidden for reels & auth) */}
      {!isAuthPage && !isReelsPage && <Navbar />}

      <div className="flex w-full">

        {/* ✅ SIDEBAR (hidden for reels & auth) */}
        {!isAuthPage && !isReelsPage && (
          <div className="hidden lg:block">
            <Sidebar setSidebarOpen={setSidebarOpen} />
          </div>
        )}

        {/* ✅ MAIN CONTENT */}
        <main
          className={`
            flex-1 transition-all duration-300 w-full

            ${isReelsPage
              ? "m-0 h-screen bg-black"
              : !isAuthPage
                ? "md:mt-[56px] lg:ml-20"
                : "h-screen"
            }
          `}
        >
          <Routes>

            {/* AUTH */}
            <Route path="/login" element={!user ? <Login /> : <Navigate to="/feed" />} />
            <Route path="/register" element={!user ? <Register /> : <Navigate to="/feed" />} />
            
            {/* FORGOT PASSWORD (FIXED: Protected from logged-in users) */}
            <Route path="/forgot-password" element={!user ? <ForgotPassword /> : <Navigate to="/feed" />} />
            <Route path="/verify-otp" element={!user ? <VerifyOtp /> : <Navigate to="/feed" />} />
            <Route path="/reset-password" element={!user ? <ResetPassword /> : <Navigate to="/feed" />} />

            {/* MAIN */}
            <Route path="/" element={<PrivateRoute><Feed /></PrivateRoute>} />
            <Route path="/feed" element={<PrivateRoute><Feed /></PrivateRoute>} />
            <Route path="/search" element={<PrivateRoute><Search /></PrivateRoute>} />

            {/* REELS */}
            <Route path="/reels" element={<PrivateRoute><Reels /></PrivateRoute>} />
            <Route path="/reels/:id" element={<PrivateRoute><Reels /></PrivateRoute>} />

            {/* CREATE */}
            <Route path="/create/post" element={<PrivateRoute><CreatePost /></PrivateRoute>} />
            <Route path="/create/reel" element={<PrivateRoute><CreateReel /></PrivateRoute>} />
            <Route path="/create/event" element={<PrivateRoute><CreateEvent /></PrivateRoute>} />

            {/* EVENTS */}
            <Route path="/events" element={<PrivateRoute><Events /></PrivateRoute>} />
            <Route path="/events/:id" element={<PrivateRoute><Events /></PrivateRoute>} />

            {/* OTHER */}
            <Route path="/post/:id" element={<PrivateRoute><Feed /></PrivateRoute>} />
            <Route path="/add-story" element={<PrivateRoute><AddStory /></PrivateRoute>} />
            <Route path="/profile" element={<PrivateRoute><Profile /></PrivateRoute>} />
            <Route path="/edit-profile" element={<PrivateRoute><EditProfile /></PrivateRoute>} />
            <Route path="/user/:username" element={<PrivateRoute><UserProfile /></PrivateRoute>} />

            {/* FALLBACK */}
            <Route path="*" element={<Navigate to={user ? "/feed" : "/login"} />} />

          </Routes>
        </main>
      </div>

      {/* ✅ MOBILE FLOAT MENU (Also hidden on new auth pages) */}
      {!isAuthPage && !isReelsPage && (
        <div className="lg:hidden">
          <FloatingSidebarButton
            isOpen={menuOpen}
            onClick={() => setMenuOpen((prev) => !prev)}
            onClose={() => setMenuOpen(false)}
            setMenuPosition={setMenuPosition}
          />
          <CornerSidebar
            position={menuPosition}
            isOpen={menuOpen}
            onClose={() => setMenuOpen(false)}
          />
        </div>
      )}

    </div>
  );
}

export default App;