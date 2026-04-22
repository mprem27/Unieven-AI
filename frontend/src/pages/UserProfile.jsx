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
        
        // 🔥 FIXED HERE
        const res = await getProfile(decodedUsername);
        
        if (res && res.user) {
          setProfileData(res.user);
          
          // ✅ 🔥 FIX INITIAL STATE (IMPORTANT)
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

  // ✅ 🔥 FINAL FIX (ONLY LOGIC CHANGE)
  const handleFollowClick = async () => {
    if (!profileData?._id || actionLoading) return;

    setActionLoading(true);

    try {
      // ❌ REMOVE GUESS LOGIC
      // ✅ WAIT FOR BACKEND RESPONSE ONLY

      const res = await followUser(profileData._id);

      // 🔥 STRICT BACKEND CONTROL
      if (res?.status === "requested") {
        setFollowState("requested");
      } else if (res?.status === "accepted") {
        setFollowState("following");
      } else if (res?.status === "unfollowed") {
        setFollowState("follow");
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
      <div className="h-screen flex justify-center items-center bg-[#F8FAFC]">
        <Loader size="40px" color="#3b82f6" />
      </div>
    );
  }

  if (!profileData) {
    return (
      <div className="h-screen flex justify-center items-center bg-[#F8FAFC]">
        <h2 className="text-xl font-bold text-gray-500">User not found</h2>
      </div>
    );
  }

  const eventPosts = posts.filter((p) => p.isEvent);
  
  // ✅ 🔥 CONTENT VISIBILITY (KEEP THIS)
  const canViewContent = followState === "following"; 

  return (
    <div className="w-full min-h-screen flex justify-center bg-[#F8FAFC] font-['Poppins',sans-serif] antialiased text-gray-900">
      
      <div className="fixed top-[-10%] left-[-10%] w-[400px] h-[400px] bg-blue-100 rounded-full blur-[120px] opacity-40 -z-10" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[400px] h-[400px] bg-purple-100 rounded-full blur-[120px] opacity-40 -z-10" />

      <div className="w-full max-w-[935px] px-4 py-8">

        {/* ================= HEADER SECTION ================= */}
        <header className="flex flex-col md:flex-row items-center md:items-start gap-8 md:gap-20 mb-12 bg-white/40 backdrop-blur-xl border border-white/60 p-8 rounded-[40px] shadow-sm">
          
          <div className="relative group flex-shrink-0">
            <div className="w-[160px] h-[160px] rounded-full p-[4px] bg-gradient-to-tr from-gray-200 to-gray-300 shadow-lg">
              <div className="bg-white p-1 rounded-full w-full h-full">
                <img
                  src={getProfileImage(profileData)}
                  className="w-full h-full rounded-full object-cover"
                  alt={profileData.username}
                />
              </div>
            </div>
          </div>

          <div className="flex-1 flex flex-col items-center md:items-start">
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 mb-6">
              <h2 className="text-[28px] font-black tracking-tight flex items-center gap-2">
                {profileData.username}
                <RoleBadge role={profileData.role} />
              </h2>
              
              <div className="flex gap-2">
                <button 
                  onClick={handleFollowClick}
                  disabled={actionLoading}
                  className={`px-8 py-2 rounded-xl text-sm font-bold shadow-sm transition-all active:scale-95 flex items-center justify-center min-w-[120px]
                    ${followState === "following" 
                      ? "bg-white/80 hover:bg-white border border-gray-200 text-gray-800" 
                      : followState === "requested"
                      ? "bg-gray-200 text-gray-600 cursor-not-allowed"
                      : "bg-[#0095f6] hover:bg-[#1877f2] text-white"
                    }`}
                >
                  {actionLoading ? (
                    <Loader size="16px" color={followState === "follow" ? "#fff" : "#000"} />
                  ) : followState === "following" ? (
                    "Following"
                  ) : followState === "requested" ? (
                    "Requested"
                  ) : (
                    "Follow"
                  )}
                </button>
              </div>
            </div>

            <div className="hidden md:flex gap-10 mb-6">
              <div className="text-center md:text-left">
                <span className="font-black text-lg">{posts.length}</span> <span className="text-gray-500 font-medium ml-1">posts</span>
              </div>
              <div className="text-center md:text-left cursor-pointer">
                <span className="font-black text-lg">{profileData.followers?.length || 0}</span> <span className="text-gray-500 font-medium ml-1">followers</span>
              </div>
              <div className="text-center md:text-left cursor-pointer">
                <span className="font-black text-lg">{profileData.following?.length || 0}</span> <span className="text-gray-500 font-medium ml-1">following</span>
              </div>
            </div>

            <div className="text-center md:text-left">
              <p className="font-bold text-lg mb-1">{profileData.name}</p>
              <p className="text-gray-600 font-medium whitespace-pre-wrap leading-relaxed max-w-[450px]">
                {profileData.bio || "No bio available."}
              </p>
            </div>
          </div>
        </header>

        {/* ================= CONTENT VISIBILITY ================= */}
        {!canViewContent ? (
          
          <div className="flex flex-col items-center justify-center mt-12 py-20 bg-white/40 backdrop-blur-md rounded-[40px] border border-white/60 shadow-sm text-center px-4">
            <div className="w-20 h-20 rounded-full border-2 border-gray-800 flex items-center justify-center mb-6">
               <FaLock className="text-gray-800 text-3xl" />
            </div>
            <h2 className="text-[26px] font-black text-gray-900 tracking-tight mb-2">Content Hidden</h2>
            <p className="text-gray-500 font-medium text-[16px] max-w-[300px]">
              Follow <span className="font-bold text-gray-800">@{profileData.username}</span> to see their posts and events.
            </p>
          </div>

        ) : (

          <>
            <div className="flex justify-center border-t border-gray-200/60 mt-4">
              <div className="flex gap-12 sm:gap-16">
                {[
                  { id: "posts", label: "POSTS", icon: <FaTh /> },
                  { id: "events", label: "EVENTS", icon: <FaCalendarAlt /> }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 py-4 text-[12px] font-black tracking-widest transition-all ${
                      activeTab === tab.id
                        ? "border-t-2 border-blue-600 text-blue-600"
                        : "text-gray-400 hover:text-gray-600"
                    }`}
                  >
                    {tab.icon}
                    <span className="hidden sm:inline">{tab.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 md:gap-4 mt-6">
              {(activeTab === "posts" ? posts : eventPosts).length > 0 ? (
                (activeTab === "posts" ? posts : eventPosts).map((post) => {
                  
                  const isVideo = post.mediaType === "video" || post.type === "video" || post.video;
                  const mediaSrc = post.mediaUrl || post.media || post.image || post.video;

                  return (
                    <div key={post._id} className="relative group aspect-square rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 bg-gray-100">
                      
                      {isVideo ? (
                        <video src={mediaSrc} className="w-full h-full object-cover" />
                      ) : (
                        <img src={mediaSrc} className="w-full h-full object-cover" alt="post" />
                      )}

                      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-all duration-300 flex justify-center items-center gap-6 text-white z-10 cursor-pointer">
                        <span className="flex items-center gap-2 font-black text-lg">
                          <FaHeart className="text-xl" /> {post.likesCount || post.likes?.length || 0}
                        </span>
                        <span className="flex items-center gap-2 font-black text-lg">
                          <FaComment className="text-xl scale-x-[-1]" /> {post.comments?.length || 0}
                        </span>
                      </div>

                      {isVideo && (
                        <div className="absolute top-3 right-3 z-20 bg-black/20 backdrop-blur-md p-1.5 rounded-lg border border-white/20">
                          <FaPlay className="text-white text-[10px]" />
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                 <div className="col-span-3 py-20 text-center flex flex-col items-center">
                    <div className="w-16 h-16 rounded-full border-2 border-gray-300 flex items-center justify-center text-gray-400 text-2xl mb-4">
                       {activeTab === "posts" ? <FaTh /> : <FaCalendarAlt />}
                    </div>
                    <h3 className="text-xl font-bold text-gray-800">No {activeTab} yet</h3>
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