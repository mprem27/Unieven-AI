import React, { useState, useEffect } from "react";
import { getProfileImage } from "../utils/getProfileImage";
import { addComment, likeComment } from "../services/commentService";
import { FaHeart, FaRegHeart } from "react-icons/fa";
import { IoSend } from "react-icons/io5";
import { useAuth } from "../context/AuthContext";

function CommentsModal({ item, type, onClose, onSync }) {
  
  const { user } = useAuth();

  const [comments, setComments] = useState(item.comments || []);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);


  useEffect(() => {
    setComments(item.comments || []);
  }, [item]);

  const handleAdd = async () => {
    if (!text.trim() || loading) return;

    const commentText = text.trim();

    setLoading(true);


    const temp = {
      _id: `temp-${Date.now()}`,
      text: commentText,
      user,
      likes: [],
    };

    setComments((prev) => [...prev, temp]);
    setText("");

    try {
      const res = await addComment(type, item._id, commentText);

      if (res.item?.comments) {
        setComments(res.item.comments);
        onSync?.(res.item);
      }

    } catch (e) {

      setComments((prev) =>
        prev.filter((c) => c._id !== temp._id)
      );

    } finally {
      setLoading(false);
    }
  };

  const toggleLike = async (commentId) => {

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
      const res = await likeComment(type, commentId);

      setComments((prev) =>
        prev.map((c) =>
          c._id === commentId
            ? { ...c, likes: res.likes || [] }
            : c
        )
      );

    } catch (e) {
      console.error("Like comment failed:", e);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-end md:items-center justify-center z-[100] p-0 md:p-4 transition-all duration-500 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className={`
          relative flex flex-col transition-all duration-500
          bg-[#121212] border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.8)]
          h-[85%] md:h-[650px] w-full md:max-w-lg md:rounded-[32px] rounded-t-[32px]
          animate-slideUp
          ${
            loading
              ? "opacity-80 pointer-events-none"
              : "opacity-100"
          }
        `}
        onClick={(e) => e.stopPropagation()}
      >
        {/* MOBILE HANDLE */}
        <div className="w-12 h-1.5 bg-white/10 rounded-full mx-auto mt-4 mb-1 md:hidden" />

        {/* HEADER */}
        <div className="flex justify-between items-center px-6 py-5 border-b border-white/5">
          <h2 className="font-bold text-lg md:text-xl text-white tracking-tight capitalize">
            {type} comments
          </h2>

          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-full transition-all active:scale-90"
          >
            <span className="text-white text-lg">✕</span>
          </button>
        </div>

        {/* COMMENTS LIST */}
        <div className="flex-1 overflow-y-auto space-y-6 p-6 scrollbar-hide">
          {comments.length ? (
            comments.map((c, index) => {
              const likedByMe =
                c.likes?.includes(user?._id);

              return (
                <div
                  key={c._id}
                  className="flex gap-4 group animate-fadeIn"
                  style={{
                    animationDelay: `${index * 30}ms`,
                  }}
                >
                  <img
                    src={getProfileImage(c.user)}
                    className="w-10 h-10 rounded-full object-cover border border-white/10 shadow-md"
                    alt="user"
                  />

                  <div className="flex-1">
                    <div className="bg-white/[0.03] border border-white/5 rounded-2xl rounded-tl-none p-4">
                      <p className="text-[13px] font-bold text-blue-400 mb-1">
                        {c.user?.username || "user"}
                      </p>

                      <p className="text-[14px] leading-relaxed text-gray-200 whitespace-pre-wrap break-words">
                        {c.text}
                      </p>
                    </div>

                    <div className="flex gap-5 text-[11px] font-bold text-gray-500 mt-2 ml-1 uppercase tracking-widest">
                      <button
                        onClick={() =>
                          toggleLike(c._id)
                        }
                        className={`flex items-center gap-1.5 transition ${
                          likedByMe
                            ? "text-red-500"
                            : "hover:text-white"
                        }`}
                      >
                        {likedByMe ? (
                          <FaHeart className="scale-110" />
                        ) : (
                          <FaRegHeart className="scale-110" />
                        )}

                        <span>
                          {c.likes?.length || 0}
                        </span>
                      </button>

                      <button className="hover:text-white transition">
                        Reply
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-white/20 space-y-4">
              <div className="p-6 bg-white/5 rounded-full text-5xl">
                💬
              </div>

              <p className="text-sm font-semibold tracking-wide">
                No comments yet
              </p>
            </div>
          )}
        </div>

        {/* INPUT */}
        <div className="p-6 border-t border-white/5 bg-[#0a0a0a]/50 md:rounded-b-[32px] pb-[env(safe-area-inset-bottom)]">
          <div className="flex items-center gap-3 bg-white/5 rounded-2xl px-5 py-3 border border-white/10 focus-within:border-white/20 focus-within:bg-white/[0.07] transition-all duration-300">
            <input
              value={text}
              onChange={(e) =>
                setText(e.target.value)
              }
              onKeyDown={(e) =>
                e.key === "Enter" &&
                handleAdd()
              }
              className="flex-1 bg-transparent outline-none text-[15px] text-white placeholder-white/30"
              placeholder="Add a comment..."
            />

            <button
              onClick={handleAdd}
              disabled={
                !text.trim() || loading
              }
              className={`transition-all ${
                !text.trim() || loading
                  ? "text-white/10"
                  : "text-blue-500 hover:text-blue-400 active:scale-90 hover:scale-110"
              }`}
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <IoSend size={22} />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* CUSTOM STYLES */}
      <style>
        {`
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }

          @keyframes slideUp {
            from { transform: translateY(100%); }
            to { transform: translateY(0); }
          }

          .animate-fadeIn {
            animation: fadeIn 0.3s ease-in-out forwards;
          }

          .animate-slideUp {
            animation: slideUp 0.4s cubic-bezier(0.25, 1, 0.5, 1) forwards;
          }

          .scrollbar-hide::-webkit-scrollbar {
            display: none;
          }

          .scrollbar-hide {
            -ms-overflow-style: none;
            scrollbar-width: none;
          }
        `}
      </style>
    </div>
  );
}

export default CommentsModal;