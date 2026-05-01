import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import Loader from "../components/Loader";
import { FaChevronLeft, FaEnvelope, FaLock } from "react-icons/fa";
import { Assets } from "../assets/Assets";
import AUTH_API from "../api/authApi"; // ✅ Imported your Axios instance

function ResetPassword() {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Auto-fill email if passed from the Verify OTP screen
  const [email, setEmail] = useState(location.state?.email || "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState(""); // 🟦 STEP 2: ADD CONFIRM PASSWORD
  
  // 🟦 STEP 3: ADD PASSWORD VISIBILITY TOGGLE
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [loading, setLoading] = useState(false);

  // ✅ UPDATED handleReset logic for JSON responses
  const handleReset = async (e) => {
    e.preventDefault();

    if (!email) return toast.error("Email is required");
    if (!password || password.length < 6)
      return toast.error("Password must be at least 6 characters");

    // 🟦 STEP 2: VALIDATE PASSWORD MATCH
    if (password !== confirmPassword) {
      return toast.error("Passwords do not match");
    }

    // 🟦 STEP 5: BETTER PASSWORD STRENGTH
    const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{6,}$/;
    if (!strongPasswordRegex.test(password)) {
      return toast.error(
        "Password must contain an uppercase letter, lowercase letter, number, and symbol"
      );
    }

    setLoading(true);

    try {
      const res = await AUTH_API.post("/auth/reset-password", {
        email: email.toLowerCase().trim(),
        newPassword: password,
      });

      const data = res.data;

      // ✅ Handle JSON response
      if (data?.success) {
        toast.success("Password changed successfully!");
        
        // 🟦 STEP 4: SAFE LOGIN NAVIGATION
        navigate("/login", {
          replace: true,
        });

      } else {
        toast.error(data?.message || "Failed to reset password");
      }

    } catch (error) {
      // 🟦 STEP 6: ERROR LOGGING
      console.error("RESET PASSWORD ERROR:", error?.response?.data || error);
      
      toast.error(
        error.response?.data?.message || "Server error"
      );
    } finally {
      setLoading(false);
    }
  };

  // Premium UI Styles (Added pr-16 for visibility toggle spacing)
  const inputStyle = "w-full bg-white/60 backdrop-blur-md border border-white/40 rounded-[16px] sm:rounded-2xl pl-12 pr-16 py-3.5 sm:py-4 text-[14px] sm:text-[16px] outline-none focus:bg-white focus:border-[#1877f2] focus:ring-4 focus:ring-blue-500/10 transition-all shadow-sm";
  const emailInputStyle = "w-full bg-white/60 backdrop-blur-md border border-white/40 rounded-[16px] sm:rounded-2xl pl-12 pr-4 py-3.5 sm:py-4 text-[14px] sm:text-[16px] outline-none focus:bg-white focus:border-[#1877f2] focus:ring-4 focus:ring-blue-500/10 transition-all shadow-sm";

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-tr from-[#E0E7FF] via-[#F3F4F6] to-[#FDF2F8] font-['Poppins',sans-serif] antialiased p-4 relative overflow-hidden">
      
      {/* Background Blobs */}
      <div className="absolute top-[10%] left-[10%] w-[300px] h-[300px] bg-blue-300/40 rounded-full blur-[100px] animate-pulse pointer-events-none"></div>
      <div className="absolute bottom-[10%] right-[10%] w-[300px] h-[300px] bg-purple-300/40 rounded-full blur-[100px] pointer-events-none"></div>

      <div className="w-full max-w-[450px] bg-white/40 backdrop-blur-2xl rounded-[32px] sm:rounded-[40px] border border-white/60 shadow-[0_20px_60px_rgba(0,0,0,0.05)] overflow-hidden z-10 p-8 sm:p-10 relative">
        
        {/* Back Button */}
        <button 
          onClick={() => navigate("/verify-otp")} 
          className="absolute top-6 left-6 p-3 bg-white/60 rounded-full hover:bg-white transition-all shadow-sm group"
        >
          <FaChevronLeft className="text-gray-700 text-sm group-hover:scale-110 transition-transform" />
        </button>

        <div className="flex flex-col items-center mb-8 mt-6">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4 shadow-inner">
             <img src={Assets.logoicon} className="w-8 h-8 object-contain opacity-80" alt="Logo" />
          </div>
          <h2 className="text-[24px] sm:text-[28px] font-black text-gray-900 tracking-tight text-center">
            New Password
          </h2>
          <p className="text-gray-500 font-medium text-[13px] sm:text-[14px] text-center mt-2 max-w-[280px]">
            Create a strong new password for your account.
          </p>
        </div>

        <form onSubmit={handleReset} className="flex flex-col gap-4 sm:gap-5">
          
          {/* Email Input (Read Only / Trimmed) */}
          <div className="relative">
            <label className="block text-[13px] sm:text-[14px] font-bold text-gray-800 mb-2 ml-1">
              Email Address
            </label>
            <div className="relative">
              <FaEnvelope className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-lg z-10" />
              <input 
                type="email" 
                placeholder="name@university.edu.in" 
                className={`${emailInputStyle} text-gray-500 bg-white/40`} 
                value={email}
                // 🟦 STEP 1: TRIM EMAIL INPUT
                onChange={(e) => setEmail(e.target.value.toLowerCase().trimStart())}
                readOnly={!!location.state?.email}
                required 
              />
            </div>
          </div>

          {/* New Password Input */}
          <div className="relative animate-in slide-in-from-bottom-2 duration-300">
            <label className="block text-[13px] sm:text-[14px] font-bold text-gray-800 mb-2 ml-1">
              New Password
            </label>
            <div className="relative">
              <FaLock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-lg z-10" />
              <input 
                type={showPassword ? "text" : "password"}
                placeholder="Minimum 6 characters" 
                className={inputStyle} 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required 
              />
              {password.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[11px] sm:text-[12px] font-bold text-gray-500 hover:text-gray-800 transition-colors z-10"
                >
                  {showPassword ? "HIDE" : "SHOW"}
                </button>
              )}
            </div>
          </div>

          {/* 🟦 STEP 2: ADD CONFIRM PASSWORD */}
          <div className="relative animate-in slide-in-from-bottom-2 duration-300 delay-75">
            <label className="block text-[13px] sm:text-[14px] font-bold text-gray-800 mb-2 ml-1">
              Confirm Password
            </label>
            <div className="relative">
              <FaLock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-lg z-10" />
              <input 
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Repeat your password" 
                className={inputStyle} 
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required 
              />
              {confirmPassword.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[11px] sm:text-[12px] font-bold text-gray-500 hover:text-gray-800 transition-colors z-10"
                >
                  {showConfirmPassword ? "HIDE" : "SHOW"}
                </button>
              )}
            </div>
            
            {/* Visual Match Indicator */}
            {confirmPassword.length > 0 && password !== confirmPassword && (
              <p className="text-[11px] sm:text-[12px] text-red-500 mt-2 ml-1 font-semibold">
                Passwords do not match
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || !email || password.length < 6 || password !== confirmPassword}
            className={`w-full mt-2 sm:mt-4 py-4 rounded-[18px] sm:rounded-[20px] font-black text-[15px] sm:text-[16px] tracking-wide transition-all duration-300 flex justify-center items-center h-[54px] sm:h-[60px] ${
              email && password.length >= 6 && password === confirmPassword
              ? "bg-gray-900 text-white hover:bg-black hover:-translate-y-1 active:scale-95 shadow-lg shadow-gray-200" 
              : "bg-white/80 text-gray-400 cursor-not-allowed border border-white/40 shadow-none"
            }`}
          >
            {loading ? <Loader size="20px" color="#fff" /> : "Save New Password"}
          </button>
        </form>

      </div>
    </div>
  );
}

export default ResetPassword;