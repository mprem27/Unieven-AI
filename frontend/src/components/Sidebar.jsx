import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import { Assets } from "../assets/Assets";
import { useAuth } from "../context/AuthContext";
import { getNotifications } from "../services/notificationService";
import { getProfileImage } from "../utils/getProfileImage";
import NotificationPanel from "../components/NotificationPanel";

function Sidebar({ setSidebarOpen }) {
  const [open, setOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [openNotif, setOpenNotif] = useState(false);

  const dropdownRef = useRef();
  const createRef = useRef();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const isFaculty = ["faculty", "admin"].includes(user?.role);

  // Removed "My Events" as requested
  const menu = [
    { name: "Home", path: "/feed", icon: Assets.home },
    { name: "Reels", path: "/reels", icon: Assets.reels },
    { name: "Events", path: "/events", icon: Assets.blogs },
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
        console.error("Notification fetch error:", err);
      }
    };
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    setOpenNotif(false);
  }, [location.pathname]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setMoreOpen(false);
      if (createRef.current && !createRef.current.contains(e.target)) setCreateOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <>
      <div
        className={`
          fixed left-0 bg-white hidden md:flex flex-col justify-between
          transition-all duration-300 ease-in-out shadow-sm border-r border-gray-100 z-30
          
          /* ✅ FIXED: Starts below compact Navbar */
          top-14 
          
          /* ✅ FIXED: Height is screen minus Navbar height (56px) */
          h-[calc(100vh-56px)]
          
          /* RESPONSIVE WIDTH LOGIC */
          ${!open ? "w-20" : "w-64"}
        `}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >
        <div className="pt-6">
          <div className="flex flex-col gap-2 px-3">
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
                className={({ isActive }) =>
                  `flex items-center gap-5 p-3 rounded-xl cursor-pointer transition-all duration-200
                   hover:bg-gray-50 hover:scale-[1.02]
                   ${(isActive && item.name !== "Notifications") || (item.name === "Notifications" && openNotif) ? "bg-gray-100 font-bold" : ""}`
                }
              >
                <div className="relative shrink-0">
                  <img src={item.icon} className="w-6 h-6 object-contain opacity-90" alt={item.name} />
                  {item.name === "Notifications" && unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full border border-white leading-none">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </div>
                <span className={`text-[15px] font-semibold tracking-wide truncate transition-opacity duration-300 ${!open ? "opacity-0 pointer-events-none" : "opacity-100"}`}>
                  {item.name}
                </span>
              </NavLink>
            ))}

            {/* CREATE DROPDOWN */}
            <div className="relative" ref={createRef}>
              <div
                onClick={() => setCreateOpen(!createOpen)}
                className={`flex items-center gap-5 p-3 rounded-xl cursor-pointer transition-all hover:bg-gray-50 ${createOpen || location.pathname.includes("/create") ? "bg-gray-100 font-bold" : ""}`}
              >
                <img src={Assets.create} className="w-6 h-6 shrink-0 object-contain opacity-90" alt="Create" />
                <span className={`text-[15px] font-semibold tracking-wide truncate transition-opacity duration-300 ${!open ? "opacity-0 pointer-events-none" : "opacity-100"}`}>Create</span>
              </div>
              
              <div className={`absolute top-0 left-[calc(100%+12px)] w-48 bg-white rounded-2xl shadow-2xl border border-gray-100 p-2 z-[100] transition-all duration-300 origin-left ${createOpen ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"}`}>
                <div className="flex flex-col gap-1 text-sm">
                  <div onClick={() => { setCreateOpen(false); navigate("/create/post"); }} className="p-3 rounded-xl cursor-pointer hover:bg-gray-50 font-semibold text-gray-700 transition-colors">Post</div>
                  <div onClick={() => { setCreateOpen(false); navigate("/create/reel"); }} className="p-3 rounded-xl cursor-pointer hover:bg-gray-50 font-semibold text-gray-700 transition-colors">Reel</div>
                  {isFaculty && (
                    <div onClick={() => { setCreateOpen(false); navigate("/create/event"); }} className="p-3 rounded-xl cursor-pointer hover:bg-indigo-50 font-bold text-indigo-600 border-t border-gray-50 mt-1 transition-colors">Event</div>
                  )}
                </div>
              </div>
            </div>

            {/* PROFILE LINK */}
            <NavLink 
              to="/profile" 
              className={({ isActive }) => `flex items-center gap-5 p-3 rounded-xl hover:bg-gray-50 transition-all ${isActive ? "bg-gray-100 font-bold" : ""}`}
            >
              <div className="w-7 h-7 rounded-full overflow-hidden border border-gray-200 shrink-0">
                <img src={getProfileImage(user)} className="w-full h-full object-cover" alt="Profile" />
              </div>
              <span className={`text-[15px] font-semibold truncate transition-opacity duration-300 ${!open ? "opacity-0 pointer-events-none" : "opacity-100"}`}>Profile</span>
            </NavLink>
          </div>
        </div>

        {/* BOTTOM SECTION: MORE & SETTINGS */}
        <div className="p-3 relative mb-6" ref={dropdownRef}>
          <div
            onClick={() => setMoreOpen(!moreOpen)}
            className="flex items-center gap-5 p-3 rounded-xl cursor-pointer hover:bg-gray-50 transition-all"
          >
            <img src={Assets.menu} className="w-6 h-6 shrink-0 opacity-80" alt="Menu" />
            <span className={`text-[15px] font-semibold truncate transition-opacity duration-300 ${!open ? "opacity-0 pointer-events-none" : "opacity-100"}`}>More</span>
          </div>

          <div className={`absolute bottom-[calc(100%+12px)] left-2 w-60 bg-white rounded-2xl shadow-2xl border border-gray-100 p-2 z-[100] transition-all duration-300 ${moreOpen ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"}`}>
            <div className="flex flex-col gap-1">
              <div onClick={() => { navigate("/edit-profile"); setMoreOpen(false); }} className="flex items-center gap-4 p-3 rounded-xl cursor-pointer hover:bg-gray-100">
                <img src={Assets.settings} className="w-4 h-4 opacity-70" alt="" />
                <span className="font-medium text-[14px] text-gray-700">Settings</span>
              </div>
              <div onClick={() => { navigate("/activity"); setMoreOpen(false); }} className="flex items-center gap-4 p-3 rounded-xl cursor-pointer hover:bg-gray-100">
                <img src={Assets.activity} className="w-4 h-4 opacity-70" alt="" />
                <span className="font-medium text-[14px] text-gray-700">Your activity</span>
              </div>
              <div onClick={() => { navigate("/saved"); setMoreOpen(false); }} className="flex items-center gap-4 p-3 rounded-xl cursor-pointer hover:bg-gray-100">
                <img src={Assets.save} className="w-4 h-4 opacity-70" alt="" />
                <span className="font-medium text-[14px] text-gray-700">Saved Items</span>
              </div>
              <hr className="my-2 border-gray-100" />
              <div 
                onClick={async () => { await logout(); navigate("/login"); }} 
                className="flex items-center gap-4 p-3 rounded-xl cursor-pointer hover:bg-red-50 text-red-500 font-bold transition-colors"
              >
                <img src={Assets.logout} className="w-4 h-4" alt="" />
                <span className="text-[14px]">Log out</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* NOTIFICATION OVERLAY */}
      <NotificationPanel isOpen={openNotif} onClose={() => setOpenNotif(false)} />
    </>
  );
}

export default Sidebar;