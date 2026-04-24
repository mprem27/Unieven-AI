import React from "react";

const Loader = ({ size = "24px", fullPage = false }) => {
  const loaderContent = (
    <div className="relative flex items-center justify-center">
      {/* Outer Glow Circle */}
      <div 
        style={{ width: size, height: size }}
        className="absolute rounded-full border-2 border-white/5 shadow-[0_0_15px_rgba(59,130,246,0.3)]"
      />
      
      {/* Spinning Gradient Element */}
      <div
        style={{ 
          width: size, 
          height: size,
          borderTop: "2px solid #3b82f6", // Your theme's blue
          borderRight: "2px solid transparent",
          borderBottom: "2px solid transparent",
          borderLeft: "2px solid transparent",
        }}
        className="rounded-full animate-spin shadow-inner"
      />

      <style>
        {`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          .animate-spin {
            animation: spin 0.8s cubic-bezier(0.4, 0, 0.2, 1) infinite;
          }
        `}
      </style>
    </div>
  );

  if (fullPage) {
    return (
      <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#0f0f0f]/80 backdrop-blur-md">
        {loaderContent}
        <p className="mt-4 text-xs font-bold tracking-[0.2em] text-white/40 uppercase animate-pulse">
          Loading
        </p>
      </div>
    );
  }

  return loaderContent;
};

export default Loader;