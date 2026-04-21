import React, { useState } from "react";
import { useNavigate } from "react-router-dom"; // ✅ IMPORT useNavigate
import { getProfileImage } from "../utils/getProfileImage";
import RoleBadge from "./RoleBadge";
import { followUser } from "../services/userService";

function Suggestions({ users }) {
  const [loadingId, setLoadingId] = useState(null);
  const [followed, setFollowed] = useState({});
  const navigate = useNavigate(); // ✅ INITIALIZE navigate

  const handleFollow = async (userId) => {
    try {
      setLoadingId(userId);
      const res = await followUser(userId);

      // 🔥 backend toggle support
      setFollowed((prev) => ({
        ...prev,
        [userId]: res.status === "accepted" ? true : !prev[userId],
      }));
    } catch (err) {
      console.log(err);
    } finally {
      setLoadingId(null);
    }
  };

  if (!users || users.length === 0) return null;

  return (
    <div className="w-full max-w-[470px] mt-8 mb-4 px-1 font-['Poppins',sans-serif]">
      
      {/* Header section */}
      <div className="flex items-center justify-between mb-4 px-2">
        <h3 className="text-[15px] font-bold text-gray-800 tracking-tight">Suggested for you</h3>
        <button className="text-[13px] font-bold text-[#0095f6] hover:text-[#00376b] transition-colors">
          See All
        </button>
      </div>

      {/* Scrollable Container */}
      <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-6 pt-2 px-2 snap-x">
        {users.map((u) => (
          <div
            key={u._id}
            className="snap-start min-w-[160px] max-w-[160px] bg-white/40 backdrop-blur-2xl border border-white/60 rounded-[20px] p-5 flex flex-col items-center shadow-[0_8px_20px_rgba(0,0,0,0.04)] hover:shadow-[0_15px_30px_rgba(0,0,0,0.08)] hover:-translate-y-1 transition-all duration-300"
          >
            
            {/* Premium Profile Image with subtle ring (✅ Clickable) */}
            <div 
             onClick={() => navigate(`/user/${encodeURIComponent(u.username)}`)}
              className="w-[72px] h-[72px] rounded-full p-[3px] bg-gradient-to-tr from-gray-100 to-gray-200 shadow-sm mb-3 cursor-pointer hover:scale-105 transition-transform duration-300"
            >
              <div className="bg-white p-0.5 rounded-full w-full h-full">
                <img
                  src={getProfileImage(u)}
                  className="w-full h-full rounded-full object-cover"
                  alt={u.username}
                />
              </div>
            </div>

            {/* User Info with Truncation for safety (✅ Clickable) */}
            <div 
             onClick={() => navigate(`/user/${encodeURIComponent(u.username)}`)}
              className="flex flex-col items-center w-full mb-4 cursor-pointer group"
            >
              <div className="flex items-center justify-center gap-1 w-full px-1">
                <p className="text-[14px] font-bold text-gray-900 truncate group-hover:text-gray-600 transition-colors">
                  {u.username}
                </p>
                <RoleBadge role={u.role} />
              </div>
              <p className="text-[11px] text-gray-500 font-medium mt-0.5 truncate w-full text-center px-2">
                {u.name || "Suggested"}
              </p>
            </div>

            {/* Follow Button */}
            <button
              onClick={() => handleFollow(u._id)}
              disabled={loadingId === u._id}
              className={`w-full py-2 rounded-xl text-[13px] font-bold transition-all duration-300 active:scale-95 flex justify-center items-center h-[36px] ${
                followed[u._id]
                  ? "bg-white/80 hover:bg-gray-100 text-gray-800 border border-gray-200/60 shadow-sm"
                  : "bg-[#0095f6] hover:bg-[#1877f2] text-white shadow-md shadow-blue-500/20"
              }`}
            >
              {loadingId === u._id ? (
                <span className="animate-pulse">Wait...</span>
              ) : followed[u._id] ? (
                "Following"
              ) : (
                "Follow"
              )}
            </button>

          </div>
        ))}
      </div>
    </div>
  );
}

export default Suggestions;