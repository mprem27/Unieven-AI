import React, { useState, useEffect, useRef } from "react";
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

// 🔥 FONT MAP
const fontMap = {
  classic: "font-sans font-bold",
  typewriter: "font-serif italic",
  modern: "font-mono uppercase tracking-widest",
  impact: "font-black uppercase tracking-tight",
  cursive: "font-[cursive]",
  marker: "font-[fantasy] tracking-wide",
  sleek: "font-sans font-light tracking-[0.3em] uppercase",
};

// 🔥 TEXT STYLE HELPER
const getTextStyle = (post) => {
  switch (post.textStyle) {
    case "highlight":
      return {
        background: "rgba(0,0,0,0.45)",
        padding: "4px 16px",
        borderRadius: "14px",
      };
    case "neon":
      return {
        textShadow: "0 0 8px currentColor, 0 0 16px currentColor",
      };
    case "outline":
      return {
        WebkitTextStroke: "1px black",
      };
    case "glitch":
      return {
        textShadow: "2px 0 red, -2px 0 cyan",
      };
    case "3d-pop":
      return {
        textShadow: "3px 3px 0 rgba(0,0,0,0.4)",
      };
    default:
      return {};
  }
};

// Event expiry helper
const isEventExpired = (event) => {
  if (!event?.date) return false;
  try {
    const dateStr = typeof event.date === 'string' ? event.date : new Date(event.date).toISOString();
    const datePart = dateStr.split("T")[0];
    const timePart = event.time || "23:59";
    return new Date(`${datePart}T${timePart}`) < new Date();
  } catch {
    return new Date(event.date) < new Date();
  }
};

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

  // LOCAL CACHING: Remembers states even if the backend hides them on refresh
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

          // 🔥 FIX 5: FETCH NORMALIZATION & MERGE
          const postsRes = await getUserPosts(userId);
          const validPosts = [
            ...(postsRes?.posts || []),
            ...(postsRes?.reels || []),
          ]
            .filter((p) => p && p._id && p.user?._id)
            .map((p) => ({
              ...p,
              user: p.user || {},
              feedItemType:
                p.feedItemType ||
                (p.video || p.type === "video" ? "reel" : "post"),
            }));
            
          setPosts(validPosts);
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

  // PERFECT BACKEND RE-SYNC LOGIC
  const handleFollowClick = async () => {
    if (!profileData?._id || actionLoading) return;

    const userId = profileData._id;
    setActionLoading(true);

    try {
      const res = await followUser(userId);

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
        const isPrivate = profileData.isPrivate === true || profileData.isPrivate === "true";

        if (followState === "follow") { 
          setFollowState(isPrivate ? "requested" : "following");
          if (isPrivate) addLocalPending(userId);
        } else { 
          setFollowState("follow");
          removeLocalPending(userId);
        }
      }

      const updatedProfile = await getProfile(decodedUsername);

      if (updatedProfile?.user) {
        setProfileData(updatedProfile.user);

        const checkMatch = (arr) =>
          arr?.some((item) => (item._id || item).toString() === currentUser?._id?.toString());

        const isCurrentlyFollowing = updatedProfile.user.isFollowing === true || checkMatch(updatedProfile.user.followers);
        const isCurrentlyRequested = updatedProfile.user.isRequested === true || checkMatch(updatedProfile.user.followRequests);

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
      toast.error(error?.message || "Action failed, please try again");
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

  // EVENT SEPARATION (History Removed)
  const allEvents = posts.filter((p) => p.isEvent === true || p.isEvent === "true");
  const activeEvents = allEvents.filter((e) => !isEventExpired(e));

  // 🔥 FIX 1: BULLETPROOF FILTER (Posts + Reels merged, History gone)
  const currentDisplayList =
    activeTab === "posts"
      ? posts.filter((p) => {
          if (!p || !p._id) return false;

          if (p.isEvent === true || p.isEvent === "true") {
            return false;
          }

          return (
            p.feedItemType === "post" ||
            p.feedItemType === "reel" ||
            p.type === "video" ||
            p.video
          );
        })
      : activeEvents.filter((p) => p && p._id);
  
  // SMART VISIBILITY
  const isPrivate = profileData.isPrivate === true || profileData.isPrivate === "true";
  const isOwnProfile = profileData._id === currentUser?._id;
  const canViewContent = !isPrivate || followState === "following" || isOwnProfile; 
  const hasStory = profileData?.hasStory || profileData?.stories?.length > 0;

  const postsCount = posts.filter(p => p.isEvent !== true && p.isEvent !== "true").length;

  return (
    <div className="w-full min-h-screen bg-white flex flex-col items-center font-['-apple-system','BlinkMacSystemFont','Segoe_UI','Roboto','Helvetica','Arial',sans-serif]">
      
      <div className="w-full max-w-[935px] mx-auto flex flex-col relative">
        
        {/* ================= INSTAGRAM STYLE HEADER ================= */}
        <header className="px-4 py-6 md:py-10 flex flex-col gap-4 md:gap-5 bg-white shrink-0">
          
          <div className="flex flex-row items-center gap-6 md:gap-14 w-full">
            <div className="relative shrink-0">
              <div className={`w-[80px] h-[80px] md:w-[150px] md:h-[150px] rounded-full p-[2px] md:p-[4px] ${
                hasStory ? "bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-600" : "bg-gray-200"
              }`}>
                <div className="bg-white p-1 rounded-full w-full h-full">
                  <img src={getProfileImage(profileData)} className="w-full h-full rounded-full object-cover" alt="" />
                </div>
              </div>
            </div>

            {/* STATS BLOCK */}
            <div className="flex flex-1 justify-around md:justify-start gap-2 sm:gap-10 w-full md:pt-4">
              <div className="flex flex-col items-center">
                <span className="font-black text-base md:text-xl text-gray-900">{postsCount}</span>
                <span className="text-[10px] sm:text-[13px] text-gray-500 font-semibold tracking-wide uppercase">Posts</span>
              </div>
              <div className="flex flex-col items-center cursor-pointer">
                <span className="font-black text-base md:text-xl text-gray-900">{profileData.followers?.length || 0}</span>
                <span className="text-[10px] sm:text-[13px] text-gray-500 font-semibold tracking-wide uppercase">Connects</span>
              </div>
              <div className="flex flex-col items-center cursor-pointer">
                <span className="font-bold text-base md:text-xl text-gray-900">{profileData.following?.length || 0}</span>
                <span className="text-[10px] sm:text-[13px] text-gray-500 font-semibold tracking-wide uppercase">Connections</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col px-1 mt-1 md:mt-2">
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

          <div className="flex gap-2 w-full mt-1 md:mt-2">
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
                  "Unconnect" 
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
            
            {!isOwnProfile && followState === "following" && (
              <button onClick={() => toast.info("Messaging is not available yet")} className="flex-1 bg-[#efefef] hover:bg-gray-200 text-black px-4 py-1.5 rounded-lg text-sm font-semibold transition-all active:scale-95">
                Message (Coming Soon)
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
            <div className="border-t border-gray-200 sticky top-0 md:top-[60px] bg-white z-30 shrink-0">
              <div className="flex justify-around items-center max-w-[400px] mx-auto md:max-w-none">
                {/* 🔥 FIX 2: TABS ARRAY UPDATED (Removed History) */}
                {[
                  { id: "posts", icon: <FaTh />, label: "POSTS" },
                  { id: "events", icon: <FaCalendarAlt />, label: "EVENTS" }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id);
                      setTimeout(() => {
                        const section = document.getElementById("profile-grid-section");
                        if (section) {
                          section.scrollIntoView({
                            behavior: "smooth",
                            block: "start",
                          });
                        }
                      }, 50);
                    }}
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
            <div id="profile-grid-section" className="w-full bg-white min-h-[400px]">
              <div className="grid grid-cols-3 gap-[1px] md:gap-4 mt-1 md:mt-4 md:px-4 pb-28 auto-rows-fr">
                {currentDisplayList.length > 0 ? (
                  currentDisplayList.map((post) => {
                    const isVideo = post.mediaType === "video" || post.type === "video" || post.video || post.feedItemType === "reel";
                    const mediaSrc = post.mediaUrl || post.media || post.image || post.video;
                    
                    return (
                      <div 
                        key={post._id} 
                        // 🔥 FIX 4: FIX POST CLICK FOR REELS
                        onClick={() => navigate(post.feedItemType === "reel" ? `/reels` : `/post/${post._id}`)}
                        className="relative aspect-square min-h-[120px] md:min-h-[250px] overflow-hidden cursor-pointer bg-gray-100 group rounded-sm"
                      >
                        {/* MEDIA VISIBILITY */}
                        {isVideo ? (
                          <video src={mediaSrc} poster="/fallback-post.jpg" className="w-full h-full object-cover block" autoPlay loop muted playsInline preload="metadata" />
                        ) : (
                          <img 
                            src={mediaSrc || "/fallback-post.jpg"} 
                            onError={(e) => { e.target.src = "/fallback-post.jpg" }}
                            className="w-full h-full object-cover block" 
                            loading="lazy"
                            alt="" 
                          />
                        )}
                        
                        {/* OVERLAY TEXT */}
                        {(post.overlayText || post.text) && (
                          <div
                            className={`absolute z-20 pointer-events-none text-center whitespace-pre-wrap break-words ${fontMap[post.textFont] || fontMap.classic}`}
                            style={{
                              top: `${(post.textY ?? 0.5) * 100}%`,
                              left: `${(post.textX ?? 0.5) * 100}%`,
                              transform: "translate(-50%, -50%)",
                              color: post.textColor || "white",
                              fontSize: `${Math.max(12, (post.textSize || 42) * 0.28)}px`,
                              filter: post.filter || "none",
                              lineHeight: "1.3",
                              maxWidth: "90%",
                              padding: "2px 6px",
                              ...getTextStyle(post),
                            }}
                          >
                            {post.overlayText || post.text}
                          </div>
                        )}

                        {/* Hover Stats (Desktop) */}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity hidden md:flex justify-center items-center gap-6 text-white z-30">
                          <span className="flex items-center gap-1.5 font-bold"><FaPlay /> {post.feedItemType === "reel" ? (typeof post.views === "number" ? post.views : post.views?.length || 0) : post.views?.length || 0}</span>
                          <span className="flex items-center gap-1.5 font-bold"><FaHeart /> {post.likesCount || post.likes?.length || 0}</span>
                          <span className="flex items-center gap-1.5 font-bold"><FaComment /> {post.comments?.length || 0}</span>
                        </div>
                        
                        {isVideo && (
                          <div className="absolute top-2 right-2 text-white drop-shadow-md z-30">
                            <FaPlay size={12} />
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="col-span-3 min-h-[50vh] flex flex-col justify-center items-center text-center">
                    <div className="w-14 h-14 rounded-full border-2 border-gray-300 flex items-center justify-center text-gray-400 text-2xl mb-4">
                      {/* 🔥 FIX 3: EMPTY STATE ICON */}
                      {activeTab === "posts" ? <FaTh /> : <FaCalendarAlt />}
                    </div>
                    <h3 className="text-xl font-bold text-gray-800 uppercase tracking-widest text-sm">No {activeTab} yet</h3>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

      </div>
    </div>
  );
}

export default UserProfile;