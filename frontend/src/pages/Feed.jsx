import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Stories from "../components/Stories";
import CommentsModal from "../components/CommentsModal";
import ShareModal from "../components/ShareModal";
import { getFeed, likePost, deletePost, savePost, unsavePost } from "../services/postService"; 
import { getReels, likeReel } from "../services/reelService"; 
import { getStories } from "../services/storyService";
import { getSuggestedUsers } from "../services/userService";
import Suggestions from "../components/Suggestions";
import { Assets } from "../assets/Assets";
import Loader from "../components/Loader";
import { toast } from "react-toastify";
import { getProfileImage } from "../utils/getProfileImage";
import RoleBadge from "../components/RoleBadge";
import { useAuth } from "../context/AuthContext";
import { FaTicketAlt, FaBookmark, FaRegBookmark, FaCalendarAlt, FaMapMarkerAlt, FaFlag, FaTrash } from "react-icons/fa";

function Feed() {
  const { user } = useAuth();
  const navigate = useNavigate(); 
  
  const [posts, setPosts] = useState([]);
  const [stories, setStories] = useState([]);
  const [suggestedUsers, setSuggestedUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showHeart, setShowHeart] = useState(null);
  const [activePost, setActivePost] = useState(null);
  const [openShare, setOpenShare] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [expandedEvents, setExpandedEvents] = useState({});

  const loadFeedData = async () => {
    try {
      setLoading(true);
      let [postsRes, reelsRes, storiesRes, usersRes] = await Promise.allSettled([
        getFeed(), getReels(), getStories(), getSuggestedUsers()
      ]);

      const fetchedPosts = (postsRes.value?.posts || []).map(p => ({ 
        ...p, 
        feedItemType: "post",
        isSaved: p.savedBy?.includes(user?._id) || false 
      }));
      
      const fetchedReels = (reelsRes.value?.reels || []).map(r => ({
        ...r, 
        feedItemType: "reel", 
        media: r.video || r.media, 
        type: "video",
        isSaved: r.savedBy?.includes(user?._id) || false
      }));

      const combinedFeed = [...fetchedPosts, ...fetchedReels].sort((a, b) => 
        new Date(b.createdAt || Date.now()) - new Date(a.createdAt || Date.now())
      );

      setPosts(combinedFeed);
      if (storiesRes.value) setStories(storiesRes.value.users || []);
      if (usersRes.value) setSuggestedUsers(usersRes.value.users || []);
    } catch (err) {
      toast.error("Failed to load feed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadFeedData(); }, [user?._id]);

  const handleLike = async (item) => {
    if (!user) return toast.error("Please login");
    const id = item._id;
    const isLiked = item.likes?.includes(user?._id);
    
    setPosts(prev => prev.map(p => p._id === id ? {
      ...p,
      likes: isLiked ? p.likes.filter(l => l !== user?._id) : [...(p.likes || []), user?._id]
    } : p));

    try {
      item.feedItemType === "reel" ? await likeReel(id) : await likePost(id);
    } catch { loadFeedData(); }
  };

  // Improved Double Tap logic
  let clickTimeout = null;
  const handleMediaClick = (post) => {
    if (clickTimeout) {
      clearTimeout(clickTimeout);
      clickTimeout = null;
      // Double tap detected
      if (!post.likes?.includes(user?._id)) handleLike(post);
      setShowHeart(post._id);
      setTimeout(() => setShowHeart(null), 800);
    } else {
      clickTimeout = setTimeout(() => {
        clickTimeout = null;
        // Single tap detected - Navigate to reels page if it's a reel
        if (post.feedItemType === "reel") {
          navigate(`/reels/${post._id}`);
        }
      }, 300); // 300ms delay to distinguish between single and double tap
    }
  };

  const handleToggleSave = async (item) => {
    if (!user) return toast.error("Please login");
    const id = item._id;
    const isCurrentlySaved = item.isSaved;

    setPosts(prev => prev.map(p => p._id === id ? { ...p, isSaved: !isCurrentlySaved } : p));

    try {
      if (isCurrentlySaved) {
        await unsavePost(id);
        toast.info("Removed from saved");
      } else {
        await savePost(id);
        toast.success("Saved to profile");
      }
    } catch (error) {
      loadFeedData();
      toast.error("Could not update save status");
    }
    setOpenMenuId(null);
  };

  const handleDeleteItem = async (itemId) => {
    if (!window.confirm("Are you sure you want to remove this?")) return;
    try {
      await deletePost(itemId);
      setPosts((prev) => prev.filter((p) => p._id !== itemId));
      toast.success("Removed successfully");
    } catch (error) {
      toast.error("Failed to remove");
    } finally {
      setOpenMenuId(null); 
    }
  };

  const toggleEventExpand = (id) => {
    setExpandedEvents(prev => ({ ...prev, [id]: !prev[id] }));
  };

  if (loading) return <div className="flex justify-center items-center h-screen bg-[#fafafa]"><Loader size="40px" color="#3b82f6" /></div>;

  return (
    <>
      <div className="flex flex-col items-center w-full bg-[#fafafa] min-h-screen pb-20 font-['Poppins',sans-serif] mt-0">
        <Stories users={stories} />

        <div className="flex flex-col items-center gap-6 w-full max-w-[400px] px-2 sm:px-0">
          
          {posts.length === 0 && suggestedUsers.length > 0 && <Suggestions users={suggestedUsers} />}

          {posts.map((post, index) => {
            const isLiked = post.likes?.includes(user?._id);
            const isSaved = post.isSaved;
            const isEventPost = post.isEvent === true || post.isEvent === "true";
            const isExpanded = expandedEvents[post._id];

            return (
              <React.Fragment key={post._id}>
                <div className="bg-white w-full border border-gray-200 rounded-[16px] overflow-hidden shadow-sm relative">
                  
                  {/* HEADER */}
                  <div className="flex justify-between items-center px-4 py-3">
                    <div className="flex gap-3 items-center">
                      <Link to={`/user/${encodeURIComponent(post.user?.username || "")}`}>
                        <img src={getProfileImage(post.user)} className="w-9 h-9 rounded-full object-cover border border-gray-100" alt="" />
                      </Link>
                      <div className="flex flex-col">
                        <Link to={`/user/${encodeURIComponent(post.user?.username || "")}`} className="font-bold text-sm flex items-center gap-1 hover:underline">
                          {post.user?.username} <RoleBadge role={post.user?.role} />
                        </Link>
                        {post.feedItemType === "reel" && (
                           <span className="text-[10px] text-gray-500 font-bold tracking-wide uppercase mt-0.5">Reel</span>
                        )}
                        {isEventPost && <span className="text-[9px] text-blue-500 font-black uppercase tracking-widest">Campus Event</span>}
                      </div>
                    </div>

                    {/* ✅ UPDATED 3 DOTS INLINE DROPDOWN */}
                    <div className="relative">
                      <img 
                        src={Assets.dots} 
                        className="w-5 cursor-pointer hover:opacity-70 transition-opacity" 
                        onClick={() => setOpenMenuId(openMenuId === post._id ? null : post._id)} 
                        alt="options" 
                      />
                      
                      {openMenuId === post._id && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setOpenMenuId(null)}></div>
                          <div className="absolute right-0 top-6 w-44 bg-white border border-gray-200 shadow-xl rounded-xl z-50 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
                             <button onClick={() => handleToggleSave(post)} className="w-full px-4 py-3 text-left text-sm font-bold border-b border-gray-100 hover:bg-gray-50 text-black transition-colors">
                               {post.isSaved ? "Unsave" : "Save"}
                             </button>
                             <button onClick={() => { setOpenShare(post); setOpenMenuId(null); }} className="w-full px-4 py-3 text-left text-sm font-bold border-b border-gray-100 hover:bg-gray-50 text-black transition-colors">
                               Share
                             </button>
                             <button onClick={() => { toast.info("Reported to admins."); setOpenMenuId(null); }} className="w-full flex items-center gap-2 px-4 py-3 text-sm font-bold border-b border-gray-100 hover:bg-gray-50 text-orange-500 transition-colors">
                               <FaFlag className="text-[12px]"/> Report
                             </button>
                             {user?._id === post.user?._id && (
                               <button onClick={() => handleDeleteItem(post._id)} className="w-full flex items-center gap-2 px-4 py-3 text-sm font-bold border-b border-gray-100 hover:bg-gray-50 text-red-500 transition-colors">
                                 <FaTrash className="text-[12px]"/> Delete
                               </button>
                             )}
                             <button onClick={() => setOpenMenuId(null)} className="w-full px-4 py-3 text-left text-sm font-medium text-gray-500 hover:bg-gray-50 transition-colors">
                               Cancel
                             </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* MEDIA - ✅ Integrated Single/Double Tap Logic */}
                  <div 
                    onClick={() => handleMediaClick(post)} 
                    className={`relative bg-black w-full h-[400px] sm:h-[480px] flex items-center justify-center overflow-hidden ${post.feedItemType === "reel" ? "cursor-pointer" : ""}`}
                  >
                    {post.type === "video" ? (
                      <video src={post.media} className="w-full h-full object-contain pointer-events-none" autoPlay loop muted playsInline />
                    ) : (
                      <img src={post.media} className="w-full h-full object-contain pointer-events-none" alt="" />
                    )}
                    
                    {/* Event/Reel Overlay Text */}
                    {post.overlayText && (
                      <div 
                        className={`absolute z-30 px-4 py-2 ${isEventPost ? "cursor-pointer hover:scale-105 transition-transform" : "pointer-events-none"}`}
                        onClick={(e) => {
                          if (isEventPost) {
                            e.stopPropagation();
                            navigate("/events");
                          }
                        }}
                        style={{
                          top: "50%", left: "50%",
                          transform: `translate(calc(-50% + ${post.overlayX || 0}px), calc(-50% + ${post.overlayY || 0}px))`
                        }}
                      >
                        <p className={`text-center text-3xl text-white font-bold drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)] whitespace-nowrap ${post.overlayFont || "font-sans"}`}>
                          {post.overlayText}
                        </p>
                      </div>
                    )}

                    {/* Double Tap Heart Animation */}
                    {showHeart === post._id && (
                      <div className="absolute inset-0 flex justify-center items-center z-20 pointer-events-none">
                        <img src={Assets.liked} className="w-28 animate-ping drop-shadow-2xl" alt="liked" />
                      </div>
                    )}
                  </div>

                  {/* ACTIONS */}
                  <div className="flex justify-between px-4 pt-3 pb-2">
                    <div className="flex gap-4 items-center">
                      <img 
                        src={isLiked ? Assets.liked : Assets.like} 
                        onClick={() => handleLike(post)} 
                        className="w-[26px] cursor-pointer hover:scale-110 transition-transform active:scale-95" 
                        alt="like" 
                      />
                      <img 
                        src={Assets.comment} 
                        onClick={() => setActivePost(post)} 
                        className="w-[26px] cursor-pointer hover:scale-110 transition-transform active:scale-95" 
                        alt="comment" 
                      />
                      <img 
                        src={Assets.share} 
                        onClick={() => setOpenShare(post)} 
                        className="w-[26px] cursor-pointer hover:scale-110 transition-transform active:scale-95" 
                        alt="share" 
                      />
                    </div>
                    <button onClick={() => handleToggleSave(post)} className="transition-transform active:scale-125">
                      {isSaved ? <FaBookmark className="text-black text-[22px]" /> : <FaRegBookmark className="text-gray-800 text-[22px]" />}
                    </button>
                  </div>

                  {/* INFO */}
                  <div className="px-4 pb-4">
                    <p className="font-bold text-[13px] mb-1.5">{post.likes?.length || 0} likes</p>
                    <div className={`text-[13px] leading-snug ${!isExpanded && isEventPost ? 'line-clamp-2' : ''}`}>
                      <Link to={`/user/${encodeURIComponent(post.user?.username || "")}`} className="font-bold mr-2 hover:text-gray-600">
                        {post.user?.username}
                      </Link>
                      <span className="text-gray-800 whitespace-pre-wrap">{post.caption}</span>
                    </div>

                    {isEventPost && (
                      <>
                        {!isExpanded ? (
                          <button onClick={() => toggleEventExpand(post._id)} className="text-gray-400 text-[11px] font-bold mt-1 uppercase tracking-wider hover:text-blue-500">See more event info...</button>
                        ) : (
                          <div className="mt-4 p-4 bg-blue-50/50 rounded-2xl border border-blue-100 animate-in fade-in slide-in-from-top-2">
                             <div className="space-y-2 text-[12px] font-bold text-blue-800 mb-4">
                                <p className="flex items-center gap-2"><FaCalendarAlt className="text-blue-400" /> {post.date ? new Date(post.date).toDateString() : 'TBA'} • {post.time || 'TBA'}</p>
                                <p className="flex items-center gap-2"><FaMapMarkerAlt className="text-red-400" /> {post.location || 'Campus Hall'}</p>
                             </div>
                             <button 
                               onClick={() => navigate("/events")} 
                               className="w-full py-2.5 bg-transparent border border-blue-600 text-blue-600 hover:bg-blue-50 rounded-xl font-bold text-[12px] uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2"
                             >
                               <FaTicketAlt /> Register the Event
                             </button>
                             <button onClick={() => toggleEventExpand(post._id)} className="w-full text-center mt-3 text-[11px] text-blue-500 font-bold uppercase hover:underline">Show Less</button>
                          </div>
                        )}
                      </>
                    )}

                    <p onClick={() => setActivePost(post)} className="text-gray-500 text-[13px] font-medium mt-2 cursor-pointer hover:text-gray-400">
                      {post.comments?.length > 0 ? `View all ${post.comments.length} comments` : "Add a comment..."}
                    </p>

                    <p className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold mt-2">
                      {post.createdAt ? new Date(post.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : "RECENT"}
                    </p>
                  </div>
                </div>

                {index === 0 && suggestedUsers.length > 0 && <div className="w-full py-2"><Suggestions users={suggestedUsers} /></div>}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {activePost && <CommentsModal item={activePost} type={activePost.feedItemType === "reel" ? "reel" : "post"} onClose={() => setActivePost(null)} onSync={(updated) => setPosts(prev => prev.map(p => p._id === updated._id ? updated : p))} />}
      {openShare && <ShareModal post={openShare} onClose={() => setOpenShare(null)} />}
    </>
  );
}

export default Feed;