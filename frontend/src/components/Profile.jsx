import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getProfile } from "../services/userService";
import { getFeed, deletePost, unsavePost } from "../services/postService"; 
import { getReels } from "../services/reelService"; 
import Loader from "../components/Loader";
import ShareModal from "../components/ShareModal"; 
import { toast } from "react-toastify";
import { getProfileImage } from "../utils/getProfileImage";
import RoleBadge from "../components/RoleBadge"; 
import {
  FaHeart, FaComment, FaPlay, FaRegBookmark, FaTh,
  FaCalendarAlt, FaCog, FaTimes, FaTrash, FaShare,
  FaMapMarkerAlt, FaClock, FaEdit
} from "react-icons/fa";

function Profile() {
  const { user: currentUser, loading: authLoading } = useAuth();
  const [profileData, setProfileData] = useState(null);
  const [posts, setPosts] = useState([]);
  const [savedPosts, setSavedPosts] = useState([]); 
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("posts");
  const [selectedPost, setSelectedPost] = useState(null);
  const [openShare, setOpenShare] = useState(null);

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

        const fetchedPosts = (postsData?.posts || []).map(p => ({ ...p, feedItemType: "post" }));
        const fetchedReels = (reelsData?.reels || []).map(r => ({ ...r, feedItemType: "reel", media: r.video || r.media, type: "video" }));
        const combinedFeed = [...fetchedPosts, ...fetchedReels].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        const myItems = combinedFeed.filter((p) => String(p.user?._id || p.user) === String(currentUser._id));
        const savedSource = userData?.user?.savedPosts || currentUser?.savedPosts || [];
        const userSavedIds = savedSource.map(s => String(s._id || s));
        const mySaved = combinedFeed.filter((p) => userSavedIds.includes(String(p._id)));
        
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

  if (authLoading || loading) {
    return (
      <div className="h-screen flex justify-center items-center bg-white">
        <Loader size="40px" color="#3b82f6" />
      </div>
    );
  }

  if (!profileData) return null;

  const eventPosts = posts.filter((p) => p.isEvent === true || p.isEvent === "true");
  const currentDisplayList = activeTab === "posts" ? posts : activeTab === "saved" ? savedPosts : eventPosts;
  const hasStory = profileData?.hasStory || profileData?.stories?.length > 0;

  return (
    <>
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

              {/* Stats Block (Follows Instagram Mobile pattern) */}
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
              {/* ✅ Full Name (Above Username/Stats line for Instagram feel) */}
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

            {/* Edit & Settings Buttons (Full width on mobile) */}
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
          <div className="border-t border-gray-200 sticky top-0 md:top-[60px] bg-white z-30">
            <div className="flex justify-around items-center">
              {[
                { id: "posts", icon: <FaTh /> },
                { id: "saved", icon: <FaRegBookmark /> },
                { id: "events", icon: <FaCalendarAlt /> }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 flex justify-center py-3 text-xl transition-all relative ${
                    activeTab === tab.id ? "text-blue-500" : "text-gray-400"
                  }`}
                >
                  {tab.icon}
                  {activeTab === tab.id && (
                    <div className="absolute top-0 w-full h-[1.5px] bg-black" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* ================= GRID CONTENT ================= */}
          <div className="grid grid-cols-3 gap-[1px] md:gap-4">
            {currentDisplayList.length > 0 ? (
              currentDisplayList.map((post) => {
                const isVideo = post.mediaType === "video" || post.type === "video" || post.video || post.feedItemType === "reel";
                const mediaSrc = post.mediaUrl || post.media || post.image || post.video;
                return (
                  <div key={post._id} onClick={() => setSelectedPost(post)} className="relative aspect-square overflow-hidden cursor-pointer bg-gray-100 group">
                    {isVideo ? <video src={mediaSrc} className="w-full h-full object-cover" /> : <img src={mediaSrc} className="w-full h-full object-cover" alt="" />}
                    
                    {/* Hover Stats (Desktop) */}
                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity hidden md:flex justify-center items-center gap-6 text-white">
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
              <div className="col-span-3 py-24 text-center text-gray-400 text-sm font-medium">
                No {activeTab} yet.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ================= POST MODAL ================= */}
      {selectedPost && (
        <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="absolute inset-0" onClick={() => setSelectedPost(null)}></div>
          <div className="bg-white md:rounded-2xl rounded-t-2xl w-full max-w-[450px] flex flex-col overflow-hidden relative z-10 animate-in slide-in-from-bottom duration-300">
            
            <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto my-3 md:hidden"></div>

            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <img src={getProfileImage(selectedPost.user)} className="w-8 h-8 rounded-full object-cover" alt="" />
                <span className="font-bold text-sm">{selectedPost.user?.username || currentUser.username}</span>
              </div>
              <button onClick={() => setSelectedPost(null)} className="text-gray-500"><FaTimes size={18} /></button>
            </div>

            <div className="w-full bg-[#0a0a0a] aspect-square overflow-hidden shrink-0">
              {selectedPost.type === "video" || selectedPost.mediaType === "video" || selectedPost.feedItemType === "reel" ? (
                 <video src={selectedPost.mediaUrl || selectedPost.media || selectedPost.video} className="w-full h-full object-contain" autoPlay loop muted controls />
              ) : (
                 <img src={selectedPost.mediaUrl || selectedPost.media || selectedPost.image} className="w-full h-full object-contain" alt="" />
              )}
            </div>

            <div className="p-4 overflow-y-auto max-h-[30vh]">
              <p className="text-sm leading-relaxed mb-4">
                <span className="font-bold mr-2">{selectedPost.user?.username || currentUser.username}</span>
                {selectedPost.caption}
              </p>
              
              <div className="flex flex-col gap-2">
                <button onClick={() => { setOpenShare(selectedPost); setSelectedPost(null); }} className="w-full py-2 bg-gray-100 text-sm font-bold rounded-lg flex items-center justify-center gap-2"><FaShare /> Share</button>
                <button onClick={() => activeTab === "saved" ? unsavePost(selectedPost._id) : deletePost(selectedPost._id)} className="w-full py-2 bg-red-50 text-red-600 text-sm font-bold rounded-lg flex items-center justify-center gap-2">
                   <FaTrash /> {activeTab === "saved" ? "Unsave" : "Delete"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {openShare && <ShareModal post={openShare} onClose={() => setOpenShare(null)} />}
    </>
  );
}

export default Profile;