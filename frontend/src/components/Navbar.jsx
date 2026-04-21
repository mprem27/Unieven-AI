import { Link } from "react-router-dom";
import logo from "../assets/logo.png";

function Navbar() {
  return (
    <div className="fixed top-0 left-0 w-full bg-[#fafafa] shadow-sm z-40">
      
      <div className="flex items-center px-6 py-2 h-14">
        
        {/* LEFT - Logo + Text */}
        <div className="flex items-center gap-2">
          <img
            src={logo}
            alt="logo"
            className="w-7 h-7 object-contain rounded-md"
          />
          <h1 className="text-lg font-semibold text-gray-800 tracking-wide">
            UniEven
          </h1>
        </div>

      </div>

    </div>
  );
}

export default Navbar;