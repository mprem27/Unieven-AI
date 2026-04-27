import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import Loader from "../components/Loader";
import { createEvent } from "../services/eventService"; 
import { createPost } from "../services/postService";
import { 
  FaCalendarAlt, FaClock, FaMapMarkerAlt, FaAlignLeft, 
  FaImage, FaArrowLeft, FaCheckCircle, 
  FaEdit, FaTags
} from "react-icons/fa";

function CreateEvent() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  // States
  const [step, setStep] = useState(1); 
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [dragActive, setDragActive] = useState(false);

  // Form Data
  const [formData, setFormData] = useState({
    title: "",
    category: "Workshop",
    date: "",
    time: "",
    location: "",
    description: "",
  });

  const categories = ["Workshop", "Seminar", "Cultural", "Sports", "Technical", "Webinar", "Meetup"];

  // 🔥 FIX 1: Prevent Memory Leaks from object URLs
  useEffect(() => {
    return () => {
      if (preview) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const processFile = (selectedFile) => {
    if (selectedFile && selectedFile.type.startsWith("image/")) {
      setFile(selectedFile);
      setPreview(URL.createObjectURL(selectedFile));
    } else {
      toast.error("Please upload a valid image (PNG/JPG)");
    }
  };

  const handleGeneratePreview = () => {
    if (!file) return toast.error("Please upload an event poster!");
    
    // 🔥 FIX 2: Added 'time' to strict validation
    if (!formData.title || !formData.date || !formData.time || !formData.location) {
      return toast.error("Please fill all required fields!");
    }
    
    setStep(2);
    window.scrollTo(0, 0);
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const eventData = new FormData();
      Object.keys(formData).forEach(key => eventData.append(key, formData[key]));
      eventData.append("image", file);

      const eventRes = await createEvent(eventData);
      const newEventId = eventRes?.event?._id || "";

      const postData = new FormData();
      postData.append("media", file);
      postData.append("isEvent", "true");
      postData.append("eventId", newEventId);
      postData.append("caption", `🔥 NEW EVENT: ${formData.title}\n\n📍 ${formData.location}\n📅 ${formData.date} at ${formData.time}\n\n${formData.description}`);
      
      await createPost(postData);

      toast.success("UniEven Pass Published! 🎉");
      
      // Tell the rest of the app to refresh data
      window.dispatchEvent(new Event("profileUpdated"));
      navigate("/events");
    } catch (err) {
      toast.error("Failed to publish event.");
    } finally {
      setLoading(false);
    }
  };

  const inputClasses = "w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3.5 text-sm focus:bg-white focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 outline-none transition-all duration-200 font-bold text-gray-900 placeholder:font-medium placeholder:text-gray-400";

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center py-6 sm:py-12 px-4 font-['Poppins'] antialiased">
      
      <div className="w-full max-w-5xl bg-white rounded-[48px] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] border border-white overflow-hidden flex flex-col">
        
        {/* Navigation Header */}
        <div className="p-6 border-b border-gray-50 flex items-center justify-between bg-white/80 backdrop-blur-md sticky top-0 z-20">
          <button onClick={() => step === 2 ? setStep(1) : navigate(-1)} className="p-3.5 hover:bg-gray-100 rounded-2xl transition-all active:scale-90 text-gray-500 hover:text-black">
            <FaArrowLeft size={16} />
          </button>
          <div className="flex flex-col items-center">
            <h1 className="text-xl font-black text-gray-900 tracking-tight">UniEven Studio</h1>
            <p className="text-[9px] uppercase tracking-[0.3em] font-black text-blue-500">{step === 1 ? "Creation Mode" : "Verification Mode"}</p>
          </div>
          <div className="w-10"></div>
        </div>

        {step === 1 ? (
          <div className="flex flex-col lg:flex-row">
            {/* Visual Section: Poster Upload */}
            <div className="w-full lg:w-[45%] p-8 sm:p-10 bg-gray-50/50 border-r border-gray-100">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-4 block">Poster Design</label>
              
              <div 
                onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                onDragLeave={() => setDragActive(false)}
                onDrop={(e) => { e.preventDefault(); processFile(e.dataTransfer.files[0]); }}
                onClick={() => fileInputRef.current.click()}
                className={`aspect-[4/5] rounded-[36px] border-2 border-dashed transition-all duration-300 flex flex-col items-center justify-center cursor-pointer overflow-hidden relative group ${dragActive ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-blue-400 bg-white hover:shadow-2xl hover:shadow-blue-500/5"}`}
              >
                {preview ? (
                  <>
                    <img src={preview} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" alt="Preview" />
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-[4px] opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center">
                       <span className="bg-white text-black px-8 py-3 rounded-2xl font-black text-xs shadow-2xl">CHANGE POSTER</span>
                    </div>
                  </>
                ) : (
                  <div className="text-center p-8">
                    <div className="w-20 h-20 bg-blue-50 text-blue-500 rounded-[28px] flex items-center justify-center mx-auto mb-6 shadow-xl shadow-blue-500/5 animate-pulse">
                      <FaImage size={32} />
                    </div>
                    <p className="font-black text-gray-800 text-lg">Drop Poster Here</p>
                    <p className="text-[11px] text-gray-400 mt-2 font-bold tracking-wider uppercase opacity-60">High-Res PNG or JPG preferred</p>
                  </div>
                )}
                {/* 🔥 FIX 3: Safe File Input (resets value so onChange always triggers) */}
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept="image/*"
                  onClick={(e) => (e.target.value = null)}
                  onChange={(e) => processFile(e.target.files[0])} 
                />
              </div>
            </div>

            {/* Content Section: Details */}
            <div className="w-full lg:w-[55%] p-8 sm:p-12 space-y-8">
              <section className="space-y-4">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-500">Event Pass Info</label>
                <input name="title" placeholder="What's the event name?" className={inputClasses} value={formData.title} onChange={handleChange} />
                <div className="relative">
                  <FaTags className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" />
                  <select name="category" className={`${inputClasses} pl-12 appearance-none`} value={formData.category} onChange={handleChange}>
                    {categories.map(cat => <option key={cat}>{cat}</option>)}
                  </select>
                </div>
              </section>

              <section className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 ml-2">Event Date</label>
                  <div className="relative">
                    <FaCalendarAlt className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" />
                    <input type="date" name="date" className={`${inputClasses} pl-12`} value={formData.date} onChange={handleChange} />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 ml-2">Start Time</label>
                  <div className="relative">
                    <FaClock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" />
                    <input type="time" name="time" className={`${inputClasses} pl-12`} value={formData.time} onChange={handleChange} />
                  </div>
                </div>
              </section>

              <section className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 ml-2">Venue Location</label>
                <div className="relative">
                  <FaMapMarkerAlt className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" />
                  <input name="location" placeholder="e.g., Campus Main Hall" className={`${inputClasses} pl-12`} value={formData.location} onChange={handleChange} />
                </div>
              </section>

              <section className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 ml-2">About the Vibe</label>
                <div className="relative">
                  <FaAlignLeft className="absolute left-4 top-5 text-gray-300" />
                  <textarea name="description" rows="4" placeholder="Briefly describe the event..." className={`${inputClasses} pl-12 resize-none min-h-[100px]`} value={formData.description} onChange={handleChange}></textarea>
                </div>
              </section>

              <button onClick={handleGeneratePreview} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-5 rounded-[24px] font-black text-xs tracking-[0.2em] shadow-2xl shadow-blue-200 transition-all active:scale-[0.98] uppercase">
                Generate Event Pass
              </button>
            </div>
          </div>
        ) : (
          /* ================= STEP 2: PREMIUM PASS PREVIEW ================= */
          <div className="p-10 sm:p-20 bg-gray-50 flex flex-col items-center">
            <div className="w-full max-w-[420px] bg-white rounded-[44px] shadow-[0_40px_80px_-15px_rgba(0,0,0,0.1)] overflow-hidden relative border border-gray-100 transition-transform duration-500 hover:translate-y-[-5px]">
              
              {/* Poster Top */}
              <div className="h-[320px] relative">
                <img src={preview} className="w-full h-full object-cover" alt="Final" />
                <div className="absolute top-5 left-5 bg-black/40 backdrop-blur-xl px-4 py-2 rounded-2xl border border-white/20">
                  <span className="text-white text-[10px] font-black uppercase tracking-widest">{formData.category}</span>
                </div>
              </div>

              {/* Physical Perforation Simulation */}
              <div className="relative h-10 flex items-center">
                <div className="absolute -left-6 w-12 h-12 rounded-full bg-[#f8fafc] border border-gray-100 shadow-inner"></div>
                <div className="w-full border-b-2 border-dashed border-gray-100 mx-4 opacity-50"></div>
                <div className="absolute -right-6 w-12 h-12 rounded-full bg-[#f8fafc] border border-gray-100 shadow-inner"></div>
              </div>

              {/* Pass Info */}
              <div className="p-10 pt-4">
                <h2 className="text-3xl font-black text-gray-900 leading-tight mb-8 tracking-tight">{formData.title}</h2>
                
                <div className="flex flex-col gap-6">
                  <div className="flex justify-between items-center bg-gray-50 p-4 rounded-3xl border border-gray-100/50">
                    <div className="flex items-center gap-3">
                       <FaCalendarAlt className="text-blue-500" />
                       <span className="text-[13px] font-black text-gray-800 uppercase">{formData.date}</span>
                    </div>
                    <div className="h-4 w-[1px] bg-gray-200"></div>
                    <div className="flex items-center gap-3">
                       <FaClock className="text-purple-500" />
                       <span className="text-[13px] font-black text-gray-800 uppercase">{formData.time}</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-4 px-2">
                    <div className="w-8 h-8 bg-blue-50 rounded-full flex items-center justify-center shrink-0">
                       <FaMapMarkerAlt className="text-blue-600" size={14} />
                    </div>
                    <p className="text-[13px] font-bold text-gray-600 leading-snug">{formData.location}</p>
                  </div>
                </div>

                {/* Barcode/Unique ID Section */}
                <div className="mt-10 pt-8 border-t border-gray-50 flex flex-col items-center">
                   <div className="w-full h-14 bg-neutral-50 rounded-2xl flex items-center justify-center border border-neutral-100 overflow-hidden group">
                      <div className="flex gap-1.5 items-end transition-all group-hover:gap-2">
                         {[...Array(20)].map((_,i) => <div key={i} className={`w-[1px] bg-neutral-300 ${i % 3 === 0 ? 'h-6' : 'h-4'}`}></div>)}
                         <span className="text-[9px] font-black text-neutral-400 mx-2 tracking-widest">#{Math.floor(Math.random()*1000000)}</span>
                         {[...Array(20)].map((_,i) => <div key={i} className={`w-[1px] bg-neutral-300 ${i % 2 === 0 ? 'h-4' : 'h-6'}`}></div>)}
                      </div>
                   </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 mt-12 w-full max-w-[420px]">
              <button onClick={() => setStep(1)} className="flex-1 bg-white text-gray-900 border-2 border-gray-100 py-4.5 rounded-[28px] font-black text-xs tracking-widest hover:bg-gray-50 transition-all flex items-center justify-center gap-2">
                <FaEdit /> RE-EDIT
              </button>
              <button onClick={handleSubmit} disabled={loading} className="flex-[2] bg-gray-900 hover:bg-black text-white py-4.5 rounded-[28px] font-black text-xs tracking-[0.2em] shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-3">
                {loading ? <Loader size="20px" color="#fff" /> : <><FaCheckCircle /> PUBLISH & POST</>}
              </button>
            </div>
            
            <p className="mt-8 text-[9px] text-gray-400 font-bold text-center uppercase tracking-[0.3em] leading-relaxed">
              Auto-shared to feed • Powered by UniEven Studio 2026
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default CreateEvent;