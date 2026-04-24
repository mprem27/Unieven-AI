import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { getProfileImage } from "../utils/getProfileImage";
import RoleBadge from "./RoleBadge";
import { followUser } from "../services/userService";

function Suggestions({ users }) {
  const [loadingId, setLoadingId] = useState(null);
  const [followed, setFollowed] = useState({});
  const navigate = useNavigate();

  const handleConnect = async (userId) => {
    try {
      setLoadingId(userId);
      const res = await followUser(userId);

      // Backend toggle support for connection logic
      setFollowed((prev) => ({
        ...prev,
        [userId]: res.status === "accepted" ? true : !prev[userId],
      }));
    } catch (err) {
      console.error("Connection error:", err);
    } finally {
      setLoadingId(null);
    }
  };

  if (!users || users.length === 0) return null;

  return (
    <div className="w-full max-w-[470px] mt-6 md:mt-8 mb-4 px-1 font-['Poppins',sans-serif] overflow-hidden">
      
      {/* Header section */}
      <div className="flex items-center justify-between mb-4 px-3">
        <h3 className="text-[14px] md:text-[15px] font-bold text-gray-800 tracking-tight">Suggested for you</h3>
        <button className="text-[12px] md:text-[13px] font-bold text-[#3b82f6] hover:text-blue-700 transition-colors">
          See All
        </button>
      </div>

      {/* 🔥 HORIZONTAL SCROLL CONTAINER */}
      <div className="flex gap-3 md:gap-4 overflow-x-auto scrollbar-hide pb-6 pt-1 px-3 snap-x snap-mandatory scroll-smooth [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {users.map((u) => (
          <div
            key={u._id}
            className="snap-start min-w-[150px] md:min-w-[160px] bg-white/50 backdrop-blur-2xl border border-white/60 rounded-[24px] p-5 flex flex-col items-center shadow-[0_8px_20px_rgba(0,0,0,0.03)] hover:shadow-[0_12px_25px_rgba(0,0,0,0.08)] hover:-translate-y-1 transition-all duration-300"
          >
            
            {/* Clickable Profile Image */}
            <div 
              onClick={() => navigate(`/user/${encodeURIComponent(u.username)}`)}
              className={`w-[68px] h-[68px] md:w-[72px] md:h-[72px] rounded-full p-[2.5px] shadow-sm mb-3 cursor-pointer hover:scale-105 transition-transform duration-300 ${
                followed[u._id] ? "bg-gray-200" : "bg-gradient-to-tr from-blue-400 to-purple-500"
              }`}
            >
              <div className="bg-white p-0.5 rounded-full w-full h-full">
                <img
                  src={getProfileImage(u)}
                  className="w-full h-full rounded-full object-cover"
                  alt={u.username}
                />
              </div>
            </div>

            {/* Clickable User Info */}
            <div 
              onClick={() => navigate(`/user/${encodeURIComponent(u.username)}`)}
              className="flex flex-col items-center w-full mb-4 cursor-pointer group"
            >
              <div className="flex items-center justify-center gap-1 w-full px-1">
                <p className="text-[13px] md:text-[14px] font-bold text-gray-900 truncate group-hover:text-blue-600 transition-colors">
                  {u.username}
                </p>
                <RoleBadge role={u.role} className="scale-75 origin-left" />
              </div>
              <p className="text-[10px] md:text-[11px] text-gray-400 font-semibold mt-0.5 truncate w-full text-center px-2">
                {u.name || "UniEven Member"}
              </p>
            </div>

            {/* Connect Button */}
            <button
              onClick={() => handleConnect(u._id)}
              disabled={loadingId === u._id}
              className={`w-full py-1.5 md:py-2 rounded-xl text-[12px] md:text-[13px] font-black transition-all duration-300 active:scale-95 flex justify-center items-center h-[34px] md:h-[36px] ${
                followed[u._id]
                  ? "bg-gray-100 text-gray-500 border border-gray-200"
                  : "bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20"
              }`}
            >
              {loadingId === u._id ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : followed[u._id] ? (
                "Connected"
              ) : (
                "Connect"
              )}
            </button>

          </div>
        ))}
      </div>
    </div>
  );
}

export default Suggestions;