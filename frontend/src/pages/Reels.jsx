import React, { useRef, useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getReels, likeReel, viewReel } from "../services/reelService";
import { savePost, deletePost } from "../services/postService";
import { getProfileImage } from "../utils/getProfileImage";
import CommentsModal from "../components/CommentsModal";
import ShareModal from "../components/ShareModal";
import RoleBadge from "../components/RoleBadge";
import { Assets } from "../assets/Assets"; 
import { toast } from "react-toastify";
import {
  FaBookmark,
  FaRegBookmark,
  FaVolumeMute,
  FaVolumeUp,
  FaMapMarkerAlt,
  FaPlay,
  FaTrash,
  FaFlag,
  FaArrowLeft,
  FaMusic
} from "react-icons/fa";

// 🔥 HELPER: Shuffles an array randomly
const shuffleArray = (array) => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

function Reels() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const videoRefs = useRef([]);
  const containerRef = useRef(null);

  const [originalReels, setOriginalReels] = useState([]); // Keeps the pure, unshuffled fetch data
  const [reels, setReels] = useState([]);
  
  const [liked, setLiked] = useState({});
  const [saved, setSaved] = useState({});
  
  // Default sound ON
  const [muted, setMuted] = useState(false);
  const mutedRef = useRef(muted);

  const [activeReel, setActiveReel] = useState(null);
  const [openShare, setOpenShare] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState({});
  const [progress, setProgress] = useState({});
  const [showHeart, setShowHeart] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedCaption, setExpandedCaption] = useState({});

  // Keep ref synced with state for the intersection observer
  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  // ─── FETCH INITIAL REELS ───────────────────────────────────────────────
  useEffect(() => {
    const fetchReels = async () => {
      try {
        setLoading(true);
        const res = await getReels();
        
        // Ensure fallback profile structure
        const data = (res.reels || [])
          .filter((reel) => reel.user && reel.user._id)
          .map((reel) => ({
            ...reel,
            user: reel.user,
          }));

        setOriginalReels(data);

        // 🔥 INITIALIZE: Shuffle the reels and add unique keys for mapping
        if (data.length > 0) {
          const initialShuffled = shuffleArray(data).map(r => ({
            ...r,
            uniqueKey: `${r._id}-${Math.random().toString(36).substr(2, 9)}`
          }));

          setReels(initialShuffled);

          const likeState = {};
          const playState = {};
          const saveState = {};
          
          initialShuffled.forEach((r, i) => {
            likeState[i] = r.likes?.includes(user?._id);
            playState[i] = false;
            saveState[i] = r.savedBy?.includes(user?._id) || false;
          });
          
          setLiked(likeState);
          setIsPlaying(playState);
          setSaved(saveState);
        }

      } catch (err) {
        toast.error("Failed to load reels");
      } finally {
        setLoading(false);
      }
    };
    fetchReels();
  }, [user]);

  // ─── INFINITE RANDOM LOOP ──────────────────────────────────────────────
  // Triggered when user scrolls close to the bottom of the current feed
  useEffect(() => {
    if (reels.length > 0 && originalReels.length > 0) {
      // If we are within 2 reels of the end, append more!
      if (currentIndex >= reels.length - 2) {
        const moreReels = shuffleArray(originalReels).map(r => ({
          ...r,
          uniqueKey: `${r._id}-${Math.random().toString(36).substr(2, 9)}`
        }));

        setReels(prev => {
          const newReels = [...prev, ...moreReels];
          const startIndex = prev.length;

          // Extend the like, play, and save states for the newly appended reels
          setLiked(p => {
             const np = {...p};
             moreReels.forEach((r, i) => np[startIndex + i] = r.likes?.includes(user?._id));
             return np;
          });
          setIsPlaying(p => {
             const np = {...p};
             moreReels.forEach((r, i) => np[startIndex + i] = false);
             return np;
          });
          setSaved(p => {
             const np = {...p};
             moreReels.forEach((r, i) => np[startIndex + i] = r.savedBy?.includes(user?._id) || false);
             return np;
          });

          return newReels;
        });
      }
    }
  }, [currentIndex, originalReels, reels.length, user]);

  // ─── INTERSECTION OBSERVER (AUTO-PLAY) ───────────────────
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const i = Number(entry.target.dataset.index);
          const video = videoRefs.current[i];
          if (!video) return;

          // Only active reel plays, previous stops
          if (entry.isIntersecting) {
            videoRefs.current.forEach((v, idx) => {
              if (v && idx !== i) {
                v.pause();
                v.currentTime = v.currentTime; // Lock frame, pause gracefully
              }
            });

            video.muted = mutedRef.current; // Sync correct audio state
            video.play().catch(() => {});
            
            setIsPlaying((p) => ({ ...p, [i]: true }));
            setCurrentIndex(i); // 🔥 Updates index to trigger infinite loop above
            
            if (reels[i]?._id) viewReel(reels[i]._id).catch(() => {});
          } else {
            video.pause();
            setIsPlaying((p) => ({ ...p, [i]: false }));
          }
        });
      },
      { threshold: 0.75 }
    );

    videoRefs.current.forEach((v) => v && observer.observe(v));
    return () => observer.disconnect();
  }, [reels]);

  // ─── PROGRESS ────────────────────────────────────────────
  const handleTimeUpdate = (i) => {
    const v = videoRefs.current[i];
    if (!v?.duration) return;
    setProgress((p) => ({ ...p, [i]: (v.currentTime / v.duration) * 100 }));
  };

  // ─── LIKE ─────────────────────────────────────────────────
  const handleLike = async (i) => {
    const reel = reels[i];
    const wasLiked = liked[i];
    setLiked((p) => ({ ...p, [i]: !p[i] }));
    
    // Optimistically update ALL instances of this specific reel ID in the infinite loop
    setReels((prev) =>
      prev.map((r) =>
        r._id === reel._id
          ? {
              ...r,
              likes: wasLiked
                ? (r.likes || []).filter((id) => id !== user?._id)
                : [...(r.likes || []), user?._id],
            }
          : r
      )
    );
    try {
      await likeReel(reel._id);
    } catch {
      setLiked((p) => ({ ...p, [i]: wasLiked }));
    }
  };

  // ─── DOUBLE TAP LIKE ─────────────────────────────────────
  const handleDoubleTap = (i) => {
    if (!liked[i]) handleLike(i);
    setShowHeart(i);
    setTimeout(() => setShowHeart(null), 900);
  };

  // ─── PLAY/PAUSE TOGGLE ───────────────────────────────────
  const handlePlayPause = (i) => {
    const v = videoRefs.current[i];
    if (!v) return;
    if (v.paused) {
      v.play();
      setIsPlaying((p) => ({ ...p, [i]: true }));
    } else {
      v.pause();
      setIsPlaying((p) => ({ ...p, [i]: false }));
    }
  };

  // ─── MUTE ─────────────────────────────────────────────────
  const toggleMute = (e) => {
    e?.stopPropagation();
    const newMute = !muted;
    setMuted(newMute);
    videoRefs.current.forEach((v) => v && (v.muted = newMute));
  };

  // ─── SAVE ─────────────────────────────────────────────────
  const handleSave = async (i, reelId) => {
    setSaved((p) => ({ ...p, [i]: !p[i] }));
    try {
      await savePost(reelId);
      toast.success(saved[i] ? "Removed from saved" : "Saved!");
    } catch (err) {
      setSaved((p) => ({ ...p, [i]: !p[i] }));
      toast.error(err?.message || "Failed to save");
    }
    setOpenMenuId(null);
  };

  // ─── DELETE ───────────────────────────────────────────────
  const handleDelete = async (reelId) => {
    if (!window.confirm("Delete this reel?")) return;
    try {
      await deletePost(reelId);
      
      // Remove all instances of this reel from the infinite loop
      setReels((prev) => prev.filter((r) => r._id !== reelId));
      setOriginalReels((prev) => prev.filter((r) => r._id !== reelId));
      
      toast.success("Reel deleted");
    } catch {
      toast.error("Failed to delete");
    }
    setOpenMenuId(null);
  };

  // ─── FORMAT COUNT ─────────────────────────────────────────
  const fmt = (n = 0) => {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
    if (n >= 1000) return (n / 1000).toFixed(1) + "K";
    return n;
  };

  if (loading) {
    return (
      <div className="h-[100dvh] bg-black flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (!reels.length) {
    return (
      <div className="h-[100dvh] bg-black flex flex-col items-center justify-center text-white gap-4">
        <div className="text-5xl">🎬</div>
        <p className="text-lg font-semibold">No reels yet</p>
        <button onClick={() => navigate("/create/reel")} className="px-6 py-2.5 bg-white text-black font-bold rounded-full text-sm">
          Create First Reel
        </button>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] bg-[#000] flex items-center justify-center overflow-hidden font-['SF_Pro_Display',system-ui,sans-serif] selection:bg-none">

      {/* 🔝 FIXED BACK HEADER */}
      <div className="fixed top-0 left-0 right-0 max-w-[400px] mx-auto flex justify-between items-center px-4 py-4 z-[60] pointer-events-none">
        <button onClick={() => navigate(-1)} className="drop-shadow-lg active:scale-90 transition-transform pointer-events-auto">
          <FaArrowLeft className="text-white text-xl" />
        </button>
      </div>

      {/* 📱 REELS CONTAINER */}
      <div
        ref={containerRef}
        className="w-full max-w-[400px] h-[100dvh] overflow-y-scroll snap-y snap-mandatory relative bg-black scrollbar-hide [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
      >
        {reels.map((reel, i) => (
          <div
            key={reel.uniqueKey} // 🔥 Changed from reel._id to prevent duplication rendering crashes
            className="h-[100dvh] w-full snap-start relative bg-[#111] flex items-center justify-center overflow-hidden"
          >
            {/* VIDEO PLAYER */}
            <video
              ref={(el) => (videoRefs.current[i] = el)}
              data-index={i}
              src={reel.video || reel.mediaUrl || reel.media}
              loop
              preload="auto"
              muted={muted}
              playsInline
              className="w-full h-full object-cover cursor-pointer"
              onClick={() => handlePlayPause(i)}
              onDoubleClick={() => handleDoubleTap(i)}
              onTimeUpdate={() => handleTimeUpdate(i)}
            />

            {/* GRADIENT OVERLAYS */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/80 pointer-events-none z-10" />

            {/* PROGRESS BAR */}
            <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/10 z-30">
              <div className="h-full bg-white/90 transition-all duration-75 ease-linear" style={{ width: `${progress[i] || 0}%` }} />
            </div>

            {/* PLAY ICON (paused state) */}
            {!isPlaying[i] && (
              <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
                <div className="bg-black/30 backdrop-blur-sm w-16 h-16 rounded-full flex items-center justify-center">
                  <FaPlay className="text-white text-2xl ml-1 opacity-90" />
                </div>
              </div>
            )}

            {/* DOUBLE TAP HEART */}
            {showHeart === i && (
              <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
                <img src={Assets.liked} className="w-32 opacity-95 animate-ping drop-shadow-2xl" alt="liked" />
              </div>
            )}

            {/* MUTE BUTTON (Floating top-right) */}
            <button
              onClick={toggleMute}
              className="absolute top-5 right-4 z-40 bg-black/40 backdrop-blur-md w-8 h-8 rounded-full flex items-center justify-center border border-white/20"
            >
              {muted ? <FaVolumeMute className="text-white text-[12px]" /> : <FaVolumeUp className="text-white text-[12px]" />}
            </button>

            {/* ── RIGHT ACTION PANEL ── */}
            <div className="absolute right-3 bottom-16 flex flex-col items-center gap-5 z-40 pb-2">
              
              {/* LIKE */}
              <ActionBtn
                icon={<img src={liked[i] ? Assets.liked : Assets.like} className={`w-[26px] drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)] ${!liked[i] && "invert"}`} alt="like" />}
                count={fmt(reel.likes?.length || 0)}
                onClick={() => handleLike(i)}
              />

              {/* COMMENT */}
              <ActionBtn
                icon={<img src={Assets.comment} className="w-[26px] drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)] invert" alt="comment" />}
                count={fmt(reel.comments?.length || 0)}
                onClick={() => setActiveReel(reel)}
              />

              {/* SHARE */}
              <ActionBtn
                icon={<img src={Assets.share} className="w-[26px] drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)] invert" alt="share" />}
                count="Share"
                onClick={() => setOpenShare(reel)}
              />
              
              {/* VIEWS COUNT */}
              <ActionBtn
                icon={<FaPlay className="text-white text-[22px] drop-shadow-md" />}
                count={fmt(reel.views?.length || 0)}
              />

              {/* SAVE / BOOKMARK */}
              <ActionBtn
                icon={saved[i] ? <FaBookmark className="text-[24px] text-white drop-shadow-md" /> : <FaRegBookmark className="text-[24px] text-white drop-shadow-md" />}
                count="Save"
                onClick={() => handleSave(i, reel._id)}
              />

              {/* MORE (3 DOTS) */}
              <div className="relative">
                <ActionBtn
                  icon={<img src={Assets.dots} className="w-5 rotate-90 drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)] invert mt-1" alt="more" />}
                  onClick={() => setOpenMenuId(openMenuId === reel._id ? null : reel._id)}
                />
              </div>

              {/* AVATAR DISC (Music) */}
              <div className="mt-1 w-8 h-8 rounded-md border-[1.5px] border-white/70 overflow-hidden shadow-lg animate-spin-slow">
                <img src={getProfileImage(reel.user)} className="w-full h-full object-cover" alt="" />
              </div>
            </div>

            {/* ── BOTTOM USER INFO ── */}
            <div className="absolute bottom-6 left-4 right-16 z-30 text-white flex flex-col gap-2.5 pb-2">
              
              <div className="flex items-start gap-3 mb-3">
                <Link to={`/user/${encodeURIComponent(reel.user?.username || "")}`}>
                  <img
                    src={getProfileImage(reel.user)}
                    className="w-10 h-10 rounded-full object-cover border-[1px] border-white/50 shadow-sm"
                    alt={reel.user?.username}
                  />
                </Link>

                <div className="flex flex-col justify-center mt-1">
                  <div className="flex items-center gap-2">
                    <Link
                      to={`/user/${encodeURIComponent(reel.user?.username || "")}`}
                      className="font-bold text-white text-[14px] hover:underline flex items-center gap-1 drop-shadow-md tracking-wide"
                    >
                      {reel.user?.username}
                      <RoleBadge role={reel.user?.role} />
                    </Link>
                    
                    <button 
                      onClick={() => navigate(`/user/${encodeURIComponent(reel.user?.username)}`)}
                      className="border border-white/80 text-white text-[11px] font-bold px-3 py-[3px] rounded-md hover:bg-white hover:text-black transition-colors shrink-0 shadow-sm ml-1"
                    >
                      View
                    </button>
                  </div>
                  
                  {reel.location && (
                    <div className="flex items-center gap-1 mt-[2px]">
                      <FaMapMarkerAlt className="text-white/80 text-[10px] drop-shadow-sm" />
                      <span className="text-white/90 text-[12px] drop-shadow-sm font-medium">{reel.location}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Caption */}
              {reel.caption && (
                <div className="pr-4">
                  <p className="text-white text-[14px] leading-snug drop-shadow-md font-normal">
                    {expandedCaption[i] || reel.caption.length <= 60
                      ? reel.caption
                      : reel.caption.slice(0, 60) + "..."}
                    {reel.caption.length > 60 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedCaption((p) => ({ ...p, [i]: !p[i] }));
                        }}
                        className="text-white/70 ml-1 font-semibold text-[13px] hover:text-white"
                      >
                        {expandedCaption[i] ? " less" : " more"}
                      </button>
                    )}
                  </p>
                </div>
              )}

              {/* Audio tag */}
              <div className="flex items-center gap-2 text-white drop-shadow-md mt-1">
                <FaMusic className="text-[12px]" />
                <div className="overflow-hidden whitespace-nowrap max-w-[200px]">
                  <span className="inline-block text-[13px] font-medium">
                    UniEven Original Audio
                  </span>
                </div>
              </div>

            </div>
          </div>
        ))}
      </div>

      {/* ═══════════════════ UNIFIED POPUP MENU ═══════════════════ */}
      {openMenuId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpenMenuId(null)}></div>
          <div className="bg-white w-full max-w-[300px] rounded-[28px] overflow-hidden z-10 animate-in zoom-in-95 duration-200">
              
             {/* Save Button */}
             <button 
               onClick={() => {
                 const idx = reels.findIndex(r => r._id === openMenuId);
                 handleSave(idx, openMenuId);
               }} 
               className="w-full py-4 text-sm font-bold border-b border-gray-100 hover:bg-gray-50 text-black"
             >
               {saved[reels.findIndex(r => r._id === openMenuId)] ? "Unsave Reel" : "Save Reel"}
             </button>
             
             {/* Report Button */}
             <button onClick={() => { toast.info("Reported to admins."); setOpenMenuId(null); }} className="w-full py-4 text-sm font-bold border-b border-gray-100 hover:bg-gray-50 text-orange-500">
               Report
             </button>

             {/* Delete Button (Only if owner) */}
             {user?._id === reels.find(r => r._id === openMenuId)?.user?._id && (
               <button onClick={() => handleDelete(openMenuId)} className="w-full py-4 text-sm font-bold border-b border-gray-100 hover:bg-gray-50 text-red-500">
                 Delete Reel
               </button>
             )}

             {/* Cancel Button */}
             <button onClick={() => setOpenMenuId(null)} className="w-full py-4 text-sm font-medium text-gray-500 hover:bg-gray-50">
               Cancel
             </button>

          </div>
        </div>
      )}

      {/* ═══════════════════ MODALS ═══════════════════ */}
      {activeReel && (
        <CommentsModal
          item={activeReel}
          type="reel"
          onClose={() => setActiveReel(null)}
          onSync={(updated) => {
            setReels((prev) => prev.map((r) => (r._id === updated._id ? { ...r, ...updated } : r)));
            setActiveReel(updated);
          }}
        />
      )}

      {openShare && <ShareModal post={openShare} onClose={() => setOpenShare(null)} />}
    </div>
  );
}

/* ─── ACTION BUTTON COMPONENT ─── */
function ActionBtn({ icon, count, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-[2px] group transition-transform duration-200 hover:scale-110 active:scale-95"
    >
      <div className="flex items-center justify-center opacity-95 group-hover:opacity-100">
        {icon}
      </div>
      {count !== undefined && (
        <span className="text-white text-[13px] font-semibold tabular-nums drop-shadow-md">
          {count}
        </span>
      )}
    </button>
  );
}

export default Reels;