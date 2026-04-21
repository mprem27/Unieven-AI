import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
// ✅ ALL imports now come smoothly from your notificationService
import {
  getNotifications,
  deleteNotification,
  markAsRead,
  acceptFollowRequest,
  rejectFollowRequest,
} from "../services/notificationService";// ✅ FIXED IMPORTS
import { getProfileImage } from "../utils/getProfileImage";
import Loader from "./Loader";
import { FaTrash, FaCheck, FaTimes } from "react-icons/fa";

// 🔥 HELPER: Format Time (e.g., 5m, 2h, 1d)
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

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
      markAsRead().catch(() => null); // ✅ Mark as read when opened
    }
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

  // 🧠 GROUP BY DATE
  const groupByDate = (list) => {
    const groups = {
      Today: [],
      Yesterday: [],
      "This Week": [],
      Earlier: [],
    };

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

  // ✅ ACCEPT
  const handleAccept = async (id) => {
    try {
      await acceptFollowRequest(id);
      fetchNotifications();
    } catch (error) {
      console.log(error);
    }
  };

  // ❌ REJECT
  const handleReject = async (id) => {
    try {
      await rejectFollowRequest(id);
      fetchNotifications();
    } catch (error) {
      console.log(error);
    }
  };

  // 🗑 DELETE
  const handleDelete = async (id) => {
    try {
      // Optimistic UI update
      setNotifications((prev) => prev.filter((n) => n._id !== id));
      await deleteNotification(id);
    } catch (error) {
      console.log(error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex justify-end bg-black/20 backdrop-blur-[2px] font-['Poppins',sans-serif]">
      
      {/* 👆 CLICK OUTSIDE TO CLOSE */}
      <div className="absolute inset-0" onClick={onClose}></div>

      {/* PANEL */}
      <div className="relative w-full max-w-[420px] h-full bg-white shadow-[-10px_0_30px_rgba(0,0,0,0.05)] overflow-y-auto flex flex-col animate-in slide-in-from-right duration-300">

        {/* HEADER */}
        <div className="flex justify-between items-center p-6 border-b border-gray-100 sticky top-0 bg-white/90 backdrop-blur-md z-10">
          <h2 className="text-2xl font-black text-gray-900 tracking-tight">Notifications</h2>
          <button 
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors text-gray-500"
          >
            <FaTimes size={18} />
          </button>
        </div>

        <div className="flex-1 p-4">
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader size="30px" color="#3b82f6" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-20 text-gray-500 font-medium">
              <span className="text-4xl block mb-3">📭</span>
              No notifications yet.
            </div>
          ) : (
            /* GROUPED DATA */
            Object.entries(grouped).map(([title, items]) =>
              items.length > 0 && (
                <div key={title} className="mb-6">
                  <h4 className="text-[13px] font-bold text-gray-400 uppercase tracking-wider mb-3 px-2">
                    {title}
                  </h4>

                  {items.map((n) => {
                    // Check if it's a pending follow request
                    const isPendingRequest = n.type === "follow_request" && n.followRequestData?.status === "pending";

                    return (
                      <div
                        key={n._id}
                        className="group flex items-center gap-3 mb-2 bg-transparent hover:bg-gray-50 p-3 rounded-2xl transition-colors cursor-pointer relative"
                        onClick={() => navigate(`/profile/${n.fromUser?.username}`)}
                      >
                        <img
                          src={getProfileImage(n.fromUser)}
                          className="w-12 h-12 rounded-full object-cover border border-gray-200 flex-shrink-0"
                          alt="avatar"
                        />

                        <div className="flex-1 pr-6">
                          <p className="text-[14px] text-gray-800 leading-snug">
                            <span className="font-bold text-gray-900 mr-1">
                              {n.fromUser?.username}
                            </span> 
                            {/* 🔥 FIX: use n.message */}
                            {n.message?.replace(n.fromUser?.username, "").trim()}
                            <span className="text-gray-400 font-medium ml-2 text-[12px]">
                              {formatTimeAgo(n.createdAt)}
                            </span>
                          </p>

                          {/* 🔥 FIX: Use nested requestId */}
                          {isPendingRequest && (
                            <div className="flex gap-2 mt-3">
                              <button
                                onClick={(e) => { e.stopPropagation(); handleAccept(n.followRequestData.requestId); }}
                                className="bg-[#0095f6] hover:bg-[#1877f2] text-white px-5 py-1.5 rounded-lg text-xs font-bold transition-colors shadow-sm"
                              >
                                Accept
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleReject(n.followRequestData.requestId); }}
                                className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-5 py-1.5 rounded-lg text-xs font-bold transition-colors shadow-sm"
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </div>

                        {/* DELETE ICON (Shows on Hover) */}
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(n._id); }}
                          className="absolute right-4 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity bg-white hover:bg-red-50 p-2 rounded-full shadow-sm"
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