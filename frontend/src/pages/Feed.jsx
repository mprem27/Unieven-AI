import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom"; // ✅ ADDED useNavigate
import Stories from "../components/Stories";
import CommentsModal from "../components/CommentsModal";
import ShareModal from "../components/ShareModal";
import { getFeed, likePost, deletePost, savePost } from "../services/postService"; 
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
import { FaTicketAlt } from "react-icons/fa"; // ✅ ADDED Ticket Icon

function Feed() {
  const { user } = useAuth(); // Get current logged-in user
  const navigate = useNavigate(); // ✅ INITIALIZED navigate
  
  const [posts, setPosts] = useState([]);
  const [stories, setStories] = useState([]);
  const [suggestedUsers, setSuggestedUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showHeart, setShowHeart] = useState(null);
  const [activePost, setActivePost] = useState(null);
  const [openShare, setOpenShare] = useState(null);
  
  // ✅ STATE FOR 3-DOTS MENU
  const [openMenuId, setOpenMenuId] = useState(null);

  // 🔄 FETCH DATA (POSTS + REELS COMBINED)
  const loadFeedData = async () => {
    try {
      setLoading(true);

      // Catching errors individually so one failure doesn't break the whole feed
      let postsRes = null, reelsRes = null, storiesRes = null, usersRes = null;

      try { postsRes = await getFeed(); } catch (e) { console.error("Posts Fetch Error:", e); }
      try { reelsRes = await getReels(); } catch (e) { console.error("Reels Fetch Error:", e); }
      try { storiesRes = await getStories(); } catch (e) { console.error("Stories Fetch Error:", e); }
      try { usersRes = await getSuggestedUsers(); } catch (e) { console.error("Users Fetch Error:", e); }

      // 1. Format Posts
      const fetchedPosts = (postsRes?.posts || []).map(p => ({
        ...p,
        feedItemType: "post"
      }));

      // 2. Format Reels (Map 'video' to 'media' so the UI renders it easily)
      const fetchedReels = (reelsRes?.reels || []).map(r => ({
        ...r,
        feedItemType: "reel",
        media: r.video || r.media, 
        type: "video" // Force type to video for the UI player
      }));

      // 3. Combine and Sort safely (Fallback to Date.now() if createdAt is missing)
      const combinedFeed = [...fetchedPosts, ...fetchedReels].sort((a, b) => {
        const dateA = new Date(a.createdAt || Date.now());
        const dateB = new Date(b.createdAt || Date.now());
        return dateB - dateA;
      });

      setPosts(combinedFeed);
      
      if (storiesRes) setStories(storiesRes.users || []);
      if (usersRes) setSuggestedUsers(usersRes.users || []);

    } catch (err) {
      console.error("Critical Feed Error:", err);
      toast.error("Failed to load feed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFeedData();
  }, []);

  // ❤️ LIKE POST OR REEL
  const handleLike = async (item) => {
    const id = item._id;
    
    // Optimistic UI update
    setPosts((prev) =>
      prev.map((p) =>
        p._id === id
          ? {
              ...p,
              likes: p.likes?.includes("me")
                ? p.likes.filter((l) => l !== "me")
                : [...(p.likes || []), "me"],
            }
          : p
      )
    );

    try {
      // Dynamically call the correct API based on the type
      if (item.feedItemType === "reel") {
        await likeReel(id);
      } else {
        await likePost(id);
      }
    } catch {
      loadFeedData(); // Revert on failure
    }
  };

  // ❤️ DOUBLE TAP
  const handleDoubleTap = (item) => {
    handleLike(item);
    setShowHeart(item._id);
    setTimeout(() => setShowHeart(null), 800);
  };

  // 🔖 SAVE POST OR REEL
  const handleSaveItem = async (itemId) => {
    try {
      await savePost(itemId);
      toast.success("Saved to your profile!");
    } catch (error) {
      toast.error(error.message || "Already saved or failed to save");
    } finally {
      setOpenMenuId(null);
    }
  };

  // 🗑️ REMOVE POST OR REEL
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

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader size="40px" />
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col items-center w-full bg-[#fafafa] min-h-screen pb-10">

        {/* STORIES */}
        <Stories users={stories} />

        {/* POSTS/REELS CONTAINER */}
        <div className="flex flex-col items-center gap-6 mt-6 w-full max-w-[470px]">

          {/* Show suggestions at the top ONLY if there is no feed data */}
          {posts.length === 0 && suggestedUsers.length > 0 && (
             <Suggestions users={suggestedUsers} />
          )}

          {posts.map((post, index) => {
            
            // ✅ IDENTIFY IF IT IS AN EVENT POST
            const isEventPost = post.isEvent === true || post.isEvent === "true" || post.caption?.includes("Upcoming Event");

            return (
              <React.Fragment key={post._id}>
                
                {/* === INDIVIDUAL FEED ITEM (POST OR REEL) === */}
                <div className="bg-white w-full border border-gray-200 rounded-lg overflow-hidden relative">

                  {/* HEADER */}
                  <div className="flex justify-between items-center px-4 py-3">
                    <div className="flex gap-3 items-center">
                      <img
                        src={getProfileImage(post.user)}
                        className="w-8 h-8 rounded-full object-cover border border-gray-100"
                        alt={post.user?.username || "User"}
                      />
                      <div className="flex flex-col">
                        <p className="font-semibold text-sm flex items-center">
                          {post.user?.username}
                          <RoleBadge role={post.user?.role} />
                        </p>
                        {post.feedItemType === "reel" && (
                           <span className="text-[10px] text-gray-400 font-bold tracking-wide uppercase">Reel</span>
                        )}
                        {/* ✅ EVENT BADGE IN HEADER */}
                        {isEventPost && (
                           <span className="text-[10px] text-blue-500 font-bold tracking-wide uppercase">Event Announcement</span>
                        )}
                      </div>
                    </div>

                    {/* 3 DOTS MENU */}
                    <div className="relative">
                      <img 
                        src={Assets.dots} 
                        className="w-5 cursor-pointer hover:opacity-70 transition-opacity" 
                        alt="options" 
                        onClick={() => setOpenMenuId(openMenuId === post._id ? null : post._id)}
                      />
                      
                      {openMenuId === post._id && (
                        <>
                          {/* Invisible Background to handle click-outside */}
                          <div className="fixed inset-0 z-40" onClick={() => setOpenMenuId(null)}></div>
                          
                          {/* Popup Menu */}
                          <div className="absolute right-0 top-6 w-40 bg-white border border-gray-200 shadow-xl rounded-xl z-50 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
                            
                            {/* SAVE */}
                            <button 
                              onClick={() => handleSaveItem(post._id)}
                              className="w-full px-4 py-3 text-left text-gray-700 font-medium text-[14px] hover:bg-gray-50 border-b border-gray-100 transition-colors"
                            >
                              Save
                            </button>

                            {/* SHARE */}
                            <button 
                              onClick={() => { setOpenShare(post); setOpenMenuId(null); }}
                              className="w-full px-4 py-3 text-left text-gray-700 font-medium text-[14px] hover:bg-gray-50 border-b border-gray-100 transition-colors"
                            >
                              Share
                            </button>

                            {/* REPORT */}
                            <button 
                              onClick={() => { toast.info("Reported to admins."); setOpenMenuId(null); }}
                              className="w-full px-4 py-3 text-left text-orange-500 font-medium text-[14px] hover:bg-gray-50 border-b border-gray-100 transition-colors"
                            >
                              Report
                            </button>

                            {/* REMOVE (Only for Items owned by User) */}
                            {user?._id === post.user?._id && (
                              <button 
                                onClick={() => handleDeleteItem(post._id)}
                                className="w-full px-4 py-3 text-left text-red-500 font-bold text-[14px] hover:bg-gray-50 border-b border-gray-100 transition-colors"
                              >
                                Remove
                              </button>
                            )}
                            
                            {/* CANCEL */}
                            <button 
                              onClick={() => setOpenMenuId(null)}
                              className="w-full px-4 py-3 text-left text-gray-500 text-[14px] hover:bg-gray-50 transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* MEDIA */}
                  <div
                    onDoubleClick={() => handleDoubleTap(post)}
                    className="relative bg-black flex justify-center items-center overflow-hidden"
                  >
                    {post.type === "video" ? (
                      <video
                        src={post.media}
                        className="w-full max-h-[580px] object-contain"
                        autoPlay
                        loop
                        muted
                        playsInline
                      />
                    ) : (
                      <img
                        src={post.media}
                        className="w-full max-h-[580px] object-contain"
                        alt="post media"
                      />
                    )}

                    {/* ✅ CLICKABLE OVERLAY TEXT */}
                    {post.overlayText && (
                      <div 
                        onClick={(e) => {
                          if (isEventPost) {
                            e.stopPropagation();
                            navigate("/events"); // Click overlay -> go to events
                          }
                        }}
                        className={`absolute z-30 px-4 py-2 ${isEventPost ? "cursor-pointer hover:scale-105 transition-transform" : "pointer-events-none"}`}
                        style={{
                          top: "50%",
                          left: "50%",
                          transform: `translate(calc(-50% + ${post.overlayX || 0}px), calc(-50% + ${post.overlayY || 0}px))`
                        }}
                      >
                        <p className={`text-center text-3xl text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)] whitespace-nowrap ${post.overlayFont || "font-sans"}`}>
                          {post.overlayText}
                        </p>
                      </div>
                    )}

                    {/* Heart Animation */}
                    {showHeart === post._id && (
                      <div className="absolute inset-0 flex justify-center items-center z-20 pointer-events-none">
                        <img src={Assets.liked} className="w-24 animate-bounce drop-shadow-lg" alt="liked" />
                      </div>
                    )}
                  </div>

                  {/* ACTIONS */}
                  <div className="flex justify-between px-4 pt-3 pb-2">
                    <div className="flex gap-4">
                      <img
                        src={Assets.like}
                        onClick={() => handleLike(post)}
                        className="w-6 cursor-pointer hover:scale-110 transition-transform"
                        alt="like"
                      />
                      <img
                        src={Assets.comment}
                        onClick={() => setActivePost(post)}
                        className="w-6 cursor-pointer hover:scale-110 transition-transform"
                        alt="comment"
                      />
                      <img
                        src={Assets.share}
                        onClick={() => setOpenShare(post)}
                        className="w-6 cursor-pointer hover:scale-110 transition-transform"
                        alt="share"
                      />
                    </div>

                    {/* Save button visible for all items */}
                    <img 
                      src={Assets.save} 
                      onClick={() => handleSaveItem(post._id)} 
                      className="w-6 cursor-pointer hover:scale-110 transition-transform" 
                      alt="save" 
                    />
                  </div>

                  {/* LIKES */}
                  <div className="px-4 text-sm font-bold mb-1 text-gray-900">
                    {post.likes?.length || 0} likes
                  </div>

                  {/* CAPTION */}
                  <div className="px-4 text-[14px] text-gray-800 leading-snug mb-2">
                    <span className="font-bold mr-2 inline-flex items-center text-gray-900 cursor-pointer hover:text-gray-500">
                      {post.user?.username}
                      <RoleBadge role={post.user?.role} />
                    </span>
                    {/* ✅ PRE-WRAP KEEPS LINE BREAKS FROM CREATE EVENT */}
                    <span className="whitespace-pre-wrap block mt-1 text-[13px]">{post.caption}</span>
                  </div>

                  {/* ✅ DEDICATED REGISTER BUTTON FOR EVENTS */}
                  {isEventPost && (
                    <div className="px-4 pb-2 mt-2">
                      <button 
                        onClick={() => navigate("/events")}
                        className="w-full py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-600 font-bold rounded-lg transition-colors flex items-center justify-center gap-2 text-sm border border-blue-100 shadow-sm"
                      >
                        <FaTicketAlt /> Go to Events Page to Register
                      </button>
                    </div>
                  )}

                  {/* COMMENTS TRIGGER */}
                  <div
                    onClick={() => setActivePost(post)}
                    className="px-4 py-2 mb-2 text-gray-500 text-[13px] cursor-pointer hover:text-gray-400"
                  >
                    {post.comments?.length > 0
                      ? `View all ${post.comments.length} comments`
                      : "Add a comment..."}
                  </div>

                  {/* DATE */}
                  <div className="px-4 pb-4 text-[10px] text-gray-400 uppercase tracking-wide">
                    {post.createdAt ? new Date(post.createdAt).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    }) : "RECENT"}
                  </div>
                </div>

                {/* 🔥 INJECT SUGGESTIONS AFTER THE 1ST POST */}
                {index === 0 && suggestedUsers.length > 0 && (
                  <div className="w-full my-2">
                    <Suggestions users={suggestedUsers} />
                  </div>
                )}
                
              </React.Fragment>
            );
          })}

        </div>
      </div>

      {/* COMMENTS MODAL */}
      {activePost && (
        <CommentsModal
          item={activePost}
          // Pass the correct type to the CommentsModal based on feed item
          type={activePost.feedItemType === "reel" ? "reel" : "post"}
          onClose={() => setActivePost(null)}
          onSync={(updatedItem) => {
            setPosts((prev) =>
              prev.map((p) =>
                p._id === updatedItem._id ? updatedItem : p
              )
            );
            setActivePost(updatedItem);
          }}
        />
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

export default Feed;