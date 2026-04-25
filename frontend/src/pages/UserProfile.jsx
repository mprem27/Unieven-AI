import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { getProfile, getUserPosts, followUser } from "../services/userService";
import Loader from "../components/Loader";
import { toast } from "react-toastify";
import { getProfileImage } from "../utils/getProfileImage";
import RoleBadge from "../components/RoleBadge"; 
import {
  FaHeart,
  FaComment,
  FaPlay,
  FaTh,
  FaCalendarAlt,
  FaLock
} from "react-icons/fa";

function UserProfile() {
  const { username } = useParams(); 

  // 🔥 FIX: decode username (IMPORTANT)
  const decodedUsername = decodeURIComponent(username);
  
  const [profileData, setProfileData] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("posts");

  const [followState, setFollowState] = useState("follow"); 
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    const loadUserProfile = async () => {
      try {
        setLoading(true);
        
        const res = await getProfile(decodedUsername);
        
        if (res && res.user) {
          setProfileData(res.user);
          
          // ✅ SYNC INITIAL STATE
          if (res.user.isFollowing) {
            setFollowState("following");
          } else if (res.user.isRequested) {
            setFollowState("requested");
          } else {
            setFollowState("follow");
          }

          const postsRes = await getUserPosts(res.user._id).catch(() => null);
          setPosts(postsRes?.posts || []);
        } else {
          toast.error("User not found");
        }
      } catch (err) {
        toast.error("Failed to load profile");
      } finally {
        setLoading(false);
      }
    };

    loadUserProfile();
  }, [decodedUsername]);

  // ✅ PERFECT BACKEND SYNC LOGIC
  const handleFollowClick = async () => {
    if (!profileData?._id || actionLoading) return;

    setActionLoading(true);

    try {
      const res = await followUser(profileData._id);

      // 🔥 Match EXACT strings from your authController smart toggle
      if (res?.message === "Unfollowed / Request cancelled") {
        setFollowState("follow");
      } else if (res?.status === "requested") {
        setFollowState("requested");
      } else if (res?.status === "accepted") {
        setFollowState("following");
      } else {
        setFollowState("follow");
      }

    } catch (error) {
      toast.error("Action failed, please try again");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex justify-center items-center bg-[#F8FAFC]">
        <Loader size="40px" color="#3b82f6" />
      </div>
    );
  }

  if (!profileData) {
    return (
      <div className="min-h-screen flex justify-center items-center bg-[#F8FAFC]">
        <h2 className="text-xl font-bold text-gray-500">User not found</h2>
      </div>
    );
  }

  const eventPosts = posts.filter((p) => p.isEvent);
  
  // ✅ SMART VISIBILITY: Allow viewing if public OR if connected
  const isPrivate = profileData.isPrivate === true || profileData.isPrivate === "true";
  const canViewContent = !isPrivate || followState === "following"; 

  return (
    <div className="w-full min-h-screen flex justify-center bg-[#F8FAFC] font-['Poppins',sans-serif] antialiased text-gray-900 pb-20">
      
      {/* Background blobs */}
      <div className="fixed top-[-10%] left-[-10%] w-[300px] h-[300px] md:w-[400px] md:h-[400px] bg-blue-100 rounded-full blur-[100px] md:blur-[120px] opacity-40 -z-10 pointer-events-none" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[300px] h-[300px] md:w-[400px] md:h-[400px] bg-purple-100 rounded-full blur-[100px] md:blur-[120px] opacity-40 -z-10 pointer-events-none" />

      <div className="w-full max-w-[935px] px-2 sm:px-4 py-6 md:py-8">

        {/* ================= HEADER SECTION ================= */}
        <header className="flex flex-col md:flex-row items-center md:items-start gap-6 md:gap-20 mb-8 md:mb-12 bg-white/60 backdrop-blur-xl border border-white/80 p-6 md:p-8 rounded-[30px] md:rounded-[40px] shadow-sm">
          
          {/* Profile Picture */}
          <div className="relative group flex-shrink-0">
            <div className="w-[100px] h-[100px] sm:w-[130px] sm:h-[130px] md:w-[160px] md:h-[160px] rounded-full p-[3px] md:p-[4px] bg-gradient-to-tr from-gray-200 to-gray-300 shadow-lg">
              <div className="bg-white p-1 rounded-full w-full h-full">
                <img
                  src={getProfileImage(profileData)}
                  className="w-full h-full rounded-full object-cover"
                  alt={profileData.username}
                />
              </div>
            </div>
          </div>

          <div className="flex-1 flex flex-col items-center md:items-start w-full">
            
            {/* Username & Action Button */}
            <div className="flex flex-col sm:flex-row items-center md:items-start gap-4 mb-4 sm:mb-6 w-full md:w-auto">
              <h2 className="text-[22px] sm:text-[28px] font-black tracking-tight flex items-center gap-2 text-center md:text-left">
                {profileData.username}
                <RoleBadge role={profileData.role} />
              </h2>
              
              <div className="flex gap-2">
                <button 
                  onClick={handleFollowClick}
                  disabled={actionLoading}
                  className={`px-6 sm:px-8 py-2 rounded-xl text-[13px] sm:text-sm font-bold shadow-sm transition-all active:scale-95 flex items-center justify-center min-w-[110px] sm:min-w-[120px]
                    ${followState === "following" 
                      ? "bg-white/80 hover:bg-white border border-gray-200 text-gray-800" 
                      : followState === "requested"
                      ? "bg-gray-200 text-gray-600 cursor-not-allowed"
                      : "bg-[#0095f6] hover:bg-[#1877f2] text-white"
                    }`}
                >
                  {actionLoading ? (
                    <div className={`w-4 h-4 border-2 border-t-transparent rounded-full animate-spin ${followState === "follow" ? "border-white/50" : "border-gray-500"}`}></div>
                  ) : followState === "following" ? (
                    "Connected" // 🔥 UPDATED HERE
                  ) : followState === "requested" ? (
                    "Requested"
                  ) : (
                    "Connect"   // 🔥 UPDATED HERE
                  )}
                </button>
              </div>
            </div>

            {/* Stats (Posts, Followers, Following) */}
            <div className="flex gap-6 sm:gap-10 mb-4 sm:mb-6 w-full justify-center md:justify-start border-y border-gray-200/50 md:border-none py-3 md:py-0">
              <div className="text-center md:text-left flex flex-col md:flex-row md:gap-1">
                <span className="font-black text-base sm:text-lg">{posts.length}</span> 
                <span className="text-gray-500 font-medium text-[13px] sm:text-base">posts</span>
              </div>
              <div className="text-center md:text-left flex flex-col md:flex-row md:gap-1 cursor-pointer">
                <span className="font-black text-base sm:text-lg">{profileData.followers?.length || 0}</span> 
                <span className="text-gray-500 font-medium text-[13px] sm:text-base">followers</span>
              </div>
              <div className="text-center md:text-left flex flex-col md:flex-row md:gap-1 cursor-pointer">
                <span className="font-black text-base sm:text-lg">{profileData.following?.length || 0}</span> 
                <span className="text-gray-500 font-medium text-[13px] sm:text-base">following</span>
              </div>
            </div>

            {/* Bio Section */}
            <div className="text-center md:text-left px-2 md:px-0">
              <p className="font-bold text-[15px] sm:text-lg mb-0.5 sm:mb-1">{profileData.name}</p>
              <p className="text-gray-600 font-medium whitespace-pre-wrap leading-relaxed max-w-[450px] text-[13px] sm:text-[15px]">
                {profileData.bio || "No bio available."}
              </p>
            </div>
          </div>
        </header>

        {/* ================= CONTENT VISIBILITY ================= */}
        {!canViewContent ? (
          
          <div className="flex flex-col items-center justify-center mt-6 md:mt-12 py-16 md:py-20 bg-white/60 backdrop-blur-md rounded-[30px] md:rounded-[40px] border border-white/80 shadow-sm text-center px-4">
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-full border-2 border-gray-800 flex items-center justify-center mb-4 md:mb-6">
               <FaLock className="text-gray-800 text-2xl md:text-3xl" />
            </div>
            <h2 className="text-[20px] md:text-[26px] font-black text-gray-900 tracking-tight mb-2">This Account is Private</h2>
            <p className="text-gray-500 font-medium text-[14px] md:text-[16px] max-w-[300px]">
              {/* 🔥 UPDATED HERE */}
              Connect with <span className="font-bold text-gray-800">@{profileData.username}</span> to see their photos and videos.
            </p>
          </div>

        ) : (

          <>
            {/* TABS */}
            <div className="flex justify-center border-t border-gray-200/60 mt-2 md:mt-4">
              <div className="flex gap-12 sm:gap-16">
                {[
                  { id: "posts", label: "POSTS", icon: <FaTh /> },
                  { id: "events", label: "EVENTS", icon: <FaCalendarAlt /> }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 py-3 sm:py-4 text-[11px] sm:text-[12px] font-black tracking-widest transition-all ${
                      activeTab === tab.id
                        ? "border-t-[2px] sm:border-t-[3px] border-blue-600 text-blue-600"
                        : "text-gray-400 hover:text-gray-600 border-t-[2px] sm:border-t-[3px] border-transparent"
                    }`}
                  >
                    <span className="text-sm sm:text-base">{tab.icon}</span>
                    <span className="hidden sm:inline">{tab.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* GRID */}
            <div className="grid grid-cols-3 gap-1 sm:gap-2 md:gap-4 mt-2 sm:mt-6">
              {(activeTab === "posts" ? posts : eventPosts).length > 0 ? (
                (activeTab === "posts" ? posts : eventPosts).map((post) => {
                  
                  const isVideo = post.mediaType === "video" || post.type === "video" || post.video;
                  const mediaSrc = post.mediaUrl || post.media || post.image || post.video;

                  return (
                    <div key={post._id} className="relative group aspect-square md:rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 bg-gray-100 cursor-pointer">
                      
                      {isVideo ? (
                        <video src={mediaSrc} className="w-full h-full object-cover" />
                      ) : (
                        <img src={mediaSrc} className="w-full h-full object-cover" alt="post" />
                      )}

                      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col sm:flex-row justify-center items-center gap-2 sm:gap-6 text-white z-10">
                        <span className="flex items-center gap-1.5 sm:gap-2 font-black text-sm sm:text-lg">
                          <FaHeart className="text-base sm:text-xl" /> {post.likesCount || post.likes?.length || 0}
                        </span>
                        <span className="flex items-center gap-1.5 sm:gap-2 font-black text-sm sm:text-lg">
                          <FaComment className="text-base sm:text-xl scale-x-[-1]" /> {post.comments?.length || 0}
                        </span>
                      </div>

                      {isVideo && (
                        <div className="absolute top-2 right-2 sm:top-3 sm:right-3 z-20 bg-black/30 backdrop-blur-md p-1.5 sm:p-2 rounded-lg border border-white/20">
                          <FaPlay className="text-white text-[8px] sm:text-[10px]" />
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                 <div className="col-span-3 py-16 sm:py-20 text-center flex flex-col items-center">
                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full border-2 border-gray-300 flex items-center justify-center text-gray-400 text-xl sm:text-2xl mb-4">
                       {activeTab === "posts" ? <FaTh /> : <FaCalendarAlt />}
                    </div>
                    <h3 className="text-lg sm:text-xl font-bold text-gray-800">No {activeTab} yet</h3>
                 </div>
              )}
            </div>
          </>
        )}

      </div>
    </div>
  );
}

export default UserProfile;