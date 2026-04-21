import React from "react";
import { FaCheckCircle } from "react-icons/fa";

function RoleBadge({ role }) {
  // 🔴 FACULTY → RED VERIFIED BADGE
  if (role === "faculty") {
    return (
      <span 
        className="ml-1 flex items-center cursor-help" 
        title="Verified Faculty"
      >
        <FaCheckCircle className="text-[#ff3040] text-[16px] drop-shadow-sm" />
      </span>
    );
  }

  // 🟢 STUDENT → GREEN VERIFIED BADGE
  if (role === "student") {
    return (
      <span 
        className="ml-1 flex items-center cursor-help" 
        title="Verified Student"
      >
        <FaCheckCircle className="text-[#10b981] text-[16px] drop-shadow-sm" />
      </span>
    );
  }

  return null;
}

export default RoleBadge;