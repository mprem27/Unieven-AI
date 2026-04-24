import React, { useEffect, useState, useRef } from "react";
import { viewStory } from "../services/storyService";
import { FaTimes, FaChevronLeft, FaPaperPlane } from "react-icons/fa";
import CommentsModal from "./CommentsModal";
import { getProfileImage } from "../utils/getProfileImage";
import RoleBadge from "../components/RoleBadge";

function StoryViewer({ stories, currentIndex, onClose }) {
  const [index, setIndex] = useState(currentIndex || 0);
  const [progress, setProgress] = useState(0);
  const [showComments, setShowComments] = useState(false);
  const timerRef = useRef(null);

  const currentStory = stories[index];

  // 🔥 TIMER + PROGRESS LOGIC
  useEffect(() => {
    if (!currentStory || showComments) return;

    setProgress(0);
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
        return prev + 1.5; // Smooth speed
      });
    }, 100);

    return () => clearInterval(timerRef.current);
  }, [index, currentStory, showComments]);

  // 👉 CLICK NAVIGATION (Fixed 50/50 Split)
  const handleNavigation = (e) => {
    // Ignore clicks on buttons/inputs
    if (e.target.closest(".ignore-click")) return;

    const { clientX } = e;
    const { innerWidth } = window;

    if (clientX < innerWidth / 2) {
      // Left Side: Previous
      if (index > 0) {
        setIndex(index - 1);
      } else {
        onClose(); // Optional: Close if first story and clicked left
      }
    } else {
      // Right Side: Next
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
      <div className="fixed inset-0 bg-black/95 sm:backdrop-blur-2xl z-[200] flex justify-center items-center overflow-hidden touch-none font-['Poppins',sans-serif]">
        
        {/* Main Viewer Container */}
        <div 
          onClick={handleNavigation}
          className="relative w-full max-w-[480px] h-full sm:h-[95vh] bg-black sm:rounded-[32px] overflow-hidden flex flex-col shadow-2xl border sm:border-white/10"
        >
          
          {/* 🔥 TOP OVERLAY: PROGRESS + HEADER */}
          <div className="absolute top-0 left-0 right-0 z-[220] p-4 bg-gradient-to-b from-black/80 to-transparent">
            
            {/* Progress Bars */}
            <div className="flex gap-1.5 mb-4">
              {stories.map((_, i) => (
                <div key={i} className="flex-1 h-[2px] bg-white/20 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-white transition-all duration-100 ease-linear shadow-[0_0_10px_white]"
                    style={{ width: i < index ? "100%" : i === index ? `${progress}%` : "0%" }}
                  />
                </div>
              ))}
            </div>

            {/* Header Content */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {/* Back Arrow */}
                <button 
                  onClick={(e) => { e.stopPropagation(); onClose(); }}
                  className="ignore-click text-white p-1 hover:bg-white/10 rounded-full transition-colors"
                >
                  <FaChevronLeft size={20} />
                </button>

                {/* Profile Info */}
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
                       {new Date(currentStory.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Close Button */}
              <button 
                onClick={(e) => { e.stopPropagation(); onClose(); }}
                className="ignore-click text-white/80 hover:text-white p-2"
              >
                <FaTimes size={24} />
              </button>
            </div>
          </div>

          {/* 📸 MEDIA AREA */}
          <div className="flex-1 flex items-center justify-center bg-black relative">
            {currentStory.type === "video" ? (
              <video 
                src={currentStory.media} 
                className="w-full h-full object-contain sm:object-cover" 
                autoPlay muted playsInline
              />
            ) : (
              <img 
                src={currentStory.media} 
                className="w-full h-full object-contain sm:object-cover" 
                alt="Story" 
              />
            )}

            {/* Text Overlay */}
            {currentStory.text && (
              <div className="absolute inset-0 flex items-center justify-center px-10 pointer-events-none">
                <p className="text-white text-xl font-black text-center drop-shadow-[0_4px_10px_rgba(0,0,0,0.8)] bg-black/30 px-4 py-2 rounded-xl backdrop-blur-sm">
                  {currentStory.text}
                </p>
              </div>
            )}
          </div>

          {/* 💬 INTERACTIVE FOOTER */}
          <div className="absolute bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-black/90 to-transparent flex items-center gap-4 z-[220]">
            <div 
              onClick={(e) => { e.stopPropagation(); setShowComments(true); }}
              className="ignore-click flex-1 bg-white/10 hover:bg-white/20 border border-white/20 rounded-full px-5 py-3 text-white/80 text-sm cursor-text transition-all backdrop-blur-md"
            >
              Send message...
            </div>
            <button 
              onClick={(e) => { e.stopPropagation(); setShowComments(true); }}
              className="ignore-click text-white hover:scale-110 transition-transform active:scale-95"
            >
              <FaPaperPlane size={22} />
            </button>
          </div>

        </div>
      </div>

      {/* COMMENTS / REPLY MODAL */}
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