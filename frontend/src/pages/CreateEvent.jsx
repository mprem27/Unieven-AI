import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import Loader from "../components/Loader";
import { createEvent } from "../services/eventService"; 
import { createPost } from "../services/postService";
import { 
  FaCalendarAlt, FaClock, FaMapMarkerAlt, FaAlignLeft, 
  FaImage, FaArrowLeft, FaCheckCircle, 
  FaEdit, FaTags, FaUsers, FaTicketAlt
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

  // Form Data (Added Capacity and Price/Type)
  const [formData, setFormData] = useState({
    title: "",
    category: "Workshop",
    date: "",
    time: "",
    location: "",
    capacity: "",
    priceType: "Free",
    description: "",
  });

  const categories = ["Workshop", "Seminar", "Cultural", "Sports", "Technical", "Webinar", "Meetup", "Networking"];
  const priceTypes = ["Free", "Paid", "Invite Only", "Registration Required"];

  // Prevent Memory Leaks from object URLs
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
    
    if (!formData.title || !formData.date || !formData.time || !formData.location) {
      return toast.error("Please fill all required fields!");
    }
    
    setStep(2);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const eventData = new FormData();
      Object.keys(formData).forEach(key => eventData.append(key, formData[key]));
      eventData.append("image", file);

      const eventRes = await createEvent(eventData);
      const newEventId = eventRes?.event?._id || "";

      // Auto-generate a beautiful caption for the feed
      const capacityText = formData.capacity ? `👥 Capacity: ${formData.capacity} Seats` : "👥 Open to All";
      const captionText = `🔥 NEW EVENT: ${formData.title}\n\n📍 ${formData.location}\n📅 ${formData.date} at ${formData.time}\n🎟️ Entry: ${formData.priceType}\n${capacityText}\n\n${formData.description}`;

      const postData = new FormData();
      postData.append("media", file);
      postData.append("isEvent", "true");
      postData.append("eventId", newEventId);
      postData.append("caption", captionText);
      
      await createPost(postData);

      toast.success("Event & Digital Pass Published! 🎉");
      
      // Tell the rest of the app to refresh data
      window.dispatchEvent(new Event("profileUpdated"));
      navigate("/events");
    } catch (err) {
      toast.error("Failed to publish event.");
    } finally {
      setLoading(false);
    }
  };

  const inputClasses = "w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5 text-sm focus:bg-white focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all duration-200 font-semibold text-slate-900 placeholder:font-medium placeholder:text-slate-400";

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center py-6 sm:py-12 px-4 font-['-apple-system','BlinkMacSystemFont','Segoe_UI','Roboto','Helvetica','Arial',sans-serif] antialiased">
      
      <div className="w-full max-w-5xl bg-white rounded-[32px] md:rounded-[48px] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden flex flex-col">
        
        {/* Navigation Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white/80 backdrop-blur-md sticky top-0 z-20">
          <button onClick={() => step === 2 ? setStep(1) : navigate(-1)} className="p-3.5 hover:bg-slate-100 rounded-2xl transition-all active:scale-90 text-slate-500 hover:text-slate-900">
            <FaArrowLeft size={16} />
          </button>
          <div className="flex flex-col items-center">
            <h1 className="text-xl font-black text-slate-900 tracking-tight">Event Studio</h1>
            <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-indigo-500 mt-1">{step === 1 ? "Creation Mode" : "Verification Mode"}</p>
          </div>
          <div className="w-10"></div>
        </div>

        {step === 1 ? (
          <div className="flex flex-col lg:flex-row">
            {/* Visual Section: Poster Upload */}
            <div className="w-full lg:w-[45%] p-6 sm:p-10 bg-slate-50/50 border-r border-slate-100">
              <label className="text-xs font-bold uppercase tracking-[0.15em] text-slate-400 mb-4 block">Event Poster</label>
              
              <div 
                onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                onDragLeave={() => setDragActive(false)}
                onDrop={(e) => { e.preventDefault(); processFile(e.dataTransfer.files[0]); }}
                onClick={() => fileInputRef.current.click()}
                className={`aspect-[4/5] rounded-[32px] border-2 border-dashed transition-all duration-300 flex flex-col items-center justify-center cursor-pointer overflow-hidden relative group ${dragActive ? "border-indigo-500 bg-indigo-50" : "border-slate-200 hover:border-indigo-400 bg-white hover:shadow-2xl hover:shadow-indigo-500/10"}`}
              >
                {preview ? (
                  <>
                    <img src={preview} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" alt="Preview" />
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center">
                       <span className="bg-white text-slate-900 px-6 py-3 rounded-2xl font-bold text-xs shadow-xl flex items-center gap-2">
                         <FaImage /> Change Poster
                       </span>
                    </div>
                  </>
                ) : (
                  <div className="text-center p-8">
                    <div className="w-20 h-20 bg-indigo-50 text-indigo-500 rounded-[28px] flex items-center justify-center mx-auto mb-6 shadow-xl shadow-indigo-500/10 animate-pulse">
                      <FaImage size={32} />
                    </div>
                    <p className="font-bold text-slate-800 text-lg">Drop Poster Here</p>
                    <p className="text-[11px] text-slate-400 mt-2 font-medium tracking-wide uppercase opacity-80">High-Res PNG or JPG preferred</p>
                  </div>
                )}
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
            <div className="w-full lg:w-[55%] p-6 sm:p-10 space-y-6">
              <section className="space-y-3">
                <label className="text-[11px] font-bold uppercase tracking-[0.1em] text-indigo-500 ml-1">Basic Info</label>
                <input name="title" placeholder="What's the event name?" className={inputClasses} value={formData.title} onChange={handleChange} />
                <div className="relative">
                  <FaTags className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <select name="category" className={`${inputClasses} pl-12 appearance-none`} value={formData.category} onChange={handleChange}>
                    {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>
              </section>

              <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 ml-1">Event Date</label>
                  <div className="relative">
                    <FaCalendarAlt className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input type="date" name="date" className={`${inputClasses} pl-12`} value={formData.date} onChange={handleChange} />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 ml-1">Start Time</label>
                  <div className="relative">
                    <FaClock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input type="time" name="time" className={`${inputClasses} pl-12`} value={formData.time} onChange={handleChange} />
                  </div>
                </div>
              </section>

              <section className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 ml-1">Venue Location</label>
                <div className="relative">
                  <FaMapMarkerAlt className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input name="location" placeholder="e.g., Campus Main Hall" className={`${inputClasses} pl-12`} value={formData.location} onChange={handleChange} />
                </div>
              </section>

              {/* 🔥 NEW SECTION: Ticket Type & Capacity */}
              <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 ml-1">Entry Type</label>
                  <div className="relative">
                    <FaTicketAlt className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <select name="priceType" className={`${inputClasses} pl-12 appearance-none`} value={formData.priceType} onChange={handleChange}>
                      {priceTypes.map(type => <option key={type} value={type}>{type}</option>)}
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 ml-1">Capacity (Optional)</label>
                  <div className="relative">
                    <FaUsers className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input type="number" name="capacity" placeholder="Leave blank for unlimited" min="1" className={`${inputClasses} pl-12`} value={formData.capacity} onChange={handleChange} />
                  </div>
                </div>
              </section>

              <section className="space-y-2 pt-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 ml-1">About the Event</label>
                <div className="relative">
                  <FaAlignLeft className="absolute left-4 top-5 text-slate-400" />
                  <textarea name="description" rows="4" placeholder="Briefly describe what attendees can expect..." className={`${inputClasses} pl-12 resize-none min-h-[120px]`} value={formData.description} onChange={handleChange}></textarea>
                </div>
              </section>

              <button onClick={handleGeneratePreview} className="w-full bg-slate-900 hover:bg-black text-white py-4.5 rounded-2xl font-bold text-sm tracking-wide shadow-lg shadow-slate-900/20 transition-all active:scale-[0.98] mt-4 flex items-center justify-center gap-2">
                Generate Digital Pass <FaArrowLeft className="rotate-180" />
              </button>
            </div>
          </div>
        ) : (
          /* ================= STEP 2: PREMIUM PASS PREVIEW ================= */
          <div className="p-6 sm:p-16 bg-slate-50 flex flex-col items-center">
            
            {/* Digital Wallet Style Ticket */}
            <div className="w-full max-w-[400px] bg-white rounded-[32px] shadow-2xl overflow-hidden relative border border-slate-100 transition-transform duration-500 hover:-translate-y-1">
              
              {/* Poster Top */}
              <div className="h-[300px] relative">
                <img src={preview} className="w-full h-full object-cover" alt="Final" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
                <div className="absolute top-4 left-4 bg-white/20 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/20">
                  <span className="text-white text-[10px] font-bold uppercase tracking-widest">{formData.category}</span>
                </div>
                <div className="absolute bottom-4 right-4 bg-indigo-600 px-3 py-1.5 rounded-xl shadow-lg">
                  <span className="text-white text-[10px] font-black uppercase tracking-widest">{formData.priceType}</span>
                </div>
              </div>

              {/* Physical Perforation Simulation */}
              <div className="relative h-8 flex items-center">
                <div className="absolute -left-4 w-8 h-8 rounded-full bg-slate-50 border border-slate-100 shadow-inner"></div>
                <div className="w-full border-b-2 border-dashed border-slate-200 mx-5 opacity-70"></div>
                <div className="absolute -right-4 w-8 h-8 rounded-full bg-slate-50 border border-slate-100 shadow-inner"></div>
              </div>

              {/* Pass Info */}
              <div className="p-8 pt-2">
                <h2 className="text-2xl font-black text-slate-900 leading-tight mb-6 tracking-tight line-clamp-2">{formData.title}</h2>
                
                <div className="flex flex-col gap-5">
                  {/* Time & Date Block */}
                  <div className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <div className="flex flex-col">
                       <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mb-1">Date</span>
                       <span className="text-sm font-bold text-slate-800 flex items-center gap-1.5"><FaCalendarAlt className="text-indigo-500"/> {formData.date}</span>
                    </div>
                    <div className="h-8 w-[1px] bg-slate-200"></div>
                    <div className="flex flex-col items-end">
                       <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mb-1">Time</span>
                       <span className="text-sm font-bold text-slate-800 flex items-center gap-1.5">{formData.time} <FaClock className="text-indigo-500"/></span>
                    </div>
                  </div>

                  {/* Location & Capacity */}
                  <div className="flex items-start justify-between gap-4 px-1">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-red-50 rounded-full flex items-center justify-center shrink-0">
                         <FaMapMarkerAlt className="text-red-500" size={12} />
                      </div>
                      <p className="text-xs font-bold text-slate-700 leading-snug line-clamp-2 max-w-[180px]">{formData.location}</p>
                    </div>
                    
                    {formData.capacity && (
                      <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-lg shrink-0">
                        <FaUsers className="text-slate-500" size={12}/>
                        <span className="text-xs font-bold text-slate-600">{formData.capacity} Max</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Barcode/Unique ID Section */}
                <div className="mt-8 pt-6 border-t border-slate-100 flex flex-col items-center">
                   <div className="w-full h-12 flex items-center justify-center opacity-60 mix-blend-multiply group cursor-pointer">
                      <div className="flex gap-1 items-end">
                         {[...Array(24)].map((_,i) => <div key={i} className={`w-[2px] bg-slate-800 ${i % 3 === 0 ? 'h-8' : i % 2 === 0 ? 'h-6' : 'h-5'}`}></div>)}
                         <span className="text-[10px] font-bold text-slate-800 mx-3 tracking-[0.2em]">PASS-{Math.floor(Math.random()*10000)}</span>
                         {[...Array(24)].map((_,i) => <div key={i} className={`w-[2px] bg-slate-800 ${i % 2 === 0 ? 'h-5' : i % 3 === 0 ? 'h-8' : 'h-6'}`}></div>)}
                      </div>
                   </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 mt-10 w-full max-w-[400px]">
              <button onClick={() => setStep(1)} className="flex-1 bg-white text-slate-700 border border-slate-200 py-3.5 rounded-xl font-bold text-xs tracking-wide hover:bg-slate-50 transition-all flex items-center justify-center gap-2">
                <FaEdit /> Edit Details
              </button>
              <button onClick={handleSubmit} disabled={loading} className="flex-[2] bg-indigo-600 hover:bg-indigo-700 text-white py-3.5 rounded-xl font-bold text-xs tracking-wide shadow-lg shadow-indigo-600/20 active:scale-95 transition-all flex items-center justify-center gap-2">
                {loading ? <Loader size="16px" color="#fff" /> : <><FaCheckCircle /> Publish Event</>}
              </button>
            </div>
            
            <p className="mt-6 text-[10px] text-slate-400 font-semibold text-center uppercase tracking-widest">
              Event will automatically be shared to feed
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default CreateEvent;