import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { updateProfile } from "../services/userService";
import { getProfileImage } from "../utils/getProfileImage";
import API from "../api/axios";
import Loader from "../components/Loader";
import { toast } from "react-toastify";
import { FaChevronDown, FaQuestionCircle, FaCheckCircle, FaTimesCircle } from "react-icons/fa";

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
    isPrivate: false, // ✅ Added Private state
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
      // Parse DOB if it exists (assuming YYYY-MM-DD format from DB)
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
        isPrivate: user.isPrivate || false, // ✅ Set initial Private state
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

    // Show preview immediately in the modal
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
      const data = await updateProfile(formData);
      
      if (data.success !== false) {
        setUser(data.user || data);
        toast.success("Profile photo updated!");
        setIsPhotoModalOpen(false);
        setSelectedFile(null);
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
      formData.append("isPrivate", form.isPrivate); // ✅ Add isPrivate to Payload
      
      if (form.day && form.month && form.year) {
        const numericMonth = monthMap[form.month];
        formData.append("dob", `${form.year}-${numericMonth}-${form.day}`);
      }

      // If they didn't click "Save Photo" in modal but clicked the main save button, upload it anyway
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

  const inputStyles = "w-full bg-[#fafafa] border border-[#dbdbdb] rounded-xl px-4 py-3 text-[15px] focus:bg-white focus:border-[#0095f6] focus:ring-1 focus:ring-[#0095f6] outline-none transition-all duration-300 shadow-sm text-[#262626]";
  const selectStyle = "flex-1 bg-[#fafafa] border border-[#dbdbdb] rounded-xl px-2 py-3 text-[14px] outline-none cursor-pointer hover:bg-white focus:border-[#0095f6] transition-all appearance-none text-center font-medium shadow-sm text-[#262626]";

  return (
    <div className="w-full min-h-screen flex justify-center bg-[#fafafa] text-[#262626] font-[system-ui,-apple-system,BlinkMacSystemFont,'Segoe_UI',Roboto,Helvetica,Arial,sans-serif] antialiased sm:py-10">
      
      <div className="w-full max-w-[650px] bg-white sm:border border-[#dbdbdb] sm:rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.02)] flex flex-col mb-10">
        
        <div className="px-6 sm:px-12 py-10">
          <h2 className="text-[24px] font-bold mb-8 tracking-tight">Edit profile</h2>

          {/* ================= PREMIUM HEADER CARD ================= */}
          <div className="flex items-center justify-between bg-gradient-to-r from-[#f5f5f5] to-[#fafafa] p-4 sm:px-6 sm:py-5 rounded-2xl mb-10 border border-[#efefef] shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-[56px] h-[56px] rounded-full overflow-hidden bg-white border-2 border-white shadow-sm ring-1 ring-gray-100">
                <img src={form.imagePreview} className="w-full h-full object-cover" alt="Profile" />
              </div>
              <div className="flex flex-col justify-center">
                <p className="font-bold text-[16px] leading-tight">{form.username}</p>
                <p className="text-[14px] text-[#737373] mt-0.5">{form.name}</p>
              </div>
            </div>

            <button
              onClick={() => setIsPhotoModalOpen(true)}
              className="bg-[#0095f6] hover:bg-[#1877f2] text-white px-5 py-2 rounded-xl text-sm font-semibold transition-all shadow-md active:scale-95"
            >
              Change photo
            </button>
          </div>

          {/* ================= STACKED FORM FIELDS ================= */}
          <div className="flex flex-col gap-8">

            {/* NAME */}
            <div>
              <label className="block font-bold text-[15px] mb-2 text-gray-800">Name</label>
              <input name="name" value={form.name} onChange={handleChange} placeholder="Name" className={inputStyles} />
              <p className="text-[12px] text-[#8e8e8e] mt-2 leading-relaxed pl-1">
                Help people discover your account by using the name you're known by.
              </p>
            </div>

            {/* USERNAME W/ LIVE CHECKER */}
            <div>
              <label className="block font-bold text-[15px] mb-2 text-gray-800">Username</label>
              <div className="relative">
                <input 
                  name="username" 
                  value={form.username} 
                  onChange={handleUsernameChange} 
                  placeholder="Username" 
                  className={`${inputStyles} pr-10 ${usernameError ? 'border-red-400' : ''}`} 
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {checkingUsername ? (
                    <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                  ) : usernameAvailable ? (
                    <FaCheckCircle className="text-[#00a400]" size={16} />
                  ) : usernameError ? (
                    <FaTimesCircle className="text-[#fa3e3e]" size={16} />
                  ) : null}
                </div>
              </div>
              {usernameError && <p className="text-[12px] text-[#fa3e3e] mt-2 font-bold ml-1">{usernameError}</p>}
            </div>

            {/* BIO */}
            <div>
              <label className="block font-bold text-[15px] mb-2 text-gray-800">Bio</label>
              <div className="relative">
                <textarea name="bio" value={form.bio} onChange={handleChange} rows="3" maxLength="150" placeholder="Write something about yourself..." className={`${inputStyles} resize-none pb-8`} />
                <span className="absolute bottom-3 right-4 text-[12px] text-[#a8a8a8] font-medium bg-white px-1">
                  {form.bio.length} / 150
                </span>
              </div>
            </div>

            {/* CUSTOM GENDER DROPDOWN */}
            <div>
              <label className="block font-bold text-[15px] mb-2 text-gray-800">Gender</label>
              <div className="relative">
                <div 
                  onClick={() => setIsGenderOpen(!isGenderOpen)}
                  className={`${inputStyles} flex justify-between items-center cursor-pointer select-none bg-white hover:bg-gray-50`}
                >
                  <span>{form.gender}</span>
                  <FaChevronDown className={`text-[#8e8e8e] text-xs transition-transform duration-300 ${isGenderOpen ? "rotate-180" : ""}`} />
                </div>
                
                {isGenderOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setIsGenderOpen(false)} />
                    <div className="absolute top-full left-0 w-full mt-2 bg-white border border-[#dbdbdb] rounded-xl shadow-lg z-20 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                      {genderOptions.map((opt) => (
                        <div
                          key={opt}
                          onClick={() => {
                            setForm({ ...form, gender: opt });
                            setIsGenderOpen(false);
                          }}
                          className={`px-4 py-3 hover:bg-[#f5f5f5] cursor-pointer text-[15px] transition-colors ${form.gender === opt ? "font-bold text-[#0095f6]" : "text-[#262626]"}`}
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
            <div>
              <div className="flex items-center gap-2 mb-2 ml-1">
                 <label className="text-[15px] font-bold text-gray-800 tracking-tight">Date of Birth</label>
                 <FaQuestionCircle className="text-gray-400 text-[10px]" title="This won't be a part of your public profile." />
              </div>
              <div className="flex gap-3 relative">
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
              <p className="text-[12px] text-[#8e8e8e] mt-2 leading-relaxed pl-1">
                This won't be a part of your public profile.
              </p>
            </div>

            {/* 🔥 PRIVATE ACCOUNT TOGGLE (Hides if Faculty) */}
            {!isFaculty && (
              <div className="border-t border-gray-200 pt-6 mt-2">
                <div className="flex items-center justify-between">
                  <div className="pr-4">
                    <label className="block font-bold text-[15px] mb-1 text-gray-800">Private Account</label>
                    <p className="text-[12px] text-[#8e8e8e] leading-relaxed">
                      When your account is private, only people you approve can see your photos and videos.
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
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#0095f6]"></div>
                  </label>
                </div>
              </div>
            )}

            {/* SUBMIT BUTTON */}
            <div className="flex justify-end mt-4">
              <button
                onClick={handleSubmit}
                disabled={saving || !usernameAvailable}
                className="bg-[#0095f6] hover:bg-[#1877f2] text-white px-10 py-3 rounded-xl font-bold text-[15px] transition-all duration-300 disabled:opacity-50 w-full sm:w-auto flex justify-center items-center h-[48px] shadow-md active:scale-95"
              >
                {saving ? <Loader size="20px" color="#ffffff" /> : "Save Changes"}
              </button>
            </div>

          </div>
        </div>
      </div>

      {/* ================= PHOTO MODAL ================= */}
      {isPhotoModalOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-md transition-all">
          <div className="bg-white/90 backdrop-blur-2xl rounded-3xl w-full max-w-[400px] flex flex-col overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-white/60 animate-in zoom-in-95 duration-300">
            
            <div className="py-6 text-center border-b border-gray-200/50">
              <h3 className="text-[18px] font-bold text-[#262626]">Change Profile Photo</h3>
            </div>

            <div className="flex flex-col items-center py-8 bg-gradient-to-b from-transparent to-gray-50/50">
              <div 
                className="w-[140px] h-[140px] rounded-full overflow-hidden border-[3px] border-white shadow-lg relative group cursor-pointer" 
                onClick={() => fileInputRef.current.click()}
              >
                <img src={form.imagePreview} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt="preview" />
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/40 backdrop-blur-sm transition-all duration-300 text-white text-sm font-bold tracking-wide">
                  Browse Files
                </div>
              </div>
            </div>
            
            <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={handleFileSelect} />

            <div className="flex flex-col">
              {selectedFile ? (
                <button 
                  onClick={handleSavePhoto} 
                  disabled={savingPhoto}
                  className="py-4 text-[15px] font-bold text-[#0095f6] border-t border-gray-200/50 hover:bg-blue-50 transition-colors flex justify-center items-center"
                >
                  {savingPhoto ? <Loader size="16px" color="#0095f6" /> : "Save Photo"}
                </button>
              ) : (
                <button 
                  onClick={() => fileInputRef.current.click()} 
                  className="py-4 text-[15px] font-bold text-[#0095f6] border-t border-gray-200/50 hover:bg-blue-50 transition-colors"
                >
                  Upload New Photo
                </button>
              )}
              
              {!selectedFile && (
                <button 
                  onClick={() => {
                    setSelectedFile(null);
                    setForm(prev => ({ ...prev, imagePreview: "https://via.placeholder.com/150" }));
                  }}
                  className="py-4 text-[15px] font-bold text-[#ed4956] border-t border-gray-200/50 hover:bg-red-50 transition-colors"
                >
                  Remove Current Photo
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
                className="py-4 text-[15px] font-medium text-gray-600 border-t border-gray-200/50 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

export default EditProfile;