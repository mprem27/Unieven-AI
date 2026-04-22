import React, { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import Loader from "../components/Loader";
import { createEvent } from "../services/eventService"; 
import { createPost } from "../services/postService"; // ✅ IMPORTED POST SERVICE FOR AUTO-POST
import { 
  FaCalendarAlt, 
  FaClock, 
  FaMapMarkerAlt, 
  FaAlignLeft, 
  FaTicketAlt, 
  FaImage,
  FaArrowLeft,
  FaCheckCircle,
  FaEdit
} from "react-icons/fa";

function CreateEvent() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  // States
  const [step, setStep] = useState(1); // 1 = Edit, 2 = Preview
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [dragActive, setDragActive] = useState(false);

  // Form Data
  const [formData, setFormData] = useState({
    title: "",
    category: "General",
    date: "",
    time: "",
    location: "",
    description: "",
  });

  const categories = ["General", "Workshop", "Seminar", "Cultural", "Sports", "Technical", "Webinar"];

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // ✅ IMAGE HANDLING
  const processFile = (selectedFile) => {
    if (selectedFile) {
      if (!selectedFile.type.startsWith("image/")) {
        toast.error("Please select a valid image file");
        return;
      }
      setFile(selectedFile);
      setPreview(URL.createObjectURL(selectedFile));
    }
  };

  const handleFileChange = (e) => processFile(e.target.files[0]);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  // ✅ GO TO PREVIEW (Validate first)
  const handleGeneratePreview = () => {
    if (!file) return toast.error("Event poster image is required!");
    if (!formData.title.trim()) return toast.error("Event title is required!");
    if (!formData.date) return toast.error("Event date is required!");
    if (!formData.time) return toast.error("Event time is required!");
    if (!formData.location.trim()) return toast.error("Location is required!");
    
    setStep(2); // Move to ticket preview
  };

  // ✅ SUBMIT TO BACKEND (Creates Event AND Auto-posts to Feed)
  const handleSubmit = async () => {
    setLoading(true);
    try {
      // 1. Prepare Event Data
      const eventData = new FormData();
      eventData.append("image", file);
      eventData.append("title", formData.title);
      eventData.append("category", formData.category);
      eventData.append("date", formData.date);
      eventData.append("time", formData.time);
      eventData.append("location", formData.location);
      eventData.append("description", formData.description);

      // 2. Create the Event
      const eventRes = await createEvent(eventData);
      const newEventId = eventRes?.event?._id || "";

      // 3. Auto-Create a Feed Post for the Event
      const postData = new FormData();
      postData.append("media", file); 
      postData.append("location", formData.location);
      postData.append("isEvent", "true");
      postData.append("eventId", newEventId); // 🔗 Bind Event ID
      postData.append("eventLink", `/events`); // 🔗 Bind Link
      
      // 🎯 PLACE "RSVP" LINK OVERLAY IN TOP RIGHT CORNER OF IMAGE
      postData.append("overlayText", "🎟️ CLICK TO RSVP");
      postData.append("overlayFont", "font-black");
      postData.append("overlayX", "120"); // Offset to the right
      postData.append("overlayY", "-150"); // Offset to the top
      
      // Add category as a tag for the post
      postData.append("tags", JSON.stringify([formData.category.toLowerCase(), "CampusEvent"]));
      
      // 🔗 CAPTION LINK: Beautifully formatted caption with Registration Link
      const postCaption = `🎉 Upcoming Event: ${formData.title}!\n\n📅 Date: ${formData.date}\n⏰ Time: ${formData.time}\n📍 Location: ${formData.location}\n\n${formData.description}\n\n👉 Register & get your ticket here: /events`;
      postData.append("caption", postCaption);

      await createPost(postData);

      toast.success("Event Published & Shared to Feed! 🎉");
      navigate("/events"); // Navigate to events page to view the ticket

    } catch (err) {
      toast.error(err.message || "Failed to create event.");
    } finally {
      setLoading(false);
    }
  };

  const inputStyles = "w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-[14px] focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all shadow-sm text-gray-800";

  return (
    <div className="w-full min-h-screen flex justify-center items-center bg-[#f0f2f5] font-['Poppins',sans-serif] antialiased py-10 px-4">
      
      {/* Container */}
      <div className="w-full max-w-[900px] bg-white rounded-[32px] shadow-xl overflow-hidden flex flex-col relative border border-gray-100 min-h-[600px]">
        
        {/* Header */}
        <div className="h-[60px] flex items-center justify-between px-6 border-b border-gray-100 bg-white z-10 shrink-0">
          <button onClick={() => step === 2 ? setStep(1) : navigate(-1)} className="text-gray-500 hover:text-gray-800 transition-colors">
            <FaArrowLeft size={18} />
          </button>
          <h1 className="font-bold text-[16px] text-gray-900">
            {step === 1 ? "Create New Event" : "Ticket Preview"}
          </h1>
          <div className="w-5"></div> {/* Spacer for centering */}
        </div>

        {/* ================= STEP 1: EDIT MODE ================= */}
        {step === 1 && (
          <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
            
            {/* LEFT: Image Upload */}
            <div 
              className="w-full md:w-2/5 bg-gray-50 p-6 flex flex-col items-center justify-center border-r border-gray-100 relative"
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              {preview ? (
                <div className="relative w-full h-full rounded-2xl overflow-hidden group shadow-md">
                  <img src={preview} alt="Event Poster" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button onClick={() => { setFile(null); setPreview(null); }} className="bg-white text-red-500 font-bold px-4 py-2 rounded-lg shadow-lg">
                      Remove Image
                    </button>
                  </div>
                </div>
              ) : (
                <div 
                  onClick={() => fileInputRef.current.click()}
                  className={`w-full h-full min-h-[300px] border-2 border-dashed rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all ${dragActive ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:bg-gray-100"}`}
                >
                  <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm text-blue-500 mb-4">
                    <FaImage size={24} />
                  </div>
                  <p className="font-bold text-gray-700">Upload Poster</p>
                  <p className="text-xs text-gray-400 mt-1">Drag & drop or click to browse</p>
                </div>
              )}
              <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
            </div>

            {/* RIGHT: Form Details */}
            <div className="w-full md:w-3/5 p-6 md:p-8 flex flex-col overflow-y-auto scrollbar-hide">
              <div className="flex flex-col gap-4 flex-1">
                
                {/* Title & Category */}
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-xs font-bold text-gray-500 uppercase ml-1 mb-1 block">Event Title *</label>
                    <input type="text" name="title" value={formData.title} onChange={handleChange} placeholder="e.g., Tech Symposium 2026" className={inputStyles} />
                  </div>
                  <div className="w-1/3">
                    <label className="text-xs font-bold text-gray-500 uppercase ml-1 mb-1 block">Category</label>
                    <select name="category" value={formData.category} onChange={handleChange} className={inputStyles}>
                      {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>

                {/* Date & Time */}
                <div className="flex gap-3">
                  <div className="flex-1 relative">
                    <label className="text-xs font-bold text-gray-500 uppercase ml-1 mb-1 block">Date *</label>
                    <div className="relative flex items-center">
                      <FaCalendarAlt className="absolute left-3 text-gray-400" />
                      <input type="date" name="date" value={formData.date} onChange={handleChange} className={`${inputStyles} pl-9`} />
                    </div>
                  </div>
                  <div className="flex-1 relative">
                    <label className="text-xs font-bold text-gray-500 uppercase ml-1 mb-1 block">Time *</label>
                    <div className="relative flex items-center">
                      <FaClock className="absolute left-3 text-gray-400" />
                      <input type="time" name="time" value={formData.time} onChange={handleChange} className={`${inputStyles} pl-9`} />
                    </div>
                  </div>
                </div>

                {/* Location */}
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase ml-1 mb-1 block">Location *</label>
                  <div className="relative flex items-center">
                    <FaMapMarkerAlt className="absolute left-3 text-gray-400" />
                    <input type="text" name="location" value={formData.location} onChange={handleChange} placeholder="e.g., Main Auditorium" className={`${inputStyles} pl-9`} />
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase ml-1 mb-1 block">Description</label>
                  <div className="relative">
                    <FaAlignLeft className="absolute left-3 top-4 text-gray-400" />
                    <textarea name="description" value={formData.description} onChange={handleChange} rows="5" placeholder="What is this event about?" className={`${inputStyles} pl-9 resize-none`} />
                  </div>
                </div>

              </div>

              {/* Action Button */}
              <button 
                onClick={handleGeneratePreview}
                className="mt-6 w-full bg-gray-900 hover:bg-black text-white py-3.5 rounded-xl font-bold text-[15px] transition-all shadow-md flex items-center justify-center gap-2 shrink-0"
              >
                <FaTicketAlt /> Preview Campus Event Pass
              </button>
            </div>
          </div>
        )}

        {/* ================= STEP 2: PREVIEW MODE (TICKET STYLE) ================= */}
        {step === 2 && (
          <div className="flex flex-col items-center justify-center flex-1 p-6 bg-gray-50 overflow-y-auto">
            
            {/* TICKET UI */}
            <div className="w-full max-w-[400px] bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col relative transform transition-transform hover:scale-[1.02] duration-300">
              
              {/* Top: Image */}
              <div className="h-[220px] w-full bg-gray-200 relative">
                <img src={preview} alt="Poster" className="w-full h-full object-cover" />
                <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold text-blue-600 shadow-sm uppercase tracking-wide">
                  {formData.category}
                </div>
              </div>

              {/* Ticket Cutout Effect */}
              <div className="relative h-8 bg-white flex items-center justify-between px-[-10px]">
                <div className="w-6 h-6 bg-gray-50 rounded-full absolute -left-3 shadow-inner"></div>
                <div className="w-full border-t-2 border-dashed border-gray-200 mx-4 mt-1"></div>
                <div className="w-6 h-6 bg-gray-50 rounded-full absolute -right-3 shadow-inner"></div>
              </div>

              {/* Bottom: Details */}
              <div className="p-6 pt-2 flex flex-col gap-4">
                <h2 className="text-2xl font-black text-gray-900 leading-tight">{formData.title}</h2>
                
                <div className="flex justify-between items-center bg-blue-50/50 p-3 rounded-xl border border-blue-100/50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center">
                      <FaCalendarAlt />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 font-semibold uppercase">Date</p>
                      <p className="text-sm font-bold text-gray-900">{new Date(formData.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                    </div>
                  </div>
                  <div className="w-[1px] h-8 bg-blue-200"></div>
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="text-xs text-gray-500 font-semibold uppercase text-right">Time</p>
                      <p className="text-sm font-bold text-gray-900">{formData.time}</p>
                    </div>
                    <div className="w-10 h-10 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center">
                      <FaClock />
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3 mt-1">
                  <FaMapMarkerAlt className="text-red-500 mt-1 shrink-0" />
                  <p className="text-sm font-medium text-gray-700">{formData.location}</p>
                </div>

                {formData.description && (
                  <p className="text-sm text-gray-500 mt-2 line-clamp-3 leading-relaxed">
                    {formData.description}
                  </p>
                )}
              </div>
            </div>

            {/* ACTION BUTTONS */}
            <div className="w-full max-w-[400px] mt-8 flex gap-3 shrink-0">
              <button 
                onClick={() => setStep(1)}
                disabled={loading}
                className="flex-1 bg-white border border-gray-300 text-gray-700 py-3.5 rounded-xl font-bold text-[14px] hover:bg-gray-50 transition-colors flex items-center justify-center gap-2 shadow-sm"
              >
                <FaEdit /> Edit
              </button>

              <button 
                onClick={handleSubmit}
                disabled={loading}
                className="flex-[2] bg-blue-600 hover:bg-blue-700 text-white py-3.5 rounded-xl font-bold text-[15px] shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                {loading ? <Loader size="20px" color="#fff" /> : <><FaCheckCircle /> Publish Event</>}
              </button>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}

export default CreateEvent;