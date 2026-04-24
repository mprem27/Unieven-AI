import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { updateProfile } from "../services/userService";
import { getProfileImage } from "../utils/getProfileImage";
import API from "../api/axios";
import Loader from "../components/Loader";
import { toast } from "react-toastify";
import { FaChevronDown, FaQuestionCircle, FaCheckCircle, FaTimesCircle, FaCamera } from "react-icons/fa";

function EditProfile() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();

  // 🎓 Check if Faculty
  const isFaculty = user?.role === "faculty" || user?.email?.startsWith("tts");

  const [form, setForm] = useState({
    name: "",
    username: "",
    bio: "",
    gender: "Prefer not to say",
    day: "",
    month: "",
    year: "",
    imagePreview: "",
    isPrivate: false, 
  });

  const [selectedFile, setSelectedFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingPhoto, setSavingPhoto] = useState(false);
  
  // Custom Dropdown State
  const [isGenderOpen, setIsGenderOpen] = useState(false);
  const genderOptions = ["Male", "Female", "Prefer not to say", "Custom"];
  
  // Modal States
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
  const fileInputRef = useRef(null);

  // Username Checker States
  const [usernameError, setUsernameError] = useState("");
  const [usernameAvailable, setUsernameAvailable] = useState(true);
  const [checkingUsername, setCheckingUsername] = useState(false);

  // Date Arrays
  const days = Array.from({ length: 31 }, (_, i) => (i + 1).toString().padStart(2, '0'));
  const monthMap = { "Jan": "01", "Feb": "02", "Mar": "03", "Apr": "04", "May": "05", "Jun": "06", "Jul": "07", "Aug": "08", "Sep": "09", "Oct": "10", "Nov": "11", "Dec": "12" };
  const months = Object.keys(monthMap);
  const years = Array.from({ length: 100 }, (_, i) => new Date().getFullYear() - i);

  useEffect(() => {
    if (user) {
      let initialDay = "", initialMonth = "", initialYear = "";
      if (user.dob) {
        const dateObj = new Date(user.dob);
        initialYear = dateObj.getFullYear().toString();
        const monthNum = (dateObj.getMonth() + 1).toString().padStart(2, '0');
        initialMonth = Object.keys(monthMap).find(key => monthMap[key] === monthNum) || "";
        initialDay = dateObj.getDate().toString().padStart(2, '0');
      }

      setForm({
        name: user.name || "",
        username: user.username || "",
        bio: user.bio || "",
        gender: user.gender || "Prefer not to say",
        day: initialDay,
        month: initialMonth,
        year: initialYear,
        imagePreview: getProfileImage(user),
        isPrivate: user.isPrivate || false, 
      });
      setLoading(false);
    }
  }, [user]);

  // 🕵️ LIVE USERNAME CHECKER
  useEffect(() => {
    if (!form.username || form.username === user?.username) {
      setUsernameAvailable(true);
      setUsernameError("");
      return;
    }

    const delayDebounceFn = setTimeout(() => {
      if (form.username.length >= 3) {
        checkUsername(form.username);
      } else {
        setUsernameAvailable(false);
        setUsernameError("Username must be at least 3 characters.");
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [form.username, user]);

  const checkUsername = async (value) => {
    setCheckingUsername(true);
    try {
      const res = await API.get(`/users/search?query=${value}`);
      const isTaken = res.data.users.some(u => u.username.toLowerCase() === value.toLowerCase());
      
      if (isTaken && value.toLowerCase() !== user?.username.toLowerCase()) {
        setUsernameError("This username isn't available.");
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

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleUsernameChange = (e) => {
    const value = e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, "");
    setForm({ ...form, username: value });
  };

  // ✅ STAGE PHOTO ONLY (Wait for save button click)
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setSelectedFile(file);
    setForm((prev) => ({
      ...prev,
      imagePreview: URL.createObjectURL(file),
    }));
  };

  // ✅ SAVE SPECIFICALLY THE PHOTO FROM MODAL
  const handleSavePhoto = async () => {
    if (!selectedFile) return;

    setSavingPhoto(true);
    try {
      const formData = new FormData();
      formData.append("image", selectedFile);
      
      // ✅ Send ALL mandatory fields to prevent backend 500 error
      formData.append("name", form.name);
      formData.append("username", form.username);
      formData.append("bio", form.bio || "");
      formData.append("gender", form.gender || "Prefer not to say");
      formData.append("isPrivate", String(form.isPrivate)); // Fixed Boolean issue

      if (form.day && form.month && form.year) {
        const numericMonth = monthMap[form.month];
        formData.append("dob", `${form.year}-${numericMonth}-${form.day}`);
      }

      const data = await updateProfile(formData);
      
      if (data.success !== false) {
        setUser(data.user || data);
        toast.success("Profile photo updated!");
        setIsPhotoModalOpen(false);
        setSelectedFile(null);
      } else {
        throw new Error(data.message || "Failed to update");
      }
    } catch (err) {
      toast.error("Failed to upload photo.");
    } finally {
      setSavingPhoto(false);
    }
  };

  // ✅ MAIN FORM SUBMIT
  const handleSubmit = async () => {
    if (!form.username || !form.name) {
      toast.error("Username and Name are required!");
      return;
    }
    if (!usernameAvailable) {
      toast.error("Please choose a valid username.");
      return;
    }

    setSaving(true);
    try {
      const formData = new FormData();
      formData.append("name", form.name);
      formData.append("username", form.username);
      formData.append("bio", form.bio || "");
      formData.append("gender", form.gender || "Prefer not to say");
      
      // ✅ FIXED: Explicitly cast boolean to string for FormData
      formData.append("isPrivate", String(form.isPrivate)); 
      
      if (form.day && form.month && form.year) {
        const numericMonth = monthMap[form.month];
        formData.append("dob", `${form.year}-${numericMonth}-${form.day}`);
      }

      if (selectedFile) formData.append("image", selectedFile); 

      const data = await updateProfile(formData);
      
      if (data.success === false) {
        throw new Error(data.message || "Server rejected the update.");
      }

      const updatedUser = data.user || data;
      setUser(updatedUser); 
      
      toast.success("Profile saved successfully!");
      setTimeout(() => navigate("/profile"), 1200);

    } catch (err) {
      toast.error(err?.response?.data?.message || err.message || "Update failed. Try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="h-screen flex justify-center items-center bg-[#fafafa]">
        <Loader size="40px" color="#0095f6" />
      </div>
    );
  }

  const inputStyles = "w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-3.5 text-[15px] focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 outline-none transition-all duration-300 font-medium text-gray-800 placeholder:text-gray-400";
  const selectStyle = "flex-1 bg-gray-50 border border-gray-200 rounded-2xl px-2 py-3.5 text-[14px] outline-none cursor-pointer hover:bg-white focus:border-blue-500 transition-all appearance-none text-center font-bold text-gray-700";

  return (
    <div className="w-full min-h-screen flex justify-center bg-[#f8f9fa] text-[#262626] font-['Poppins',sans-serif] antialiased sm:py-12">
      
      <div className="w-full max-w-[680px] bg-white sm:rounded-[32px] sm:shadow-[0_20px_50px_rgba(0,0,0,0.04)] border-gray-100 flex flex-col mb-10 overflow-hidden">
        
        <div className="px-6 sm:px-16 py-10">
          <div className="flex justify-between items-center mb-10">
            <h2 className="text-[26px] font-black tracking-tight text-gray-900">Profile Studio</h2>
            <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-red-500 font-bold text-sm transition-colors uppercase tracking-widest">Cancel</button>
          </div>

          {/* ================= PREMIUM HEADER CARD ================= */}
          <div className="relative group bg-gradient-to-br from-gray-50 to-white p-6 rounded-[30px] mb-12 border border-gray-100 flex flex-col sm:flex-row items-center gap-6 shadow-sm">
            <div className="relative shrink-0">
              <div className="w-24 h-24 rounded-[28px] overflow-hidden border-4 border-white shadow-xl ring-1 ring-gray-100">
                <img src={form.imagePreview} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" alt="Profile" />
              </div>
              <button 
                onClick={() => setIsPhotoModalOpen(true)}
                className="absolute -bottom-2 -right-2 bg-blue-600 text-white p-2.5 rounded-2xl shadow-lg hover:scale-110 active:scale-90 transition-all border-2 border-white"
              >
                <FaCamera size={14} />
              </button>
            </div>
            <div className="text-center sm:text-left flex-1">
              <p className="font-black text-xl text-gray-900 leading-tight">@{form.username}</p>
              <p className="text-sm text-gray-400 font-bold uppercase tracking-widest mt-1.5">{user?.role || "Student"}</p>
            </div>
          </div>

          {/* ================= STACKED FORM FIELDS ================= */}
          <div className="flex flex-col gap-10">

            {/* NAME */}
            <div className="space-y-2">
              <label className="block font-black text-[11px] uppercase tracking-[0.15em] text-gray-400 ml-1">Identity Name</label>
              <input name="name" value={form.name} onChange={handleChange} placeholder="Enter your full name" className={inputStyles} />
              <p className="text-[11px] text-gray-400 mt-2 leading-relaxed font-medium px-1 italic">
                Using your real name helps friends recognize you.
              </p>
            </div>

            {/* USERNAME W/ LIVE CHECKER */}
            <div className="space-y-2">
              <label className="block font-black text-[11px] uppercase tracking-[0.15em] text-gray-400 ml-1">Unique Username</label>
              <div className="relative">
                <input 
                  name="username" 
                  value={form.username} 
                  onChange={handleUsernameChange} 
                  placeholder="Choose a username" 
                  className={`${inputStyles} pr-12 ${!usernameAvailable ? 'border-red-300 focus:border-red-400 focus:ring-red-400/5' : ''}`} 
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                  {checkingUsername ? (
                    <div className="w-5 h-5 border-[3px] border-gray-200 border-t-blue-500 rounded-full animate-spin"></div>
                  ) : usernameAvailable ? (
                    <FaCheckCircle className="text-green-500" size={18} />
                  ) : usernameError ? (
                    <FaTimesCircle className="text-red-400" size={18} />
                  ) : null}
                </div>
              </div>
              {usernameError && <p className="text-[11px] text-red-500 mt-2 font-bold ml-1 uppercase tracking-tighter">{usernameError}</p>}
            </div>

            {/* BIO */}
            <div className="space-y-2">
              <label className="block font-black text-[11px] uppercase tracking-[0.15em] text-gray-400 ml-1">About the Vibe</label>
              <div className="relative">
                <textarea name="bio" value={form.bio} onChange={handleChange} rows="3" maxLength="150" placeholder="Write a short bio..." className={`${inputStyles} resize-none pb-10`} />
                <span className={`absolute bottom-4 right-5 text-[10px] font-black tracking-widest ${form.bio.length >= 140 ? 'text-red-500' : 'text-gray-300'}`}>
                  {form.bio.length} / 150
                </span>
              </div>
            </div>

            {/* CUSTOM GENDER DROPDOWN */}
            <div className="space-y-2">
              <label className="block font-black text-[11px] uppercase tracking-[0.15em] text-gray-400 ml-1">Gender Identity</label>
              <div className="relative">
                <div 
                  onClick={() => setIsGenderOpen(!isGenderOpen)}
                  className={`${inputStyles} flex justify-between items-center cursor-pointer select-none bg-gray-50`}
                >
                  <span className="font-bold text-gray-700">{form.gender}</span>
                  <FaChevronDown className={`text-gray-400 text-[10px] transition-transform duration-300 ${isGenderOpen ? "rotate-180" : ""}`} />
                </div>
                
                {isGenderOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setIsGenderOpen(false)} />
                    <div className="absolute top-full left-0 w-full mt-3 bg-white border border-gray-100 rounded-[24px] shadow-2xl z-20 overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300">
                      {genderOptions.map((opt) => (
                        <div
                          key={opt}
                          onClick={() => {
                            setForm({ ...form, gender: opt });
                            setIsGenderOpen(false);
                          }}
                          className={`px-6 py-4 hover:bg-blue-50 cursor-pointer text-sm font-bold transition-colors ${form.gender === opt ? "text-blue-600 bg-blue-50/50" : "text-gray-600"}`}
                        >
                          {opt}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* DATE OF BIRTH */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-2 ml-1">
                 <label className="block font-black text-[11px] uppercase tracking-[0.15em] text-gray-400">Birth Cycle</label>
                 <FaQuestionCircle className="text-gray-300 text-[10px]" title="Private by default." />
              </div>
              <div className="flex gap-4 relative">
                <select name="month" value={form.month} className={selectStyle} onChange={handleChange}>
                  <option value="">Month</option>
                  {months.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <select name="day" value={form.day} className={selectStyle} onChange={handleChange}>
                  <option value="">Day</option>
                  {days.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <select name="year" value={form.year} className={selectStyle} onChange={handleChange}>
                  <option value="">Year</option>
                  {years.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>

            {/* 🔥 PRIVATE ACCOUNT TOGGLE */}
            {!isFaculty && (
              <div className="bg-blue-50/30 p-6 rounded-[30px] border border-blue-50/50 mt-4">
                <div className="flex items-center justify-between">
                  <div className="pr-4">
                    <label className="block font-black text-[13px] text-gray-800 uppercase tracking-tight">Privacy Shield</label>
                    <p className="text-[11px] text-gray-400 font-bold uppercase tracking-wide mt-1">
                      Hide your feed from strangers.
                    </p>
                  </div>
                  
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      name="isPrivate"
                      checked={form.isPrivate}
                      onChange={(e) => setForm({ ...form, isPrivate: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-12 h-7 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5 shadow-inner"></div>
                  </label>
                </div>
              </div>
            )}

            {/* SUBMIT BUTTON */}
            <div className="pt-6">
              <button
                onClick={handleSubmit}
                disabled={saving || !usernameAvailable}
                className="w-full bg-black hover:bg-blue-600 text-white py-5 rounded-[24px] font-black text-xs uppercase tracking-[0.25em] transition-all duration-300 disabled:opacity-30 flex justify-center items-center h-[60px] shadow-xl active:scale-95 shadow-blue-900/10"
              >
                {saving ? <Loader size="20px" color="#ffffff" /> : "Save Changes"}
              </button>
            </div>

          </div>
        </div>
      </div>

      {/* ================= PHOTO MODAL ================= */}
      {isPhotoModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xl transition-all duration-500">
          <div className="bg-white rounded-[40px] w-full max-w-[420px] flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
            
            <div className="py-8 text-center border-b border-gray-50">
              <h3 className="text-lg font-black text-gray-900 tracking-tight">Portrait Studio</h3>
            </div>

            <div className="flex flex-col items-center py-12 bg-gray-50/50">
              <div 
                className="w-32 h-32 rounded-[36px] overflow-hidden border-4 border-white shadow-2xl relative group cursor-pointer hover:scale-105 transition-transform" 
                onClick={() => fileInputRef.current.click()}
              >
                <img src={form.imagePreview} className="w-full h-full object-cover" alt="preview" />
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/40 backdrop-blur-sm transition-all duration-300 text-white text-[10px] font-black uppercase tracking-widest">
                  Browse
                </div>
              </div>
            </div>
            
            <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={handleFileSelect} />

            <div className="flex flex-col p-4 gap-2">
              {selectedFile ? (
                <button 
                  onClick={handleSavePhoto} 
                  disabled={savingPhoto}
                  className="w-full py-4.5 bg-blue-600 text-white rounded-[20px] font-black text-xs uppercase tracking-widest active:scale-95 shadow-lg shadow-blue-200"
                >
                  {savingPhoto ? <Loader size="16px" color="#ffffff" /> : "Confirm Portrait"}
                </button>
              ) : (
                <button 
                  onClick={() => fileInputRef.current.click()} 
                  className="w-full py-4.5 bg-gray-900 text-white rounded-[20px] font-black text-xs uppercase tracking-widest active:scale-95"
                >
                  Upload New
                </button>
              )}
              
              {!selectedFile && (
                <button 
                  onClick={() => {
                    setSelectedFile(null);
                    setForm(prev => ({ 
                      ...prev, 
                      imagePreview: `https://ui-avatars.com/api/?name=${form.name || form.username || 'U'}&background=e2e8f0&color=475569` 
                    }));
                  }}
                  className="w-full py-4.5 text-red-500 font-bold text-xs uppercase tracking-widest hover:bg-red-50 rounded-[20px] transition-colors"
                >
                  Reset Portrait
                </button>
              )}
              
              <button 
                onClick={() => {
                  setIsPhotoModalOpen(false);
                  if (selectedFile) {
                    setForm(prev => ({ ...prev, imagePreview: getProfileImage(user) }));
                    setSelectedFile(null);
                  }
                }} 
                className="w-full py-4.5 text-gray-400 font-bold text-xs uppercase tracking-widest hover:text-black transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default EditProfile;