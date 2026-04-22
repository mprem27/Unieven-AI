import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { register as registerUser } from "../services/authService";
import { useAuth } from "../context/AuthContext";
import API from "../api/axios";
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
  const { setUser } = useAuth();

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

  const [usernameError, setUsernameError] = useState("");
  const [usernameAvailable, setUsernameAvailable] = useState(false);
  const [checkingUsername, setCheckingUsername] = useState(false);

  // Generate Date Arrays
  const days = Array.from({ length: 31 }, (_, i) => (i + 1).toString().padStart(2, '0'));
  
  // 🔥 Map Month Names to their Numeric Values for proper formatting
  const monthMap = {
    "Jan": "01", "Feb": "02", "Mar": "03", "Apr": "04", 
    "May": "05", "Jun": "06", "Jul": "07", "Aug": "08", 
    "Sep": "09", "Oct": "10", "Nov": "11", "Dec": "12"
  };
  const months = Object.keys(monthMap);
  const years = Array.from({ length: 100 }, (_, i) => new Date().getFullYear() - i);

  // 🔥 EMAIL TYPE DETECTION
  const getEmailType = (email) => {
    const e = email.toLowerCase();
    if (e.startsWith("tts") && e.includes(".edu.in")) return "faculty";
    if (e.startsWith("vtu") && e.includes(".edu.in")) return "student";
    return "normal";
  };

  const emailType = getEmailType(form.email);

  // 🔥 USERNAME CHECK (Debounced)
  useEffect(() => {
    const delay = setTimeout(() => {
      if (form.username.length >= 3) checkUsername(form.username);
      else {
        setUsernameAvailable(false);
        setUsernameError("");
      }
    }, 500);
    return () => clearTimeout(delay);
  }, [form.username]);

  const checkUsername = async (value) => {
    setCheckingUsername(true);
    try {
      const res = await API.get(`/users/search?query=${value}`);
      const isTaken = res.data.users.some(
        (u) => u.username.toLowerCase() === value.toLowerCase()
      );
      if (isTaken) {
        setUsernameError("Username not available");
        setUsernameAvailable(false);
      } else {
        setUsernameError("");
        setUsernameAvailable(true);
      }
    } catch {
      setUsernameError("Error checking username");
    } finally {
      setCheckingUsername(false);
    }
  };

  // 🔥 SEND OTP
  const handleSendOtp = async () => {
    if (!form.email) return toast.error("Enter email first");
    setSendingOtp(true);
    try {
      const res = await API.post("/auth/send-register-otp", { email: form.email });
      if (res.data.success) {
        setOtpSent(true);
        toast.success(res.data.message);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to send OTP");
    } finally {
      setSendingOtp(false);
    }
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleUsernameChange = (e) => {
    const value = e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, "");
    setForm({ ...form, username: value });
  };

  // 🔥 REGISTER SUBMIT (Fixed payload formatting)
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!usernameAvailable) return toast.error("Username not available");
    if (emailType !== "normal" && !otpVerified) return toast.error("Verify OTP first");
    
    setLoading(true);
    try {
      // ✅ Convert Month Name to Number and format as YYYY-MM-DD
      const numericMonth = monthMap[form.month];
      const formattedDob = `${form.year}-${numericMonth}-${form.day}`;

      // ✅ Ensure the exact payload structure your backend expects
      const payload = {
        email: form.email,
        password: form.password,
        name: form.name,
        username: form.username,
        otp: form.otp,
        dob: formattedDob // Sending structured Date of Birth
      };

      const data = await registerUser(payload);
      
      if (data.success) {
        localStorage.setItem("token", data.token);
        setUser(data.user);
        navigate("/feed");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const isFormValid = form.email && form.password.length >= 6 && form.name && usernameAvailable && form.day && form.month && form.year;

  // UI STYLES
  const inputStyle = "w-full bg-white/60 backdrop-blur-md border border-white/40 rounded-2xl px-5 py-4 text-[16px] outline-none focus:bg-white focus:border-[#1877f2] focus:ring-4 focus:ring-blue-500/5 transition-all shadow-sm";
  const selectStyle = "flex-1 bg-white/60 backdrop-blur-md border border-white/40 rounded-xl px-2 py-3 text-[14px] outline-none cursor-pointer hover:bg-white hover:border-blue-300 transition-all appearance-none text-center font-medium shadow-sm";
  const labelStyle = "block text-[15px] font-bold text-gray-800 mb-2 ml-1";

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-tr from-[#E0E7FF] via-[#F3F4F6] to-[#FDF2F8] font-['Poppins',sans-serif] antialiased p-4 relative overflow-hidden">
      
      {/* Dynamic Background Blur Shapes */}
      <div className="absolute top-[-10%] left-[-10%] w-[40vw] h-[40vw] bg-blue-300 rounded-full blur-[120px] opacity-30 animate-pulse"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[30vw] h-[30vw] bg-purple-300 rounded-full blur-[120px] opacity-30"></div>

      <div className="w-full max-w-[550px] bg-white/40 backdrop-blur-2xl rounded-[45px] border border-white/60 shadow-[0_25px_80px_rgba(0,0,0,0.06)] overflow-hidden z-10 p-8 sm:p-14 relative">
        
        <button onClick={() => navigate("/login")} className="absolute top-10 left-10 p-3 bg-white/50 rounded-full hover:bg-white transition-all shadow-sm group">
          <FaChevronLeft className="text-gray-700 group-hover:scale-110 transition-transform" />
        </button>

        <div className="flex flex-col items-center mb-10 mt-4">
          <img src={Assets.logoicon} className="w-20 h-20 object-contain drop-shadow-lg" alt="Logo" />
          <h2 className="text-[32px] font-black text-gray-900 mt-4 tracking-tight leading-none">Create Account</h2>
          <p className="text-gray-500 font-medium text-center mt-2">Join our premium campus network today.</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          
          {/* EMAIL & TYPE DETECTION */}
          <div className="relative">
            <label className={labelStyle}>College Email</label>
            <input name="email" type="email" placeholder="name@university.edu.in" className={inputStyle} onChange={handleChange} required />
            
            {form.email && (
              <div className="mt-2 ml-1 flex items-center justify-between">
                <div className="flex gap-2">
                  {emailType === "student" && <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider">🎓 Student</span>}
                  {emailType === "faculty" && <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider">🧑‍🏫 Faculty</span>}
                  {emailType === "normal" && <span className="bg-gray-200 text-gray-700 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider">👤 Normal</span>}
                </div>
                
                {emailType !== "normal" && !otpSent && (
                  <button type="button" onClick={handleSendOtp} className="text-[#1877f2] text-[12px] font-bold hover:underline flex items-center gap-1">
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
                  className={`${inputStyle} tracking-[10px] text-center font-bold`}
                  onChange={(e) => {
                    setForm({ ...form, otp: e.target.value });
                    if (e.target.value.length === 6) setOtpVerified(true);
                    else setOtpVerified(false);
                  }}
                />
                {otpVerified && <FaCheckCircle className="absolute right-5 top-1/2 -translate-y-1/2 text-green-500 text-xl" />}
              </div>
            </div>
          )}

          {/* FULL NAME */}
          <div>
            <label className={labelStyle}>Full Name</label>
            <input name="name" placeholder="Enter your full name" className={inputStyle} onChange={handleChange} required />
          </div>

          {/* USERNAME */}
          <div>
            <label className={labelStyle}>Username</label>
            <div className="relative">
              <input
                name="username"
                placeholder="Choose a handle"
                className={`${inputStyle} pr-14 ${usernameError ? "border-red-400" : usernameAvailable ? "border-green-400" : ""}`}
                value={form.username}
                onChange={handleUsernameChange}
                required
              />
              <div className="absolute right-5 top-1/2 -translate-y-1/2">
                {checkingUsername ? <div className="w-5 h-5 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" /> : 
                 usernameAvailable ? <FaCheckCircle className="text-[#00a400] text-xl" /> : 
                 usernameError ? <FaTimesCircle className="text-[#fa3e3e] text-xl" /> : null}
              </div>
            </div>
            {usernameError && <p className="text-[12px] text-[#fa3e3e] mt-2 font-bold ml-1">{usernameError}</p>}
          </div>

          {/* DATE OF BIRTH */}
          <div>
            <div className="flex items-center gap-2 mb-2 ml-1">
               <label className="text-[15px] font-bold text-gray-800 tracking-tight">Date of Birth</label>
               <FaQuestionCircle className="text-gray-400 text-[10px]" title="Required for account verification" />
            </div>
            <div className="flex gap-3 relative">
              <select name="month" className={selectStyle} onChange={handleChange} required>
                <option value="">Month</option>
                {months.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <select name="day" className={selectStyle} onChange={handleChange} required>
                <option value="">Day</option>
                {days.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <select name="year" className={selectStyle} onChange={handleChange} required>
                <option value="">Year</option>
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>

          {/* PASSWORD */}
          <div>
            <label className={labelStyle}>Password</label>
            <input name="password" type="password" placeholder="Minimum 6 characters" className={inputStyle} onChange={handleChange} required />
          </div>

          {/* SUBMIT BUTTONS */}
          <div className="mt-4 flex flex-col gap-4">
             <p className="text-[11px] text-gray-500 text-center leading-relaxed px-4">
              By tapping Register, you agree to our <span className="text-gray-900 font-bold underline">Terms</span> and <span className="text-gray-900 font-bold underline">Privacy Policy</span>.
            </p>

            <button
              disabled={!isFormValid || (emailType !== "normal" && !otpVerified)}
              className={`w-full py-4.5 rounded-[22px] font-black text-[18px] tracking-wide transition-all duration-300 shadow-xl flex justify-center items-center h-[60px] ${
                isFormValid && (emailType === "normal" || otpVerified)
                ? "bg-gray-900 text-white hover:bg-black hover:-translate-y-1 active:scale-95 shadow-gray-200" 
                : "bg-white/60 text-gray-400 cursor-not-allowed border border-white/20 shadow-none"
              }`}
            >
              {loading ? <Loader size="24px" color="#fff" /> : "Register"}
            </button>

            <button
              type="button"
              onClick={() => navigate("/login")}
              className="w-full py-4 rounded-[22px] border-2 border-white/60 text-gray-800 font-bold text-[16px] hover:bg-white/80 transition-all backdrop-blur-md"
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