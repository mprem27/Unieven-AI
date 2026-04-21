import React, { useState, useEffect } from "react";
import { 
  FaWhatsapp, 
  FaTwitter, 
  FaFacebookF, 
  FaTelegramPlane, 
  FaLink, 
  FaShareAlt, 
  FaTimes, 
  FaSearch,
  FaCheck
} from "react-icons/fa";
import { useAuth } from "../context/AuthContext";
import { getProfile } from "../services/userService";
import { getProfileImage } from "../utils/getProfileImage";
import { toast } from "react-toastify";

function ShareModal({ post, onClose }) {
  const { user: currentUser } = useAuth();
  const [copied, setCopied] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [followingUsers, setFollowingUsers] = useState([]);

  // Trigger slide-up animation on mount
  useEffect(() => {
    setIsVisible(true);
  }, []);

  // Fetch real users the current user is following
  useEffect(() => {
    const fetchFollowing = async () => {
      if (!currentUser?.username) return;
      try {
        const res = await getProfile(currentUser.username);
        if (res?.user?.following) {
          setFollowingUsers(res.user.following);
        }
      } catch (err) {
        console.log("Failed to fetch following list:", err);
      }
    };
    fetchFollowing();
  }, [currentUser]);

  // Handle closing animation
  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 300); // Matches the transition duration
  };

  // Dynamically generate the correct URL based on the item type
  const postType = post?.feedItemType === "reel" ? "reels" : post?.isEvent ? "events" : "post";
  const shareUrl = `${window.location.origin}/${postType}/${post?._id || ""}`;
  
  // Clean up caption for sharing text
  const rawText = post?.title || post?.caption || "Check out this post on our campus network!";
  const shareText = rawText.length > 50 ? rawText.substring(0, 50) + "..." : rawText;

  // 🔥 Native Share (Mobile Web Share API)
  const handleNativeShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: "Campus Network",
          text: shareText,
          url: shareUrl,
        });
      } else {
        copyLink(); // Fallback if browser doesn't support native sharing
      }
    } catch (err) {
      console.log("Error sharing natively:", err);
    }
  };

  // 🔥 Social Links
  const shareWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText + " " + shareUrl)}`, "_blank");
  };

  const shareTwitter = () => {
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`, "_blank");
  };

  const shareFacebook = () => {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`, "_blank");
  };

  const shareTelegram = () => {
    window.open(`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`, "_blank");
  };

  // 🔥 Copy Link
  const copyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // 🔥 Mock In-App Send
  const handleSendToUser = (user) => {
    toast.info(`In-app sending to @${user.username || "user"} is currently under development! 🚀`, {
      icon: "🚧"
    });
  };

  return (
    <div 
      className={`fixed inset-0 flex items-end justify-center z-[100] transition-colors duration-300 ${isVisible ? "bg-black/60 backdrop-blur-sm" : "bg-black/0 backdrop-blur-none"}`}
      onClick={handleClose}
    >
      {/* 🔥 BOTTOM SHEET */}
      <div 
        className={`bg-white w-full max-w-[500px] rounded-t-3xl p-5 md:p-6 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${isVisible ? "translate-y-0" : "translate-y-full"}`}
        onClick={(e) => e.stopPropagation()} // Prevent clicks inside from closing
      >
        
        {/* DRAG HANDLE & HEADER */}
        <div className="w-full flex flex-col items-center mb-5">
          <div className="w-12 h-1.5 bg-gray-300 rounded-full mb-4"></div>
          <div className="w-full flex justify-between items-center">
            <div className="w-8"></div> {/* Spacer */}
            <h3 className="font-black text-lg text-gray-900">Share</h3>
            <button 
              onClick={handleClose}
              className="w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center text-gray-500 transition-colors"
            >
              <FaTimes />
            </button>
          </div>
        </div>

        {/* 🔥 SEARCH & SEND (UI Layout) */}
        <div className="mb-6">
          <div className="relative mb-4">
            <FaSearch className="absolute left-4 top-3.5 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search people..." 
              className="w-full bg-gray-100 border-none rounded-xl pl-10 pr-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-gray-800 font-medium"
            />
          </div>

          {/* Horizontal User List */}
          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
            {followingUsers.length > 0 ? (
              followingUsers.map((u) => (
                <div 
                  key={u._id || Math.random()} 
                  onClick={() => handleSendToUser(u)}
                  className="flex flex-col items-center cursor-pointer group min-w-[70px]"
                >
                  <img
                    src={getProfileImage(u)}
                    className="w-14 h-14 rounded-full object-cover border border-gray-200 group-hover:scale-105 transition-transform"
                    alt={u.username || "User"}
                  />
                  <p className="text-xs font-semibold text-gray-700 mt-2 truncate w-full text-center">
                    {u.username || "User"}
                  </p>
                </div>
              ))
            ) : (
              <div className="w-full text-center text-sm text-gray-400 py-4 font-medium">
                Follow users to quickly share posts with them here.
              </div>
            )}
          </div>
        </div>

        <hr className="border-gray-100 mb-6" />

        {/* 🔥 SOCIAL SHARE ICONS */}
        <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
          
          <button onClick={copyLink} className="flex flex-col items-center gap-2 min-w-[70px] group">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center text-xl shadow-sm transition-all group-hover:scale-105 ${copied ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-700"}`}>
              {copied ? <FaCheck /> : <FaLink />}
            </div>
            <span className="text-xs font-semibold text-gray-600">Copy</span>
          </button>

          <button onClick={shareWhatsApp} className="flex flex-col items-center gap-2 min-w-[70px] group">
            <div className="w-14 h-14 rounded-full bg-[#25D366] text-white flex items-center justify-center text-2xl shadow-sm transition-transform group-hover:scale-105">
              <FaWhatsapp />
            </div>
            <span className="text-xs font-semibold text-gray-600">WhatsApp</span>
          </button>

          <button onClick={shareTwitter} className="flex flex-col items-center gap-2 min-w-[70px] group">
            <div className="w-14 h-14 rounded-full bg-black text-white flex items-center justify-center text-xl shadow-sm transition-transform group-hover:scale-105">
              <FaTwitter />
            </div>
            <span className="text-xs font-semibold text-gray-600">X (Twitter)</span>
          </button>

          <button onClick={shareFacebook} className="flex flex-col items-center gap-2 min-w-[70px] group">
            <div className="w-14 h-14 rounded-full bg-[#1877F2] text-white flex items-center justify-center text-2xl shadow-sm transition-transform group-hover:scale-105">
              <FaFacebookF />
            </div>
            <span className="text-xs font-semibold text-gray-600">Facebook</span>
          </button>

          <button onClick={shareTelegram} className="flex flex-col items-center gap-2 min-w-[70px] group">
            <div className="w-14 h-14 rounded-full bg-[#0088cc] text-white flex items-center justify-center text-2xl shadow-sm transition-transform group-hover:scale-105 pr-1">
              <FaTelegramPlane />
            </div>
            <span className="text-xs font-semibold text-gray-600">Telegram</span>
          </button>

          <button onClick={handleNativeShare} className="flex flex-col items-center gap-2 min-w-[70px] group">
            <div className="w-14 h-14 rounded-full bg-gray-100 text-gray-700 flex items-center justify-center text-xl shadow-sm transition-transform group-hover:scale-105">
              <FaShareAlt />
            </div>
            <span className="text-xs font-semibold text-gray-600">More</span>
          </button>

        </div>

        {/* 🔥 QUICK COPY LINK BAR */}
        <div className="mt-2 bg-gray-50 border border-gray-200 rounded-xl p-1.5 flex items-center gap-2">
          <div className="flex-1 truncate text-sm text-gray-500 font-medium px-3 select-all">
            {shareUrl}
          </div>
          <button 
            onClick={copyLink}
            className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-colors ${copied ? "bg-green-500 text-white" : "bg-blue-600 hover:bg-blue-700 text-white"}`}
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>

      </div>
    </div>
  );
}

export default ShareModal;