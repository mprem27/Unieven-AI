import { NavLink, useNavigate, useLocation } from "react-router-dom"; // ✅ Added useLocation
import { useState, useRef, useEffect } from "react";
import { Assets } from "../assets/Assets";
import { useAuth } from "../context/AuthContext";
import { getNotifications } from "../services/notificationService";
import { getProfileImage } from "../utils/getProfileImage";
import NotificationPanel from "../components/NotificationPanel";

function Sidebar() {
  const [open, setOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [activeItem, setActiveItem] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  const [openNotif, setOpenNotif] = useState(false);

  const dropdownRef = useRef();
  const createRef = useRef();
  const navigate = useNavigate();
  const location = useLocation(); // ✅ Initialized location
  const { user, logout } = useAuth();

  // ✅ 4. Improved Faculty Check
  const isFaculty = ["faculty", "admin"].includes(user?.role);

  // ✅ 1. Added "My Events" to the menu
  const menu = [
    { name: "Home", path: "/feed", icon: Assets.home },
    { name: "Reels", path: "/reels", icon: Assets.reels },
    { name: "Events", path: "/events", icon: Assets.blogs },
    { name: "My Events", path: "/my-events", icon: Assets.activity },
    { name: "Search", path: "/search", icon: Assets.search },
    { name: "Notifications", path: "#", icon: Assets.like },
  ];

  useEffect(() => {
    let isMounted = true;

    const fetchNotifications = async () => {
      try {
        const res = await getNotifications();
        if (!isMounted) return;
        const unread = (res?.notifications || []).filter(n => !n.isRead).length;
        setUnreadCount(unread);
      } catch (err) {
        console.error(err);
      }
    };

    fetchNotifications();

    return () => {
      isMounted = false;
    };
  }, []);

  // ✅ 3. Close Notification Panel on Route Change
  useEffect(() => {
    setOpenNotif(false);
  }, [location.pathname]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setMoreOpen(false);
      }
      if (createRef.current && !createRef.current.contains(e.target)) {
        setCreateOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <>
      <div
        className={`fixed top-14 left-0 h-[calc(100vh-56px)] bg-white flex flex-col justify-between
        transition-all duration-300 ease-in-out shadow-md z-30
        ${open ? "w-64" : "w-24"}`}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >

        <div>
          <div className="flex items-center h-20 px-4">
            <img src={Assets.logoicon} className="w-12 h-12 object-contain" alt="Logo" />
          </div>

          <div className="flex flex-col gap-3 mt-2 px-3">
            {menu.map((item, index) => (
              <NavLink
                to={item.path}
                key={index}
                onClick={(e) => {
                  if (item.name === "Notifications") {
                    e.preventDefault();
                    setOpenNotif(true);
                  }
                }}
                // ✅ 2. Fixed Notifications Active Highlight
                className={({ isActive }) =>
                  `flex items-center gap-5 p-3 rounded-xl cursor-pointer
                   transition-all duration-200 ease-in-out
                   hover:bg-gray-100 hover:scale-[1.05]
                   ${
                     (isActive && item.name !== "Notifications") || 
                     (item.name === "Notifications" && openNotif)
                       ? "bg-gray-200 font-bold shadow-sm scale-[1.05]"
                       : ""
                   }`
                }
              >
                <div className="relative">
                  <img
                    src={item.icon}
                    className="w-7 h-7 object-contain opacity-90 hover:opacity-100 hover:scale-110 transition duration-200"
                    alt={item.name}
                  />

                  {item.name === "Notifications" && unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] px-1 rounded-full">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </div>

                {open && (
                  <span className="text-base font-semibold tracking-wide">
                    {item.name}
                  </span>
                )}
              </NavLink>
            ))}

            {/* 🔥 CREATE DROPDOWN BUTTON */}
            <div className="relative" ref={createRef}>
              <div
                onClick={() => setCreateOpen(!createOpen)}
                // ✅ 6. Added Active Highlight for Create Button route
                className={`flex items-center gap-5 p-3 rounded-xl cursor-pointer transition-all duration-200 ease-in-out hover:bg-gray-100 hover:scale-[1.05] ${
                  createOpen || location.pathname.includes("/create") 
                    ? "bg-gray-200 font-bold shadow-sm scale-[1.05]" 
                    : ""
                }`}
              >
                <img
                  src={Assets.create}
                  className="w-7 h-7 object-contain opacity-90 hover:opacity-100 hover:scale-110 transition duration-200"
                  alt="Create"
                />
                {open && (
                  <span className="text-base font-semibold tracking-wide">
                    Create
                  </span>
                )}
              </div>

              {/* CREATE DROPDOWN MENU */}
              <div
                className={`absolute top-0 left-[calc(100%+10px)] w-48 bg-white rounded-2xl shadow-xl border border-gray-100 p-2 z-[100]
                transition-all duration-300 ease-out origin-left
                ${
                  createOpen
                    ? "opacity-100 translate-x-0 scale-100 pointer-events-auto"
                    : "opacity-0 -translate-x-4 scale-95 pointer-events-none"
                }`}
              >
                <div className="flex flex-col gap-1">
                  <div
                    onClick={() => { setCreateOpen(false); navigate("/create/post"); }}
                    className="flex items-center gap-4 p-3 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors"
                  >
                    <span className="font-semibold text-gray-800">Post</span>
                  </div>
                  
                  <div
                    onClick={() => { setCreateOpen(false); navigate("/create/reel"); }}
                    className="flex items-center gap-4 p-3 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors"
                  >
                    <span className="font-semibold text-gray-800">Reel</span>
                  </div>

                  {/* FACULTY ONLY OPTION */}
                  {isFaculty && (
                    <>
                      <hr className="my-1 border-gray-100" />
                      <div
                        onClick={() => { setCreateOpen(false); navigate("/create/event"); }}
                        className="flex items-center gap-4 p-3 rounded-xl cursor-pointer hover:bg-blue-50 transition-colors"
                      >
                        <span className="font-bold text-blue-600">Event</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* 👤 PROFILE */}
            <NavLink
              to="/profile"
              className={({ isActive }) =>
                `flex items-center gap-5 p-3 rounded-xl cursor-pointer
                hover:bg-gray-100 hover:scale-[1.05] transition
                ${isActive ? "bg-gray-200 font-bold scale-[1.05]" : ""}`
              }
            >
              <img
               src={getProfileImage(user)}
                className="w-7 h-7 rounded-full object-cover border"
                alt="Profile"
              />

              {open && (
                <span className="text-base font-semibold">
                  Profile
                </span>
              )}
            </NavLink>
          </div>
        </div>

        {/* 🔥 MORE BUTTON */}
        <div className="p-3 relative mb-4" ref={dropdownRef}>
          <div
            onClick={() => setMoreOpen(!moreOpen)}
            className="flex items-center gap-5 p-3 rounded-xl cursor-pointer
            hover:bg-gray-100 transition hover:scale-[1.05]"
          >
            <img src={Assets.menu} className="w-7 h-7" alt="Menu" />

            {open && (
              <span className="text-base font-semibold">More</span>
            )}
          </div>

          {/* ORIGINAL DROPDOWN */}
          <div
            className={`absolute bottom-[calc(100%+10px)] left-2 w-60 bg-white rounded-2xl shadow-xl border border-gray-100 p-2 z-[100]
            transition-all duration-300 ease-out
            ${
              moreOpen
                ? "opacity-100 translate-y-0 pointer-events-auto"
                : "opacity-0 translate-y-3 pointer-events-none"
            }`}
          >
            <div className="flex flex-col gap-2">

              {/* SETTINGS */}
              <div
                onClick={() => setActiveItem("settings")}
                className={`flex items-center gap-5 p-3 rounded-xl cursor-pointer
                hover:bg-gray-100 hover:scale-[1.05] transition
                ${activeItem === "settings" ? "bg-gray-200 font-bold" : ""}`}
              >
                <img src={Assets.settings} className="w-7 h-7" alt="Settings" />
                <span className="font-semibold">Settings</span>
              </div>

              {/* YOUR ACTIVITY */}
              <div
                onClick={() => setActiveItem("activity")}
                className={`flex items-center gap-5 p-3 rounded-xl cursor-pointer
                hover:bg-gray-100 hover:scale-[1.05] transition
                ${activeItem === "activity" ? "bg-gray-200 font-bold" : ""}`}
              >
                <img src={Assets.activity} className="w-7 h-7" alt="Activity" />
                <span className="font-semibold">Your activity</span>
              </div>

              {/* SAVED */}
              <div
                onClick={() => setActiveItem("saved")}
                className={`flex items-center gap-5 p-3 rounded-xl cursor-pointer
                hover:bg-gray-100 hover:scale-[1.05] transition
                ${activeItem === "saved" ? "bg-gray-200 font-bold" : ""}`}
              >
                <img src={Assets.save} className="w-7 h-7" alt="Saved" />
                <span className="font-semibold">Saved</span>
              </div>

              <hr className="my-2 border-gray-200" />

              {/* LOGOUT */}
              <div
                onClick={async () => {
                  await logout();
                  navigate("/login");
                }}
                className="flex items-center gap-5 p-3 rounded-xl cursor-pointer
                hover:bg-gray-100 hover:scale-[1.05] transition text-red-500"
              >
                <img src={Assets.logout} className="w-7 h-7" alt="Logout" />
                <span className="font-semibold">Log out</span>
              </div>

            </div>
          </div>
        </div>

      </div>

      <NotificationPanel
        isOpen={openNotif}
        onClose={() => setOpenNotif(false)}
      />
    </>
  );
}

export default Sidebar;