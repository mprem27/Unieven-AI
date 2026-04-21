import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getProfile } from "../services/userService";
import { getFeed, deletePost, unsavePost } from "../services/postService"; 
import { getReels } from "../services/reelService"; // ✅ IMPORTED REELS
import Loader from "../components/Loader";
import ShareModal from "../components/ShareModal"; 
import { toast } from "react-toastify";
import { getProfileImage } from "../utils/getProfileImage";
import RoleBadge from "../components/RoleBadge"; 
import {
  FaHeart,
  FaComment,
  FaPlay,
  FaRegBookmark,
  FaTh,
  FaCalendarAlt,
  FaCog,
  FaTimes,
  FaTrash,
  FaShare,
  FaMapMarkerAlt,
  FaClock
} from "react-icons/fa";

function Profile() {
  const { user: currentUser, loading: authLoading } = useAuth();
  
  const [profileData, setProfileData] = useState(null);
  
  // Tab Data States
  const [posts, setPosts] = useState([]);
  const [savedPosts, setSavedPosts] = useState([]); 
  
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("posts");

  // Popup Modal States
  const [selectedPost, setSelectedPost] = useState(null);
  const [openShare, setOpenShare] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const loadProfileData = async () => {
      if (!currentUser?._id) return;

      setLoading(true);
      try {
        // ✅ FETCH BOTH POSTS AND REELS
        const [userData, postsData, reelsData] = await Promise.all([
          getProfile(currentUser.username).catch(() => null),
          getFeed().catch(() => null),
          getReels().catch(() => null)
        ]);

        if (!isMounted) return;

        if (userData?.user) {
          setProfileData(userData.user);
        } else {
          toast.error("Failed to load profile details");
        }

        // ✅ FORMAT & COMBINE POSTS AND REELS
        const fetchedPosts = (postsData?.posts || []).map(p => ({ ...p, feedItemType: "post" }));
        const fetchedReels = (reelsData?.reels || []).map(r => ({ ...r, feedItemType: "reel", media: r.video || r.media, type: "video" }));
        
        const combinedFeed = [...fetchedPosts, ...fetchedReels].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        // 1. My Created Items (Posts & Reels)
        const myItems = combinedFeed.filter((p) => {
          const postUserId = p.user?._id || p.user;
          return String(postUserId) === String(currentUser._id);
        });
        
        // 2. My Saved Items
        const savedSource = userData?.user?.savedPosts || currentUser?.savedPosts || [];
        const userSavedIds = savedSource.map(s => String(s._id || s));
        const mySaved = combinedFeed.filter((p) => userSavedIds.includes(String(p._id)));
        
        setPosts(myItems);
        setSavedPosts(mySaved);

      } catch (err) {
        if (isMounted) toast.error("Error loading data");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadProfileData();

    return () => {
      isMounted = false;
    };
  }, [currentUser]);

  // ✅ ACTION: DELETE POST OR REEL
  const handleDelete = async (postId) => {
    if (!window.confirm("Are you sure you want to delete this post?")) return;
    try {
      await deletePost(postId);
      setPosts((prev) => prev.filter((p) => p._id !== postId));
      setSelectedPost(null);
      toast.success("Post deleted successfully");
    } catch (err) {
      toast.error("Failed to delete post");
    }
  };

  // ✅ ACTION: UNSAVE POST
  const handleUnsave = async (postId) => {
    try {
      await unsavePost(postId);
      setSavedPosts((prev) => prev.filter((p) => p._id !== postId));
      setSelectedPost(null);
      toast.success("Post unsaved");
    } catch (err) {
      toast.error("Failed to unsave post");
    }
  };

  if (authLoading || loading) {
    return (
      <div className="h-screen flex justify-center items-center bg-[#F8FAFC]">
        <Loader size="40px" color="#3b82f6" />
      </div>
    );
  }

  if (!profileData) return null;

  const eventPosts = posts.filter((p) => p.isEvent === true || p.isEvent === "true");
  const currentDisplayList = activeTab === "posts" ? posts : activeTab === "saved" ? savedPosts : eventPosts;

  // 🔥 STORY LOGIC FOR RING COLOR
  const hasStory = profileData?.hasStory || profileData?.stories?.length > 0;

  return (
    <>
      <div className="w-full min-h-screen flex justify-center bg-[#F8FAFC] font-['Poppins',sans-serif] antialiased text-gray-900 pb-20">
        
        {/* Background Decorative Blurs */}
        <div className="fixed top-[-10%] left-[-10%] w-[400px] h-[400px] bg-blue-100 rounded-full blur-[120px] opacity-40 -z-10" />
        <div className="fixed bottom-[-10%] right-[-10%] w-[400px] h-[400px] bg-purple-100 rounded-full blur-[120px] opacity-40 -z-10" />

        <div className="w-full max-w-[935px] px-4 py-8">

          {/* ================= HEADER SECTION ================= */}
          <header className="flex flex-col md:flex-row items-center md:items-start gap-8 md:gap-20 mb-12 bg-white/40 backdrop-blur-xl border border-white/60 p-8 rounded-[40px] shadow-sm">
            
            <div className="relative group">
              {/* ✅ DYNAMIC STORY RING */}
              <div className={`w-[160px] h-[160px] rounded-full p-[4px] shadow-lg ${
                hasStory 
                  ? "bg-gradient-to-tr from-blue-500 via-purple-500 to-pink-500" 
                  : "bg-gray-300"
              }`}>
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
                  <Link to="/edit-profile">
                    <button className="bg-white/80 hover:bg-white border border-gray-200 px-6 py-2 rounded-xl text-sm font-bold shadow-sm transition-all active:scale-95">
                      Edit profile
                    </button>
                  </Link>
                  <button className="bg-white/80 hover:bg-white border border-gray-200 p-2 rounded-xl shadow-sm transition-all">
                    <FaCog className="text-gray-600" />
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
                  {profileData.bio || "Vel Tech Student | Excellence in Innovation 🎓"}
                </p>
              </div>
            </div>
          </header>

          {/* ================= TABS ================= */}
          <div className="flex justify-center border-t border-gray-200/60 mt-4">
            <div className="flex gap-12 sm:gap-16">
              {[
                { id: "posts", icon: <FaTh /> },
                { id: "saved", icon: <FaRegBookmark /> },
                { id: "events", icon: <FaCalendarAlt /> }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 py-4 text-[18px] transition-all ${
                    activeTab === tab.id
                      ? "border-t-2 border-blue-600 text-blue-600"
                      : "text-gray-400 hover:text-gray-600"
                  }`}
                >
                  {/* ✅ REMOVED TEXT LABEL, ONLY RENDER ICON */}
                  {tab.icon}
                </button>
              ))}
            </div>
          </div>

          {/* ================= CONTENT GRID ================= */}
          <div className="grid grid-cols-3 gap-2 md:gap-4 mt-6">
            {currentDisplayList.length > 0 ? (
              currentDisplayList.map((post) => {
                const isVideo = post.mediaType === "video" || post.type === "video" || post.video || post.feedItemType === "reel";
                const mediaSrc = post.mediaUrl || post.media || post.image || post.video;

                return (
                  <div 
                    key={post._id} 
                    onClick={() => setSelectedPost(post)} 
                    className="relative group aspect-square rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer bg-gray-100"
                  >
                    {isVideo ? (
                      <video src={mediaSrc} className="w-full h-full object-cover" />
                    ) : (
                      <img src={mediaSrc} className="w-full h-full object-cover" alt="post" />
                    )}

                    <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-all duration-300 flex justify-center items-center gap-6 text-white z-10">
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
                     {activeTab === "posts" ? <FaTh /> : activeTab === "saved" ? <FaRegBookmark /> : <FaCalendarAlt />}
                  </div>
                  <h3 className="text-xl font-bold text-gray-800">No {activeTab} yet</h3>
                  <p className="text-gray-500 font-medium mt-1">Start exploring the campus feed.</p>
               </div>
            )}
          </div>
        </div>
      </div>

      {/* ================= REDESIGNED SINGLE COLUMN POPUP MODAL ================= */}
      {selectedPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          
          {/* Close Background Overlay */}
          <div className="absolute inset-0 cursor-pointer" onClick={() => setSelectedPost(null)}></div>
          
          <div className="bg-white rounded-[24px] w-full max-w-[420px] flex flex-col overflow-hidden relative z-10 shadow-2xl animate-in zoom-in-95 duration-300 max-h-[90vh]">
            
            {/* Popup Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-white shrink-0">
              <div className="flex items-center gap-3">
                <img 
                  src={getProfileImage(selectedPost.user)} 
                  className="w-8 h-8 rounded-full object-cover border border-gray-200" 
                  alt="Avatar" 
                />
                <span className="font-bold text-gray-900 text-[14px]">{selectedPost.user?.username || currentUser.username}</span>
              </div>
              <button 
                onClick={() => setSelectedPost(null)} 
                className="text-gray-400 hover:text-gray-700 p-1 transition-colors"
              >
                <FaTimes size={18} />
              </button>
            </div>

            {/* Popup Media */}
            <div className="w-full bg-black flex items-center justify-center min-h-[300px] max-h-[450px] overflow-hidden relative shrink-0">
              {selectedPost.type === "video" || selectedPost.mediaType === "video" || selectedPost.feedItemType === "reel" ? (
                 <video src={selectedPost.mediaUrl || selectedPost.media || selectedPost.video} className="w-full h-full object-contain max-h-[450px]" autoPlay loop muted controls />
              ) : (
                 <img src={selectedPost.mediaUrl || selectedPost.media || selectedPost.image} className="w-full h-full object-contain max-h-[450px]" alt="Selected Post" />
              )}

              {/* Render Custom Overlay Text if User added it during creation */}
              {selectedPost.overlayText && (
                <div 
                  className="absolute z-10 pointer-events-none px-4 py-2"
                  style={{
                    top: "50%",
                    left: "50%",
                    transform: `translate(calc(-50% + ${selectedPost.overlayX || 0}px), calc(-50% + ${selectedPost.overlayY || 0}px))`
                  }}
                >
                  <p className={`text-center text-2xl text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)] whitespace-nowrap ${selectedPost.overlayFont || "font-sans"}`}>
                    {selectedPost.overlayText}
                  </p>
                </div>
              )}
            </div>

            {/* Scrollable Caption & Action Buttons */}
            <div className="flex flex-col flex-1 overflow-y-auto bg-white">
              
              {/* ✅ EVENT POPUP DATA DISPLAY */}
              {selectedPost.isEvent === true || selectedPost.isEvent === "true" ? (
                <div className="m-4 p-4 bg-blue-50/80 border border-blue-100 rounded-xl">
                  <h4 className="text-sm font-bold text-blue-800 mb-3 flex items-center gap-2 border-b border-blue-200 pb-2">
                    <FaCalendarAlt /> Event Details
                  </h4>
                  
                  <div className="flex flex-col gap-2 text-[13px] text-blue-900 font-medium mb-3">
                    <div className="flex items-center gap-2">
                      <FaCalendarAlt className="text-blue-500" />
                      <span>{selectedPost.date ? new Date(selectedPost.date).toLocaleDateString() : "Check caption for date"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <FaClock className="text-blue-500" />
                      <span>{selectedPost.time || "Check caption for time"}</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <FaMapMarkerAlt className="text-blue-500 mt-0.5" />
                      <span>{selectedPost.location || "Check caption for location"}</span>
                    </div>
                  </div>

                  <p className="text-[13px] text-blue-900/80 leading-relaxed whitespace-pre-wrap pt-2 border-t border-blue-200/50">
                    {selectedPost.description || selectedPost.caption}
                  </p>
                </div>
              ) : (
                /* Standard Post Caption */
                selectedPost.caption && (
                  <div className="px-4 py-4">
                    <p className="text-[14px] text-gray-800 leading-relaxed whitespace-pre-wrap">
                      <span className="font-bold mr-2 text-gray-900">{selectedPost.user?.username || currentUser.username}</span>
                      {selectedPost.caption}
                    </p>
                  </div>
                )
              )}

              {/* Action Buttons */}
              <div className="flex flex-col gap-2 px-4 py-4 mt-auto border-t border-gray-50">
                
                {/* SHARE BUTTON */}
                <button 
                  onClick={() => { setOpenShare(selectedPost); setSelectedPost(null); }} 
                  className="w-full flex items-center justify-center gap-2 py-3 bg-gray-100 text-gray-800 font-bold rounded-xl hover:bg-gray-200 transition-colors shadow-sm text-[14px]"
                >
                  <FaShare /> Share
                </button>

                {/* CONDITIONAL ACTION BUTTONS */}
                {activeTab === "saved" ? (
                  <button 
                    onClick={() => handleUnsave(selectedPost._id)} 
                    className="w-full flex items-center justify-center gap-2 py-3 bg-red-50 text-red-600 font-bold rounded-xl hover:bg-red-100 transition-colors shadow-sm text-[14px]"
                  >
                    <FaRegBookmark /> Unsave
                  </button>
                ) : (
                  <button 
                    onClick={() => handleDelete(selectedPost._id)} 
                    className="w-full flex items-center justify-center gap-2 py-3 bg-red-50 text-red-600 font-bold rounded-xl hover:bg-red-100 transition-colors shadow-sm text-[14px]"
                  >
                    <FaTrash /> Delete
                  </button>
                )}
              </div>

            </div>
          </div>
        </div>
      )}

      {/* SHARE MODAL */}
      {openShare && (
        <ShareModal
          post={openShare}
          onClose={() => setOpenShare(null)}
        />
      )}
    </>
  );
}

export default Profile;