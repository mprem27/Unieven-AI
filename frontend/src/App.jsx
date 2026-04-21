import { useState } from "react";
import { Routes, Route, useLocation, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";

// TOAST
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

// Components
import Navbar from "./components/Navbar";
import Sidebar from "./components/Sidebar";

// Pages
import Login from "./Pages/Login";
import Register from "./Pages/Register";
import Feed from "./Pages/Feed";
import AddStory from "./Pages/AddStory";
import Reels from "./Pages/Reels";
import Profile from "./components/Profile";
import EditProfile from "./Pages/EditProfile";
import UserProfile from "./Pages/UserProfile";
import Search from "./Pages/Search";

// CREATE
import CreatePost from "./Pages/CreatePost";
import CreateReel from "./Pages/CreateReel";
import CreateEvent from "./Pages/CreateEvent";

// EVENTS
import Events from "./Pages/Events";

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, loading } = useAuth();
  const location = useLocation();

  // 🔥 SHOW LOADER INSTEAD OF BLANK SCREEN
  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center text-gray-500">
        Loading...
      </div>
    );
  }

  const isAuthPage =
    location.pathname === "/login" ||
    location.pathname === "/register";

  // 🔐 REUSABLE PRIVATE ROUTE
  const PrivateRoute = ({ children }) => {
    return user ? children : <Navigate to="/login" />;
  };

  return (
    <div className="min-h-screen bg-[#fafafa]">

      {/* TOAST */}
      <ToastContainer
        position="bottom-center"
        autoClose={2000}
        hideProgressBar
        theme="dark"
      />

      {/* NAVBAR */}
      {!isAuthPage && <Navbar />}

      <div className={isAuthPage ? "w-full" : "flex"}>

        {/* SIDEBAR */}
        {!isAuthPage && <Sidebar setSidebarOpen={setSidebarOpen} />}

        <main
          className={`
            flex-1 transition-all duration-300
            ${!isAuthPage ? "mt-14 min-h-[calc(100vh-56px)]" : "h-screen"}
            ${!isAuthPage ? (sidebarOpen ? "ml-64" : "ml-24") : "ml-0"}
          `}
        >
          <Routes>

            {/* AUTH */}
            <Route path="/login" element={!user ? <Login /> : <Navigate to="/feed" />} />
            <Route path="/register" element={!user ? <Register /> : <Navigate to="/feed" />} />

            {/* MAIN */}
            <Route path="/" element={<PrivateRoute><Feed /></PrivateRoute>} />
            <Route path="/feed" element={<PrivateRoute><Feed /></PrivateRoute>} />

            {/* SEARCH */}
            <Route path="/search" element={<PrivateRoute><Search /></PrivateRoute>} />

            {/* REELS */}
            <Route path="/reels" element={<PrivateRoute><Reels /></PrivateRoute>} />
            {/* ✅ ADDED: Route to handle shared Reel links */}
            <Route path="/reels/:id" element={<PrivateRoute><Reels /></PrivateRoute>} />

            {/* CREATE */}
            <Route path="/create/post" element={<PrivateRoute><CreatePost /></PrivateRoute>} />
            <Route path="/create/reel" element={<PrivateRoute><CreateReel /></PrivateRoute>} />
            <Route path="/create/event" element={<PrivateRoute><CreateEvent /></PrivateRoute>} />

            {/* EVENTS */}
            <Route path="/events" element={<PrivateRoute><Events /></PrivateRoute>} />
            {/* ✅ ADDED: Route to handle shared Event links */}
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
    </div>
  );
}

export default App;