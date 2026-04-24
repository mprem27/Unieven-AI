import { Link, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import logo from "../assets/logo.png";
import { Assets } from "../assets/Assets";
import { getNotifications } from "../services/notificationService";
import NotificationPanel from "../components/NotificationPanel";

function Navbar() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [openNotif, setOpenNotif] = useState(false);
  const location = useLocation();

  useEffect(() => {
    let isMounted = true;

    const fetchNotifications = async () => {
      try {
        const res = await getNotifications();
        if (!isMounted) return;

        const unread = (res?.notifications || []).filter(
          (n) => !n.isRead
        ).length;

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

  return (
    <>
      <nav
        className="
          w-full flex items-center justify-center
          bg-white/70 backdrop-blur-2xl border-b border-gray-100/50
          relative md:fixed top-0 left-0 right-0 z-40
          h-14
        "
      >
        <div className="flex items-center justify-between px-4 md:px-10 w-full max-w-[1400px]">

          {/* LEFT */}
          <Link
            to="/feed"
            className="flex items-center gap-2 hover:opacity-80 transition active:scale-95"
          >
            <img
              src={logo}
              alt="logo"
              className="w-7 h-7 md:w-8 md:h-8 object-contain rounded-lg"
            />
            <h1 className="text-lg md:text-xl font-black bg-gradient-to-r from-slate-950 to-slate-600 bg-clip-text text-transparent tracking-tighter">
              UniEven
            </h1>
          </Link>

          {/* RIGHT */}
          <button
            type="button"
            onClick={() => setOpenNotif(true)}
            className="relative p-2 rounded-xl hover:bg-gray-100/50 transition active:scale-90 group"
          >
            <img
              src={Assets.like}
              className="w-5 h-5 md:w-6 md:h-6 opacity-80 group-hover:opacity-100 transition-opacity"
              alt="Notifications"
            />

            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 bg-rose-500 text-white text-[9px] font-bold px-1 py-[1px] rounded-full border border-white">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

        </div>
      </nav>

      <NotificationPanel
        isOpen={openNotif}
        onClose={() => setOpenNotif(false)}
      />
    </>
  );
}

export default Navbar;