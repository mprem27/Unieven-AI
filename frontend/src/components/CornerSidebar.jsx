import { useState, useEffect } from "react";
import { Assets } from "../assets/Assets";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getProfileImage } from "../utils/getProfileImage";

const CornerSidebar = ({ position, isOpen, onClose }) => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [direction, setDirection] = useState({ x: 1, y: 1 });
  const [windowSize, setWindowSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  // Track window resize for responsiveness
  useEffect(() => {
    const handleResize = () => {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Responsive constants
  const isMobile = windowSize.width < 768;
  const spacing = isMobile ? 62 : 75; // Tighter spacing for mobile
  const btnSize = isMobile ? 48 : 56; // Smaller buttons on mobile
  const padding = 12;

  // 🔥 Decide direction based on screen position
  useEffect(() => {
    if (!position) return;

    const midX = windowSize.width / 2;
    const midY = windowSize.height / 2;

    setDirection({
      x: position.x < midX ? 1 : -1,
      y: position.y < midY ? 1 : -1,
    });
  }, [position, isOpen, windowSize]);

  if (!isOpen || !position) return null;

  const horizontalItems = [
    { name: "Home", path: "/feed", icon: Assets.home },
    { name: "Search", path: "/search", icon: Assets.search },
    { name: "Post", path: "/create/post", icon: Assets.create },
    { name: "Reel", path: "/create/reel", icon: Assets.createreel },
    {
      name: "Profile",
      path: "/profile",
      icon: getProfileImage(user),
      isProfile: true,
    },
  ];

  const verticalItems = [
    { name: "Reels", path: "/reels", icon: Assets.reels },
    { name: "Events", path: "/events", icon: Assets.blogs },
    { name: "Activity", path: "/my-events", icon: Assets.activity },
  ];

  if (user?.role === "faculty" || user?.role === "admin") {
    verticalItems.push({
      name: "Create Event",
      path: "/create/event",
      icon: Assets.events,
    });
  }

  verticalItems.push({
    name: "Logout",
    action: async () => {
      await logout();
      navigate("/login");
    },
    icon: Assets.logout,
  });

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  const renderButton = (item, index, isVertical) => {
    const offset = (index + 1) * spacing;

    let x = position.x;
    let y = position.y;

    // Adjust for button centering (diff between main toggle and branch buttons)
    const toggleBtnSize = 56; 
    const centeringOffset = (toggleBtnSize - btnSize) / 2;

    if (!isVertical) {
      x = position.x + centeringOffset + direction.x * offset;
      y = position.y + centeringOffset;
      y = clamp(y, 80, windowSize.height - btnSize - padding);
    } else {
      x = position.x + centeringOffset;
      y = position.y + centeringOffset + direction.y * offset;
      x = clamp(x, padding, windowSize.width - btnSize - padding);
    }

    const containerClasses = isVertical
      ? `absolute flex items-center ${
          direction.x === 1 ? "flex-row" : "flex-row-reverse"
        }`
      : `absolute flex flex-col items-center`;

    return (
      <div
        key={(isVertical ? "v" : "h") + index}
        style={{
          left: x,
          top: y,
          transitionDelay: `${index * 40}ms`,
          width: btnSize,
          height: btnSize
        }}
        className={`${containerClasses} z-[9995] animate-in fade-in zoom-in duration-200`}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (item.action) item.action();
            else navigate(item.path);
            onClose();
          }}
          style={{ width: btnSize, height: btnSize }}
          className="group relative rounded-full bg-white/95 backdrop-blur-md shadow-lg flex items-center justify-center hover:scale-110 active:scale-90 transition-all border border-white/50"
        >
          <img
            src={item.icon}
            alt={item.name}
            className={
              item.isProfile
                ? "w-full h-full rounded-full object-cover"
                : isMobile ? "w-5 h-5" : "w-6 h-6"
            }
          />

          {/* 🔥 RESPONSIVE TOOLTIP */}
          <span
            className={`
              absolute px-2 py-1 rounded-md bg-black/80 text-white text-[9px] md:text-[10px]
              opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none
              ${isVertical
                ? direction.x === 1
                  ? "left-full ml-2"
                  : "right-full mr-2"
                : direction.y === 1 
                  ? "top-full mt-2" 
                  : "bottom-full mb-2"}
            `}
          >
            {item.name}
          </span>
        </button>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[9990] pointer-events-none overflow-hidden">
      {/* BACKDROP */}
      <div
        className="absolute inset-0 bg-black/20 backdrop-blur-[1px] pointer-events-auto transition-opacity"
        onClick={onClose}
      />

      <div className="pointer-events-auto relative w-full h-full">
        {horizontalItems.map((item, i) => renderButton(item, i, false))}
        {verticalItems.map((item, i) => renderButton(item, i, true))}
      </div>
    </div>
  );
};

export default CornerSidebar;