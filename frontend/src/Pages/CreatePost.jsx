import React, { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { createPost } from "../services/postService";
import { getProfileImage } from "../utils/getProfileImage";
import Loader from "../components/Loader";
import { toast } from "react-toastify";
import { 
  FaMapMarkerAlt, 
  FaHashtag, 
  FaArrowLeft,
  FaImages,
  FaFont
} from "react-icons/fa";

function CreatePost() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  // States
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  // Form Data States
  const [caption, setCaption] = useState("");
  const [overlayText, setOverlayText] = useState("");
  const [overlayFont, setOverlayFont] = useState("font-sans");
  const [location, setLocation] = useState("");
  const [tags, setTags] = useState("");

  // 🔥 DRAGGABLE TEXT STATES
  const [textPos, setTextPos] = useState({ x: 0, y: 0 });
  const [isDraggingText, setIsDraggingText] = useState(false);
  const dragRef = useRef({ startX: 0, startY: 0 });

  const fontOptions = [
    { label: "Classic", value: "font-sans" },
    { label: "Serif", value: "font-serif" },
    { label: "Typewriter", value: "font-mono" },
    { label: "Cursive", value: "font-[cursive]" },
    { label: "Impact", value: "font-['Impact']" }
  ];

  // ✅ HANDLE FILE PROCESSING
  const processFile = (selectedFile) => {
    if (selectedFile) {
      if (!selectedFile.type.startsWith("image/")) {
        toast.error("Please select an image file");
        return;
      }
      setFile(selectedFile);
      setPreview(URL.createObjectURL(selectedFile));
      setTextPos({ x: 0, y: 0 }); // Reset text position for new image
    }
  };

  const handleFileChange = (e) => processFile(e.target.files[0]);

  // ✅ DRAG AND DROP IMAGE HANDLERS
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

  // 🔥 DRAGGABLE TEXT HANDLERS
  const handlePointerDown = (e) => {
    setIsDraggingText(true);
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    dragRef.current = {
      startX: clientX - textPos.x,
      startY: clientY - textPos.y,
    };
  };

  const handlePointerMove = (e) => {
    if (!isDraggingText) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    setTextPos({
      x: clientX - dragRef.current.startX,
      y: clientY - dragRef.current.startY,
    });
  };

  const handlePointerUp = () => {
    setIsDraggingText(false);
  };

  // ✅ RESET FORM
  const handleDiscard = () => {
    setFile(null);
    setPreview(null);
    setCaption("");
    setOverlayText(""); 
    setLocation("");
    setTags("");
    setTextPos({ x: 0, y: 0 });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ✅ SUBMIT TO BACKEND
  const handleSubmit = async () => {
    if (!file) return toast.error("Please select an image to post!");

    setLoading(true);
    try {
      const formData = new FormData();
      
      formData.append("media", file); 
      formData.append("caption", caption);
      
      if (location.trim()) formData.append("location", location);
      
      if (tags.trim()) {
        const formattedTags = tags.split(",").map((t) => t.trim()).filter((t) => t !== "");
        formData.append("tags", JSON.stringify(formattedTags));
      }
      
      if (overlayText.trim()) {
        formData.append("overlayText", overlayText);
        formData.append("overlayFont", overlayFont); 
        formData.append("overlayX", textPos.x);
        formData.append("overlayY", textPos.y);
      }

      await createPost(formData);
      toast.success("Post shared successfully!");
      navigate("/profile");

    } catch (err) {
      toast.error(err.message || "Failed to share post.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full min-h-screen flex justify-center items-center bg-[#fafafa] font-['system-ui',-apple-system,sans-serif] antialiased p-4">
      
      {/* INSTAGRAM STYLE MODAL CONTAINER */}
      <div className="w-full max-w-[850px] bg-white rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-gray-200 flex flex-col overflow-hidden h-[650px]">
        
        {/* === HEADER === */}
        <div className="h-[42px] border-b border-gray-200 flex items-center justify-between px-4 shrink-0 bg-white">
          <div className="w-16 flex items-center">
            {preview && (
              <button onClick={handleDiscard} className="text-gray-800 hover:text-gray-500 transition-colors p-1">
                <FaArrowLeft size={18} />
              </button>
            )}
          </div>
          
          <h1 className="font-semibold text-[16px] text-gray-900 tracking-tight">Create new post</h1>
          
          <div className="w-16 flex justify-end">
            {preview && (
              <button 
                onClick={handleSubmit} 
                disabled={loading}
                className="text-[#0095f6] hover:text-[#00376b] font-semibold text-[14px] transition-colors disabled:opacity-50"
              >
                {loading ? <Loader size="14px" color="#0095f6" /> : "Share"}
              </button>
            )}
          </div>
        </div>

        {/* === BODY === */}
        <div 
          className="flex-1 flex flex-col md:flex-row overflow-hidden relative bg-white"
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          
          {!preview ? (
            /* UPLOAD UI (Centered) */
            <div className="flex flex-col items-center justify-center w-full h-full text-center px-6">
              <FaImages size={64} className={`mb-4 transition-all duration-300 ${dragActive ? "text-blue-500 scale-110" : "text-gray-800"}`} />
              <h2 className="text-[20px] font-medium text-gray-800 mb-6 tracking-tight">Drag photos and videos here</h2>
              <button 
                onClick={() => fileInputRef.current.click()}
                className="bg-[#0095f6] hover:bg-[#1877f2] text-white px-6 py-1.5 rounded-lg font-semibold text-[14px] transition-colors"
              >
                Select from computer
              </button>
              <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
            </div>

          ) : (

            /* SPLIT VIEW UI */
            <>
              {/* LEFT: IMAGE CANVAS */}
              <div 
                className="w-full md:w-[60%] h-[300px] md:h-full bg-[#262626] relative flex items-center justify-center overflow-hidden border-b md:border-b-0 md:border-r border-gray-200"
                onMouseMove={handlePointerMove}
                onMouseUp={handlePointerUp}
                onMouseLeave={handlePointerUp}
                onTouchMove={handlePointerMove}
                onTouchEnd={handlePointerUp}
              >
                <img src={preview} alt="Preview" className="w-full h-full object-contain pointer-events-none" />
                
                {/* DRAGGABLE TEXT OVERLAY */}
                {overlayText && (
                  <div 
                    className="absolute z-40 cursor-grab active:cursor-grabbing px-4 py-2"
                    style={{
                      top: "50%",
                      left: "50%",
                      transform: `translate(calc(-50% + ${textPos.x}px), calc(-50% + ${textPos.y}px))`,
                      touchAction: "none"
                    }}
                    onMouseDown={handlePointerDown}
                    onTouchStart={handlePointerDown}
                  >
                    <p className={`text-center text-3xl text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)] whitespace-nowrap ${overlayFont}`}>
                      {overlayText}
                    </p>
                  </div>
                )}
              </div>

              {/* RIGHT: DETAILS SIDEBAR */}
              <div className="w-full md:w-[40%] h-full flex flex-col bg-white overflow-y-auto scrollbar-hide">
                
                {/* User Header */}
                <div className="flex items-center gap-3 p-4">
                  <img 
                    src={getProfileImage(user)} 
                    className="w-7 h-7 rounded-full object-cover"
                    alt="Profile"
                  />
                  <span className="font-semibold text-[14px] text-gray-900">{user?.username}</span>
                </div>

                {/* Caption Area */}
                <div className="px-4 pb-2 border-b border-gray-100">
                  <textarea 
                    placeholder="Write a caption..." 
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    rows="5"
                    maxLength={2200}
                    className="w-full resize-none border-none p-0 focus:ring-0 text-[14px] text-gray-800 placeholder-gray-400 bg-transparent outline-none"
                  />
                  <div className="flex justify-end mt-1">
                     <span className="text-[12px] text-gray-300 font-medium">{caption.length}/2,200</span>
                  </div>
                </div>

                {/* Inputs Section */}
                <div className="flex flex-col">
                  
                  {/* Location Input */}
                  <div className="flex items-center px-4 py-3 border-b border-gray-100 group">
                    <input 
                      type="text" 
                      placeholder="Add location" 
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      className="w-full border-none p-0 focus:ring-0 text-[14px] outline-none text-gray-800 placeholder-gray-500 bg-transparent"
                    />
                    <FaMapMarkerAlt className="text-gray-300 group-focus-within:text-gray-600 transition-colors" />
                  </div>

                  {/* Tags Input */}
                  <div className="flex items-center px-4 py-3 border-b border-gray-100 group">
                    <input 
                      type="text" 
                      placeholder="Add tags (comma separated)" 
                      value={tags}
                      onChange={(e) => setTags(e.target.value)}
                      className="w-full border-none p-0 focus:ring-0 text-[14px] outline-none text-gray-800 placeholder-gray-500 bg-transparent"
                    />
                    <FaHashtag className="text-gray-300 group-focus-within:text-gray-600 transition-colors" />
                  </div>

                  {/* Advanced: Text Overlay Configuration */}
                  <div className="px-4 py-4 flex flex-col gap-3 bg-gray-50/50 flex-1">
                    <p className="text-[13px] font-semibold text-gray-500 uppercase tracking-wide">Text Overlay on Image</p>
                    
                    <div className="flex items-center bg-white border border-gray-200 rounded-md px-3 py-2 focus-within:border-gray-400 transition-colors">
                      <FaFont className="text-gray-400 shrink-0 text-sm" />
                      <input 
                        type="text" 
                        placeholder="Add draggable text..." 
                        value={overlayText}
                        onChange={(e) => setOverlayText(e.target.value)}
                        maxLength={40}
                        className="w-full border-none px-3 py-0 focus:ring-0 text-[14px] outline-none bg-transparent"
                      />
                    </div>

                    {overlayText && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {fontOptions.map((font) => (
                          <button
                            key={font.value}
                            onClick={() => setOverlayFont(font.value)}
                            className={`px-3 py-1 rounded-md text-[12px] transition-all border ${
                              overlayFont === font.value 
                                ? "bg-gray-800 text-white border-gray-800 font-bold" 
                                : "bg-white text-gray-600 border-gray-200 hover:bg-gray-100"
                            } ${font.value}`}
                          >
                            {font.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                </div>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}

export default CreatePost;