import React from "react";
import { FaCheckCircle } from "react-icons/fa";

function RoleBadge({ role, className = "" }) {
  // Common styles for the badges
  const baseStyles = `inline-flex items-center cursor-help transition-transform hover:scale-110 ${className}`;
  
  // Icon sizes: text-[1em] allows the badge to scale automatically with the parent's font size
  // If used in a 2XL header, it will be 2XL. If used in small text, it will be small.
  const iconStyles = "text-[1em] drop-shadow-sm";

  // 🔵 ADMIN → BLUE VERIFIED BADGE
  if (role === "admin") {
    return (
      <span className={baseStyles} title="Verified Admin">
        <FaCheckCircle className={`text-[#3b82f6] ${iconStyles}`} />
      </span>
    );
  }

  // 🔴 FACULTY → RED VERIFIED BADGE
  if (role === "faculty") {
    return (
      <span className={baseStyles} title="Verified Faculty">
        <FaCheckCircle className={`text-[#ff3040] ${iconStyles}`} />
      </span>
    );
  }

  // 🟢 STUDENT → GREEN VERIFIED BADGE
  if (role === "student") {
    return (
      <span className={baseStyles} title="Verified Student">
        <FaCheckCircle className={`text-[#10b981] ${iconStyles}`} />
      </span>
    );
  }

  return null;
}

export default RoleBadge;