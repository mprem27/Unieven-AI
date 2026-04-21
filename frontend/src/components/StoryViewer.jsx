import React, { useEffect, useState, useRef } from "react";
import { viewStory } from "../services/storyService";
import { FaTimes, FaComment, FaPaperPlane } from "react-icons/fa";
import CommentsModal from "./CommentsModal";
import { getProfileImage } from "../utils/getProfileImage";
import RoleBadge from "../components/RoleBadge"; 

function StoryViewer({ stories, currentIndex, onClose }) {
  const [index, setIndex] = useState(currentIndex || 0);
  const [progress, setProgress] = useState(0);
  const [showComments, setShowComments] = useState(false);
  const timerRef = useRef(null);

  const currentStory = stories[index];

  // 🔥 TIMER + VIEW TRACK (PAUSE ON COMMENTS)
  useEffect(() => {
    if (!currentStory || showComments) return;

    setProgress(0);

    // ✅ mark viewed
    viewStory(currentStory._id);

    timerRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(timerRef.current);

          if (index < stories.length - 1) {
            setIndex((prevIndex) => prevIndex + 1);
          } else {
            onClose();
          }

          return 100;
        }
        return prev + 2;
      });
    }, 100);

    return () => clearInterval(timerRef.current);
  }, [index, currentStory, showComments]);

  // 👉 CLICK NAVIGATION (Fixed 50/50 Split)
  const handleClick = (e) => {
    // Prevent navigation if clicking on buttons or input areas
    if (
      e.target.closest(".close-btn") ||
      e.target.closest(".comment-btn") ||
      e.target.closest(".interactive-area")
    ) {
      return;
    }

    const width = window.innerWidth;
    const clickX = e.clientX;

    // ✅ Left half of screen = Previous Story
    if (clickX < width / 2) {
      if (index > 0) {
        setIndex(index - 1);
      }
    } 
    // ✅ Right half of screen = Next Story
    else {
      if (index < stories.length - 1) {
        setIndex(index + 1);
      } else {
        onClose();
      }
    }
  };

  if (!currentStory) return null;

  return (
    <>
      <div
        onClick={handleClick}
        className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[100] flex justify-center items-center font-['Poppins',sans-serif] antialiased cursor-pointer"
      >
        <div className="relative w-full max-w-[420px] h-full sm:h-[90vh] sm:rounded-[32px] overflow-hidden bg-black shadow-2xl border sm:border-gray-800 cursor-default">

          {/* 🔥 PROGRESS BARS (Premium Top Edge) */}
          <div className="absolute top-4 left-3 right-3 flex gap-1.5 z-[110]">
            {stories.map((_, i) => (
              <div
                key={i}
                className="flex-1 h-[3px] bg-white/20 rounded-full overflow-hidden backdrop-blur-sm"
              >
                <div
                  className="h-full bg-white transition-all duration-100 ease-linear rounded-full shadow-[0_0_8px_rgba(255,255,255,0.8)]"
                  style={{
                    width:
                      i < index
                        ? "100%"
                        : i === index
                        ? `${progress}%`
                        : "0%",
                  }}
                />
              </div>
            ))}
          </div>

          {/* 👤 USER HEADER (Profile Pic & Username) */}
          <div className="absolute top-8 left-0 right-0 px-4 flex items-center justify-between z-[110] bg-gradient-to-b from-black/60 to-transparent pb-6 pt-2">
            <div className="flex items-center gap-3 text-white">
              <div className="w-10 h-10 rounded-full p-[2px] bg-gradient-to-tr from-blue-500 to-purple-500 shadow-lg">
                <img
                  src={getProfileImage(currentStory.user)}
                  className="w-full h-full rounded-full object-cover border-2 border-black"
                  alt="Profile"
                />
              </div>

              <span className="text-[15px] font-bold tracking-tight flex items-center drop-shadow-md">
                {currentStory.user?.username}
                <RoleBadge role={currentStory.user?.role} />
              </span>
            </div>

            {/* ❌ CLOSE BUTTON */}
            <button
              onClick={(e) => {
                e.stopPropagation(); // Stop click from triggering next story
                onClose();
              }}
              className="close-btn text-white/80 hover:text-white transition-colors p-2"
            >
              <FaTimes size={24} className="drop-shadow-md" />
            </button>
          </div>

          {/* 📸 MEDIA CONTENT */}
          <div className="w-full h-full flex items-center justify-center bg-[#111] pointer-events-none">
            {currentStory.type === "video" ? (
              <video
                src={currentStory.media}
                className="w-full h-full object-cover"
                autoPlay
                muted
                playsInline
              />
            ) : (
              <img
                src={currentStory.media}
                className="w-full h-full object-cover"
                alt="Story content"
              />
            )}
          </div>

          {/* 📝 STORY TEXT / TAGS OVERLAY */}
          {currentStory.text && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[105]">
              <p className="text-white bg-black/50 backdrop-blur-md px-6 py-3 rounded-2xl text-[18px] font-bold text-center max-w-[80%] shadow-lg">
                {currentStory.text}
              </p>
            </div>
          )}

          {/* 💬 BOTTOM INTERACTION BAR */}
          <div className="interactive-area absolute bottom-0 left-0 right-0 p-4 flex items-center gap-3 bg-gradient-to-t from-black/80 via-black/40 to-transparent pt-12 z-[120]">
            
            {/* Fake Reply Input to look like IG */}
            <div 
              onClick={(e) => {
                e.stopPropagation();
                setShowComments(true);
              }}
              className="comment-btn flex-1 bg-white/20 hover:bg-white/30 backdrop-blur-md border border-white/30 rounded-full px-5 py-3.5 text-white/90 text-[14px] font-medium cursor-text transition-all"
            >
              Reply to {currentStory.user?.username}...
            </div>

            {/* Share / Like Buttons */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowComments(true);
              }}
              className="comment-btn text-white hover:scale-110 transition-transform drop-shadow-lg"
            >
              <FaPaperPlane size={22} />
            </button>
          </div>

        </div>
      </div>

      {/* 🔥 COMMENTS MODAL */}
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