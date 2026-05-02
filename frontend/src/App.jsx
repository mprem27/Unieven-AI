import React, { useState, useEffect, Suspense, lazy } from "react";
import {
  Routes,
  Route,
  useLocation,
  Navigate,
} from "react-router-dom";

import { useAuth } from "./context/AuthContext";

// =====================================================
// TOAST
// =====================================================
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

// =====================================================
// COMPONENTS (Eagerly loaded - needed immediately)
// =====================================================
import Navbar from "./components/Navbar";
import Sidebar from "./components/Sidebar";
import FloatingSidebarButton from "./components/FloatingSidebarButton";
import CornerSidebar from "./components/CornerSidebar";
import Loader from "./components/Loader";

// =====================================================
//  LAZY LOADED PAGES (Performance Upgrade)
// =====================================================
// Auth
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const VerifyOtp = lazy(() => import("./pages/VerifyOtp"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));

// Main Pages
const Feed = lazy(() => import("./pages/Feed"));
const AddStory = lazy(() => import("./pages/AddStory"));
const Reels = lazy(() => import("./pages/Reels"));
const Search = lazy(() => import("./pages/Search"));
const Events = lazy(() => import("./pages/Events"));

// Profile
const Profile = lazy(() => import("./components/Profile"));
const EditProfile = lazy(() => import("./pages/EditProfile"));
const UserProfile = lazy(() => import("./pages/UserProfile"));

// Create
const CreatePost = lazy(() => import("./pages/CreatePost"));
const CreateReel = lazy(() => import("./pages/CreateReel"));
const CreateEvent = lazy(() => import("./pages/CreateEvent"));

// =====================================================
//  PRIVATE ROUTE
// =====================================================
const PrivateRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-white">
        <Loader size="42px" fullPage={false} />
      </div>
    );
  }

  return user ? children : <Navigate to="/login" replace />;
};

// =====================================================
//  PUBLIC AUTH ROUTE
// =====================================================
const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-white">
        <Loader size="42px" fullPage={false} />
      </div>
    );
  }

  return !user ? children : <Navigate to="/feed" replace />;
};

// =====================================================
// MAIN APP
// =====================================================
function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState(null);

  const { user, loading } = useAuth();
  const location = useLocation();

  //  STEP 2: SCROLL RESTORATION
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  // =====================================================
  // PAGE DETECTION
  // =====================================================
  const authRoutes = [
    "/login",
    "/register",
    "/forgot-password",
    "/verify-otp",
    "/reset-password",
  ];

  //  STEP 3: SAFER ROUTE MATCHING (Handles URL Params)
  const isAuthPage = authRoutes.some(route => location.pathname.startsWith(route));
  const isReelsPage = location.pathname.startsWith("/reels");

  // =====================================================
  // GLOBAL LOADING
  // =====================================================
  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-white">
        <Loader size="48px" fullPage={false} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafafa]">

      {/* =====================================================
          TOAST SYSTEM
      ===================================================== */}
      <ToastContainer
        position="bottom-center"
        autoClose={2500}
        hideProgressBar
        newestOnTop
        closeOnClick
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="dark"
      />

      {/* =====================================================
          NAVBAR
      ===================================================== */}
      {!isAuthPage && !isReelsPage && <Navbar />}

      <div className="flex w-full">

        {/* =====================================================
            DESKTOP SIDEBAR
        ===================================================== */}
        {!isAuthPage && !isReelsPage && (
          <div className="hidden lg:block">
            <Sidebar setSidebarOpen={setSidebarOpen} />
          </div>
        )}

        {/* =====================================================
            MAIN CONTENT
        ===================================================== */}
        <main
          className={`
            flex-1 w-full transition-all duration-300
            ${
              isReelsPage
                ? "m-0 h-screen bg-black"
                : !isAuthPage
                ? "md:mt-[56px] lg:ml-20"
                : "h-screen"
            }
          `}
        >
          {/* LAZY LOAD SUSPENSE WRAPPER */}
          <Suspense 
            fallback={
              <div className="h-[80vh] flex items-center justify-center">
                <Loader size="42px" fullPage={false} />
              </div>
            }
          >
            <Routes>

              {/* =====================================================
                  AUTH ROUTES
              ===================================================== */}
              <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
              <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
              <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
              <Route path="/verify-otp" element={<PublicRoute><VerifyOtp /></PublicRoute>} />
              <Route path="/reset-password" element={<PublicRoute><ResetPassword /></PublicRoute>} />

              {/* =====================================================
                  FEED & POSTS
              ===================================================== */}
              <Route path="/" element={<PrivateRoute><Feed /></PrivateRoute>} />
              <Route path="/feed" element={<PrivateRoute><Feed /></PrivateRoute>} />
              <Route path="/post/:id" element={<PrivateRoute><Feed /></PrivateRoute>} />

              {/* =====================================================
                  SEARCH & EVENTS
              ===================================================== */}
              <Route path="/search" element={<PrivateRoute><Search /></PrivateRoute>} />
              <Route path="/events" element={<PrivateRoute><Events /></PrivateRoute>} />
              <Route path="/events/:id" element={<PrivateRoute><Events /></PrivateRoute>} />

              {/* =====================================================
                  REELS
              ===================================================== */}
              <Route path="/reels" element={<PrivateRoute><Reels /></PrivateRoute>} />
              <Route path="/reels/:id" element={<PrivateRoute><Reels /></PrivateRoute>} />

              {/* =====================================================
                  CREATE / ADD
              ===================================================== */}
              <Route path="/add-story" element={<PrivateRoute><AddStory /></PrivateRoute>} />
              <Route path="/create/post" element={<PrivateRoute><CreatePost /></PrivateRoute>} />
              <Route path="/create/reel" element={<PrivateRoute><CreateReel /></PrivateRoute>} />
              <Route path="/create/event" element={<PrivateRoute><CreateEvent /></PrivateRoute>} />

              {/* =====================================================
                  PROFILE
              ===================================================== */}
              <Route path="/profile" element={<PrivateRoute><Profile /></PrivateRoute>} />
              <Route path="/edit-profile" element={<PrivateRoute><EditProfile /></PrivateRoute>} />
              <Route path="/user/:username" element={<PrivateRoute><UserProfile /></PrivateRoute>} />

              {/* =====================================================
                  FALLBACK (404 / REDIRECT)
              ===================================================== */}
              <Route path="*" element={<Navigate to={user ? "/feed" : "/login"} replace />} />

            </Routes>
          </Suspense>
        </main>
      </div>

      {/* =====================================================
          MOBILE SIDEBAR
      ===================================================== */}
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
