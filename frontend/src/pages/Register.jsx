import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { register as registerUser, sendRegisterOtp } from "../services/authService";
import { useAuth } from "../context/AuthContext";
import Loader from "../components/Loader";
import { toast } from "react-toastify";
import {
  FaCheckCircle,
  FaTimesCircle,
  FaChevronLeft,
  FaQuestionCircle,
  FaPaperPlane,
} from "react-icons/fa";
import { Assets } from "../assets/Assets";

function Register() {
  const navigate = useNavigate();
  // We extract `login` instead of `setUser` because AuthContext's login() handles the token automatically
  const { login } = useAuth();

  const [form, setForm] = useState({
    email: "",
    password: "",
    name: "",
    username: "",
    otp: "",
    day: "",
    month: "",
    year: "",
  });

  const [loading, setLoading] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);

  // ===============================
  // 🔥 USERNAME STATES
  // ===============================
  const [usernameError, setUsernameError] = useState("");
  const [usernameAvailable, setUsernameAvailable] = useState(false);
  const [checkingUsername, setCheckingUsername] = useState(false);

  // RESERVED USERNAMES
  const reservedUsernames = [
    "admin",
    "root",
    "support",
    "faculty",
    "student",
    "official",
    "unieven",
    "system",
  ];

  // Generate Date Arrays
  const days = Array.from({ length: 31 }, (_, i) => (i + 1).toString().padStart(2, '0'));
  const monthMap = {
    "Jan": "01", "Feb": "02", "Mar": "03", "Apr": "04", 
    "May": "05", "Jun": "06", "Jul": "07", "Aug": "08", 
    "Sep": "09", "Oct": "10", "Nov": "11", "Dec": "12"
  };
  const months = Object.keys(monthMap);
  const years = Array.from({ length: 100 }, (_, i) => new Date().getFullYear() - i);

  // EMAIL TYPE DETECTION
  const getEmailType = (email) => {
    const e = email.toLowerCase();
    if (e.startsWith("tts") && e.includes(".edu.in")) return "faculty";
    if (e.startsWith("vtu") && e.includes(".edu.in")) return "student";
    return "normal";
  };

  const emailType = getEmailType(form.email);

  // ===============================
  // 🔥 LIVE USERNAME CHECKER
  // ===============================
  const checkUsername = async (value) => {
    const username = value.toLowerCase().trim();

    // RESET
    if (!username) {
      setUsernameAvailable(false);
      setUsernameError("");
      return false;
    }

    // FORMAT CHECK
    const validFormat = /^[a-z0-9._]{3,20}$/.test(username);

    if (!validFormat) {
      setUsernameAvailable(false);
      setUsernameError("3–20 chars: lowercase letters, numbers, . or _");
      return false;
    }

    // RESERVED CHECK
    if (reservedUsernames.includes(username)) {
      setUsernameAvailable(false);
      setUsernameError("This username is reserved");
      return false;
    }

    setCheckingUsername(true);

    try {
      const apiBase = import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "http://localhost:4000/api";

      const response = await fetch(
        `${apiBase}/users/check-username?username=${encodeURIComponent(username)}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const data = await response.json();

      if (data.success && data.available) {
        setUsernameAvailable(true);
        setUsernameError("");
        return true;
      } else {
        setUsernameAvailable(false);
        setUsernameError(data.message || "Username already taken");
        return false;
      }
    } catch (error) {
      console.error("Username check failed:", error);
      setUsernameAvailable(false);
      setUsernameError("Username check failed. Please try again.");
      return false;
    } finally {
      setCheckingUsername(false);
    }
  };

  // ===============================
  // 🔥 DEBOUNCE EFFECT
  // ===============================
  useEffect(() => {
    if (!form.username) {
      setUsernameAvailable(false);
      setUsernameError("");
      return;
    }

    const delay = setTimeout(() => {
      checkUsername(form.username);
    }, 350);

    return () => clearTimeout(delay);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.username]);

  // ===============================
  // 🔥 USERNAME INPUT HANDLER
  // ===============================
  const handleUsernameChange = (e) => {
    const value = e.target.value
      .toLowerCase()
      .replace(/[^a-z0-9._]/g, "")
      .slice(0, 20);

    setForm((prev) => ({
      ...prev,
      username: value,
    }));
  };

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  // SEND OTP
  const handleSendOtp = async () => {
    if (sendingOtp) return;

    if (
      !form.email ||
      !form.password ||
      !form.name ||
      !form.username ||
      !form.day ||
      !form.month ||
      !form.year
    ) {
      return toast.error("Complete all fields before requesting OTP");
    }

    setSendingOtp(true);

    // LOCK USERNAME BEFORE OTP
    const isAvail = await checkUsername(form.username);
    
    if (!isAvail) {
      setSendingOtp(false);
      return toast.error("Username is no longer available or invalid");
    }

    try {
      const numericMonth = monthMap[form.month];
      const formattedDob = `${form.year}-${numericMonth}-${form.day}`;

      const payload = {
        email: form.email.toLowerCase().trim(),
        password: form.password,
        name: form.name.trim(),
        username: form.username.toLowerCase().trim(),
        dob: formattedDob,
      };

      const res = await sendRegisterOtp(payload);

      if (res.success) {
        setOtpSent(true);
        toast.success(res.message || "OTP sent successfully");
      }
    } catch (err) {
      console.error("OTP ERROR:", err);

      toast.error(
        err?.message ||
        err?.response?.data?.message ||
        "Failed to send OTP. Please try again."
      );
    } finally {
      setSendingOtp(false);
    }
  };

  // REGISTER SUBMIT
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.username || form.username.trim() === "") {
      return toast.error("Username is required");
    }

    if (!usernameAvailable) return toast.error("Username not available");
    if (!otpVerified) return toast.error("Verify OTP first");
    
    setLoading(true);
    try {
      const payload = {
        email: form.email.toLowerCase().trim(),
        otp: form.otp.trim(),
      };

      const data = await registerUser(payload);
      
      if (data.success) {
        // Handled entirely by AuthContext now to prevent duplication and sync issues
        login(data); 
        navigate("/feed");
      }
    } catch (err) {
      toast.error(
        err?.message ||
        err?.response?.data?.message ||
        "Registration failed"
      );
    } finally {
      setLoading(false);
    }
  };

  const isFormValid = 
    form.email && 
    form.password.length >= 6 && 
    form.name && 
    form.username &&
    usernameAvailable && 
    form.day && 
    form.month && 
    form.year &&
    otpSent;

  // RESPONSIVE UI STYLES (Added visual cues for disabled states)
  const inputStyle = "w-full bg-white/60 backdrop-blur-md border border-white/40 rounded-[16px] sm:rounded-2xl px-4 sm:px-5 py-3.5 sm:py-4 text-[14px] sm:text-[16px] outline-none focus:bg-white focus:border-[#1877f2] focus:ring-4 focus:ring-blue-500/10 transition-all shadow-sm disabled:opacity-60 disabled:cursor-not-allowed";
  const selectStyle = "flex-1 bg-white/60 backdrop-blur-md border border-white/40 rounded-xl sm:rounded-2xl px-1 sm:px-2 py-3.5 sm:py-4 text-[13px] sm:text-[14px] outline-none cursor-pointer hover:bg-white hover:border-blue-300 transition-all appearance-none text-center font-medium shadow-sm disabled:opacity-60 disabled:cursor-not-allowed";
  const labelStyle = "block text-[13px] sm:text-[15px] font-bold text-gray-800 mb-1.5 sm:mb-2 ml-1";

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-tr from-[#E0E7FF] via-[#F3F4F6] to-[#FDF2F8] font-['Poppins',sans-serif] antialiased p-4 sm:p-6 lg:p-8 relative overflow-hidden">
      
      {/* Dynamic Background Blur Shapes */}
      <div className="absolute top-[-5%] left-[-10%] w-[300px] h-[300px] sm:w-[40vw] sm:h-[40vw] bg-blue-300 rounded-full blur-[100px] sm:blur-[120px] opacity-40 animate-pulse pointer-events-none"></div>
      <div className="absolute bottom-[-5%] right-[-10%] w-[250px] h-[250px] sm:w-[30vw] sm:h-[30vw] bg-purple-300 rounded-full blur-[100px] sm:blur-[120px] opacity-40 pointer-events-none"></div>

      <div className="w-full max-w-[550px] bg-white/40 backdrop-blur-2xl rounded-[32px] sm:rounded-[45px] border border-white/60 shadow-[0_20px_60px_rgba(0,0,0,0.05)] overflow-hidden z-10 p-6 sm:p-10 md:p-14 relative mt-10 sm:mt-0">
        
        {/* Back Button */}
        <button 
          onClick={() => navigate("/login")} 
          className="absolute top-4 left-4 sm:top-8 sm:left-8 p-2.5 sm:p-3 bg-white/60 rounded-full hover:bg-white transition-all shadow-sm group"
        >
          <FaChevronLeft className="text-gray-700 text-sm sm:text-base group-hover:scale-110 transition-transform" />
        </button>

        <div className="flex flex-col items-center mb-8 sm:mb-10 mt-4 sm:mt-2">
          <img src={Assets.logoicon} className="w-16 h-16 sm:w-20 sm:h-20 object-contain drop-shadow-lg" alt="Logo" />
          <h2 className="text-[26px] sm:text-[32px] font-black text-gray-900 mt-3 sm:mt-4 tracking-tight leading-none text-center">Create Account</h2>
          <p className="text-gray-500 font-medium text-[13px] sm:text-base text-center mt-1.5 sm:mt-2">Join our premium campus network today.</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5 sm:gap-6">
          
          {/* EMAIL & TYPE DETECTION */}
          <div className="relative">
            <label className={labelStyle}>College Email</label>
            <input 
              name="email" 
              type="email" 
              placeholder="name@university.edu.in" 
              className={inputStyle} 
              onChange={handleChange} 
              disabled={otpSent} 
              required 
            />
            
            {form.email && (
              <div className="mt-2 ml-1 flex flex-wrap items-center justify-between gap-2">
                <div className="flex gap-2">
                  {emailType === "student" && <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-[10px] sm:text-[11px] font-bold uppercase tracking-wider">Student</span>}
                  {emailType === "faculty" && <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-[10px] sm:text-[11px] font-bold uppercase tracking-wider">Faculty</span>}
                  {emailType === "normal" && <span className="bg-gray-200 text-gray-700 px-3 py-1 rounded-full text-[10px] sm:text-[11px] font-bold uppercase tracking-wider">Normal</span>}
                </div>
                
                {!otpSent && (
                  <button type="button" onClick={handleSendOtp} className="text-[#1877f2] text-[11px] sm:text-[12px] font-bold hover:underline flex items-center gap-1 shrink-0">
                    {sendingOtp ? <Loader size="12px" color="#1877f2" /> : <><FaPaperPlane size={10}/> Send OTP</>}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* OTP INPUT */}
          {otpSent && (
            <div className="animate-in slide-in-from-top-2 duration-300">
              <label className={labelStyle}>Verification Code</label>
              <div className="relative">
                <input
                  name="otp"
                  placeholder="Enter 6-digit OTP"
                  maxLength="6"
                  value={form.otp}
                  className={`${inputStyle} tracking-[6px] sm:tracking-[10px] text-center font-bold`}
                  onChange={(e) => {
                    const otpValue = e.target.value.replace(/\D/g, "").slice(0, 6);
                    setForm((prev) => ({
                      ...prev,
                      otp: otpValue,
                    }));
                    setOtpVerified(otpValue.length === 6);
                  }}
                />
                {otpVerified && <FaCheckCircle className="absolute right-4 sm:right-5 top-1/2 -translate-y-1/2 text-green-500 text-lg sm:text-xl" />}
              </div>
            </div>
          )}

          {/* FULL NAME */}
          <div>
            <label className={labelStyle}>Full Name</label>
            <input 
              name="name" 
              placeholder="Enter your full name" 
              className={inputStyle} 
              onChange={handleChange} 
              disabled={otpSent}
              required 
            />
          </div>

          {/* ===============================
              🔥 USERNAME INPUT 
             =============================== */}
          <div>
            <label className={labelStyle}>Username</label>
            <div className="relative">
              <input
                name="username"
                placeholder="Choose a handle"
                className={`${inputStyle} pr-14 ${
                  usernameError && !otpSent
                    ? "border-red-400 focus:border-red-400"
                    : usernameAvailable && !otpSent
                    ? "border-green-400 focus:border-green-400"
                    : ""
                }`}
                value={form.username}
                onChange={handleUsernameChange}
                disabled={otpSent}
                required
              />
              
              <div className="absolute right-5 top-1/2 -translate-y-1/2 flex items-center justify-center">
                {checkingUsername ? (
                  <div className="w-5 h-5 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
                ) : usernameAvailable ? (
                  <FaCheckCircle className="text-green-500 text-xl" />
                ) : usernameError && !otpSent ? (
                  <FaTimesCircle className="text-red-500 text-xl" />
                ) : null}
              </div>
            </div>
            
            {usernameError && !otpSent && (
              <p className="text-xs text-red-500 mt-2 font-semibold ml-1">
                {usernameError}
              </p>
            )}
          </div>

          {/* DATE OF BIRTH */}
          <div>
            <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2 ml-1">
               <label className="text-[13px] sm:text-[15px] font-bold text-gray-800 tracking-tight">Date of Birth</label>
               <FaQuestionCircle className="text-gray-400 text-[9px] sm:text-[10px]" title="Required for account verification" />
            </div>
            <div className="flex gap-2 sm:gap-3 relative">
              <select name="month" className={selectStyle} onChange={handleChange} disabled={otpSent} required>
                <option value="">Month</option>
                {months.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <select name="day" className={selectStyle} onChange={handleChange} disabled={otpSent} required>
                <option value="">Day</option>
                {days.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <select name="year" className={selectStyle} onChange={handleChange} disabled={otpSent} required>
                <option value="">Year</option>
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>

          {/* PASSWORD */}
          <div>
            <label className={labelStyle}>Password</label>
            <input 
              name="password" 
              type="password" 
              placeholder="Minimum 6 characters" 
              className={inputStyle} 
              onChange={handleChange} 
              disabled={otpSent}
              required 
            />
          </div>

          {/* SUBMIT BUTTONS */}
          <div className="mt-2 sm:mt-4 flex flex-col gap-3 sm:gap-4">
             <p className="text-[10px] sm:text-[11px] text-gray-500 text-center leading-relaxed px-2 sm:px-4">
              By tapping Register, you agree to our <span className="text-gray-900 font-bold hover:underline cursor-pointer">Terms</span> and <span className="text-gray-900 font-bold hover:underline cursor-pointer">Privacy Policy</span>.
            </p>

            <button
              disabled={!isFormValid || !otpVerified || loading}
              className={`w-full py-4 sm:py-4.5 rounded-[18px] sm:rounded-[22px] font-black text-[16px] sm:text-[18px] tracking-wide transition-all duration-300 flex justify-center items-center h-[54px] sm:h-[60px] ${
                isFormValid && otpVerified && !loading
                ? "bg-gray-900 text-white hover:bg-black hover:-translate-y-1 active:scale-95 shadow-lg sm:shadow-xl shadow-gray-200" 
                : "bg-white/80 text-gray-400 cursor-not-allowed border border-white/40 shadow-none"
              }`}
            >
              {loading ? <Loader size="20px" color="#fff" /> : "Register"}
            </button>

            <button
              type="button"
              onClick={() => navigate("/login")}
              className="w-full py-3.5 sm:py-4 rounded-[18px] sm:rounded-[22px] border-2 border-white/60 text-gray-800 font-bold text-[14px] sm:text-[16px] hover:bg-white/80 transition-all backdrop-blur-md active:scale-95"
            >
              Already a member? Log In
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}

export default Register;