import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getProfile } from "../services/userService";
import { getFeed, deletePost, unsavePost } from "../services/postService"; 
import { getReels, deleteReel, unsaveReel } from "../services/reelService"; 
import Loader from "../components/Loader";
import ShareModal from "../components/ShareModal"; 
import { toast } from "react-toastify";
import { getProfileImage } from "../utils/getProfileImage";
import RoleBadge from "../components/RoleBadge"; 
import {
  FaHeart, FaComment, FaPlay, FaRegBookmark, FaTh,
  FaCalendarAlt, FaCog, FaTimes, FaTrash, FaShare,
  FaMapMarkerAlt, FaClock, FaEdit, FaHistory
} from "react-icons/fa";

// FONT MAP
const fontMap = {
  classic: "font-sans font-bold",
  typewriter: "font-serif italic",
  modern: "font-mono uppercase tracking-widest",
  impact: "font-black uppercase tracking-tight",
  cursive: "font-[cursive]",
  marker: "font-[fantasy] tracking-wide",
  sleek: "font-sans font-light tracking-[0.3em] uppercase",
};

// TEXT STYLE HELPER
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

function Profile() {
  const { user: currentUser, loading: authLoading } = useAuth();
  const [profileData, setProfileData] = useState(null);
  const [posts, setPosts] = useState([]);
  const [savedPosts, setSavedPosts] = useState([]); 
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("posts");
  const [selectedPost, setSelectedPost] = useState(null);
  const [openShare, setOpenShare] = useState(null);
  
  // Custom Delete Modal States
  const [itemToDelete, setItemToDelete] = useState(null);

  // ADDED REF FOR SCROLLING
  const gridScrollRef = useRef(null);

  useEffect(() => {
    let isMounted = true;
    const loadProfileData = async () => {
      if (!currentUser?._id) return;
      setLoading(true);
      try {
        const [userData, postsData, reelsData] = await Promise.all([
          getProfile(currentUser.username).catch(() => null),
          getFeed().catch(() => null),
          getReels().catch(() => null)
        ]);

        if (!isMounted) return;
        if (userData?.user) setProfileData(userData.user);

        const fetchedPosts = (postsData?.posts || [])
          .filter((p) => p.user && (p.user._id || typeof p.user === 'string'))
          .map(p => ({ 
            ...p, 
            user: p.user || {}, 
            feedItemType: "post" 
          }));
          
        const fetchedReels = (reelsData?.reels || [])
          .filter((r) => r.user && (r.user._id || typeof r.user === 'string'))
          .map(r => ({ 
            ...r, 
            user: r.user || {}, 
            feedItemType: "reel", 
            media: r.video || r.media, 
            type: "video" 
          }));
          
        const combinedFeed = [...fetchedPosts, ...fetchedReels].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        const myItems = combinedFeed.filter((p) => String(p.user?._id || p.user) === String(currentUser._id));
        
        // 🔥 STEP 2: FIX SAVED ITEMS MERGE
        const savedPostsSource = userData?.user?.savedPosts || currentUser?.savedPosts || [];
        const savedReelsSource = userData?.user?.savedReels || currentUser?.savedReels || [];

        const allSavedIds = [
          ...savedPostsSource.map((s) => String(s._id || s)),
          ...savedReelsSource.map((s) => String(s._id || s)),
        ];

        const mySaved = combinedFeed.filter((p) =>
          p && p._id && allSavedIds.includes(String(p._id))
        );
        
        setPosts(myItems);
        setSavedPosts(mySaved);
      } catch (err) {
        if (isMounted) toast.error("Error loading profile");
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    loadProfileData();
    return () => { isMounted = false; };
  }, [currentUser]);

  // 🔥 STEP 4: FIX DELETE / UNSAVE LOGIC
  const handleDeleteOrUnsave = async () => {
    try {
      if (activeTab === "saved") {
        if (itemToDelete.feedItemType === "reel") {
          await unsaveReel(itemToDelete._id);
        } else {
          await unsavePost(itemToDelete._id);
        }
        setSavedPosts((prev) => prev.filter((p) => p._id !== itemToDelete._id));
        toast.success("Removed from saved");
      } else {
        if (itemToDelete.feedItemType === "reel") {
          await deleteReel(itemToDelete._id);
        } else {
          await deletePost(itemToDelete._id);
        }
        setPosts((prev) => prev.filter((p) => p._id !== itemToDelete._id));
        toast.success("Deleted successfully");
      }

      setItemToDelete(null);
      setSelectedPost(null);

      window.dispatchEvent(new Event("profileUpdated"));
    } catch {
      toast.error("Action failed");
    }
  };

  if (authLoading || loading) {
    return (
      <div className="h-screen flex justify-center items-center bg-white">
        <Loader size="40px" color="#3b82f6" />
      </div>
    );
  }

  if (!profileData) return null;

  const allEvents = posts.filter((p) => p.isEvent === true || p.isEvent === "true");
  const activeEvents = allEvents.filter((e) => !isEventExpired(e));
  const historyEvents = allEvents.filter((e) => isEventExpired(e));

  // 🔥 STEP 3: FIX POSTS FILTER
  const currentDisplayList =
    activeTab === "posts"
      ? posts.filter((p) => {
          if (!p || !p._id) return false;
          if (p.isEvent === true || p.isEvent === "true") {
            return false;
          }
          return (p.feedItemType === "reel" || p.feedItemType === "post");
        })
      : activeTab === "saved"
      ? savedPosts.filter((p) => p && p._id)
      : activeTab === "events"
      ? activeEvents.filter((p) => p && p._id)
      : historyEvents.filter((p) => p && p._id);

  const hasStory = profileData?.hasStory || profileData?.stories?.length > 0;

  const postsCount = posts.length; 
  const reelsCount = posts.filter(p => p.feedItemType === "reel").length;
  const totalLikes = posts.reduce((sum, p) => sum + (p.likes?.length || 0), 0);

  return (
    <>
      {/* MAIN PAGE CONTAINER */}
      <div className="w-full min-h-screen bg-white flex flex-col items-center font-['-apple-system','BlinkMacSystemFont','Segoe_UI','Roboto','Helvetica','Arial',sans-serif]">
        
        {/* PROFILE WRAPPER */}
        <div className="w-full max-w-[935px] mx-auto flex flex-col relative">
          
          {/* ================= INSTAGRAM STYLE HEADER ================= */}
          <header className="px-4 py-6 md:py-10 flex flex-col gap-5 bg-white shrink-0">
            
            <div className="flex flex-col md:flex-row items-center md:items-start gap-8 md:gap-14">
              <div className="relative shrink-0">
                <div className={`w-[90px] h-[90px] md:w-[150px] md:h-[150px] rounded-full p-[2px] md:p-[4px] ${
                  hasStory ? "bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-600" : "bg-gray-200"
                }`}>
                  <div className="bg-white p-1 rounded-full w-full h-full">
                    <img src={getProfileImage(profileData)} className="w-full h-full rounded-full object-cover" alt="" />
                  </div>
                </div>
              </div>

              {/* STATS BLOCK */}
              <div className="flex flex-1 justify-center md:justify-start gap-4 sm:gap-10 flex-wrap w-full md:pt-4">
                <div className="flex flex-col items-center">
                  <span className="font-black text-base md:text-xl text-gray-900">{postsCount}</span>
                  <span className="text-[11px] sm:text-[13px] text-gray-500 font-semibold tracking-wide uppercase">Posts</span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="font-black text-base md:text-xl text-gray-900">{reelsCount}</span>
                  <span className="text-[11px] sm:text-[13px] text-gray-500 font-semibold tracking-wide uppercase">Reels</span>
                </div>
                <div className="flex flex-col items-center cursor-pointer">
                  <span className="font-black text-base md:text-xl text-gray-900">{profileData.followers?.length || 0}</span>
                  <span className="text-[11px] sm:text-[13px] text-gray-500 font-semibold tracking-wide uppercase">Connects</span>
                </div>
                <div className="flex flex-col items-center cursor-pointer">
                  <span className="font-bold text-base md:text-xl">{profileData.following?.length || 0}</span>
                  <span className="text-[11px] sm:text-[13px] text-gray-500 font-semibold tracking-wide uppercase">Connections</span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="font-black text-base md:text-xl text-gray-900">{totalLikes}</span>
                  <span className="text-[11px] sm:text-[13px] text-gray-500 font-semibold tracking-wide uppercase">Likes</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col px-1 mt-2">
              <h1 className="font-bold text-[15px] md:text-lg mb-0.5">{profileData.name}</h1>
              
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-sm md:text-base font-medium text-gray-600">@{profileData.username}</h2>
                <RoleBadge role={profileData.role} />
              </div>

              <p className="text-sm text-gray-900 whitespace-pre-wrap leading-snug mt-1">
                {profileData.bio || "Vel Tech Student | Building the future 🎓"}
              </p>
              
              <div className="flex flex-wrap gap-2 mt-2">
                <span className="text-blue-600 text-[11px] font-bold">#VelTech</span>
                <span className="text-blue-600 text-[11px] font-bold">#CST2026</span>
              </div>
            </div>

            <div className="flex gap-2 w-full mt-2">
              <Link to="/edit-profile" className="flex-1">
                <button className="w-full bg-[#efefef] hover:bg-gray-200 text-black px-4 py-1.5 rounded-lg text-sm font-semibold transition-all active:scale-95">
                  Edit Profile
                </button>
              </Link>
              <button className="bg-[#efefef] hover:bg-gray-200 p-2 rounded-lg text-black transition-all">
                <FaCog size={16} />
              </button>
            </div>
          </header>

          {/* ================= TABS ================= */}
          <div className="border-t border-gray-200 sticky top-0 bg-white z-30 shrink-0">
            <div className="flex justify-around items-center max-w-[400px] mx-auto md:max-w-none">
              {[
                { id: "posts", icon: <FaTh />, label: "POSTS" },
                { id: "saved", icon: <FaRegBookmark />, label: "SAVED" },
                { id: "events", icon: <FaCalendarAlt />, label: "EVENTS" },
                { id: "history", icon: <FaHistory />, label: "HISTORY" }
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

          {/* ================= SCROLLABLE GRID CONTENT ================= */}
          <div id="profile-grid-section" className="w-full bg-white">
            <div className="grid grid-cols-3 auto-rows-fr gap-[1px] md:gap-4 mt-1 md:mt-4 md:px-4 pb-28">
              {currentDisplayList.length > 0 ? (
                currentDisplayList.map((post) => {
                  const isVideo = post.mediaType === "video" || post.type === "video" || post.video || post.feedItemType === "reel";
                  const mediaSrc = post.mediaUrl || post.media || post.image || post.video;
                  
                  return (
                    <div key={post._id} onClick={() => setSelectedPost(post)} className="relative aspect-square min-h-[120px] md:min-h-[250px] overflow-hidden cursor-pointer bg-gray-100 group rounded-sm">
                      
                      {isVideo ? (
                        <video src={mediaSrc} poster="/fallback-post.jpg" className="w-full h-full object-cover block" muted playsInline />
                      ) : (
                        <img 
                          src={mediaSrc || "/fallback-post.jpg"} 
                          onError={(e) => { e.target.src = "https://placehold.co/400x400/eeeeee/999999?text=No+Image" }} 
                          className="w-full h-full object-cover block" 
                          alt="" 
                        />
                      )}
                      
                      {/* GRID POSTS OVERLAY */}
                      {(post.overlayText || post.text) && (
                        <div
                          className={`absolute z-20 pointer-events-none text-center whitespace-pre-wrap break-words ${fontMap[post.textFont] || fontMap.classic}`}
                          style={{
                            top: `${(post.textY || 0.5) * 100}%`,
                            left: `${(post.textX || 0.5) * 100}%`,
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
                        {/* 🔥 STEP 5: FIX REEL VIEWS */}
                        <span className="flex items-center gap-1.5 font-bold">
                          <FaPlay /> {post.feedItemType === "reel" ? (typeof post.views === "number" ? post.views : post.views?.length || 0) : post.views?.length || 0}
                        </span>
                        <span className="flex items-center gap-1.5 font-bold">
                          <FaHeart /> {post.likesCount || post.likes?.length || 0}
                        </span>
                        <span className="flex items-center gap-1.5 font-bold">
                          <FaComment /> {post.comments?.length || 0}
                        </span>
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
                    {activeTab === "posts" ? <FaTh /> : activeTab === "events" ? <FaCalendarAlt /> : activeTab === "saved" ? <FaRegBookmark /> : <FaHistory />}
                  </div>
                  <h3 className="text-xl font-bold text-gray-800 uppercase tracking-widest text-sm">No {activeTab} yet</h3>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ================= POST MODAL ================= */}
      {selectedPost && (
        <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center bg-black/80 backdrop-blur-sm sm:p-4">
          <div className="absolute inset-0" onClick={() => setSelectedPost(null)}></div>
          
          <div className="bg-white md:rounded-2xl rounded-t-2xl w-full max-w-[95vw] md:max-w-[650px] max-h-[95vh] flex flex-col overflow-hidden relative z-10 animate-in slide-in-from-bottom duration-300">
            
            <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto my-3 md:hidden shrink-0"></div>

            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
              <div className="flex items-center gap-3">
                <img src={getProfileImage(selectedPost.user)} className="w-8 h-8 rounded-full object-cover" alt="" />
                <span className="font-bold text-sm">{selectedPost.user?.username || currentUser.username}</span>
              </div>
              <button onClick={() => setSelectedPost(null)} className="text-gray-500"><FaTimes size={18} /></button>
            </div>

            <div className="w-full bg-[#0a0a0a] aspect-square max-h-[70vh] overflow-hidden shrink-0 relative flex items-center justify-center">
              {selectedPost.type === "video" || selectedPost.mediaType === "video" || selectedPost.feedItemType === "reel" ? (
                 <video src={selectedPost.mediaUrl || selectedPost.media || selectedPost.video} className="w-full h-full object-contain block" autoPlay loop muted controls playsInline />
              ) : (
                 <img 
                    src={selectedPost.mediaUrl || selectedPost.media || selectedPost.image || "/fallback-post.jpg"} 
                    onError={(e) => { e.target.src = "https://placehold.co/600x600/eeeeee/999999?text=No+Image" }}
                    className="w-full h-full object-contain block" 
                    alt="" 
                  />
              )}

              {/* MODAL VIEWER OVERLAY */}
              {(selectedPost.overlayText || selectedPost.text) && (
                <div
                  className={`absolute z-30 pointer-events-none text-center whitespace-pre-wrap break-words ${fontMap[selectedPost.textFont] || fontMap.classic}`}
                  style={{
                    top: `${(selectedPost.textY ?? 0.5) * 100}%`,
                    left: `${(selectedPost.textX ?? 0.5) * 100}%`,
                    transform: "translate(-50%, -50%)",
                    color: selectedPost.textColor || "white",
                    fontSize: `clamp(14px, ${(selectedPost.textSize || 42) * 0.7}px, 6vw)`,
                    filter: selectedPost.filter || "none",
                    lineHeight: "1.3",
                    maxWidth: "90%",
                    padding: "2px 6px",
                    ...getTextStyle(selectedPost),
                  }}
                >
                  {selectedPost.overlayText || selectedPost.text}
                </div>
              )}
            </div>

            <div className="p-4 overflow-y-auto max-h-[25vh] md:max-h-[20vh] flex flex-col gap-4">
              <p className="text-sm leading-relaxed whitespace-pre-wrap">
                <span className="font-bold mr-2">{selectedPost.user?.username || currentUser.username}</span>
                {selectedPost.caption}
              </p>
              
              <div className="flex flex-col gap-2 mt-auto">
                <button onClick={() => { setOpenShare(selectedPost); setSelectedPost(null); }} className="w-full py-3 bg-gray-100 text-sm font-bold rounded-lg flex items-center justify-center gap-2"><FaShare /> Share</button>
                <button 
                  onClick={() => setItemToDelete(selectedPost)} 
                  className="w-full py-3 bg-red-50 text-red-600 text-sm font-bold rounded-lg flex items-center justify-center gap-2"
                >
                   <FaTrash /> {activeTab === "saved" ? "Unsave" : "Delete"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {openShare && <ShareModal post={openShare} onClose={() => setOpenShare(null)} />}

      {/* CUSTOM DELETE / UNSAVE CONFIRMATION MODAL */}
      {itemToDelete && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-[320px] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 text-center flex flex-col items-center">
              <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mb-4 shadow-inner">
                <FaTrash className="text-red-500 text-xl" />
              </div>
              <h3 className="text-[18px] font-black text-gray-900 mb-2 tracking-tight capitalize">
                {activeTab === "saved" ? "Unsave Item?" : "Delete Item?"}
              </h3>
              <p className="text-[13px] text-gray-500 font-medium mb-6 leading-relaxed px-2">
                Are you sure you want to permanently {activeTab === "saved" ? "remove this from your saved collection" : "delete this from your profile"}?
              </p>
              
              <div className="flex gap-3 w-full">
                <button 
                  onClick={() => setItemToDelete(null)}
                  className="flex-1 py-2.5 text-sm font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleDeleteOrUnsave}
                  className="flex-1 py-2.5 text-sm font-bold text-white bg-red-500 hover:bg-red-600 rounded-xl transition-colors shadow-md shadow-red-500/20"
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default Profile;