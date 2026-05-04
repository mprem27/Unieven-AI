import React, { useEffect, useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import Stories from "../components/Stories";
import CommentsModal from "../components/CommentsModal";
import ShareModal from "../components/ShareModal";
import { getFeed, likePost, deletePost, savePost, unsavePost } from "../services/postService"; 
import { getReels, likeReel, deleteReel, saveReel, unsaveReel } from "../services/reelService";
import { getStories } from "../services/storyService";
import { getSuggestedUsers } from "../services/userService";
import Suggestions from "../components/Suggestions";
import { Assets } from "../assets/Assets";
import Loader from "../components/Loader";
import { toast } from "react-toastify";
import { getProfileImage } from "../utils/getProfileImage";
import RoleBadge from "../components/RoleBadge";
import { useAuth } from "../context/AuthContext";
import { 
  FaTicketAlt, 
  FaBookmark, 
  FaRegBookmark, 
  FaCalendarAlt, 
  FaMapMarkerAlt, 
  FaFlag, 
  FaTrash,
  FaVolumeMute, 
  FaVolumeUp,
  FaPlay
} from "react-icons/fa";

const shuffleArray = (array) => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

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

// TEXT STYLES HELPER
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
  
  const [itemToDelete, setItemToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [mutedVideos, setMutedVideos] = useState({});
  const [suggestionIndex, setSuggestionIndex] = useState(1);

  const clickTimeouts = useRef({});
  const videoRefs = useRef({});

  // SMART ROUTING LOGIC
  const getProfileLink = (targetUser) => {
    if (!targetUser) return "#";
    return targetUser._id === user?._id 
      ? "/profile" 
      : `/user/${encodeURIComponent(targetUser.username)}`;
  };

  const loadFeedData = async () => {
    try {
      setLoading(true);
      let [postsRes, reelsRes, storiesRes, usersRes] = await Promise.allSettled([
        getFeed(), getReels(), getStories(), getSuggestedUsers()
      ]);

      const fetchedPosts = (postsRes.status === "fulfilled" ? (postsRes.value?.posts || postsRes.value?.data || []) : [])
        .filter((p) => p.user?._id && p.user?.username)
        .map(p => ({ 
          ...p, 
          user: p.user || {},
          feedItemType: "post",
          isSaved: p.savedBy?.includes(user?._id) || false 
        }));
      
      const fetchedReels = (reelsRes.status === "fulfilled" ? (reelsRes.value?.reels || reelsRes.value?.data || []) : [])
        .filter((r) => r.user?._id && r.user?.username)
        .map(r => ({
          ...r, 
          user: r.user || {},
          feedItemType: "reel", 
          media: r.video || r.media, 
          type: "video",
          isSaved: r.savedBy?.includes(user?._id) || user?.savedReels?.includes(r._id) || false
        }));

      const sortedFeed = [...fetchedPosts, ...fetchedReels].sort((a, b) => 
        new Date(b.createdAt || Date.now()) - new Date(a.createdAt || Date.now())
      );

      const recentPosts = sortedFeed.slice(0, 2);
      const olderPosts = sortedFeed.slice(2);
      const shuffledOlderPosts = shuffleArray(olderPosts);
      
      const combinedFeed = [...recentPosts, ...shuffledOlderPosts];
      
      // 🔧 FRONTEND FILTER (SHOW ONLY VALID EVENTS)
      const now = new Date();
      const filteredFeed = combinedFeed.filter((item) => {
        const isEventPost = item.isEvent === true || String(item.isEvent) === "true";

        if (isEventPost) {
          // 🔥 FIX: Hide old/broken events that don't have a date set
          if (!item.date) return false;

          try {
            // 🔥 FIX: Precisely merge date and time to avoid timezone shift errors
            const datePart = typeof item.date === 'string' && item.date.includes("T") 
              ? item.date.split("T")[0] 
              : new Date(item.date).toISOString().split("T")[0];
              
            const timePart = item.time || "23:59:59";
            const eventDateTime = new Date(`${datePart}T${timePart}`);

            // Add 2 days buffer
            const expiryDate = new Date(eventDateTime);
            expiryDate.setDate(expiryDate.getDate() + 2);

            return now <= expiryDate;
          } catch (e) {
            return false; // Hide if date is fundamentally unparseable
          }
        }

        return true; // Keep standard posts and reels
      });

      setPosts(filteredFeed);
      
      if (filteredFeed.length > 0) {
        setSuggestionIndex(Math.min(filteredFeed.length - 1, Math.floor(Math.random() * 3) + 1));
      }

      const initialMuteState = {};
      filteredFeed.forEach(post => {
        if (post.type === "video" || post.feedItemType === "reel") {
          initialMuteState[post._id] = false; 
        }
      });
      setMutedVideos(initialMuteState);
      
      if (storiesRes.status === "fulfilled") {
        setStories(storiesRes.value?.users || storiesRes.value?.data || []);
      }
      
      if (usersRes.status === "fulfilled") {
        const allSuggestions = usersRes.value?.users || usersRes.value?.data || [];
        const filteredSuggestions = allSuggestions.filter(
          (u) => u._id !== user?._id && !user?.following?.includes(u._id)
        );
        setSuggestedUsers(shuffleArray(filteredSuggestions)); 
      }
      
    } catch (err) {
      toast.error("Failed to load feed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    loadFeedData(); 
  }, [user?._id]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const video = entry.target;

          if (entry.isIntersecting) {
            Object.values(videoRefs.current).forEach((v) => {
              if (v && v !== video) {
                v.pause();
                v.currentTime = v.currentTime; 
              }
            });
            video.muted = mutedVideos[video.dataset.id] ?? false;
            video.play().catch(() => {});
          } else {
            video.pause();
          }
        });
      },
      { threshold: 0.75 }
    );

    Object.values(videoRefs.current).forEach((video) => {
      if (video) observer.observe(video);
    });

    return () => observer.disconnect();
  }, [posts, mutedVideos]);

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
    } catch { 
      loadFeedData(); 
    }
  };

  const handleMediaClick = (post) => {
    const postId = post._id;

    if (clickTimeouts.current[postId]) {
      clearTimeout(clickTimeouts.current[postId]);
      delete clickTimeouts.current[postId]; 
      
      if (!post.likes?.includes(user?._id)) handleLike(post);
      
      setShowHeart(postId);
      setTimeout(() => setShowHeart(null), 800);
    } else {
      clickTimeouts.current[postId] = setTimeout(() => {
        delete clickTimeouts.current[postId]; 
        if (post.feedItemType === "reel") {
          navigate(`/reels/${postId}`);
        }
      }, 300);
    }
  };

  const handleToggleSave = async (item) => {
    if (!user) return toast.error("Please login");

    const id = item._id;
    const isCurrentlySaved = item.isSaved;

    setPosts((prev) =>
      prev.map((p) =>
        p._id === id
          ? { ...p, isSaved: !isCurrentlySaved }
          : p
      )
    );

    setOpenMenuId(null);

    try {
      if (item.feedItemType === "reel") {
        if (isCurrentlySaved) {
          await unsaveReel(id);
          toast.info("Removed reel from saved");
        } else {
          await saveReel(id);
          toast.success("Reel saved to profile");
        }
      } else {
        if (isCurrentlySaved) {
          await unsavePost(id);
          toast.info("Removed from saved");
        } else {
          await savePost(id);
          toast.success("Saved to profile");
        }
      }

      window.dispatchEvent(
        new Event("profileUpdated")
      );
    } catch (error) {
      loadFeedData();
      toast.error(
        "Could not update save status"
      );
    }
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    setIsDeleting(true);
    
    try {
      if (itemToDelete.feedItemType === "reel" || itemToDelete.video) {
        await deleteReel(itemToDelete._id);
      } else {
        await deletePost(itemToDelete._id);
      }
      setPosts((prev) => prev.filter((p) => p._id !== itemToDelete._id));
      
      const typeName = itemToDelete.feedItemType === "reel" ? "Reel" : (itemToDelete.isEvent ? "Event" : "Post");
      toast.success(`${typeName} deleted successfully!`);
      
      window.dispatchEvent(new Event("profileUpdated"));
    } catch (error) {
      toast.error("Failed to delete item.");
    } finally {
      setIsDeleting(false);
      setItemToDelete(null); 
    }
  };

  const toggleEventExpand = (id) => {
    setExpandedEvents(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleMute = (e, postId) => {
    e.stopPropagation(); 
    setMutedVideos((prev) => {
      const newMutedState = !prev[postId];
      if (videoRefs.current[postId]) {
        videoRefs.current[postId].muted = newMutedState;
      }
      return { ...prev, [postId]: newMutedState };
    });
  };

  if (loading) return <div className="flex justify-center items-center h-screen bg-[#fafafa]"><Loader size="40px" color="#3b82f6" /></div>;

  return (
    <>
      <div className="flex flex-col items-center w-full bg-[#fafafa] min-h-screen pb-20 font-['Poppins',sans-serif] mt-0">
        <Stories users={stories} />

        <div className="flex flex-col items-center gap-6 w-full max-w-[400px] px-2 sm:px-0">
          
          {posts.length === 0 && suggestedUsers.length > 0 && (
            <Suggestions 
              users={suggestedUsers} 
              currentUser={user} 
              onRefreshSuggestions={loadFeedData} 
            />
          )}

          {posts.map((post, index) => {
            const isLiked = post.likes?.includes(user?._id);
            const isSaved = post.isSaved;
            const isEventPost = post.isEvent === true || String(post.isEvent) === "true";
            const isExpanded = expandedEvents[post._id];
            const isThisVideoMuted = mutedVideos[post._id] !== false; 
            
            const latestComment = post.comments?.length > 0 ? post.comments[post.comments.length - 1] : null;

            return (
              <React.Fragment key={post._id}>
                <div className="bg-white w-full border border-gray-200 rounded-[16px] overflow-hidden shadow-sm relative">
                  
                  {/* Post Header */}
                  <div className="flex justify-between items-center px-4 py-3">
                    <div className="flex gap-3 items-center">
                      <Link 
                        to={getProfileLink(post.user)}
                        onClick={() => window.dispatchEvent(new Event("profileUpdated"))}
                      >
                        <img src={getProfileImage(post.user)} className="w-9 h-9 rounded-full object-cover border border-gray-100" alt="" />
                      </Link>
                      <div className="flex flex-col">
                        <Link 
                          to={getProfileLink(post.user)}
                          onClick={() => window.dispatchEvent(new Event("profileUpdated"))}
                          className="font-bold text-sm flex items-center gap-1 hover:underline"
                        >
                          {post.user?.username || "user"} <RoleBadge role={post.user?.role} />
                        </Link>
                        {post.feedItemType === "reel" && (
                           <span className="text-[10px] text-gray-500 font-bold tracking-wide uppercase mt-0.5">Reel</span>
                        )}
                        {isEventPost && <span className="text-[9px] text-blue-500 font-black uppercase tracking-widest">Campus Event</span>}
                      </div>
                    </div>

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
                               <button 
                                 onClick={() => { setItemToDelete(post); setOpenMenuId(null); }} 
                                 className="w-full flex items-center gap-2 px-4 py-3 text-sm font-bold border-b border-gray-100 hover:bg-gray-50 text-red-500 transition-colors"
                               >
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

                  {/* Media Content */}
                  <div 
                    onClick={() => handleMediaClick(post)} 
                    className={`relative bg-black w-full h-[400px] sm:h-[480px] flex items-center justify-center overflow-hidden ${post.feedItemType === "reel" ? "cursor-pointer" : ""}`}
                  >
                    {post.type === "video" || post.feedItemType === "reel" ? (
                      <>
                        <video 
                          data-id={post._id}
                          ref={(el) => (videoRefs.current[post._id] = el)}
                          src={post.media} 
                          className="w-full h-full object-contain pointer-events-none" 
                          autoPlay 
                          loop 
                          muted={isThisVideoMuted} 
                          playsInline 
                        />
                        <button
                          onClick={(e) => toggleMute(e, post._id)}
                          className="absolute bottom-3 right-3 z-40 bg-black/60 backdrop-blur-sm p-2 rounded-full text-white hover:scale-110 transition-transform"
                        >
                          {isThisVideoMuted ? <FaVolumeMute size={14} /> : <FaVolumeUp size={14} />}
                        </button>
                      </>
                    ) : (
                      <img src={post.media} className="w-full h-full object-contain pointer-events-none" alt="" />
                    )}
                    
                    {(post.overlayText || post.text) && (
                      <div 
                        className={`absolute z-30 pointer-events-none text-center whitespace-pre-wrap break-words ${fontMap[post.textFont] || fontMap.classic}`}
                        style={{
                          top: `${(post.textY || 0.5) * 100}%`,
                          left: `${(post.textX || 0.5) * 100}%`,
                          transform: "translate(-50%, -50%)",
                          color: post.textColor || "white",
                          fontSize: `${post.textSize || 42}px`,
                          filter: post.filter || "none",
                          lineHeight: "1.4",
                          maxWidth: "90%",
                          ...getTextStyle(post)
                        }}
                      >
                        {post.overlayText || post.text}
                      </div>
                    )}

                    {showHeart === post._id && (
                      <div className="absolute inset-0 flex justify-center items-center z-20 pointer-events-none">
                        <img src={Assets.liked} className="w-28 animate-ping drop-shadow-2xl" alt="liked" />
                      </div>
                    )}
                  </div>

                  {/* Actions & Description */}
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

                  <div className="px-4 pb-4">
                    <p className="font-bold text-[13px] mb-1.5">{post.likes?.length || 0} likes</p>
                    
                    {/* ACCURATE REEL VIEWS */}
                    <p className="font-semibold text-[12px] text-gray-600 mb-1 flex items-center gap-1.5">
                      <FaPlay className="text-[10px]" />
                      {post.feedItemType === "reel"
                        ? `${typeof post.views === "number" ? post.views : post.views?.length || 0} views`
                        : `${post.views?.length || 0} views`}
                    </p>
                    
                    {/* Caption */}
                    <div className={`text-[13px] leading-snug ${!isExpanded && isEventPost ? 'line-clamp-2' : ''}`}>
                      <Link 
                        to={getProfileLink(post.user)} 
                        onClick={() => window.dispatchEvent(new Event("profileUpdated"))}
                        className="font-bold mr-2 hover:text-gray-600"
                      >
                        {post.user?.username || "user"}
                      </Link>
                      <span className="text-gray-800 whitespace-pre-wrap">{post.caption}</span>
                    </div>

                    {/* Latest Comment Preview */}
                    {latestComment && latestComment.user && (
                      <div className="mt-1.5 flex text-[13px] leading-snug">
                        <Link 
                          to={getProfileLink(latestComment.user)} 
                          onClick={() => window.dispatchEvent(new Event("profileUpdated"))}
                          className="font-bold mr-2 hover:text-gray-600 truncate max-w-[100px]"
                        >
                          {latestComment.user.username || "user"}
                        </Link>
                        <span className="text-gray-800 truncate">{latestComment.text}</span>
                      </div>
                    )}

                    {/* Event Expansion */}
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

                    {/* View all comments button */}
                    <p onClick={() => setActivePost(post)} className="text-gray-500 text-[13px] font-medium mt-1 cursor-pointer hover:text-gray-400">
                      {post.comments?.length > 1 ? `View all ${post.comments.length} comments` : (post.comments?.length === 1 ? "View comment" : "Add a comment...")}
                    </p>

                    <p className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold mt-2">
                      {post.createdAt ? new Date(post.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : "RECENT"}
                    </p>
                  </div>
                </div>

                {index === suggestionIndex && suggestedUsers.length > 0 && (
                  <div className="w-full py-2">
                    <Suggestions 
                      users={suggestedUsers} 
                      currentUser={user} 
                      onRefreshSuggestions={loadFeedData} 
                    />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {activePost && <CommentsModal item={activePost} type={activePost.feedItemType === "reel" ? "reel" : "post"} onClose={() => setActivePost(null)} onSync={(updated) => setPosts(prev => prev.map(p => p._id === updated._id ? { ...p, comments: updated.comments } : p))} />}
      {openShare && <ShareModal post={openShare} onClose={() => setOpenShare(null)} />}
      
      {/* DELETE CONFIRMATION MODAL */}
      {itemToDelete && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-[320px] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 text-center flex flex-col items-center">
              <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mb-4 shadow-inner">
                <FaTrash className="text-red-500 text-xl" />
              </div>
              <h3 className="text-[18px] font-black text-gray-900 mb-2 tracking-tight capitalize">
                Delete {itemToDelete.feedItemType === "reel" ? "Reel" : (itemToDelete.isEvent ? "Event" : "Post")}?
              </h3>
              <p className="text-[13px] text-gray-500 font-medium mb-6 leading-relaxed px-2">
                Are you sure you want to permanently remove this <span className="lowercase font-bold">{itemToDelete.feedItemType === "reel" ? "reel" : (itemToDelete.isEvent ? "event" : "post")}</span> from your profile? This action cannot be undone.
              </p>
              
              <div className="flex gap-3 w-full">
                <button 
                  onClick={() => setItemToDelete(null)}
                  disabled={isDeleting}
                  className="flex-1 py-2.5 text-sm font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button 
                  onClick={confirmDelete}
                  disabled={isDeleting}
                  className="flex-1 py-2.5 text-sm font-bold text-white bg-red-500 hover:bg-red-600 rounded-xl transition-colors shadow-md shadow-red-500/20 disabled:opacity-50 flex justify-center items-center"
                >
                  {isDeleting ? <Loader size="16px" color="#fff" /> : "Delete"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default Feed;