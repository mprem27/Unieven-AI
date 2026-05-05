import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getNotifications,
  deleteNotification,
  markAsRead,
  acceptFollowRequest,
  rejectFollowRequest,
} from "../services/notificationService";
import { getProfileImage } from "../utils/getProfileImage";
import Loader from "./Loader";
import { FaTrash, FaCheck, FaTimes, FaChevronLeft } from "react-icons/fa";

const formatTimeAgo = (dateString) => {
  const seconds = Math.floor((new Date() - new Date(dateString)) / 1000);
  let interval = seconds / 31536000;
  if (interval > 1) return Math.floor(interval) + "y";
  interval = seconds / 2592000;
  if (interval > 1) return Math.floor(interval) + "mo";
  interval = seconds / 604800;
  if (interval > 1) return Math.floor(interval) + "w";
  interval = seconds / 86400;
  if (interval > 1) return Math.floor(interval) + "d";
  interval = seconds / 3600;
  if (interval > 1) return Math.floor(interval) + "h";
  interval = seconds / 60;
  if (interval > 1) return Math.floor(interval) + "m";
  return "just now";
};

function NotificationPanel({ isOpen, onClose }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // 🔥 STEP 1: INSTANT READ STATE & GLOBAL BADGE UPDATE
  useEffect(() => {
    if (isOpen) {
      // ✅ FIX 4: AUTO CLEAR BADGE WHEN PANEL OPENS
      window.dispatchEvent(
        new CustomEvent("notificationsUpdated", {
          detail: { unreadCount: 0 },
        })
      );

      fetchNotifications();
      
      markAsRead()
        .then(() => {
          setNotifications((prev) =>
            prev.map((n) => ({
              ...n,
              read: true,
            }))
          );
          // ✅ FIX 1: SEND UPDATED COUNT GLOBALLY
          window.dispatchEvent(
            new CustomEvent("notificationsUpdated", {
              detail: { unreadCount: 0 },
            })
          );
        })
        .catch(() => null);

      // Prevent background scrolling on mobile when open
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  // 🔥 STEP 4: AUTO POLLING (Keeps notifications fresh while panel is open)
  useEffect(() => {
    const interval = setInterval(() => {
      if (isOpen) {
        fetchNotifications();
      }
    }, 15000);

    return () => clearInterval(interval);
  }, [isOpen]);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await getNotifications();
      setNotifications(res.notifications || []);
    } catch (err) {
      console.log(err);
    } finally {
      setLoading(false);
    }
  };

  const groupByDate = (list) => {
    const groups = { Today: [], Yesterday: [], "This Week": [], Earlier: [] };
    const now = new Date();
    list.forEach((n) => {
      const date = new Date(n.createdAt);
      const diff = (now - date) / (1000 * 60 * 60 * 24);
      if (diff < 1) groups.Today.push(n);
      else if (diff < 2) groups.Yesterday.push(n);
      else if (diff < 7) groups["This Week"].push(n);
      else groups.Earlier.push(n);
    });
    return groups;
  };

  const grouped = groupByDate(notifications);

  // 🔥 STEP 2: GLOBAL DISPATCH AFTER ACTIONS
  const handleAccept = async (id) => {
    try {
      await acceptFollowRequest(id);
      await fetchNotifications();
      // ✅ FIX 3: DELETE / ACCEPT / REJECT ALSO UPDATE COUNT
      window.dispatchEvent(
        new CustomEvent("notificationsUpdated", {
          detail: { refresh: true },
        })
      );
    } catch (error) {
      console.log(error);
    }
  };

  const handleReject = async (id) => {
    try {
      await rejectFollowRequest(id);
      await fetchNotifications();
      // ✅ FIX 3: DELETE / ACCEPT / REJECT ALSO UPDATE COUNT
      window.dispatchEvent(
        new CustomEvent("notificationsUpdated", {
          detail: { refresh: true },
        })
      );
    } catch (error) {
      console.log(error);
    }
  };

  const handleDelete = async (id) => {
    try {
      setNotifications((prev) => prev.filter((n) => n._id !== id));
      await deleteNotification(id);
      // ✅ FIX 3: DELETE / ACCEPT / REJECT ALSO UPDATE COUNT
      window.dispatchEvent(
        new CustomEvent("notificationsUpdated", {
          detail: { refresh: true },
        })
      );
    } catch (error) {
      console.log(error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex justify-end bg-black/40 md:backdrop-blur-[2px] font-['Poppins',sans-serif]">
      
      {/* OVERLAY (Desktop only) */}
      <div className="hidden md:block absolute inset-0" onClick={onClose}></div>

      {/* PANEL CONTAINER */}
      <div 
        className={`
          relative w-full md:max-w-[420px] h-full bg-white flex flex-col 
          shadow-[-10px_0_30px_rgba(0,0,0,0.1)] 
          animate-in slide-in-from-right duration-300
        `}
      >

        {/* HEADER - Mobile optimized */}
        <div className="flex justify-between items-center px-4 py-4 md:px-6 md:py-5 border-b border-gray-100 sticky top-0 bg-white/95 backdrop-blur-md z-10">
          <div className="flex items-center gap-3">
            {/* Back button for mobile looks better */}
            <button onClick={onClose} className="md:hidden p-2 -ml-2 text-gray-700">
              <FaChevronLeft size={20} />
            </button>
            <h2 className="text-xl md:text-2xl font-black text-gray-900 tracking-tight">Notifications</h2>
          </div>
          <button 
            onClick={onClose}
            className="hidden md:flex p-2 rounded-full hover:bg-gray-100 transition-colors text-gray-500"
          >
            <FaTimes size={18} />
          </button>
        </div>

        {/* NOTIFICATIONS CONTENT */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-2 md:p-4">
          {loading ? (
            <div className="flex justify-center py-20">
              <Loader size="35px" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-32 text-gray-400">
              <span className="text-6xl mb-4">🔔</span>
              <p className="text-lg font-medium">Nothing to see here</p>
              <p className="text-sm">When you get notifications, they'll appear here.</p>
            </div>
          ) : (
            Object.entries(grouped).map(([title, items]) =>
              items.length > 0 && (
                <div key={title} className="mb-6">
                  <h4 className="text-[12px] md:text-[13px] font-bold text-gray-400 uppercase tracking-wider mb-3 px-3">
                    {title}
                  </h4>

                  {items.map((n) => {
                    const isPendingRequest = n.type === "follow_request" && n.followRequestData?.status === "pending";

                    return (
                      <div
                        key={n._id}
                        className="group flex items-start gap-3 mb-1 bg-transparent hover:bg-gray-50 p-3 rounded-2xl transition-colors cursor-pointer relative"
                        onClick={() => {
                          navigate(`/user/${n.fromUser?.username}`);
                          if(window.innerWidth < 768) onClose(); // Close on mobile navigation
                        }}
                      >
                        <img
                          src={getProfileImage(n.fromUser)}
                          className="w-11 h-11 md:w-12 md:h-12 rounded-full object-cover border border-gray-100 flex-shrink-0"
                          alt="avatar"
                        />

                        <div className="flex-1 min-w-0 pr-4">
                          <p className="text-[14px] text-gray-800 leading-[1.3]">
                            <span className="font-bold text-gray-900">
                              {n.fromUser?.username}
                            </span> 
                            {" "}{n.message?.replace(n.fromUser?.username, "").trim()}
                            <span className="text-gray-400 font-medium ml-2 text-[12px] whitespace-nowrap">
                              {formatTimeAgo(n.createdAt)}
                            </span>
                          </p>

                          {isPendingRequest && (
                            <div className="flex gap-2 mt-3 w-full">
                              <button
                                onClick={(e) => { e.stopPropagation(); handleAccept(n.followRequestData.requestId); }}
                                className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-2 rounded-xl text-xs font-bold transition-all active:scale-95 shadow-sm"
                              >
                                Accept
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleReject(n.followRequestData.requestId); }}
                                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 shadow-sm"
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </div>

                        {/* DELETE BUTTON - Visible on hover on Desktop, always icon available via padding on mobile */}
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(n._id); }}
                          className="md:opacity-0 md:group-hover:opacity-100 p-2 text-gray-300 hover:text-red-500 transition-all active:scale-90"
                          title="Delete notification"
                        >
                          <FaTrash size={12} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )
            )
          )}
        </div>
      </div>
    </div>
  );
}

export default NotificationPanel;