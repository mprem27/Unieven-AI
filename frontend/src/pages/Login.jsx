import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { login } from "../services/authService";
import Loader from "../components/Loader";
import { Assets } from "../assets/Assets";
import { FaPlay, FaCalendarAlt, FaHeart } from "react-icons/fa";
import { toast } from "react-toastify"; // ✅ Added toast import

function Login() {
  const navigate = useNavigate();
  const { setUser } = useAuth();

  const [form, setForm] = useState({
    identity: "",
    password: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // ✅ REPLACED VALIDATION BLOCK
    if (!form.identity || form.identity.trim() === "") {
      return toast.error("Please enter email or username");
    }

    if (!form.password) {
      return toast.error("Please enter password");
    }

    setLoading(true);
    try {
      // 🔥 Clean the input: removes hidden spaces and auto-capitalization
      const cleanIdentity = form.identity.toLowerCase().trim();

      const data = await login({
        identity: cleanIdentity,
        email: cleanIdentity, // ✅ Fallback just in case authService.js expects "email"
        password: form.password
      });

      // 🟦 STEP 1: REMOVED REDUNDANT TOKEN SAVE (Handled in authService.js)
      
      setUser(data.user);
      
      // 🟦 STEP 2: ADD SUCCESS TOAST
      toast.success("Login successful");
      
      // 🟦 STEP 6: SAFE NAVIGATION
      navigate("/feed", { replace: true });

    } catch (err) {
      setError(
        err?.response?.data?.message ||
        err?.message ||
        "Incorrect credentials. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  // 🟦 STEP 5: IMPROVE FORM VALIDATION
  const isFormValid = form.identity.trim().length > 0 && form.password.trim().length >= 6;

  return (
    <div className="min-h-screen w-full flex bg-[#F8FAFC] font-['Poppins',sans-serif] antialiased items-center justify-center p-4 sm:p-8">

      {/* ================= MAIN CONTAINER ================= */}
      <div className="flex w-full max-w-[1050px] bg-white rounded-2xl sm:rounded-[30px] shadow-[0_10px_40px_rgba(0,0,0,0.04)] sm:shadow-[0_20px_50px_rgba(0,0,0,0.06)] border border-gray-100 overflow-hidden min-h-[600px]">

        {/* ================= LEFT SIDE: AUTH FORM ================= */}
        <div className="flex flex-col w-full lg:w-1/2 p-6 sm:p-12 lg:p-16 justify-center relative z-10 bg-white">

          <div className="w-full max-w-[380px] mx-auto">

            {/* Logo */}
            <div className="flex items-center gap-3 mb-8 sm:mb-10">
              <img src={Assets.logo} alt="UniEven Logo" className="w-10 h-10 sm:w-12 sm:h-12 drop-shadow-sm" />
              <h1 className="text-[28px] sm:text-[32px] font-extrabold text-gray-900 tracking-tight">
                UniEven
              </h1>
            </div>

            <h2 className="text-[24px] sm:text-[26px] font-bold text-gray-800 mb-2">Welcome Back</h2>
            <p className="text-[14px] sm:text-[15px] text-gray-500 font-medium mb-8">
              Sign in to continue to your campus network.
            </p>

            <form onSubmit={handleSubmit} className="flex flex-col w-full gap-5">

              <div className="relative w-full">
                <label className="block text-[12px] sm:text-[13px] font-bold text-gray-700 mb-1.5 ml-1">Email or Username</label>
                <input
                  type="text"
                  placeholder="Enter your details"
                  className={`w-full bg-gray-50/50 border-2 ${error ? "border-red-400 focus:border-red-500" : "border-gray-200 focus:border-blue-500"
                    } rounded-xl px-4 py-3 sm:py-3.5 text-[14px] sm:text-[15px] font-medium text-gray-800 focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all hover:bg-white`}
                  value={form.identity}
                  onChange={(e) => {
                    // 🟦 STEP 3: CLEAR ERROR ON INPUT CHANGE
                    setError("");
                    setForm({ ...form, identity: e.target.value });
                  }}
                />
              </div>

              <div className="relative w-full flex flex-col">
                <div className="flex justify-between items-center mb-1.5 ml-1">
                  <label className="block text-[12px] sm:text-[13px] font-bold text-gray-700">Password</label>
                  <button
                    type="button"
                    onClick={() => navigate("/forgot-password")}
                    className="text-[11px] sm:text-[12px] font-bold text-blue-600 hover:text-blue-800 transition-colors"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    className={`w-full bg-gray-50/50 border-2 ${error ? "border-red-400 focus:border-red-500" : "border-gray-200 focus:border-blue-500"
                      } rounded-xl px-4 py-3 sm:py-3.5 text-[14px] sm:text-[15px] font-medium text-gray-800 focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all hover:bg-white pr-16`}
                    value={form.password}
                    onChange={(e) => {
                      // 🟦 STEP 3: CLEAR ERROR ON INPUT CHANGE
                      setError("");
                      setForm({ ...form, password: e.target.value });
                    }}
                  />
                  {form.password.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-800 text-[12px] sm:text-[13px] font-bold transition-colors"
                    >
                      {showPassword ? "HIDE" : "SHOW"}
                    </button>
                  )}
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-100 rounded-lg p-3 flex items-center gap-2 animate-in fade-in duration-200">
                  <span className="text-red-500 text-sm font-bold">!</span>
                  <p className="text-red-600 text-[12px] sm:text-[13px] font-semibold leading-snug">
                    {error}
                  </p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !isFormValid}
                className={`w-full py-3.5 sm:py-4 rounded-xl font-bold text-[14px] sm:text-[15px] tracking-wide flex items-center justify-center transition-all duration-300 mt-2 ${isFormValid
                    ? "bg-blue-600 hover:bg-blue-700 text-white shadow-[0_8px_20px_rgba(37,99,235,0.25)] hover:-translate-y-0.5 active:translate-y-0"
                    : "bg-gray-200 text-gray-400 cursor-not-allowed"
                  }`}
              >
                {loading ? <Loader size="20px" color="#ffffff" /> : "Sign In"}
              </button>

            </form>

            <div className="mt-8 text-center">
              <p className="text-[13px] sm:text-[14px] text-gray-600 font-medium">
                New to UniEven?{" "}
                <button
                  type="button"
                  onClick={() => navigate("/register")}
                  className="text-blue-600 font-bold hover:text-blue-800 transition-colors ml-1"
                >
                  Create an account
                </button>
              </p>
            </div>

          </div>
        </div>

        {/* ================= RIGHT SIDE: REDUCED COLOR 3D CONTENT ================= */}
        <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-[#F1F5F9] to-[#E2E8F0] p-12 items-center justify-center overflow-hidden border-l border-gray-100">

          <div className="absolute top-[-10%] right-[-10%] w-80 h-80 bg-orange-400 rounded-full blur-3xl opacity-60" />
          <div className="absolute bottom-[-10%] left-[-10%] w-80 h-80 bg-indigo-500 rounded-full blur-3xl opacity-60" />

          <div className="relative w-full h-full flex items-center justify-center perspective-[1500px] transform-gpu">

            <div className="absolute z-20 w-[280px] bg-white/90 backdrop-blur-md rounded-[24px] shadow-[0_25px_50px_rgba(0,0,0,0.06)] border border-white p-4 transform rotate-y-[-10deg] rotate-x-[5deg] hover:rotate-0 transition-all duration-700 ease-out">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-blue-50 border border-blue-100 overflow-hidden">
                  <img src={Assets.profile} className="w-full h-full object-cover" alt="User" />
                </div>
                <div>
                  <p className="text-[13px] font-bold text-gray-800">New Post</p>
                  <p className="text-[10px] text-blue-500 font-semibold uppercase tracking-wider">Campus Feed</p>
                </div>
              </div>
              <div className="w-full h-[200px] bg-blue-50/50 rounded-2xl mb-4 overflow-hidden border border-blue-50">
                <img src={Assets.login} className="w-full h-full object-cover" alt="Content" />
              </div>
              <div className="flex gap-4 px-2">
                <FaHeart className="text-red-400 text-sm" />
                <div className="w-12 h-2 bg-gray-200 rounded-full mt-1.5"></div>
              </div>
            </div>

            <div className="absolute z-10 top-0 left-0 w-[160px] aspect-[9/16] bg-white/80 backdrop-blur-sm rounded-[30px] shadow-xl border border-purple-50 p-2 transform rotate-y-[15deg] rotate-z-[-10deg] animate-[float_7s_ease-in-out_infinite]">
              <div className="w-full h-full bg-gray-800 rounded-[24px] overflow-hidden relative">
                <img src={Assets.reels || "/story-design.png"} className="w-full h-full object-cover opacity-40" alt="Reel" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center border border-white/30">
                    <FaPlay className="text-white text-[10px] ml-0.5" />
                  </div>
                </div>
              </div>
            </div>

            <div className="absolute z-30 bottom-4 right-0 w-[240px] bg-white rounded-[22px] shadow-[0_20px_40px_rgba(0,0,0,0.05)] border border-orange-50 p-4 transform rotate-y-[10deg] rotate-x-[5deg] animate-[float_6s_ease-in-out_infinite_reverse]">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 bg-orange-50 rounded-xl flex items-center justify-center text-orange-400 border border-orange-100">
                  <FaCalendarAlt size={20} />
                </div>
                <div>
                  <p className="text-[14px] font-black text-gray-800 leading-tight">Tech Fest '26</p>
                  <p className="text-[11px] font-bold text-orange-400 mt-0.5">Events Area</p>
                </div>
              </div>
              <div className="mt-4 flex justify-between items-center">
                <div className="flex -space-x-2">
                  <div className="w-6 h-6 rounded-full border-2 border-white bg-gray-200"></div>
                  <div className="w-6 h-6 rounded-full border-2 border-white bg-gray-300"></div>
                </div>
                <button className="text-[10px] font-extrabold text-orange-500 bg-orange-50 px-3 py-1.5 rounded-lg hover:bg-orange-100 transition-colors">Join</button>
              </div>
            </div>

          </div>

          <div className="absolute bottom-12 left-0 w-full text-center z-40 px-10">
            <h3 className="text-gray-800 text-[24px] font-black tracking-tight">
              Connect. Create. Campus.
            </h3>
            <p className="text-gray-500 text-[14px] font-medium mt-1">
              The premium student experience.
            </p>
          </div>

        </div>

      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotateY(15deg) rotateX(10deg); }
          50% { transform: translateY(-15px) rotateY(10deg) rotateX(5deg); }
        }
      `}} />
    </div>
  );
}

export default Login;