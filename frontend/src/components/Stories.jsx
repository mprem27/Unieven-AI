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

  // Default placeholder image if the user has no profile picture
  const DEFAULT_AVATAR = "https://cdn-icons-png.flaticon.com/512/149/149071.png";

  // 🔥 FETCH STORIES FUNCTION
  const fetchStories = async () => {
    try {
      const res = await getStories();
      setUsers(res.users || []);
    } catch (err) {
      console.log(err);
    }
  };

  // 🔥 INITIAL LOAD
  useEffect(() => {
    fetchStories();
  }, []);

  // 🔥 REFRESH WHEN PROFILE UPDATED
  useEffect(() => {
    const handleUpdate = () => {
      fetchStories();
    };

    window.addEventListener("profileUpdated", handleUpdate);

    return () => {
      window.removeEventListener("profileUpdated", handleUpdate);
    };
  }, []);

  // 👁️ OPEN STORY
  const handleOpen = (userStories) => {
    setActiveStories(userStories.stories);
    setStartIndex(0);

    if (!seenUsers.includes(userStories.user._id)) {
      setSeenUsers((prev) => [...prev, userStories.user._id]);
    }
  };

  return (
    <>
      <div className="w-full bg-white py-4 px-2 border-b border-gray-100 mb-2">
        {/* Scrollable Container with Hidden Scrollbars */}
        <div className="flex gap-4 overflow-x-auto px-2 items-start snap-x [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">

          {/* 🔥 YOUR STORY (ADD BUTTON) */}
          <div
            onClick={() => navigate("/add-story")}
            className="flex flex-col items-center cursor-pointer group min-w-[72px] snap-start shrink-0"
          >
            <div className="relative group-hover:scale-105 transition-transform duration-300">
              {/* Clean gray ring for the "Add" button */}
              <div className="w-16 h-16 rounded-full overflow-hidden border border-gray-200 shadow-sm p-[2px]">
                <img
                  src={user ? getProfileImage(user) : DEFAULT_AVATAR} 
                  onError={(e) => { e.target.onerror = null; e.target.src = DEFAULT_AVATAR; }}
                  className="w-full h-full object-cover rounded-full"
                  alt="Your Story"
                />
              </div>

              {/* Blue Plus Badge */}
              <div className="absolute bottom-0 right-0 bg-blue-500 w-[22px] h-[22px] rounded-full text-white flex items-center justify-center text-lg font-bold border-2 border-white shadow-md">
                +
              </div>
            </div>
            <p className="text-[11px] mt-2 font-medium text-gray-500 truncate w-16 text-center">
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
                className="flex flex-col items-center cursor-pointer group min-w-[72px] snap-start shrink-0"
              >
                <div className="group-hover:scale-105 transition-transform duration-300">

                  {/* 🔥 ROLE & SEEN BASED RING */}
                  <div
                    className={`p-[3px] rounded-full ${
                      isSeen
                        ? "bg-gray-200" // Gray if seen
                        : u.user?.role === "faculty"
                        ? "bg-gradient-to-tr from-orange-400 to-red-600" // Distinct gradient for faculty
                        : "bg-gradient-to-tr from-yellow-400 via-red-500 to-fuchsia-600" // Instagram-style gradient for students
                    }`}
                  >
                    <div className="bg-white p-[2px] rounded-full w-16 h-16">
                      <img
                        src={u.user ? getProfileImage(u.user) : DEFAULT_AVATAR} 
                        onError={(e) => { e.target.onerror = null; e.target.src = DEFAULT_AVATAR; }}
                        className="w-full h-full rounded-full object-cover"
                        alt={u.user?.username || "User"}
                      />
                    </div>
                  </div>
                </div>

                {/* USERNAME + ROLE */}
                <div className="flex flex-col items-center justify-center mt-1.5 w-[72px]">
                  <p className="text-[11px] font-medium text-gray-800 truncate w-full text-center flex items-center justify-center gap-0.5">
                    <span className="truncate">{u.user?.username || "User"}</span>
                    {u.user?.role && <RoleBadge role={u.user.role} />}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 🔥 STORY VIEWER */}
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