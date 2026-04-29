import React, { useState } from "react";

// =====================================================
// SAFE DEFAULT LOGO
// =====================================================
// This points to the logo in your public folder
const DEFAULT_LOGO = "/logo.png";

const Loader = ({ size = "72px", fullPage = false, customLogo }) => {
  // =====================================================
  // SAFE IMAGE FALLBACK
  // =====================================================
  // Start with customLogo (if provided) or fallback to DEFAULT_LOGO
  const [imgSrc, setImgSrc] = useState(customLogo || DEFAULT_LOGO);

  const handleImageError = () => {
    // Prevent infinite loop if the default logo is also missing
    if (imgSrc !== DEFAULT_LOGO) {
      setImgSrc(DEFAULT_LOGO);
    }
  };

  // =====================================================
  // MAIN LOADER UI
  // =====================================================
  const loaderContent = (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      {/* Ambient Glow */}
      <div
        className="absolute inset-0 bg-indigo-500/20 blur-xl rounded-full animate-pulse z-0"
        style={{ animationDuration: "3s" }}
      />

      {/* Outer Track */}
      <div className="absolute inset-0 rounded-full border-[2px] border-slate-200/30 dark:border-slate-700/30 z-10" />

      {/* Outer Spinner */}
      <div
        className="absolute inset-0 rounded-full border-[2px] border-transparent border-t-indigo-600 border-r-indigo-600/30 shadow-[0_0_15px_rgba(79,70,229,0.4)] animate-spin z-20"
        style={{
          animationDuration: "1.2s",
          animationTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      />

      {/* Inner Track */}
      <div className="absolute inset-[18%] rounded-full border-[2px] border-slate-200/30 dark:border-slate-700/30 z-10" />

      {/* Inner Reverse Spinner */}
      <div
        className="absolute inset-[18%] rounded-full border-[2px] border-transparent border-b-sky-400 border-l-sky-400/30 shadow-[0_0_10px_rgba(56,189,248,0.4)] animate-spin z-20"
        style={{
          animationDuration: "1.8s",
          animationDirection: "reverse",
          animationTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      />

      {/* Center Logo */}
      <img
        src={imgSrc}
        alt="Loading..."
        onError={handleImageError}
        className="absolute w-[45%] h-[45%] object-contain animate-pulse z-30 transition-opacity duration-300"
        style={{
          animationDuration: "2.5s",
          filter: "drop-shadow(0px 4px 6px rgba(0,0,0,0.15))",
        }}
      />
    </div>
  );

  // =====================================================
  // FULL PAGE LOADER
  // =====================================================
  if (fullPage) {
    return (
      <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white/60 dark:bg-slate-950/70 backdrop-blur-xl animate-in fade-in duration-300">
        
        {/* Background Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60vw] max-w-[600px] h-[60vw] max-h-[600px] bg-indigo-500/5 rounded-full blur-[100px] pointer-events-none" />

        {loaderContent}

        {/* Loading Text */}
        <div className="mt-8 flex flex-col items-center gap-4 z-10">
          <p className="text-xs font-bold tracking-[0.4em] text-slate-800 dark:text-slate-200 uppercase drop-shadow-sm ml-2">
            Loading
          </p>

          {/* Animated Dots */}
          <div className="flex gap-2">
            <span
              className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse"
              style={{ animationDuration: "1s", animationDelay: "0ms" }}
            />
            <span
              className="w-1.5 h-1.5 bg-sky-500 rounded-full animate-pulse"
              style={{ animationDuration: "1s", animationDelay: "200ms" }}
            />
            <span
              className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"
              style={{ animationDuration: "1s", animationDelay: "400ms" }}
            />
          </div>
        </div>
      </div>
    );
  }

  return loaderContent;
};

export default Loader;