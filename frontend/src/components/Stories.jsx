import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import StoryViewer from "./StoryViewer";
import { getStories } from "../services/storyService";
import { getProfileImage } from "../utils/getProfileImage";
import RoleBadge from "../components/RoleBadge";
import { useAuth } from "../context/AuthContext";

function Stories() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [users, setUsers] = useState([]);
  const [activeStories, setActiveStories] = useState(null);
  const [startIndex, setStartIndex] = useState(0);
  const [seenUsers, setSeenUsers] = useState([]);

  const DEFAULT_AVATAR = "https://cdn-icons-png.flaticon.com/512/149/149071.png";

  const fetchStories = async () => {
    try {
      const res = await getStories();
      setUsers(res.users || []);
    } catch (err) {
      console.error("Fetch stories error:", err);
    }
  };

  useEffect(() => {
    fetchStories();
  }, []);

  useEffect(() => {
    const handleUpdate = () => fetchStories();
    window.addEventListener("profileUpdated", handleUpdate);
    return () => window.removeEventListener("profileUpdated", handleUpdate);
  }, []);

  const handleOpen = (userStories) => {
    setActiveStories(userStories.stories);
    setStartIndex(0);
    if (!seenUsers.includes(userStories.user._id)) {
      setSeenUsers((prev) => [...prev, userStories.user._id]);
    }
  };

  return (
    <>
      {/* ✅ FINAL FIX: Removed pt/pb and added mt-0 for seamless alignment */}
      <div className="w-full bg-white border-b border-gray-100 overflow-hidden mt-0">
        
        {/* ✅ FINAL FIX: Updated gap-3, px-3, py-2 for perfect spacing */}
        <div 
          className="flex flex-row flex-nowrap overflow-x-auto overflow-y-hidden gap-3 px-3 py-1 items-start 
                     snap-x snap-mandatory scroll-smooth
                     [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
        >
          
          {/* 🔥 YOUR STORY (ADD BUTTON) */}
          <div
            onClick={() => navigate("/add-story")}
            className="flex flex-col items-center cursor-pointer group min-w-[70px] sm:min-w-[80px] snap-start shrink-0"
          >
            <div className="relative group-hover:scale-105 transition-transform duration-300">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden border-2 border-gray-100 shadow-sm p-[2px] bg-white">
                <img
                  src={user ? getProfileImage(user) : DEFAULT_AVATAR}
                  onError={(e) => { e.target.onerror = null; e.target.src = DEFAULT_AVATAR; }}
                  className="w-full h-full rounded-full object-cover bg-gray-50"
                  alt="Your Story"
                />
              </div>
              <div className="absolute bottom-0 right-0 bg-blue-600 w-[22px] h-[22px] sm:w-[26px] sm:h-[26px] rounded-full text-white flex items-center justify-center text-lg font-bold border-2 border-white shadow-md group-hover:bg-blue-700 transition-colors">
                +
              </div>
            </div>
            <p className="text-[10px] sm:text-[11px] mt-1.5 font-semibold text-gray-400 truncate w-full text-center">
              Your Story
            </p>
          </div>

          {/* 🔥 USERS STORIES */}
          {users.map((u) => {
            const isSeen = seenUsers.includes(u.user._id);

            return (
              <div
                key={u.user._id}
                onClick={() => handleOpen(u)}
                className="flex flex-col items-center cursor-pointer group min-w-[70px] sm:min-w-[80px] snap-start shrink-0"
              >
                <div className="group-hover:scale-105 transition-transform duration-300">
                  <div
                    className={`p-[2px] rounded-full transition-colors duration-500 ${
                      isSeen
                        ? "bg-gray-200"
                        : u.user?.role === "faculty"
                        ? "bg-gradient-to-tr from-red-500 to-orange-500"
                        : "bg-gradient-to-tr from-yellow-400 via-red-500 to-fuchsia-600"
                    }`}
                  >
                    <div className="bg-white p-[2px] rounded-full w-16 h-16 sm:w-20 sm:h-20">
                      <img
                        src={u.user ? getProfileImage(u.user) : DEFAULT_AVATAR}
                        onError={(e) => { e.target.onerror = null; e.target.src = DEFAULT_AVATAR; }}
                        className="w-full h-full rounded-full object-cover bg-gray-50"
                        alt={u.user?.username || "User"}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex flex-row items-center justify-center mt-1.5 w-full px-1">
                  <p className="text-[10px] sm:text-[11px] font-bold text-gray-700 truncate text-center flex items-center gap-0.5 max-w-full">
                    <span className="truncate">{u.user?.username || "User"}</span>
                    {u.user?.role && <RoleBadge role={u.user.role} className="scale-[0.7] origin-left" />}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 🔥 STORY VIEWER MODAL */}
      {activeStories && (
        <StoryViewer
          stories={activeStories}
          currentIndex={startIndex}
          onClose={() => setActiveStories(null)}
        />
      )}
    </>
  );
}

export default Stories;