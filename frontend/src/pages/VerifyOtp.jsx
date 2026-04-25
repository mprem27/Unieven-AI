import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import Loader from "../components/Loader";
import { FaChevronLeft, FaEnvelope } from "react-icons/fa";
import { Assets } from "../assets/Assets";
import AUTH_API from "../api/authApi"; // ✅ Imported your Axios instance

function VerifyOtp() {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Auto-fill email if passed from the previous screen
  const [email, setEmail] = useState(location.state?.email || "");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);

  // ✅ UPDATED handleVerify logic
  const handleVerify = async (e) => {
    e.preventDefault();

    if (!email) return toast.error("Email is required");
    if (!otp || otp.length < 6)
      return toast.error("Please enter a valid 6-digit OTP");

    setLoading(true);

    try {
      const res = await AUTH_API.post("/auth/verify-otp", {
        email: email.toLowerCase().trim(),
        otp,
      });

      const data = res.data;

      // ✅ Handle both string and object responses
      if (data === "OTP verified" || data?.message === "OTP verified") {
        toast.success("Email verified successfully!");

        navigate("/reset-password", {
          state: { email: email.toLowerCase().trim() },
        });

      } else if (data === "Invalid OTP" || data?.message === "Invalid OTP") {
        toast.error("Incorrect verification code");

      } else if (data === "OTP expired" || data?.message === "OTP expired") {
        toast.error("OTP expired. Request again");

      } else {
        toast.error(data?.message || data || "Verification failed");
      }

    } catch (error) {
      toast.error(
        error.response?.data?.message || "Server error"
      );
    } finally {
      setLoading(false);
    }
  };

  // Premium UI Styles
  const inputStyle = "w-full bg-white/60 backdrop-blur-md border border-white/40 rounded-[16px] sm:rounded-2xl px-4 py-3.5 sm:py-4 text-[14px] sm:text-[16px] outline-none focus:bg-white focus:border-[#1877f2] focus:ring-4 focus:ring-blue-500/10 transition-all shadow-sm";

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-tr from-[#E0E7FF] via-[#F3F4F6] to-[#FDF2F8] font-['Poppins',sans-serif] antialiased p-4 relative overflow-hidden">
      
      {/* Background Blobs */}
      <div className="absolute top-[10%] left-[10%] w-[300px] h-[300px] bg-blue-300/40 rounded-full blur-[100px] animate-pulse pointer-events-none"></div>
      <div className="absolute bottom-[10%] right-[10%] w-[300px] h-[300px] bg-purple-300/40 rounded-full blur-[100px] pointer-events-none"></div>

      <div className="w-full max-w-[450px] bg-white/40 backdrop-blur-2xl rounded-[32px] sm:rounded-[40px] border border-white/60 shadow-[0_20px_60px_rgba(0,0,0,0.05)] overflow-hidden z-10 p-8 sm:p-10 relative">
        
        {/* Back Button */}
        <button 
          onClick={() => navigate("/forgot-password")} 
          className="absolute top-6 left-6 p-3 bg-white/60 rounded-full hover:bg-white transition-all shadow-sm group"
        >
          <FaChevronLeft className="text-gray-700 text-sm group-hover:scale-110 transition-transform" />
        </button>

        <div className="flex flex-col items-center mb-8 mt-6">
          {/* ✅ UPDATED TO USE PROJECT LOGO */}
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4 shadow-inner">
             <img src={Assets.logoicon} className="w-8 h-8 object-contain opacity-80" alt="Logo" />
          </div>
          <h2 className="text-[24px] sm:text-[28px] font-black text-gray-900 tracking-tight text-center">
            Verify Email
          </h2>
          <p className="text-gray-500 font-medium text-[13px] sm:text-[14px] text-center mt-2 max-w-[280px]">
            Please enter the 6-digit verification code sent to your email.
          </p>
        </div>

        <form onSubmit={handleVerify} className="flex flex-col gap-5">
          
          {/* Email Input (Pre-filled and read-only) */}
          <div className="relative">
            <label className="block text-[13px] sm:text-[14px] font-bold text-gray-800 mb-2 ml-1">
              Email Address
            </label>
            <div className="relative">
              <FaEnvelope className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-lg z-10" />
              <input 
                type="email" 
                placeholder="name@university.edu.in" 
                className={`${inputStyle} pl-12 text-gray-500 bg-white/40`} 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                readOnly={!!location.state?.email}
                required 
              />
            </div>
          </div>

          {/* OTP Input */}
          <div className="relative animate-in slide-in-from-bottom-2 duration-300">
            <label className="block text-[13px] sm:text-[14px] font-bold text-gray-800 mb-2 ml-1">
              Verification Code
            </label>
            <input 
              type="text" 
              placeholder="• • • • • •" 
              maxLength="6"
              className={`${inputStyle} tracking-[10px] sm:tracking-[12px] text-center font-bold text-lg sm:text-xl placeholder:tracking-normal`} 
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ""))}
              required 
            />
          </div>

          <button
            type="submit"
            disabled={loading || !email || otp.length < 6}
            className={`w-full mt-2 py-4 rounded-[18px] sm:rounded-[20px] font-black text-[15px] sm:text-[16px] tracking-wide transition-all duration-300 flex justify-center items-center h-[54px] sm:h-[60px] ${
              email && otp.length === 6
              ? "bg-gray-900 text-white hover:bg-black hover:-translate-y-1 active:scale-95 shadow-lg shadow-gray-200" 
              : "bg-white/80 text-gray-400 cursor-not-allowed border border-white/40 shadow-none"
            }`}
          >
            {loading ? <Loader size="20px" color="#fff" /> : "Verify Code"}
          </button>
        </form>

      </div>
    </div>
  );
}

export default VerifyOtp;