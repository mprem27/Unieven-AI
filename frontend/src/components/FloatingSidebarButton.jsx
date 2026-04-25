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

  // ✅ FIXED: Using { capture: true } ensures the event is caught even if other elements stop propagation
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (isOpen && buttonRef.current && !buttonRef.current.contains(e.target)) {
        if (typeof onClick === "function") {
          onClick();
        }
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside, { capture: true });
      document.addEventListener("touchstart", handleClickOutside, { capture: true });
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside, { capture: true });
      document.removeEventListener("touchstart", handleClickOutside, { capture: true });
    };
  }, [isOpen, onClick]);

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

      // Constraints to keep it within the screen while dragging
      newX = Math.max(0, Math.min(window.innerWidth - btnSize, newX));
      newY = Math.max(80, Math.min(window.innerHeight - btnSize - 10, newY));

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

    // Left/Right edge snapping logic
    const paddingX = 5; 
    const paddingTop = 80; 
    const paddingBottom = 40; 

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
        backdrop-blur-2xl
        bg-white/60
        border-2 border-white/50
        shadow-[0_8px_32px_rgba(0,0,0,0.2)]
        flex items-center justify-center
        text-gray-900 text-xl
        active:scale-90
        ${isDragging ? "transition-none scale-110 shadow-[0_0_20px_rgba(255,255,255,0.4)]" : "transition-all duration-500 ease-[cubic-bezier(0.175,0.885,0.32,1.275)]"}
        ${isIdle && !isOpen ? "opacity-30 scale-90 blur-[1px]" : "opacity-100 scale-100 blur-0"}
      `}
    >
      <div className={`transition-transform duration-300 ${isOpen ? "rotate-90" : "rotate-0"}`}>
        {isOpen ? <FaTimes size={20} /> : <FaBars size={20} />}
      </div>
    </button>
  );
};

export default FloatingSidebarButton;