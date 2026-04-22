import React, { useRef, useEffect, useState } from "react";
import { Assets } from "../assets/Assets";
import CommentsModal from "../components/CommentsModal";
import ShareModal from "../components/ShareModal"; // ✅ Added Share Modal
import { getReels, likeReel, viewReel } from "../services/reelService";
import { deletePost, savePost } from "../services/postService"; // ✅ Added for Delete/Save actions
import { getProfileImage } from "../utils/getProfileImage"; // ✅ Added Profile Image Util
import { useAuth } from "../context/AuthContext";
import { toast } from "react-toastify";
import { FaMusic, FaPlay, FaVolumeMute, FaVolumeUp } from "react-icons/fa";

function Reels() {
  const { user } = useAuth();
  const videoRefs = useRef([]);

  const [reels, setReels] = useState([]);
  const [liked, setLiked] = useState({});
  const [showHeart, setShowHeart] = useState(null);
  const [muted, setMuted] = useState(true);
  const [progress, setProgress] = useState({});
  const [activeReel, setActiveReel] = useState(null);
  const [isPlaying, setIsPlaying] = useState({});
  
  // ✅ States for Modals/Menus
  const [openShare, setOpenShare] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);

  // 🔥 FETCH REELS
  const fetchReels = async () => {
    try {
      const data = await getReels();
      const fetchedReels = data.reels || [];
      setReels(fetchedReels);
      
      // Initialize play states and likes
      const initialPlayState = {};
      const initialLikedState = {};
      fetchedReels.forEach((reel, i) => {
        initialPlayState[i] = true;
        // ✅ Check if current user liked it
        initialLikedState[i] = reel.likes?.includes(user?._id) || reel.likes?.includes("me"); 
      });
      setIsPlaying(initialPlayState);
      setLiked(initialLikedState);

    } catch (err) {
      console.log(err);
      toast.error("Failed to load reels");
    }
  };

  useEffect(() => {
    fetchReels();
  }, [user]);

  // 🔥 AUTO PLAY & VIEW TRACKING (Intersection Observer)
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const index = Number(entry.target.dataset.index);
          const video = videoRefs.current[index];
          const reel = reels[index];

          if (!video || !reel) return;

          if (entry.isIntersecting) {
            video.play().then(() => {
              setIsPlaying((prev) => ({ ...prev, [index]: true }));
            }).catch(() => {});
            viewReel(reel._id); 
          } else {
            video.pause();
            setIsPlaying((prev) => ({ ...prev, [index]: false }));
          }
        });
      },
      { threshold: 0.7 }
    );

    videoRefs.current.forEach((video) => {
      if (video) observer.observe(video);
    });

    return () => observer.disconnect();
  }, [reels]);

  // ▶️ PLAY / PAUSE TOGGLE
  const handlePlayPause = (index) => {
    const video = videoRefs.current[index];
    if (!video) return;

    if (video.paused) {
      video.play();
      setIsPlaying((prev) => ({ ...prev, [index]: true }));
    } else {
      video.pause();
      setIsPlaying((prev) => ({ ...prev, [index]: false }));
    }
  };

  // ❤️ DOUBLE TAP TO LIKE
  const handleDoubleTap = (index) => {
    if (!liked[index]) {
      handleLike(index);
    }
    setShowHeart(index);
    setTimeout(() => setShowHeart(null), 800);
  };

  // ❤️ LIKE LOGIC
  const handleLike = async (index) => {
    const reel = reels[index];
    try {
      setLiked((prev) => ({ ...prev, [index]: !prev[index] }));
      await likeReel(reel._id);
    } catch (err) {
      console.log(err);
      // Revert if failed
      setLiked((prev) => ({ ...prev, [index]: !prev[index] }));
    }
  };

  // 🔊 MUTE TOGGLE
  const toggleMute = (e) => {
    e.stopPropagation();
    const newMute = !muted;
    setMuted(newMute);
    videoRefs.current.forEach((video) => {
      if (video) video.muted = newMute;
    });
  };

  // ⏱️ PROGRESS BAR
  const handleTimeUpdate = (index) => {
    const video = videoRefs.current[index];
    if (!video || !video.duration) return;
    const percent = (video.currentTime / video.duration) * 100;
    setProgress((prev) => ({ ...prev, [index]: percent }));
  };

  // 🔖 SAVE REEL
  const handleSaveReel = async (reelId) => {
    try {
      await savePost(reelId); // Reusing savePost logic as it saves IDs to user model
      toast.success("Reel saved to your profile!");
    } catch (error) {
      toast.error(error.message || "Already saved or failed to save");
    } finally {
      setOpenMenuId(null);
    }
  };

  // 🗑️ DELETE REEL
  const handleDeleteReel = async (reelId) => {
    if (!window.confirm("Are you sure you want to remove this Reel?")) return;
    try {
      await deletePost(reelId); // Reusing delete logic
      setReels((prev) => prev.filter((r) => r._id !== reelId));
      toast.success("Reel deleted successfully");
    } catch (error) {
      toast.error("Failed to delete reel");
    } finally {
      setOpenMenuId(null);
    }
  };

  return (
    <>
      <div className="flex justify-center bg-[#121212] min-h-screen sm:py-6">
        
        {/* 📱 PHONE CONTAINER WITH HIDDEN SCROLLBAR */}
        <div className="w-full max-w-[420px] h-[100dvh] sm:h-[90vh] sm:rounded-[24px] overflow-y-scroll snap-y snap-mandatory relative bg-black shadow-2xl 
          [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">

          {reels.map((reel, index) => (
            <div key={reel._id} className="h-full w-full snap-start relative bg-black group overflow-hidden">

              {/* 🎥 VIDEO ELEMENT */}
              <video
                ref={(el) => (videoRefs.current[index] = el)}
                data-index={index}
                src={reel.video || reel.mediaUrl || reel.media}
                autoPlay
                loop
                muted={muted}
                playsInline
                className="w-full h-full object-cover"
                onClick={() => handlePlayPause(index)}
                onDoubleClick={() => handleDoubleTap(index)}
                onTimeUpdate={() => handleTimeUpdate(index)}
              />

              {/* ✅ RENDER DRAGGABLE TEXT IF IT EXISTS */}
              {reel.overlayText && (
                <div 
                  className="absolute z-10 pointer-events-none px-4 py-2"
                  style={{
                    top: "50%",
                    left: "50%",
                    transform: `translate(calc(-50% + ${reel.overlayX || 0}px), calc(-50% + ${reel.overlayY || 0}px))`
                  }}
                >
                  <p className={`text-center text-3xl text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)] whitespace-nowrap ${reel.overlayFont || "font-sans"}`}>
                    {reel.overlayText}
                  </p>
                </div>
              )}

              {/* 🌑 GRADIENT OVERLAYS FOR READABILITY */}
              <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/80 pointer-events-none z-0" />

              {/* ⏱️ TOP PROGRESS BAR */}
              <div className="absolute top-0 left-0 w-full h-[3px] bg-white/20 z-10">
                <div
                  className="h-full bg-white/90 backdrop-blur-sm transition-all duration-75"
                  style={{ width: `${progress[index] || 0}%` }}
                />
              </div>

              {/* ⏸️ PLAY ICON OVERLAY (Shows only when paused) */}
              {!isPlaying[index] && (
                <div className="absolute inset-0 flex justify-center items-center pointer-events-none z-10">
                  <div className="bg-black/40 p-5 rounded-full backdrop-blur-sm">
                    <FaPlay className="text-white text-4xl ml-1 opacity-90" />
                  </div>
                </div>
              )}

              {/* ❤️ BIG HEART ANIMATION */}
              {showHeart === index && (
                <div className="absolute inset-0 flex justify-center items-center pointer-events-none z-20">
                  <img src={Assets.liked} className="w-28 animate-ping drop-shadow-2xl" alt="liked" />
                </div>
              )}

              {/* 🔊 SOUND TOGGLE (Top Right) */}
              <div
                onClick={toggleMute}
                className="absolute top-6 right-4 bg-black/30 p-2.5 rounded-full cursor-pointer backdrop-blur-md z-20 hover:bg-black/50 transition"
              >
                {muted ? <FaVolumeMute className="text-white text-lg" /> : <FaVolumeUp className="text-white text-lg" />}
              </div>

              {/* ➡ RIGHT SIDE ACTION ICONS */}
              <div className="absolute right-3 bottom-24 flex flex-col items-center gap-6 text-white z-20">
                
                {/* LIKE */}
                <div className="flex flex-col items-center gap-1 cursor-pointer hover:scale-110 transition-transform" onClick={() => handleLike(index)}>
                  <img src={liked[index] ? Assets.liked : Assets.like} className="w-8 drop-shadow-lg" alt="like" />
                  <p className="text-[13px] font-bold drop-shadow-md">
                    {liked[index] ? (reel.likes?.length || 0) + (reel.likes?.includes(user?._id) ? 0 : 1) : reel.likes?.length || 0}
                  </p>
                </div>

                {/* COMMENT */}
                <div className="flex flex-col items-center gap-1 cursor-pointer hover:scale-110 transition-transform" onClick={() => setActiveReel(reel)}>
                  <img src={Assets.comment} className="w-8 drop-shadow-lg" alt="comment" />
                  <p className="text-[13px] font-bold drop-shadow-md">
                    {reel.comments?.length || 0}
                  </p>
                </div>

                {/* SHARE */}
                <div className="flex flex-col items-center gap-1 cursor-pointer hover:scale-110 transition-transform" onClick={() => setOpenShare(reel)}>
                  <img src={Assets.share} className="w-8 drop-shadow-lg" alt="share" />
                  <p className="text-[13px] font-bold drop-shadow-md">Share</p>
                </div>

                {/* MORE (DOTS) */}
                <div className="relative">
                  <div className="cursor-pointer hover:scale-110 transition-transform p-2" onClick={() => setOpenMenuId(openMenuId === reel._id ? null : reel._id)}>
                    <img src={Assets.dots} className="w-5 rotate-90 drop-shadow-lg invert" alt="more" />
                  </div>
                  
                  {/* ✅ OPTIONS MENU */}
                  {openMenuId === reel._id && (
                    <>
                      {/* Invisible Background to handle click-outside */}
                      <div className="fixed inset-0 z-40" onClick={() => setOpenMenuId(null)}></div>
                      
                      {/* Popup Menu */}
                      <div className="absolute right-10 bottom-0 w-36 bg-white/90 backdrop-blur-xl border border-white/20 shadow-2xl rounded-2xl z-50 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
                        
                        <button onClick={() => handleSaveReel(reel._id)} className="w-full px-4 py-3 text-left text-gray-800 font-bold text-[13px] hover:bg-white transition-colors border-b border-gray-200/50">
                          Save
                        </button>

                        <button onClick={() => { toast.info("Reported to admins."); setOpenMenuId(null); }} className="w-full px-4 py-3 text-left text-orange-600 font-bold text-[13px] hover:bg-white transition-colors border-b border-gray-200/50">
                          Report
                        </button>

                        {user?._id === reel.user?._id && (
                          <button onClick={() => handleDeleteReel(reel._id)} className="w-full px-4 py-3 text-left text-red-600 font-black text-[13px] hover:bg-white transition-colors border-b border-gray-200/50">
                            Delete
                          </button>
                        )}
                        
                        <button onClick={() => setOpenMenuId(null)} className="w-full px-4 py-3 text-left text-gray-500 font-bold text-[13px] hover:bg-white transition-colors">
                          Cancel
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* ⬇ BOTTOM LEFT USER INFO */}
              <div className="absolute bottom-6 left-4 text-white pr-20 z-20 w-full max-w-[85%]">
                
                {/* ✅ Profile Header (Fixed Image Source) */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full overflow-hidden border-[1.5px] border-white shadow-sm bg-gray-800">
                    <img src={getProfileImage(reel.user)} className="w-full h-full object-cover" alt="avatar" />
                  </div>
                  <p className="font-bold text-[15px] drop-shadow-md">{reel.user?.username || "campus_student"}</p>
                  <button className="border border-white/70 px-3 py-1 rounded-md text-[12px] font-bold backdrop-blur-sm hover:bg-white hover:text-black transition">
                    Follow
                  </button>
                </div>

                {/* Caption */}
                <p className="text-[14px] leading-snug drop-shadow-md line-clamp-2 mb-3 whitespace-pre-wrap">
                  {reel.caption || "Living the campus life 🎓✨"}
                </p>

                {/* Audio Ticker */}
                <div className="flex items-center gap-2 bg-white/20 w-max px-3 py-1 rounded-full backdrop-blur-md">
                  <FaMusic className="text-[10px]" />
                  <p className="text-[12px] font-semibold tracking-wide">
                    UniEven Original Audio
                  </p>
                </div>

              </div>

            </div>
          ))}
        </div>
      </div>

      {/* 💬 COMMENTS MODAL */}
      {activeReel && (
        <CommentsModal
          item={activeReel}
          type="reel"
          onClose={() => setActiveReel(null)}
          onSync={(updatedReel) => {
            setReels((prev) => prev.map((r) => r._id === updatedReel._id ? updatedReel : r));
            setActiveReel(updatedReel);
          }}
        />
      )}

      {/* 🚀 SHARE MODAL */}
      {openShare && (
        <ShareModal
          post={openShare}
          onClose={() => setOpenShare(null)}
        />
      )}
    </>
  );
}

export default Reels;