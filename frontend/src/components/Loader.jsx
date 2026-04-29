import React from "react";
// Import your logo here if it's in your assets folder, e.g.:
// import Logo from "../assets/logo.png";

const Loader = ({ size = "48px", fullPage = false, logoSrc = "/logo.png" }) => {
  const loaderContent = (
    <div 
      className="relative flex items-center justify-center" 
      style={{ width: size, height: size }}
    >
      {/* 1. Subtle Glow Behind the Logo */}
      <div className="absolute w-[60%] h-[60%] bg-indigo-500/30 blur-md rounded-full animate-pulse" />

      {/* 2. Your Logo (Breathing/Pulsing) */}
      {/* The w-[55%] ensures it sits perfectly inside the spinning rings */}
      <img 
        src={logoSrc} 
        alt="Loading..." 
        className="absolute w-[55%] h-[55%] object-contain animate-pulse drop-shadow-md z-10"
      />

      {/* 3. Subtle Background Track */}
      <div 
        className="absolute inset-0 rounded-full border-[3px] border-slate-200/60 dark:border-slate-800/60"
      />
      
      {/* 4. Modern Smooth Spinning Ring */}
      {/* Asymmetrical tail effect spinning around your logo */}
      <div
        className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-indigo-600 border-r-indigo-600/20 animate-spin z-20"
        style={{ animationDuration: '0.8s', animationTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)' }}
      />
    </div>
  );

  if (fullPage) {
    return (
      <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white/70 dark:bg-slate-950/70 backdrop-blur-xl animate-in fade-in duration-300">
        
        {/* Optional: Premium faint gradient orb in the background */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

        {loaderContent}
        
        {/* Sleek, wide-tracked typography */}
        <p className="mt-8 text-[10px] font-black tracking-[0.4em] text-slate-500 dark:text-slate-400 uppercase animate-pulse drop-shadow-sm">
          Loading
        </p>
      </div>
    );
  }

  return loaderContent;
};

export default Loader;