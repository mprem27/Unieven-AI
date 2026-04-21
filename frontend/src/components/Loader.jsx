import React from "react";

const Loader = ({ size = "16px" }) => {
  return (
    <div
      style={{
        width: size,
        height: size,
        border: "2px solid rgba(0,0,0,0.1)",
        borderTop: "2px solid #333",
        borderRadius: "50%",
        animation: "spin 1s linear infinite",
      }}
    />
  );
};

export default Loader;