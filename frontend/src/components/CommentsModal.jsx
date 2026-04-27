import React, { useState, useEffect, useRef, useCallback } from "react";
import { getProfileImage } from "../utils/getProfileImage";
import {
  addComment,
  likeComment,
  deleteComment,
} from "../services/commentService";
import { FaHeart, FaRegHeart } from "react-icons/fa";
import { useAuth } from "../context/AuthContext";
import RoleBadge from "../components/RoleBadge";

// Instagram-style Quick Emojis
const QUICK_EMOJIS = ["❤️", "🙌", "🔥", "👏", "😢", "😍", "😮", "😂"];

function CommentsModal({ item, type, onClose, onSync }) {
  const { user } = useAuth();

  const [comments, setComments] = useState(item?.comments || []);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  
  // 🔥 Ref to auto-scroll to newest comment
  const commentsEndRef = useRef(null);

  const scrollToBottom = () => {
    commentsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Keep state synced if parent item changes
  useEffect(() => {
    setComments(item?.comments || []);
  }, [item]);

  // Auto-scroll when new comment is added
  useEffect(() => {
    scrollToBottom();
  }, [comments.length]); // Only run when array length changes

  // Close on Escape key
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  // 🔥 ADD COMMENT FUNCTION
  const handleAdd = useCallback(async () => {
    if (!text.trim() || loading || !user) return;

    const commentText = text.trim();
    setLoading(true);

    // 1. Optimistic UI Update (Shows instantly to the user)
    const tempId = `temp-${Date.now()}`;
    const tempComment = {
      _id: tempId,
      text: commentText,
      user: {
        _id: user._id,
        username: user.username,
        image: user.image,
        role: user.role
      },
      likes: [],
      createdAt: new Date().toISOString(), // Prevent undefined date crashes
    };

    setComments((prev) => [...prev, tempComment]);
    setText(""); // Clear input instantly

    try {
      // 2. Send to Backend
      const res = await addComment(type, item._id, commentText);

      // 3. Sync with real Database IDs
      if (
        res?.item?.comments &&
        Array.isArray(res.item.comments)
      ) {
        setComments(res.item.comments);
        onSync?.(res.item);
      }
    } catch (error) {
      console.error("Add comment failed:", error);
      // Rollback if the API fails
      setComments((prev) => prev.filter((c) => c._id !== tempId));
    } finally {
      setLoading(false);
    }
  }, [text, loading, user, type, item, onSync]);

  // 🔥 LIKE COMMENT FUNCTION
  const toggleLike = async (commentId) => {
    if (!user?._id) return;

    const previousComments = [...comments];

    // Optimistic Like Update
    setComments((prev) =>
      prev.map((c) => {
        if (c._id !== commentId) return c;
        const alreadyLiked = c.likes?.includes(user._id);
        return {
          ...c,
          likes: alreadyLiked
            ? c.likes.filter((id) => id !== user._id)
            : [...(c.likes || []), user._id],
        };
      })
    );

    try {
      // Send to Backend
      const res = await likeComment(type, commentId);

      if (res?.likes) {
        setComments((prev) =>
          prev.map((c) =>
            c._id === commentId
              ? {
                  ...c,
                  likes: res.likes,
                }
              : c
          )
        );
      }
    } catch (error) {
      setComments(previousComments); // Rollback on failure
      console.error("Like comment failed:", error);
    }
  };

  // 🔥 DELETE COMMENT FUNCTION
  const handleDeleteComment = async (commentId) => {
    try {
      const res = await deleteComment(type, commentId);

      const updatedComments =
        res?.item?.comments ||
        res?.comments ||
        [];

      setComments(updatedComments);

      onSync?.(res.item || res);

    } catch (error) {
      console.error(
        "Delete comment failed:",
        error
      );
    }
  };

  // Helper for quick emoji clicks
  const appendEmoji = (emoji) => {
    setText((prev) => prev + emoji);
  };

  return (
    <div
      className="fixed inset-0 z-[999] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className={`relative flex flex-col bg-[#121212] border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.85)] w-full h-[85dvh] sm:max-w-md sm:h-[85vh] sm:max-h-[750px] rounded-t-[24px] sm:rounded-[24px] overflow-hidden animate-slideUp transition-opacity duration-300 ${
          loading ? "opacity-90 pointer-events-none" : "opacity-100"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* MOBILE DRAG HANDLE */}
        <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mt-3 mb-1 sm:hidden" />

        {/* HEADER */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/5 bg-[#121212] sticky top-0 z-20">
          <div className="w-8" /> {/* Spacer for perfect centering */}
          <h2 className="text-base font-bold text-white tracking-wide">
            Comments
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 transition-all active:scale-90"
          >
            <span className="text-white text-sm">✕</span>
          </button>
        </div>

        {/* COMMENTS LIST */}
        <div className="flex-1 overflow-y-auto px-4 py-5 space-y-6 custom-scrollbar">
          {comments.length > 0 ? (
            comments.map((comment, index) => {
              const likedByMe = comment.likes?.includes(user?._id);

              return (
                <div
                  key={comment._id}
                  className="flex items-start gap-3 w-full animate-fadeIn"
                  style={{ animationDelay: `${index * 15}ms` }}
                >
                  {/* AVATAR */}
                  <img
                    src={getProfileImage(comment.user)}
                    alt="avatar"
                    className="w-9 h-9 rounded-full object-cover border border-white/10 flex-shrink-0 mt-1"
                  />

                  {/* COMMENT BODY */}
                  <div className="flex-1 min-w-0 pr-2">
                    <div className="flex items-baseline flex-wrap gap-x-2">
                      <span className="text-[13px] font-bold text-white flex items-center gap-1">
                        {comment.user?.username || "user"}
                        {comment.user?.role && (
                          <RoleBadge role={comment.user.role} className="scale-[0.65] origin-left -ml-0.5" />
                        )}
                      </span>
                      <span className="text-[14px] text-gray-100 break-words leading-tight">
                        {comment.text}
                      </span>
                    </div>

                    {/* ACTIONS ROW (Time, Reply, Delete) */}
                    <div className="flex items-center gap-4 mt-1.5 text-[11px] font-semibold text-gray-500">
                      <span>
                        {comment.createdAt
                          ? new Date(comment.createdAt).toLocaleDateString([], {
                              month: "short",
                              day: "numeric",
                            })
                          : "Just now"}
                      </span>

                      {comment.likes?.length > 0 && (
                        <span>
                          {comment.likes.length} likes
                        </span>
                      )}

                      <button className="hover:text-gray-300 transition">
                        Reply
                      </button>

                      {comment.user?._id === user?._id && (
                        <button
                          onClick={() =>
                            handleDeleteComment(comment._id)
                          }
                          className="hover:text-red-400 text-red-500 transition"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>

                  {/* INSTAGRAM-STYLE RIGHT-ALIGNED LIKE BUTTON */}
                  <div className="flex flex-col items-center justify-start pt-1 pl-1 flex-shrink-0">
                    <button
                      onClick={() => toggleLike(comment._id)}
                      className={`transition active:scale-75 ${
                        likedByMe ? "text-red-500" : "text-gray-500 hover:text-white"
                      }`}
                    >
                      {likedByMe ? <FaHeart size={14} /> : <FaRegHeart size={14} />}
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-white/30 space-y-3">
              <div className="text-5xl opacity-80">💬</div>
              <p className="text-[15px] font-semibold tracking-wide text-white/50">No comments yet.</p>
              <p className="text-xs">Start the conversation.</p>
            </div>
          )}
          {/* Invisible anchor div for auto-scrolling */}
          <div ref={commentsEndRef} className="h-1" />
        </div>

        {/* BOTTOM INPUT AREA */}
        <div className="border-t border-white/5 bg-[#121212] flex flex-col pb-[max(env(safe-area-inset-bottom),12px)]">
          
          {/* QUICK EMOJI TRAY */}
          <div className="flex items-center gap-4 px-4 py-2 overflow-x-auto scrollbar-hide border-b border-white/5">
            {QUICK_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => appendEmoji(emoji)}
                className="text-2xl hover:scale-125 transition-transform flex-shrink-0 active:scale-95"
              >
                {emoji}
              </button>
            ))}
          </div>

          {/* TEXT INPUT ROW */}
          <div className="flex items-center gap-3 px-4 py-3">
            <img
              src={getProfileImage(user)}
              className="w-8 h-8 rounded-full object-cover border border-white/10"
              alt="me"
            />
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAdd();
                }
              }}
              placeholder="Add a comment..."
              maxLength={300}
              className="flex-1 min-w-0 bg-transparent outline-none text-[14px] text-white placeholder-gray-500 py-1"
            />
            <button
              onClick={handleAdd}
              disabled={!text.trim() || loading}
              className={`font-semibold text-[14px] transition-all flex-shrink-0 ${
                !text.trim() || loading
                  ? "text-blue-500/40"
                  : "text-blue-500 hover:text-blue-400 active:scale-95"
              }`}
            >
              Post
            </button>
          </div>
        </div>
      </div>

      {/* ANIMATIONS & SCROLLBAR CSS */}
      <style>
        {`
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes slideUp {
            from { transform: translateY(100%); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
          }
          .animate-fadeIn { animation: fadeIn 0.3s ease forwards; }
          .animate-slideUp { animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
          
          /* Hide scrollbar for emoji tray */
          .scrollbar-hide::-webkit-scrollbar { display: none; }
          .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
          
          /* Subtle scrollbar for comments list */
          .custom-scrollbar::-webkit-scrollbar {
            width: 4px;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb {
            background: rgba(255,255,255,0.15);
            border-radius: 10px;
          }
        `}
      </style>
    </div>
  );
}

export default CommentsModal;