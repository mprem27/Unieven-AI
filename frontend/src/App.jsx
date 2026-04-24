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

  // 🔥 PAGE CHECKS
  const isAuthPage =
    location.pathname === "/login" ||
    location.pathname === "/register";

  const isReelsPage = location.pathname.startsWith("/reels");

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center text-gray-500">
        Loading...
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

            ${
              isReelsPage
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

      {/* ✅ MOBILE FLOAT MENU */}
      {!isAuthPage && !isReelsPage && (
        <div className="lg:hidden">
          <FloatingSidebarButton
            onClick={() => setMenuOpen((prev) => !prev)}
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