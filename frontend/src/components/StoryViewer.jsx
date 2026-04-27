import React, { useEffect, useState, useRef } from "react";
import { viewStory, deleteStory } from "../services/storyService";
import {
  FaTimes,
  FaChevronLeft,
  FaPaperPlane,
  FaEllipsisV,
  FaTrash,
} from "react-icons/fa";
import CommentsModal from "./CommentsModal";
import { getProfileImage } from "../utils/getProfileImage";
import RoleBadge from "../components/RoleBadge";
import { useAuth } from "../context/AuthContext";
import { toast } from "react-toastify";

function StoryViewer({ stories, currentIndex, onClose }) {
  const { user: currentUser } = useAuth();

  const [index, setIndex] = useState(currentIndex || 0);
  const [progress, setProgress] = useState(0);
  const [showComments, setShowComments] = useState(false);

  const [showMenu, setShowMenu] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const timerRef = useRef(null);
  const viewedStoriesRef = useRef(new Set());

  const currentStory = stories?.[index];

  useEffect(() => {
    if (!currentStory || showComments || showMenu) return;

    clearInterval(timerRef.current);
    setProgress(0);

    const storyId = currentStory._id;

    if (storyId && !viewedStoriesRef.current.has(storyId)) {
      viewedStoriesRef.current.add(storyId);

      // 🔥 OPTIMISTIC UPDATE: Instantly mark as viewed locally so the feed ring updates instantly
      if (currentUser?._id) {
        if (!currentStory.views) currentStory.views = [];
        if (!currentStory.views.includes(currentUser._id)) {
          currentStory.views.push(currentUser._id);
        }
      }

      viewStory(storyId).catch((err) => {
        if (
          err?.message !== "Story not found" &&
          err?.response?.data?.message !== "Story not found"
        ) {
          console.error("Story view failed:", err);
        }
      });
    }

    timerRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(timerRef.current);

          if (index < stories.length - 1) {
            setIndex((prevIndex) => prevIndex + 1);
          } else {
            onClose?.();
          }
          return 100;
        }
        return prev + 1.5;
      });
    }, 100);

    return () => clearInterval(timerRef.current);
  }, [index, currentStory?._id, showComments, showMenu, stories?.length, onClose, currentUser]);

  const handleNavigation = (e) => {
    if (e.target.closest(".ignore-click")) {
      if (!e.target.closest(".menu-container") && showMenu) {
        setShowMenu(false);
        setConfirmDelete(false);
      }
      return;
    }

    if (showMenu) {
      setShowMenu(false);
      setConfirmDelete(false);
      return;
    }

    const { clientX } = e;
    const { innerWidth } = window;

    if (clientX < innerWidth / 2) {
      if (index > 0) {
        setIndex((prev) => prev - 1);
      } else {
        onClose?.();
      }
    } else {
      if (index < stories.length - 1) {
        setIndex((prev) => prev + 1);
      } else {
        onClose?.();
      }
    }
  };

  const executeDelete = async () => {
    try {
      if (!currentStory?._id) return;

      await deleteStory(currentStory._id);
      toast.success("Story deleted");

      const updatedStories = stories.filter(
        (story) => story._id !== currentStory._id
      );

      setShowMenu(false);
      setConfirmDelete(false);

      if (updatedStories.length === 0) {
        onClose?.();
        return;
      }

      stories.splice(0, stories.length, ...updatedStories);

      if (index >= updatedStories.length) {
        setIndex(updatedStories.length - 1);
      } else {
        setIndex(index);
      }

      setProgress(0);
    } catch (err) {
      console.error("Delete Story Error:", err);
      toast.error(err?.message || "Failed to delete story");
      setShowMenu(false);
      setConfirmDelete(false);
    }
  };

  const getDynamicTextClasses = (story) => {
    // 🔥 FIX: Added px-6 py-3 to match the exact padding used in AddStory.jsx
    let base = `absolute px-6 py-3 whitespace-pre-wrap break-words select-none transition-all duration-200 z-30 pointer-events-none ${story.textFont || "font-sans"}`;

    if (story.textStyle === "playful") {
      base += ` -rotate-6 scale-110 skew-x-[-5deg]`;
    }

    return base;
  };

  const getDynamicTextStyles = (story) => {
    const textColor = story.textColor || "white";
    const textStyle = story.textStyle || "classic";
    const textSize = Number(story.textSize) || 36;

    const containerWidth =
      window.innerWidth > 420
        ? 420
        : window.innerWidth;

    const containerHeight =
      window.innerWidth > 640
        ? Math.min(
            window.innerHeight * 0.9,
            850
          )
        : window.innerHeight;

    const normalizedX = Number(story.textX) || 0.5;
    const normalizedY = Number(story.textY) || 0.5;

    const textX = normalizedX * containerWidth - containerWidth / 2;
    const textY = normalizedY * containerHeight - containerHeight / 2;

    let style = {
      position: "absolute",
      left: "50%",
      top: "50%",
      color: textColor,
      fontSize: `${textSize}px`,
      display: "inline-block",
      textAlign: "center",
      whiteSpace: "pre-wrap",
      lineHeight: "1.4", // 🔥 FIX: Matched lineHeight 1.4 from AddStory.jsx
      maxWidth: "90%",
      wordBreak: "break-word",
      transform: `translate(-50%, -50%) translate3d(${textX}px, ${textY}px, 0)`,
      zIndex: 30,
    };

    if (textStyle === "highlight") {
      style.backgroundColor = textColor;
      style.color =
        textColor === "white" ||
        textColor === "#eab308"
          ? "black"
          : "white";
      style.padding = "4px 16px"; // 🔥 FIX: Matched highlight padding from AddStory.jsx
      style.borderRadius = "12px";
      style.boxDecorationBreak = "clone";
      style.WebkitBoxDecorationBreak = "clone";

    } else if (textStyle === "neon") {
      style.textShadow = `
        0 0 10px ${textColor},
        0 0 20px ${textColor},
        0 0 30px ${textColor}
      `;
      style.color = "white";

    } else if (textStyle === "outline") {
      style.WebkitTextStroke = `1.5px ${
        textColor === "black"
          ? "white"
          : "black"
      }`;

    } else if (textStyle === "3d-pop") {
      style.textShadow = `
        2px 2px 0px #000,
        4px 4px 0px #222,
        6px 6px 0px #444
      `;

    } else if (textStyle === "glitch") {
      style.textShadow = `
        3px 0 0 red,
        -3px 0 0 cyan
      `;

    } else if (textStyle === "playful") {
      style.transform = `
        translate(-50%, -50%)
        translate3d(${textX}px, ${textY}px, 0)
        rotate(-5deg)
      `;
      style.textShadow = "3px 3px 0px rgba(0,0,0,0.5)";

    } else if (textStyle === "elegant") {
      style.textShadow = "0px 2px 4px rgba(0,0,0,0.3)";
      style.letterSpacing = "2px";

    } else {
      style.textShadow = "0 2px 10px rgba(0,0,0,0.8)";
    }

    return style;
  };

  if (!currentStory) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/95 sm:backdrop-blur-2xl z-[200] flex justify-center items-center overflow-hidden touch-none font-['Poppins',sans-serif]">
        <div
          onClick={handleNavigation}
          className="relative w-full max-w-[420px] h-[100dvh] sm:h-[90vh] sm:max-h-[850px] bg-black sm:rounded-[32px] overflow-hidden flex flex-col shadow-2xl border sm:border-white/10"
        >
          <div className="absolute top-0 left-0 right-0 z-[220] p-4 bg-gradient-to-b from-black/80 to-transparent">
            <div className="flex gap-1.5 mb-4">
              {stories.map((_, i) => (
                <div
                  key={i}
                  className="flex-1 h-[2px] bg-white/20 rounded-full overflow-hidden"
                >
                  <div
                    className="h-full bg-white transition-all duration-100 ease-linear shadow-[0_0_10px_white]"
                    style={{
                      width: i < index ? "100%" : i === index ? `${progress}%` : "0%",
                    }}
                  />
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onClose?.();
                  }}
                  className="ignore-click text-white p-1 hover:bg-white/10 rounded-full transition-colors"
                >
                  <FaChevronLeft size={20} />
                </button>

                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full border-2 border-blue-500 p-[1.5px]">
                    <img
                      src={getProfileImage(currentStory.user)}
                      className="w-full h-full rounded-full object-cover"
                      alt="User"
                    />
                  </div>

                  <div className="flex flex-col">
                    <span className="text-white text-sm font-bold flex items-center gap-1 drop-shadow-md">
                      {currentStory.user?.username}
                      <RoleBadge role={currentStory.user?.role} />
                    </span>

                    <span className="text-white/60 text-[10px] font-medium uppercase tracking-tighter">
                      {new Date(currentStory.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1 relative menu-container">
                {currentUser?._id === currentStory.user?._id && (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (showMenu) setConfirmDelete(false);
                        setShowMenu(!showMenu);
                      }}
                      className="ignore-click text-white/90 hover:text-white p-2 hover:bg-white/10 rounded-full transition-colors"
                    >
                      <FaEllipsisV size={18} />
                    </button>

                    {showMenu && (
                      <div className="absolute top-12 right-2 w-48 bg-[#1c1c1e]/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.5)] overflow-hidden z-[999] flex flex-col">
                        {!confirmDelete ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmDelete(true);
                            }}
                            className="w-full px-4 py-3.5 flex items-center gap-3 text-sm font-bold text-red-500 hover:bg-white/10 transition-colors"
                          >
                            <FaTrash size={14} />
                            Delete Story
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                executeDelete();
                              }}
                              className="w-full px-4 py-3 text-sm font-bold text-red-500 hover:bg-red-500/10"
                            >
                              Yes, Delete
                            </button>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setConfirmDelete(false);
                                setShowMenu(false);
                              }}
                              className="w-full px-4 py-3 text-sm font-bold text-white hover:bg-white/10"
                            >
                              Cancel
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </>
                )}

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onClose?.();
                  }}
                  className="ignore-click text-white/90 hover:text-white p-2 hover:bg-white/10 rounded-full transition-colors ml-1"
                >
                  <FaTimes size={22} />
                </button>
              </div>
            </div>
          </div>

          <div
            className={`flex-1 flex items-center justify-center relative overflow-hidden ${
              currentStory.type === "text"
                ? `bg-gradient-to-br ${currentStory.bgGradient || "from-gray-900 to-black"}`
                : "bg-black"
            }`}
          >
            {currentStory.type === "video" && (
              <video
                src={currentStory.media}
                className={`w-full h-full object-cover ${currentStory.filter || ""}`}
                autoPlay
                muted
                playsInline
              />
            )}

            {currentStory.type === "image" && (
              <img
                src={currentStory.media}
                className={`w-full h-full object-cover ${currentStory.filter || ""}`}
                alt="Story"
              />
            )}

            {currentStory.text && (
              <div
                className={getDynamicTextClasses(currentStory)}
                style={getDynamicTextStyles(currentStory)}
              >
                {currentStory.text}
              </div>
            )}
          </div>

          <div className="absolute bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-black/90 to-transparent flex items-center gap-4 z-[220]">
            <div
              onClick={(e) => {
                e.stopPropagation();
                setShowComments(true);
              }}
              className="ignore-click flex-1 bg-white/10 hover:bg-white/20 border border-white/20 rounded-full px-5 py-3 text-white/80 text-sm cursor-text transition-all backdrop-blur-md"
            >
              Send message...
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowComments(true);
              }}
              className="ignore-click text-white hover:scale-110 transition-transform"
            >
              <FaPaperPlane size={22} />
            </button>
          </div>
        </div>
      </div>

      {showComments && (
        <CommentsModal
          item={currentStory}
          type="story"
          onClose={() => setShowComments(false)}
        />
      )}
    </>
  );
}

export default StoryViewer;