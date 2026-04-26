import { useState, useRef, useEffect } from "react";
import { FaBars, FaTimes } from "react-icons/fa";

const FloatingSidebarButton = ({ onClick, setMenuPosition, isOpen }) => {
  const [position, setPosition] = useState({ x: 5, y: 120 });
  const [isDragging, setIsDragging] = useState(false);
  const [isIdle, setIsIdle] = useState(false);

  const positionRef = useRef(position);
  const offset = useRef({ x: 0, y: 0 });
  const dragging = useRef(false);
  const moved = useRef(false);
  const animationFrame = useRef(null);
  const idleTimer = useRef(null);
  const buttonRef = useRef(null);

  const btnSize = 56;

  const resetIdle = () => {
    setIsIdle(false);
    clearTimeout(idleTimer.current);
    if (!isOpen) {
      idleTimer.current = setTimeout(() => setIsIdle(true), 3000);
    }
  };

  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  useEffect(() => {
    // Initial snap position
    const initialPos = { x: 5, y: 120 };
    setPosition(initialPos);
    setMenuPosition?.(initialPos);
    resetIdle();
    return () => clearTimeout(idleTimer.current);
  }, [setMenuPosition]);

  const handleStart = (clientX, clientY) => {
    dragging.current = true;
    moved.current = false;
    setIsDragging(true);
    resetIdle();

    offset.current = {
      x: clientX - positionRef.current.x,
      y: clientY - positionRef.current.y,
    };
  };

  const handleMove = (clientX, clientY) => {
    if (!dragging.current) return;

    moved.current = true;
    resetIdle();

    cancelAnimationFrame(animationFrame.current);

    animationFrame.current = requestAnimationFrame(() => {
      let newX = clientX - offset.current.x;
      let newY = clientY - offset.current.y;

      // ✅ FIXED: Changed 80 to 5 so it can be dragged to the very top
      newX = Math.max(5, Math.min(window.innerWidth - btnSize - 5, newX));
      newY = Math.max(5, Math.min(window.innerHeight - btnSize - 5, newY));

      setPosition({ x: newX, y: newY });
    });
  };

  const handleEnd = () => {
    if (!dragging.current) return;

    dragging.current = false;
    setIsDragging(false);
    resetIdle();

    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;

    const currentX = positionRef.current.x;
    const currentY = positionRef.current.y;

    // ✅ FIXED: Changed paddingTop to 5 so it snaps cleanly to the top corners
    const paddingX = 5; 
    const paddingTop = 5; 
    const paddingBottom = 5; 

    const snapX = currentX < screenWidth / 2 ? paddingX : screenWidth - btnSize - paddingX;
    const snapY = Math.max(paddingTop, Math.min(screenHeight - btnSize - paddingBottom, currentY));

    const finalPos = { x: snapX, y: snapY };

    setPosition(finalPos);
    setMenuPosition?.(finalPos);

    if (window.navigator?.vibrate) {
      window.navigator.vibrate(40);
    }
  };

  useEffect(() => {
    const mouseMove = (e) => handleMove(e.clientX, e.clientY);
    const touchMove = (e) => {
      if (e.cancelable) e.preventDefault();
      handleMove(e.touches[0].clientX, e.touches[0].clientY);
    };

    if (isDragging) {
      window.addEventListener("mousemove", mouseMove);
      window.addEventListener("mouseup", handleEnd);
      window.addEventListener("touchmove", touchMove, { passive: false });
      window.addEventListener("touchend", handleEnd);
    }

    return () => {
      window.removeEventListener("mousemove", mouseMove);
      window.removeEventListener("mouseup", handleEnd);
      window.removeEventListener("touchmove", touchMove);
      window.removeEventListener("touchend", handleEnd);
    };
  }, [isDragging]);

  const handleClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    resetIdle();

    if (moved.current) return;

    if (typeof onClick === "function") {
      onClick();
      if (window.navigator?.vibrate) {
        window.navigator.vibrate(20);
      }
    }
  };

  return (
    <button
      ref={buttonRef}
      type="button"
      onMouseDown={(e) => handleStart(e.clientX, e.clientY)}
      onTouchStart={(e) => handleStart(e.touches[0].clientX, e.touches[0].clientY)}
      onClick={handleClick}
      style={{
        left: position.x,
        top: position.y,
        touchAction: "none",
      }}
      className={`
        fixed z-[9999]
        w-14 h-14
        rounded-full
        backdrop-blur-xl
        border-2 border-white/60
        flex items-center justify-center
        text-gray-900 text-xl cursor-pointer
        outline-none
        ${isDragging 
          ? "transition-none scale-110 bg-white/80 shadow-[0_15px_40px_rgba(0,0,0,0.15)]" 
          : "transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] shadow-[0_8px_25px_rgba(0,0,0,0.1)] bg-white/50 hover:bg-white/70"
        }
        ${!isDragging && !isIdle ? "hover:scale-105 active:scale-95" : ""}
        ${isIdle && !isOpen ? "opacity-40 scale-90 blur-[1px]" : "opacity-100 blur-0"}
      `}
    >
      <div 
        className={`absolute transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] 
        ${isOpen ? "opacity-100 rotate-90 scale-100" : "opacity-0 -rotate-90 scale-50"}`}
      >
        <FaTimes size={20} className="text-gray-800 drop-shadow-sm" />
      </div>

      <div 
        className={`absolute transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] 
        ${!isOpen ? "opacity-100 rotate-0 scale-100" : "opacity-0 rotate-90 scale-50"}`}
      >
        <FaBars size={20} className="text-gray-800 drop-shadow-sm" />
      </div>
    </button>
  );
};

export default FloatingSidebarButton;