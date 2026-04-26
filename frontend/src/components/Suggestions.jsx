import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getProfileImage } from "../utils/getProfileImage";
import RoleBadge from "./RoleBadge";
import { followUser, getProfile } from "../services/userService";
import { toast } from "react-toastify";

function Suggestions({ users, currentUser }) {
  const [loadingId, setLoadingId] = useState(null);

  // Prevent UI flicker while syncing real backend state
  const [initializing, setInitializing] = useState(true);

  // Track connection state:
  // null = Connect
  // requested = Connecting
  // accepted = Connected
  const [connectionStatus, setConnectionStatus] = useState({});

  const navigate = useNavigate();

  //////////////////////////////////////////////////////
  // 🔥 LOCAL STORAGE FALLBACK FOR PRIVATE REQUESTS
  //////////////////////////////////////////////////////
  const getLocalPending = () =>
    JSON.parse(localStorage.getItem("pending_reqs") || "[]");

  const addLocalPending = (id) => {
    const reqs = getLocalPending();
    if (!reqs.includes(id)) {
      localStorage.setItem(
        "pending_reqs",
        JSON.stringify([...reqs, id])
      );
    }
  };

  const removeLocalPending = (id) => {
    const reqs = getLocalPending().filter(
      (reqId) => reqId !== id
    );

    localStorage.setItem(
      "pending_reqs",
      JSON.stringify(reqs)
    );
  };

  //////////////////////////////////////////////////////
  // 🔥 INITIAL STATUS SYNC
  //////////////////////////////////////////////////////
  useEffect(() => {
    let isMounted = true;

    const initializeStatuses = async () => {
      if (!users || users.length === 0 || !currentUser?._id) {
        setInitializing(false);
        return;
      }

      setInitializing(true);

      const statusMap = {};

      await Promise.all(
        users.map(async (user) => {
          try {
            const profile = await getProfile(user.username);

            const isLocallyRequested =
              getLocalPending().includes(user._id);

            if (profile?.user) {
              //////////////////////////////////////////////////
              // 🔥 TRUST BACKEND FLAGS ONLY
              //////////////////////////////////////////////////
              const isFollowing =
                profile.user.isFollowing === true;

              const isRequested =
                profile.user.isRequested === true ||
                isLocallyRequested;

              if (isFollowing) {
                statusMap[user._id] = "accepted";

                // Cleanup stale cache
                removeLocalPending(user._id);

              } else if (isRequested) {
                statusMap[user._id] = "requested";

              } else {
                statusMap[user._id] = null;
              }
            }

          } catch (error) {
            //////////////////////////////////////////////////
            // 🔥 FALLBACK TO LOCAL CACHE
            //////////////////////////////////////////////////
            const isLocallyRequested =
              getLocalPending().includes(user._id);

            statusMap[user._id] =
              isLocallyRequested ? "requested" : null;
          }
        })
      );

      if (isMounted) {
        setConnectionStatus(statusMap);
        setInitializing(false);
      }
    };

    initializeStatuses();

    return () => {
      isMounted = false;
    };
  }, [users, currentUser?._id]);

  //////////////////////////////////////////////////////
  // 🔥 CONNECT / DISCONNECT HANDLER
  //////////////////////////////////////////////////////
  const handleConnect = async (userToConnect) => {
    const userId = userToConnect._id;

    try {
      setLoadingId(userId);

      const res = await followUser(userId);

      const status = res?.status;
      const msg = (res?.message || "").toLowerCase();

      ////////////////////////////////////////////////////
      // 🔥 UNFOLLOW / CANCEL
      ////////////////////////////////////////////////////
      if (
        status === "follow" ||
        msg.includes("unfollow") ||
        msg.includes("remove") ||
        msg.includes("cancel")
      ) {
        setConnectionStatus((prev) => ({
          ...prev,
          [userId]: null,
        }));

        removeLocalPending(userId);

      ////////////////////////////////////////////////////
      // 🔥 PRIVATE REQUEST
      ////////////////////////////////////////////////////
      } else if (
        status === "requested" ||
        msg.includes("request")
      ) {
        setConnectionStatus((prev) => ({
          ...prev,
          [userId]: "requested",
        }));

        addLocalPending(userId);

      ////////////////////////////////////////////////////
      // 🔥 ACCEPTED / PUBLIC
      ////////////////////////////////////////////////////
      } else if (
        status === "accepted" ||
        msg.includes("accept") ||
        msg.includes("success") ||
        msg.includes("follow")
      ) {
        setConnectionStatus((prev) => ({
          ...prev,
          [userId]: "accepted",
        }));

        removeLocalPending(userId);

      ////////////////////////////////////////////////////
      // 🔥 FALLBACK
      ////////////////////////////////////////////////////
      } else {
        const isPrivate =
          userToConnect.isPrivate === true ||
          userToConnect.isPrivate === "true";

        const currentStat =
          connectionStatus[userId];

        if (!currentStat) {
          setConnectionStatus((prev) => ({
            ...prev,
            [userId]: isPrivate
              ? "requested"
              : "accepted",
          }));

          if (isPrivate) {
            addLocalPending(userId);
          }

        } else {
          setConnectionStatus((prev) => ({
            ...prev,
            [userId]: null,
          }));

          removeLocalPending(userId);
        }
      }

    } catch (err) {
      console.error("Connection error:", err);

      toast.error(
        err?.message || "Failed to connect"
      );

    } finally {
      setLoadingId(null);
    }
  };

  //////////////////////////////////////////////////////
  // 🔥 EMPTY STATE
  //////////////////////////////////////////////////////
  if (!users || users.length === 0) return null;

  //////////////////////////////////////////////////////
  // 🔥 UI
  //////////////////////////////////////////////////////
  return (
    <div className="w-full max-w-[470px] mt-6 md:mt-8 mb-4 px-1 font-['Poppins',sans-serif] overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between mb-4 px-3">
        <h3 className="text-[14px] md:text-[15px] font-bold text-gray-800 tracking-tight">
          Suggested for you
        </h3>

        <button className="text-[12px] md:text-[13px] font-bold text-[#3b82f6] hover:text-blue-700 transition-colors">
          See All
        </button>
      </div>

      {/* Suggestions List */}
      <div className="flex gap-3 md:gap-4 overflow-x-auto scrollbar-hide pb-6 pt-1 px-3 snap-x snap-mandatory scroll-smooth [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">

        {users.map((u) => {
          const currentStatus =
            connectionStatus[u._id];

          const isPending =
            currentStatus === "requested";

          const isConnected =
            currentStatus === "accepted";

          const hasInteraction =
            isPending || isConnected;

          return (
            <div
              key={u._id}
              className="snap-start min-w-[150px] md:min-w-[160px] bg-white/50 backdrop-blur-2xl border border-white/60 rounded-[24px] p-5 flex flex-col items-center shadow-[0_8px_20px_rgba(0,0,0,0.03)] hover:shadow-[0_12px_25px_rgba(0,0,0,0.08)] hover:-translate-y-1 transition-all duration-300"
            >

              {/* Profile Image */}
              <div
                onClick={() =>
                  navigate(
                    `/user/${encodeURIComponent(
                      u.username
                    )}`
                  )
                }
                className={`w-[68px] h-[68px] md:w-[72px] md:h-[72px] rounded-full p-[2.5px] shadow-sm mb-3 cursor-pointer hover:scale-105 transition-transform duration-300 ${
                  hasInteraction
                    ? "bg-gray-200"
                    : "bg-gradient-to-tr from-blue-400 to-purple-500"
                }`}
              >
                <div className="bg-white p-0.5 rounded-full w-full h-full">
                  <img
                    src={getProfileImage(u)}
                    className="w-full h-full rounded-full object-cover"
                    alt={u.username}
                  />
                </div>
              </div>

              {/* User Info */}
              <div
                onClick={() =>
                  navigate(
                    `/user/${encodeURIComponent(
                      u.username
                    )}`
                  )
                }
                className="flex flex-col items-center w-full mb-4 cursor-pointer group"
              >
                <div className="flex items-center justify-center gap-1 w-full px-1">
                  <p className="text-[13px] md:text-[14px] font-bold text-gray-900 truncate group-hover:text-blue-600 transition-colors">
                    {u.username}
                  </p>

                  <RoleBadge
                    role={u.role}
                    className="scale-75 origin-left"
                  />
                </div>

                <p className="text-[10px] md:text-[11px] text-gray-400 font-semibold mt-0.5 truncate w-full text-center px-2">
                  {u.name || "UniEven Member"}
                </p>
              </div>

              {/* Connect Button */}
              <button
                onClick={() =>
                  handleConnect(u)
                }
                disabled={
                  loadingId === u._id ||
                  initializing
                }
                className={`w-full py-1.5 md:py-2 rounded-xl text-[12px] md:text-[13px] font-black transition-all duration-300 active:scale-95 flex justify-center items-center h-[34px] md:h-[36px] ${
                  hasInteraction
                    ? "bg-gray-100 text-gray-600 border border-gray-200"
                    : "bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20"
                }`}
              >
                {loadingId === u._id ||
                initializing ? (
                  <div
                    className={`w-4 h-4 border-2 border-t-transparent rounded-full animate-spin ${
                      hasInteraction
                        ? "border-gray-500"
                        : "border-white/50"
                    }`}
                  ></div>

                ) : isConnected ? (
                  "Connected"

                ) : isPending ? (
                  "Connecting"

                ) : (
                  "Connect"
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default Suggestions;