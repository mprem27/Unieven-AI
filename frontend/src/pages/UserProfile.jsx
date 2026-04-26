import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
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
  const navigate = useNavigate();
  const { user: currentUser } = useAuth(); // GET LOGGED IN USER

  const decodedUsername = decodeURIComponent(username);
  
  const [profileData, setProfileData] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("posts");

  const [followState, setFollowState] = useState("follow"); 
  const [actionLoading, setActionLoading] = useState(false);

  // 🔥 LOCAL CACHING: Remembers states even if the backend hides them on refresh
  const getLocalPending = () => JSON.parse(localStorage.getItem("pending_reqs") || "[]");
  
  const addLocalPending = (id) => {
    const reqs = getLocalPending();
    if (!reqs.includes(id)) localStorage.setItem("pending_reqs", JSON.stringify([...reqs, id]));
  };
  
  const removeLocalPending = (id) => {
    const reqs = getLocalPending().filter((reqId) => reqId !== id);
    localStorage.setItem("pending_reqs", JSON.stringify(reqs));
  };

  useEffect(() => {
    const loadUserProfile = async () => {
      try {
        setLoading(true);
        
        const res = await getProfile(decodedUsername);
        
        if (res && res.user) {
          setProfileData(res.user);
          
          const userId = res.user._id;
          const isLocallyRequested = getLocalPending().includes(userId);

          // BULLETPROOF SYNC LOGIC
          const checkMatch = (arr) => arr?.some((item) => (item._id || item).toString() === currentUser?._id?.toString());

          // Check BOTH boolean flags AND the arrays + cache to prevent refresh resets
          const isCurrentlyFollowing = res.user.isFollowing === true || checkMatch(res.user.followers);
          const isCurrentlyRequested = res.user.isRequested === true || checkMatch(res.user.followRequests) || isLocallyRequested;

          if (isCurrentlyFollowing) {
            setFollowState("following");
            removeLocalPending(userId); // Cleanup cache if they are fully connected
          } else if (isCurrentlyRequested) {
            setFollowState("requested");
          } else {
            setFollowState("follow");
          }

          // Fetch posts using the service
          const postsRes = await getUserPosts(userId);
          setPosts(postsRes?.posts || []);
        } else {
          toast.error("User not found");
        }
      } catch (err) {
        toast.error(err?.message || "Failed to load profile");
      } finally {
        setLoading(false);
      }
    };

    loadUserProfile();
  }, [decodedUsername, currentUser?._id]);

  // ✅ PERFECT BACKEND RE-SYNC LOGIC
  const handleFollowClick = async () => {
    if (!profileData?._id || actionLoading) return;

    const userId = profileData._id;
    setActionLoading(true);

    try {
      const res = await followUser(userId);

      // Read direct backend response
      const status = res?.status;
      const msg = (res?.message || "").toLowerCase();

      if (status === "follow" || msg.includes("unfollow") || msg.includes("remove") || msg.includes("cancel")) {
        setFollowState("follow");
        removeLocalPending(userId);
        
      } else if (status === "requested" || msg.includes("request")) {
        setFollowState("requested");
        addLocalPending(userId);
        
      } else if (status === "accepted" || msg.includes("accept") || msg.includes("success") || msg.includes("follow")) {
        setFollowState("following");
        removeLocalPending(userId);
        
      } else {
        // Optimistic Fallback if backend response is weird
        const isPrivate = profileData.isPrivate === true || profileData.isPrivate === "true";

        if (followState === "follow") { 
          setFollowState(isPrivate ? "requested" : "following");
          if (isPrivate) addLocalPending(userId);
        } else { 
          setFollowState("follow");
          removeLocalPending(userId);
        }
      }

      // 🔥 REFRESH PROFILE AFTER ACTION TO GUARANTEE SYNC
      const updatedProfile = await getProfile(decodedUsername);

      if (updatedProfile?.user) {
        setProfileData(updatedProfile.user); // Update followers count instantly

        const checkMatch = (arr) =>
          arr?.some(
            (item) =>
              (item._id || item).toString() ===
              currentUser?._id?.toString()
          );

        const isCurrentlyFollowing =
          updatedProfile.user.isFollowing === true ||
          checkMatch(updatedProfile.user.followers);

        const isCurrentlyRequested =
          updatedProfile.user.isRequested === true ||
          checkMatch(updatedProfile.user.followRequests);

        if (isCurrentlyFollowing) {
          setFollowState("following");
          removeLocalPending(userId);
        } else if (isCurrentlyRequested) {
          setFollowState("requested");
        } else {
          setFollowState("follow");
        }
      }

    } catch (error) {
      toast.error(
        error?.message || "Action failed, please try again"
      );
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="h-screen flex justify-center items-center bg-white">
        <Loader size="40px" color="#3b82f6" />
      </div>
    );
  }

  if (!profileData) {
    return (
      <div className="h-screen flex justify-center items-center bg-white">
        <h2 className="text-xl font-bold text-gray-500">User not found</h2>
      </div>
    );
  }

  const eventPosts = posts.filter((p) => p.isEvent === true || p.isEvent === "true");
  const currentDisplayList = activeTab === "posts" ? posts.filter(p => !p.isEvent && p.isEvent !== "true") : eventPosts;
  
  // SMART VISIBILITY (Includes check if it's your own profile)
  const isPrivate = profileData.isPrivate === true || profileData.isPrivate === "true";
  const isOwnProfile = profileData._id === currentUser?._id;
  const canViewContent = !isPrivate || followState === "following" || isOwnProfile; 
  const hasStory = profileData?.hasStory || profileData?.stories?.length > 0;

  return (
    <div className="w-full min-h-screen bg-white flex flex-col items-center pb-12 font-['-apple-system','BlinkMacSystemFont','Segoe_UI','Roboto','Helvetica','Arial',sans-serif]">
      
      <div className="w-full max-w-[935px]">
        
        {/* ================= INSTAGRAM STYLE HEADER ================= */}
        <header className="px-4 py-6 md:py-10 flex flex-col gap-5">
          
          {/* Top Row: Avatar + Stats */}
          <div className="flex items-center gap-8 md:gap-20">
            {/* Profile Avatar */}
            <div className="relative shrink-0">
              <div className={`w-[80px] h-[80px] md:w-[150px] md:h-[150px] rounded-full p-[2px] md:p-[4px] ${
                hasStory ? "bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-600" : "bg-gray-200"
              }`}>
                <div className="bg-white p-1 rounded-full w-full h-full">
                  <img src={getProfileImage(profileData)} className="w-full h-full rounded-full object-cover" alt="" />
                </div>
              </div>
            </div>

            {/* Stats Block */}
            <div className="flex flex-1 justify-around md:justify-start md:gap-14">
              <div className="flex flex-col items-center">
                <span className="font-bold text-base md:text-xl">{posts.length}</span>
                <span className="text-[12px] md:text-base text-gray-500">posts</span>
              </div>
              <div className="flex flex-col items-center cursor-pointer">
                <span className="font-bold text-base md:text-xl">{profileData.followers?.length || 0}</span>
                <span className="text-[12px] md:text-base text-gray-500">connects</span>
              </div>
              <div className="flex flex-col items-center cursor-pointer">
                <span className="font-bold text-base md:text-xl">{profileData.following?.length || 0}</span>
                <span className="text-[12px] md:text-base text-gray-500">connections</span>
              </div>
            </div>
          </div>

          {/* Info Block: Full Name, Username & Bio */}
          <div className="flex flex-col px-1">
            <h1 className="font-bold text-[15px] md:text-lg mb-0.5">{profileData.name}</h1>
            
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-sm md:text-base font-medium text-gray-600">@{profileData.username}</h2>
              <RoleBadge role={profileData.role} />
            </div>

            <p className="text-sm text-gray-900 whitespace-pre-wrap leading-snug mt-1">
              {profileData.bio || "No bio available."}
            </p>
            
            <div className="flex flex-wrap gap-2 mt-2">
              <span className="text-blue-600 text-[11px] font-bold">#VelTech</span>
              <span className="text-blue-600 text-[11px] font-bold">#CST2026</span>
            </div>
          </div>

          {/* Action Buttons (Follow/Edit) */}
          <div className="flex gap-2 w-full mt-2">
            {!isOwnProfile ? (
              <button 
                onClick={handleFollowClick}
                disabled={actionLoading}
                className={`flex-1 w-full py-1.5 md:py-2 rounded-lg text-sm font-semibold transition-all active:scale-95 flex items-center justify-center
                  ${followState === "following" 
                    ? "bg-[#efefef] hover:bg-red-50 hover:text-red-600 text-black border border-gray-200" 
                    : followState === "requested"
                    ? "bg-[#efefef] text-gray-600 cursor-not-allowed"
                    : "bg-[#0095f6] hover:bg-[#1877f2] text-white"
                  }`}
              >
                {actionLoading ? (
                  <div className={`w-4 h-4 border-2 border-t-transparent rounded-full animate-spin ${followState === "follow" ? "border-white/50" : "border-gray-500"}`}></div>
                ) : followState === "following" ? (
                  "Unconnect" // 🔥 UPDATED HERE
                ) : followState === "requested" ? (
                  "Connecting" 
                ) : (
                  "Connect" 
                )}
              </button>
            ) : (
              <button 
                onClick={() => navigate("/edit-profile")}
                className="flex-1 w-full bg-[#efefef] hover:bg-gray-200 text-black px-4 py-1.5 rounded-lg text-sm font-semibold transition-all active:scale-95"
              >
                Edit Profile
              </button>
            )}
            
            {/* Example message button (Instagram style) */}
            {!isOwnProfile && followState === "following" && (
              <button onClick={() => toast.info("Messaging is not available yet")} className="flex-1 bg-[#efefef] hover:bg-gray-200 text-black px-4 py-1.5 rounded-lg text-sm font-semibold transition-all active:scale-95">
                Message(This Futhere is not Available)
              </button>
            )}
          </div>

        </header>

        {/* ================= CONTENT VISIBILITY & TABS ================= */}
        {!canViewContent ? (
          
          <div className="flex flex-col items-center justify-center py-20 text-center border-t border-gray-200 mt-4">
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-full border-2 border-gray-800 flex items-center justify-center mb-4">
               <FaLock className="text-gray-800 text-2xl md:text-3xl" />
            </div>
            <h2 className="text-lg md:text-xl font-bold text-gray-900 tracking-tight mb-2">This Account is Private</h2>
            <p className="text-gray-500 font-medium text-sm md:text-base max-w-[300px]">
              Connect with <span className="font-bold text-gray-800">@{profileData.username}</span> to see their photos and videos.
            </p>
          </div>

        ) : (

          <>
            {/* ================= TABS ================= */}
            <div className="border-t border-gray-200 sticky top-0 md:top-[60px] bg-white z-30">
              <div className="flex justify-around items-center max-w-[400px] mx-auto md:max-w-none">
                {[
                  { id: "posts", icon: <FaTh />, label: "POSTS" },
                  { id: "events", icon: <FaCalendarAlt />, label: "EVENTS" }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex-1 flex justify-center items-center gap-2 py-3 transition-all relative ${
                      activeTab === tab.id ? "text-gray-900" : "text-gray-400"
                    }`}
                  >
                    <span className="text-lg md:text-sm">{tab.icon}</span>
                    <span className="hidden md:inline text-xs font-bold tracking-widest">{tab.label}</span>
                    {activeTab === tab.id && (
                      <div className="absolute top-[-1px] w-12 md:w-full h-[1px] md:h-[2px] bg-gray-900" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* ================= GRID CONTENT ================= */}
            <div className="grid grid-cols-3 gap-[1px] md:gap-4 mt-1 md:mt-4">
              {currentDisplayList.length > 0 ? (
                currentDisplayList.map((post) => {
                  const isVideo = post.mediaType === "video" || post.type === "video" || post.video || post.feedItemType === "reel";
                  const mediaSrc = post.mediaUrl || post.media || post.image || post.video;
                  
                  return (
                    <div 
                      key={post._id} 
                      onClick={() => navigate(`/post/${post._id}`)} 
                      className="relative aspect-square overflow-hidden cursor-pointer bg-gray-100 group"
                    >
                      {isVideo ? (
                        <video src={mediaSrc} className="w-full h-full object-cover" />
                      ) : (
                        <img src={mediaSrc} className="w-full h-full object-cover" alt="" />
                      )}
                      
                      {/* Hover Stats (Desktop) */}
                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity hidden md:flex justify-center items-center gap-6 text-white">
                        <span className="flex items-center gap-1.5 font-bold"><FaHeart /> {post.likesCount || post.likes?.length || 0}</span>
                        <span className="flex items-center gap-1.5 font-bold"><FaComment /> {post.comments?.length || 0}</span>
                      </div>
                      
                      {isVideo && (
                        <div className="absolute top-2 right-2 text-white drop-shadow-md">
                          <FaPlay size={10} />
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="col-span-3 py-24 text-center flex flex-col items-center">
                  <div className="w-14 h-14 rounded-full border-2 border-gray-300 flex items-center justify-center text-gray-400 text-2xl mb-4">
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