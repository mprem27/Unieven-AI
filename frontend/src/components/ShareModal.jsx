import React, { useState, useEffect } from "react";
import { 
  FaWhatsapp, 
  FaTwitter, 
  FaTelegramPlane, 
  FaLink, 
  FaShareAlt, 
  FaTimes, 
  FaSearch,
  FaCheck,
  FaFacebookF
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
  const [searchQuery, setSearchQuery] = useState("");

  // Trigger slide-up animation
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 10);
    return () => clearTimeout(timer);
  }, []);

  // Fetch real users
  useEffect(() => {
    const fetchFollowing = async () => {
      if (!currentUser?.username) return;
      try {
        const res = await getProfile(currentUser.username);
        if (res?.user?.following) {
          setFollowingUsers(res.user.following);
        }
      } catch (err) {
        console.error("Failed to fetch following list:", err);
      }
    };
    fetchFollowing();
  }, [currentUser]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 300);
  };

  const postType = post?.feedItemType === "reel" ? "reels" : post?.isEvent ? "events" : "post";
  const shareUrl = `${window.location.origin}/${postType}/${post?._id || ""}`;
  const shareText = post?.title || post?.caption || "Check this out on UniEven!";

  const copyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast.success("Link copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  const shareWhatsApp = () => window.open(`https://wa.me/?text=${encodeURIComponent(shareText + " " + shareUrl)}`, "_blank");
  const shareTwitter = () => window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`, "_blank");
  const shareTelegram = () => window.open(`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`, "_blank");

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: "UniEven", text: shareText, url: shareUrl });
      } catch (err) { console.log(err); }
    } else { copyLink(); }
  };

  const filteredUsers = followingUsers.filter(u => 
    u.username?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div 
      className={`fixed inset-0 flex items-end sm:items-center justify-center z-[200] transition-all duration-500 ${
        isVisible ? "bg-black/70 backdrop-blur-md opacity-100" : "bg-black/0 backdrop-blur-none opacity-0"
      }`}
      onClick={handleClose}
    >
      {/* MODAL SHEET */}
      <div 
        className={`bg-white w-full sm:max-w-[440px] rounded-t-[40px] sm:rounded-[40px] p-8 shadow-2xl transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          isVisible ? "translate-y-0 scale-100" : "translate-y-full sm:scale-90"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-6 sm:hidden"></div>

        {/* HEADER */}
        <div className="flex justify-between items-center mb-8">
          <h3 className="text-2xl font-black text-gray-900 tracking-tight">Share</h3>
          <button 
            onClick={handleClose} 
            className="w-10 h-10 bg-gray-50 hover:bg-gray-100 rounded-full flex items-center justify-center text-gray-500 hover:rotate-90 transition-all duration-300"
          >
            <FaTimes />
          </button>
        </div>

        {/* SEARCH BAR */}
        <div className="relative mb-6">
          <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 z-10" />
          <input 
            type="text" 
            placeholder="Search connects..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl pl-12 pr-4 py-4 text-sm focus:border-blue-500 focus:bg-white transition-all outline-none font-bold shadow-sm"
          />
        </div>

        {/* USERS LIST */}
        <div className="flex gap-5 overflow-x-auto pb-6 scrollbar-hide -mx-2 px-2">
          {filteredUsers.length > 0 ? (
            filteredUsers.map((u) => (
              <div 
                key={u._id} 
                onClick={() => toast.info(`Direct sending to @${u.username} coming soon!`)}
                className="flex flex-col items-center cursor-pointer min-w-[70px] active:scale-90 transition-transform"
              >
                <div className="relative p-1 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500">
                  <img 
                    src={getProfileImage(u)} 
                    className="w-14 h-14 rounded-full object-cover border-2 border-white shadow-sm" 
                    alt={u.username} 
                  />
                </div>
                <p className="text-[10px] font-black text-gray-500 mt-2 uppercase tracking-tighter truncate w-full text-center">
                  {u.username}
                </p>
              </div>
            ))
          ) : (
            <p className="w-full text-center text-gray-400 text-sm font-medium py-2">No connects found</p>
          )}
        </div>

        <div className="h-[1px] bg-gray-100 w-full mb-8"></div>

        {/* SOCIAL GRID */}
        <div className="grid grid-cols-4 gap-6 mb-10 px-2">
          <SocialBtn onClick={copyLink} icon={copied ? <FaCheck /> : <FaLink />} label="Link" color={copied ? "bg-green-500" : "bg-blue-600"} />
          <SocialBtn onClick={shareWhatsApp} icon={<FaWhatsapp />} label="WhatsApp" color="bg-[#25D366]" />
          <SocialBtn onClick={shareTwitter} icon={<FaTwitter />} label="Twitter" color="bg-black" />
          <SocialBtn onClick={handleNativeShare} icon={<FaShareAlt />} label="More" color="bg-gray-800" />
        </div>

        {/* LINK PREVIEW BOX */}
        <div className="bg-gray-50 rounded-[24px] p-3 flex items-center gap-3 border border-gray-100 group">
           <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-blue-600 shadow-sm shrink-0 border border-gray-50">
              <FaLink className="group-hover:rotate-45 transition-transform" />
           </div>
           <div className="flex-1 truncate text-[13px] font-bold text-gray-400">
              {shareUrl}
           </div>
           <button 
             onClick={copyLink} 
             className="bg-white px-5 py-2.5 rounded-xl text-xs font-black shadow-sm hover:shadow-md transition-all active:scale-95 uppercase tracking-tighter border border-gray-100"
           >
             {copied ? "Done" : "Copy"}
           </button>
        </div>
      </div>
    </div>
  );
}

const SocialBtn = ({ onClick, icon, label, color }) => (
  <button onClick={onClick} className="flex flex-col items-center gap-3 group">
    <div className={`w-14 h-14 rounded-[22px] ${color} text-white flex items-center justify-center text-2xl shadow-xl transition-all group-hover:-translate-y-2 group-hover:rotate-6 active:scale-90 shadow-blue-500/10`}>
      {icon}
    </div>
    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{label}</span>
  </button>
);

export default ShareModal;