import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import StoryViewer from "./StoryViewer";
import { getStories } from "../services/storyService";
import { getProfileImage } from "../utils/getProfileImage";
import RoleBadge from "../components/RoleBadge";
import { useAuth } from "../context/AuthContext";

function Stories() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [users, setUsers] = useState([]);
  const [activeStories, setActiveStories] = useState(null);
  const [startIndex, setStartIndex] = useState(0);
  const [seenUsers, setSeenUsers] = useState([]);

  const DEFAULT_AVATAR =
    "https://cdn-icons-png.flaticon.com/512/149/149071.png";

  // 🔥 FIXED FETCH (prevents loop refresh)
  const fetchStories = useCallback(async () => {
    try {
      const res = await getStories();
      const fetchedUsers = res.users || [];

      setUsers(fetchedUsers);

      // Sync only if active story still exists
      setActiveStories((prevActiveStories) => {
        if (!prevActiveStories?.length) return prevActiveStories;

        const currentUserId = prevActiveStories[0]?.user?._id;

        const updatedUserStories = fetchedUsers.find(
          (u) =>
            String(u.user?._id) ===
            String(currentUserId)
        );

        if (
          updatedUserStories?.stories?.length > 0
        ) {
          return updatedUserStories.stories;
        }

        return null;
      });
    } catch (err) {
      console.error(
        "Fetch stories error:",
        err
      );
    }
  }, []);

  // INITIAL LOAD
  useEffect(() => {
    fetchStories();
  }, [fetchStories]);

  // 🔥 FIXED EVENT LISTENER (NO LOOP)
  useEffect(() => {
    const handleUpdate = () => {
      fetchStories();
    };

    window.addEventListener(
      "profileUpdated",
      handleUpdate
    );

    return () => {
      window.removeEventListener(
        "profileUpdated",
        handleUpdate
      );
    };
  }, [fetchStories]);

  const handleOpen = (
    userStories
  ) => {
    if (
      !userStories?.stories ||
      userStories.stories.length === 0
    )
      return;

    setActiveStories(
      userStories.stories
    );

    setStartIndex(0);

    // Mark seen instantly
    if (
      !seenUsers.includes(
        userStories.user._id
      )
    ) {
      setSeenUsers((prev) => [
        ...prev,
        userStories.user._id,
      ]);
    }
  };

  // 🔥 DELETE FIX
  const handleStoryDeleted = (
    deletedId
  ) => {
    setUsers((prevUsers) =>
      prevUsers
        .map((u) => ({
          ...u,
          stories: u.stories.filter(
            (story) =>
              story._id !== deletedId
          ),
        }))
        .filter(
          (u) =>
            u.stories.length > 0
        )
    );

    setActiveStories((prev) => {
      if (!prev) return null;

      const updated =
        prev.filter(
          (story) =>
            story._id !== deletedId
        );

      return updated.length > 0
        ? updated
        : null;
    });
  };

  const myStoriesData =
    users.find(
      (u) =>
        String(u.user?._id) ===
        String(user?._id)
    );

  const otherUsersStories =
    users.filter(
      (u) =>
        String(u.user?._id) !==
        String(user?._id)
    );

  const myStoriesSeen =
    myStoriesData
      ? seenUsers.includes(
        myStoriesData.user._id
      ) ||
      myStoriesData.stories.every(
        (s) =>
          s.views?.some(
            (v) =>
              String(
                v._id || v
              ) ===
              String(
                user?._id
              )
          )
      )
      : false;

  return (
    <>
      <div className="w-full bg-white border-b border-gray-100 overflow-hidden mt-0">
        <div className="flex flex-row flex-nowrap overflow-x-auto overflow-y-hidden gap-3 px-3 py-1 items-start snap-x snap-mandatory scroll-smooth [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">

          {/* YOUR STORY */}
          <div className="flex flex-col items-center group min-w-[70px] sm:min-w-[80px] snap-start shrink-0">
            <div className="relative group-hover:scale-105 transition-transform duration-300">

              <div
                onClick={() =>
                  myStoriesData
                    ? handleOpen(
                      myStoriesData
                    )
                    : navigate(
                      "/add-story"
                    )
                }
                className={`p-[2px] rounded-full transition-colors duration-500 cursor-pointer ${myStoriesData
                    ? myStoriesSeen
                      ? "bg-gray-200"
                      : "bg-gradient-to-tr from-yellow-400 via-red-500 to-fuchsia-600"
                    : "bg-transparent border-2 border-gray-100 shadow-sm"
                  }`}
              >
                <div className="bg-white p-[2px] rounded-full w-16 h-16 sm:w-20 sm:h-20 overflow-hidden">
                  <img
                    src={
                      user
                        ? getProfileImage(
                          user
                        )
                        : DEFAULT_AVATAR
                    }
                    onError={(e) => {
                      e.target.onerror =
                        null;
                      e.target.src =
                        DEFAULT_AVATAR;
                    }}
                    className="w-full h-full rounded-full object-cover bg-gray-50"
                    alt="Your Story"
                  />
                </div>
              </div>

              {/* ADD STORY BUTTON */}
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(
                    "/add-story"
                  );
                }}
                className="absolute bottom-0 right-0 bg-blue-600 w-[22px] h-[22px] sm:w-[26px] sm:h-[26px] rounded-full text-white flex items-center justify-center text-lg font-bold border-2 border-white shadow-md hover:bg-blue-700 transition-colors cursor-pointer z-10"
              >
                +
              </div>
            </div>

            <p className="text-[10px] sm:text-[11px] mt-1.5 font-semibold text-gray-800 truncate w-full text-center">
              Your Story
            </p>
          </div>

          {/* OTHER USERS */}
          {otherUsersStories.map(
            (u) => {
              const isSeen =
                seenUsers.includes(
                  u.user._id
                ) ||
                u.stories.every(
                  (story) =>
                    story.views?.some(
                      (v) =>
                        String(
                          v._id ||
                          v
                        ) ===
                        String(
                          user?._id
                        )
                    )
                );

              return (
                <div
                  key={
                    u.user._id
                  }
                  onClick={() =>
                    handleOpen(
                      u
                    )
                  }
                  className="flex flex-col items-center cursor-pointer group min-w-[70px] sm:min-w-[80px] snap-start shrink-0"
                >
                  <div className="group-hover:scale-105 transition-transform duration-300">
                    <div
                      className={`p-[2px] rounded-full transition-colors duration-500 ${isSeen
                          ? "bg-gray-200"
                          : u.user?.role ===
                            "faculty"
                            ? "bg-gradient-to-tr from-red-500 to-orange-500"
                            : "bg-gradient-to-tr from-yellow-400 via-red-500 to-fuchsia-600"
                        }`}
                    >
                      <div className="bg-white p-[2px] rounded-full w-16 h-16 sm:w-20 sm:h-20">
                        <img
                          src={
                            u.user
                              ? getProfileImage(
                                u.user
                              )
                              : DEFAULT_AVATAR
                          }
                          onError={(
                            e
                          ) => {
                            e.target.onerror =
                              null;
                            e.target.src =
                              DEFAULT_AVATAR;
                          }}
                          className="w-full h-full rounded-full object-cover bg-gray-50"
                          alt={
                            u.user
                              ?.username ||
                            "User"
                          }
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-row items-center justify-center mt-1.5 w-full px-1">
                    <p className="text-[10px] sm:text-[11px] font-bold text-gray-700 truncate text-center flex items-center gap-0.5 max-w-full">
                      <span className="truncate">
                        {u.user
                          ?.username ||
                          "User"}
                      </span>

                      {u.user
                        ?.role && (
                          <RoleBadge
                            role={
                              u.user
                                .role
                            }
                            className="scale-[0.7] origin-left"
                          />
                        )}
                    </p>
                  </div>
                </div>
              );
            }
          )}
        </div>
      </div>

      {/* STORY VIEWER */}
      {activeStories && (
        <StoryViewer
          stories={
            activeStories
          }
          currentIndex={
            startIndex
          }
          onClose={() => {
            setActiveStories(
              null
            );
          }}
          onStoryDeleted={
            handleStoryDeleted
          }
        />
      )}
    </>
  );
}

export default Stories;