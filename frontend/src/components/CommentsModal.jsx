import React, { useState, useEffect } from "react";
import { getProfileImage } from "../utils/getProfileImage";
import { addComment, likeComment } from "../services/commentService";
import { FaHeart, FaRegHeart } from "react-icons/fa";

function CommentsModal({ item, type, onClose, onSync }) {
  const [comments, setComments] = useState(item.comments || []);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setComments(item.comments || []);
  }, [item]);

  // 🔥 ADD COMMENT (optimistic)
  const handleAdd = async () => {
    if (!text.trim()) return;

    const temp = {
      _id: Date.now(),
      text,
      user: item.user, // current user (optimistic)
      likes: [],
    };

    setComments((prev) => [...prev, temp]);
    setText("");

    try {
      const res = await addComment(type, item._id, text);

      // If backend returns updated item:
      if (res.item) {
        setComments(res.item.comments);
        onSync?.(res.item); // update parent (Feed/Reels/Story)
      }
    } catch (e) {
      // rollback (simple)
      setComments((prev) => prev.filter((c) => c._id !== temp._id));
    }
  };

  // ❤️ LIKE (optimistic + sync)
  const toggleLike = async (commentId) => {
    setComments((prev) =>
      prev.map((c) =>
        c._id === commentId
          ? {
              ...c,
              likes: c.likes?.includes("me")
                ? c.likes.filter((l) => l !== "me")
                : [...(c.likes || []), "me"],
            }
          : c
      )
    );

    try {
      const res = await likeComment(type, commentId);
      setComments((prev) =>
        prev.map((c) =>
          c._id === commentId ? { ...c, likes: res.likes } : c
        )
      );
    } catch (e) {
      // optional rollback
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-end z-50">
      <div className="bg-[#0f0f0f] text-white w-full h-[70%] rounded-t-2xl p-4 flex flex-col">

        {/* HEADER */}
        <div className="flex justify-between items-center mb-3">
          <h2 className="font-semibold text-lg capitalize">
            {type} comments
          </h2>
          <button onClick={onClose} className="text-xl">✕</button>
        </div>

        {/* LIST */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
          {comments.length ? (
            comments.map((c) => (
              <div key={c._id} className="flex gap-3">
                <img
                  src={getProfileImage(c.user)}
                  className="w-8 h-8 rounded-full object-cover"
                />

                <div className="flex-1">
                  <p className="text-sm">
                    <span className="font-semibold mr-2">
                      {c.user?.username || "user"}
                    </span>
                    {c.text}
                  </p>

                  <div className="flex gap-4 text-xs text-gray-400 mt-1">
                    <div
                      onClick={() => toggleLike(c._id)}
                      className="flex items-center gap-1 cursor-pointer"
                    >
                      {c.likes?.includes("me") ? (
                        <FaHeart className="text-red-500" />
                      ) : (
                        <FaRegHeart />
                      )}
                      <span>{c.likes?.length || 0}</span>
                    </div>

                    <span className="cursor-pointer hover:text-white">
                      Reply
                    </span>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p className="text-gray-500 text-center mt-10">
              No comments yet
            </p>
          )}
        </div>

        {/* INPUT */}
        <div className="flex mt-3 gap-2 border-t border-gray-700 pt-3">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="flex-1 bg-transparent p-2 outline-none text-white placeholder-gray-400"
            placeholder="Add a comment..."
          />
          <button
            onClick={handleAdd}
            disabled={loading}
            className="text-blue-500 font-semibold"
          >
            Post
          </button>
        </div>
      </div>
    </div>
  );
}

export default CommentsModal;