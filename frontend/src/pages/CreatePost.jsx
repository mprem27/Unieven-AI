import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { createPost } from "../services/postService";
import { getProfileImage } from "../utils/getProfileImage";
import Loader from "../components/Loader";
import { toast } from "react-toastify";
import { 
  FaMapMarkerAlt, FaHashtag, FaArrowLeft, FaImages,
  FaFont, FaUserTag, FaMagic, FaLink 
} from "react-icons/fa";

// 🔥 FONT MAP
const fontMap = {
  classic: "font-sans font-bold",
  typewriter: "font-serif italic",
  modern: "font-mono uppercase tracking-widest",
  impact: "font-black uppercase tracking-tight",
  cursive: "font-[cursive]",
  marker: "font-[fantasy] tracking-wide",
  sleek: "font-sans font-light tracking-[0.3em] uppercase",
};

function CreatePost() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const previewRef = useRef(null);

  // States
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  // Form Data States
  const [caption, setCaption] = useState("");
  const [location, setLocation] = useState("");
  const [tags, setTags] = useState("");
  const [mentions, setMentions] = useState(""); 
  const [link, setLink] = useState("");
  const [isPublic, setIsPublic] = useState(true); 
  const [activeFilter, setActiveFilter] = useState("none");
  const [bgGradient, setBgGradient] = useState("from-gray-900 to-black"); 

  // Text Overlay States
  const [overlayText, setOverlayText] = useState("");
  const [textFont, setTextFont] = useState("classic");
  const [textColor, setTextColor] = useState("#ffffff");
  const [textStyle, setTextStyle] = useState("classic");
  const [textSize, setTextSize] = useState(42);

  // Draggable Text States
  const [textPos, setTextPos] = useState({ x: 0, y: 0 });
  const [isDraggingText, setIsDraggingText] = useState(false);
  const dragRef = useRef({ startX: 0, startY: 0 });

  const fontOptions = [
    { label: "Classic", value: "classic" },
    { label: "Typewriter", value: "typewriter" },
    { label: "Modern", value: "modern" },
    { label: "Impact", value: "impact" },
    { label: "Cursive", value: "cursive" },
    { label: "Marker", value: "marker" },
    { label: "Sleek", value: "sleek" }
  ];

  const styleOptions = [
    "classic", "highlight", "neon", "outline", "glitch", "3d-pop", "elegant"
  ];

  const filters = [
    { name: "none", filter: "none" },
    { name: "grayscale", filter: "grayscale(100%)" },
    { name: "sepia", filter: "sepia(100%)" },
    { name: "invert", filter: "invert(100%)" },
    { name: "warm", filter: "sepia(30%) saturate(140%)" }
  ];

  const colors = ["#ffffff", "#000000", "#3b82f6", "#ef4444", "#22c55e", "#eab308"];

  // Helper for dynamic text styles
  const getTextStyle = () => {
    switch (textStyle) {
      case "highlight":
        return { background: "rgba(0,0,0,0.45)", padding: "4px 16px", borderRadius: "14px", color: textColor === "#ffffff" ? "#fff" : textColor };
      case "neon":
        return { textShadow: `0 0 8px ${textColor}, 0 0 16px ${textColor}`, color: "#fff" };
      case "outline":
        return { WebkitTextStroke: "1.5px black", color: textColor };
      case "glitch":
        return { textShadow: "2px 0 red, -2px 0 cyan", color: textColor };
      case "3d-pop":
        return { textShadow: "3px 3px 0 rgba(0,0,0,0.5), 6px 6px 0 rgba(0,0,0,0.3)", color: textColor };
      case "elegant":
        return { letterSpacing: "2px", textShadow: "0px 2px 4px rgba(0,0,0,0.3)", color: textColor };
      default:
        return { textShadow: "0 2px 10px rgba(0,0,0,0.8)", color: textColor };
    }
  };

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const processFile = (selectedFile) => {
    if (selectedFile?.type.startsWith("image/") || selectedFile?.type.startsWith("video/")) {
      setFile(selectedFile);
      setPreview(URL.createObjectURL(selectedFile));
      setTextPos({ x: 0, y: 0 });
    } else {
      toast.error("Please select a valid image or video");
    }
  };

  const handlePointerDown = (e) => {
    setIsDraggingText(true);
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    dragRef.current = { startX: clientX - textPos.x, startY: clientY - textPos.y };
  };

  const handlePointerMove = (e) => {
    if (!isDraggingText) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    setTextPos({ x: clientX - dragRef.current.startX, y: clientY - dragRef.current.startY });
  };

  const handleSubmit = async () => {
    if (!file) return toast.error("Media is required!");
    if (!(file instanceof File || file instanceof Blob)) {
        return toast.error("Invalid file type. Please re-select the image.");
    }
    
    setLoading(true);

    try {
      const formData = new FormData();
      
      // 🔥 FIX 1: Append file under multiple common field names to ensure Multer catches it
      formData.append("media", file);
      formData.append("image", file);
      formData.append("file", file);
      
      formData.append("caption", caption.trim());
      formData.append("isPublic", isPublic ? "true" : "false"); 
      
      const filterString = filters.find(f => f.name === activeFilter)?.filter || "none";
      formData.append("filter", filterString);
      formData.append("bgGradient", bgGradient);
      
      if (location.trim()) formData.append("location", location.trim());
      
      // 🔥 FIX 2: Ensure valid URL protocol
      if (link.trim()) {
        let formattedLink = link.trim();
        if (!/^https?:\/\//i.test(formattedLink)) {
          formattedLink = `https://${formattedLink}`;
        }
        formData.append("link", formattedLink);
      }
      
      // 🔥 FIX 3: Stringify arrays so FormData doesn't corrupt the backend parser
      if (tags.trim()) {
        const cleanTags = tags.split(",").map(t => t.trim().replace(/^#/, '')).filter(Boolean);
        if (cleanTags.length > 0) formData.append("tags", JSON.stringify(cleanTags));
      }
      if (mentions.trim()) {
        const cleanMentions = mentions.split(",").map(m => m.trim().replace(/^@/, '')).filter(Boolean);
        if (cleanMentions.length > 0) formData.append("mentions", JSON.stringify(cleanMentions));
      }
      
      // 🔥 TEXT OVERLAY DATA
      if (overlayText.trim()) {
        let normalizedX = 0.5;
        let normalizedY = 0.5;

        // Safely calculate position
        if (previewRef.current && previewRef.current.clientWidth > 0 && previewRef.current.clientHeight > 0) {
          const container = previewRef.current;
          normalizedX = Math.max(0, Math.min(1, (textPos.x + container.clientWidth / 2) / container.clientWidth));
          normalizedY = Math.max(0, Math.min(1, (textPos.y + container.clientHeight / 2) / container.clientHeight));
        }

        formData.append("text", overlayText.trim()); 
        formData.append("overlayText", overlayText.trim());
        formData.append("textFont", textFont);
        formData.append("textColor", textColor);
        formData.append("textStyle", textStyle);
        formData.append("textSize", textSize);
        formData.append("textX", normalizedX.toFixed(4));
        formData.append("textY", normalizedY.toFixed(4));
      }

      await createPost(formData);
      toast.success("Post Published! 🎉");
      window.dispatchEvent(new Event("profileUpdated")); // Global Sync
      navigate("/profile");
      
    } catch (err) {
      console.error("CREATE POST ERROR:", err);
      // 🔥 Better error handling for network drops
      if (err.message === "Network Error" || err.code === "ERR_CONNECTION_CLOSED") {
         toast.error("Network error: Connection to the server was lost. Please check your internet and try again.");
      } else {
         toast.error(err?.response?.data?.message || err.message || "Upload failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full min-h-screen flex justify-center items-center bg-[#f8f9fa] p-2 sm:p-6 font-['Poppins',sans-serif]">
      
      <div className="w-full max-w-[1000px] bg-white rounded-[32px] shadow-2xl flex flex-col overflow-hidden h-full max-h-[95vh] md:h-[750px] border border-white">
        
        {/* HEADER */}
        <div className="h-16 border-b border-gray-100 flex items-center justify-between px-4 sm:px-8 bg-white z-10 shrink-0">
          <button onClick={() => preview ? setPreview(null) : navigate(-1)} className="text-gray-400 hover:text-black p-2 transition-all active:scale-90">
            <FaArrowLeft size={18} />
          </button>
          <div className="text-center">
            <h1 className="font-black text-gray-900 text-sm sm:text-lg tracking-tight uppercase">Post Studio</h1>
          </div>
          <button onClick={handleSubmit} disabled={loading || !preview} className="bg-black text-white px-5 sm:px-8 py-2 rounded-full font-black text-[10px] sm:text-xs hover:bg-blue-600 transition-all disabled:opacity-30 active:scale-95">
            {loading ? <Loader size="14px" color="#fff" /> : "PUBLISH"}
          </button>
        </div>

        <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
          
          {!preview ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-10 text-center bg-gray-50"
              onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={() => setDragActive(false)}
              onDrop={(e) => { e.preventDefault(); processFile(e.dataTransfer.files[0]); }}
            >
              <div className={`p-8 sm:p-12 w-full max-w-sm rounded-[40px] sm:rounded-[50px] border-4 border-dashed transition-all ${dragActive ? "border-blue-500 bg-blue-50 scale-105" : "border-gray-200 bg-white"}`}>
                <FaImages size={60} className="mx-auto text-gray-200 mb-4 sm:mb-6" />
                <h2 className="text-lg sm:text-2xl font-black text-gray-800 mb-2">Capture the Vibe</h2>
                <p className="text-[10px] sm:text-xs text-gray-400 mb-6 sm:mb-8 font-bold uppercase tracking-widest leading-relaxed">Drag and drop high-res images here</p>
                <button type="button" onClick={() => fileInputRef.current.click()} className="w-full bg-blue-600 text-white py-3 sm:py-4 rounded-2xl font-black text-[10px] sm:text-xs tracking-widest active:scale-95 transition-all shadow-lg shadow-blue-200">BROWSE DEVICE</button>
              </div>
              <input type="file" ref={fileInputRef} onChange={(e) => processFile(e.target.files[0])} accept="image/*,video/*" className="hidden" onClick={(e) => (e.target.value = null)} />
            </div>
          ) : (
            <>
              {/* CANVAS */}
              <div 
                ref={previewRef}
                className="w-full h-[40vh] md:h-full md:w-[55%] bg-[#0a0a0a] relative flex items-center justify-center group shrink-0 overflow-hidden"
                onMouseMove={handlePointerMove} onTouchMove={handlePointerMove} onMouseUp={() => setIsDraggingText(false)} onTouchEnd={() => setIsDraggingText(false)}
              >
                
                {file?.type?.startsWith("video/") ? (
                  <video src={preview} className="w-full h-full object-contain pointer-events-none select-none transition-all duration-500" style={{ filter: filters.find(f => f.name === activeFilter)?.filter || "none" }} autoPlay loop muted playsInline />
                ) : (
                  <img src={preview} className="w-full h-full object-contain pointer-events-none select-none transition-all duration-500" style={{ filter: filters.find(f => f.name === activeFilter)?.filter || "none" }} alt="Preview" />
                )}
                
                {/* TEXT OVERLAY PREVIEW */}
                {overlayText && (
                  <div 
                    onMouseDown={handlePointerDown} 
                    onTouchStart={handlePointerDown}
                    className={`absolute left-[50%] top-[50%] z-20 cursor-move transition-transform duration-75 whitespace-pre-wrap break-words text-center ${fontMap[textFont] || fontMap.classic}`}
                    style={{ 
                      transform: `translate(calc(-50% + ${textPos.x}px), calc(-50% + ${textPos.y}px))`, 
                      fontSize: `${textSize}px`,
                      lineHeight: "1.4",
                      maxWidth: "90%",
                      ...getTextStyle()
                    }}
                  >
                    {overlayText}
                  </div>
                )}

                {/* FILTER SELECTOR */}
                <div className="absolute bottom-4 left-4 right-4 flex gap-2 overflow-x-auto scrollbar-hide bg-black/40 backdrop-blur-xl p-2 rounded-2xl border border-white/10 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                    <FaMagic className="text-white/50 m-2 shrink-0" />
                    {filters.map(f => (
                        <button type="button" key={f.name} onClick={() => setActiveFilter(f.name)} className={`px-3 py-1 rounded-lg text-[8px] sm:text-[9px] font-black uppercase tracking-widest whitespace-nowrap ${activeFilter === f.name ? 'bg-white text-black' : 'text-white/70 hover:bg-white/10'}`}>{f.name}</button>
                    ))}
                </div>
              </div>

              {/* DETAILS SIDEBAR */}
              <div className="flex-1 h-full flex flex-col bg-white overflow-y-auto scrollbar-hide border-l border-gray-100">
                <div className="p-4 sm:p-6 flex items-center gap-3 border-b border-gray-50 shrink-0">
                  <img src={getProfileImage(user)} className="w-10 h-10 rounded-xl border-2 border-gray-100 object-cover" alt="" />
                  <div>
                    <span className="font-black text-gray-900 text-xs sm:text-sm tracking-tight">{user?.username}</span>
                    <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">Post Settings</p>
                  </div>
                </div>

                <div className="p-4 sm:p-6 space-y-6 sm:space-y-8 pb-12 flex-1">
                  
                  {/* CAPTION */}
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Caption</label>
                    <textarea placeholder="Write something cool..." value={caption} onChange={(e) => setCaption(e.target.value)} rows="3" className="w-full text-xs sm:text-sm outline-none bg-gray-50 rounded-2xl p-4 placeholder:text-gray-400 font-bold border border-gray-100 focus:border-black transition-all resize-none" />
                  </div>

                  {/* PRIVACY TOGGLE */}
                  <div className="bg-gray-50 p-4 sm:p-5 rounded-[28px] border border-gray-100">
                    <div className="flex items-center justify-between">
                       <span className="font-black text-[10px] sm:text-xs text-gray-800 uppercase tracking-tight">Public Visibility</span>
                       <div onClick={() => setIsPublic(!isPublic)} className={`w-12 h-6 rounded-full p-1 cursor-pointer transition-colors duration-300 flex items-center ${isPublic ? 'bg-black' : 'bg-gray-300'}`}>
                          <div className={`bg-white w-4 h-4 rounded-full shadow-md transition-transform duration-300 ${isPublic ? 'translate-x-6' : 'translate-x-0'}`}></div>
                       </div>
                    </div>
                    <p className="text-[9px] text-gray-500 font-bold mt-3 leading-relaxed tracking-wide uppercase">{isPublic ? "Visible to the campus." : "Visible to connects only."}</p>
                  </div>

                  {/* TEXT OVERLAY STUDIO */}
                  <div className="bg-neutral-900 p-5 sm:p-6 rounded-[32px] sm:rounded-[36px] space-y-4 sm:space-y-5">
                    <label className="text-[9px] font-black text-white/50 uppercase tracking-[0.2em]">Typography Studio</label>
                    <div className="flex items-center gap-3 bg-white/10 px-4 py-3 sm:py-4 rounded-2xl border border-white/10">
                       <FaFont className="text-white shrink-0" size={14} />
                       <input placeholder="TYPE ON IMAGE..." value={overlayText} onChange={(e) => setOverlayText(e.target.value)} maxLength={40} className="bg-transparent outline-none text-[10px] sm:text-xs w-full font-black tracking-widest text-white" />
                    </div>
                    
                    {overlayText && (
                      <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex gap-2 overflow-x-auto scrollbar-hide py-1">
                          {fontOptions.map(f => (
                            <button type="button" key={f.value} onClick={() => setTextFont(f.value)} className={`px-4 py-2 rounded-xl text-[8px] sm:text-[9px] font-black uppercase transition-all shrink-0 ${textFont === f.value ? "bg-white text-black" : "bg-white/10 text-white"}`}>{f.label}</button>
                          ))}
                        </div>
                        
                        <div className="flex gap-2 overflow-x-auto scrollbar-hide py-1">
                          {styleOptions.map(s => (
                            <button type="button" key={s} onClick={() => setTextStyle(s)} className={`px-4 py-2 rounded-xl text-[8px] sm:text-[9px] font-black uppercase transition-all shrink-0 ${textStyle === s ? "bg-blue-500 text-white" : "bg-white/10 text-white"}`}>{s.replace("-", " ")}</button>
                          ))}
                        </div>

                        <div className="pt-2 flex items-center gap-3">
                           <span className="text-[9px] text-white/50 font-black uppercase">Size</span>
                           <input type="range" min="16" max="80" value={textSize} onChange={(e) => setTextSize(Number(e.target.value))} className="w-full accent-blue-500" />
                        </div>

                        <div className="flex gap-3 justify-center pt-3 border-t border-white/5 mt-2">
                          {colors.map(c => (
                            <button type="button" key={c} onClick={() => setTextColor(c)} className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full border-4 transition-transform active:scale-75 ${textColor === c ? "border-white scale-110 shadow-lg" : "border-transparent opacity-60 hover:opacity-100"}`} style={{ backgroundColor: c }}></button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* INPUTS */}
                  <div className="grid grid-cols-1 gap-3 sm:gap-4">
                    <div className="flex items-center gap-3 bg-gray-50 px-4 py-3 sm:py-4 rounded-2xl border border-gray-100 focus-within:bg-white transition-all">
                       <FaMapMarkerAlt className="text-gray-900" size={14} />
                       <input placeholder="LOCATION" value={location} onChange={(e) => setLocation(e.target.value)} className="bg-transparent outline-none text-[10px] sm:text-xs w-full font-bold uppercase tracking-widest" />
                    </div>
                    <div className="flex items-center gap-3 bg-gray-50 px-4 py-3 sm:py-4 rounded-2xl border border-gray-100 focus-within:bg-white transition-all">
                       <FaLink className="text-gray-900" size={14} />
                       <input type="url" placeholder="ADD A LINK (https://...)" value={link} onChange={(e) => setLink(e.target.value)} className="bg-transparent outline-none text-[10px] sm:text-xs w-full font-bold uppercase tracking-widest" />
                    </div>
                    <div className="flex items-center gap-3 bg-gray-50 px-4 py-3 sm:py-4 rounded-2xl border border-gray-100 focus-within:bg-white transition-all">
                       <FaHashtag className="text-gray-900" size={14} />
                       <input placeholder="TAGS (comma separated)" value={tags} onChange={(e) => setTags(e.target.value)} className="bg-transparent outline-none text-[10px] sm:text-xs w-full font-bold uppercase tracking-widest" />
                    </div>
                    <div className="flex items-center gap-3 bg-gray-50 px-4 py-3 sm:py-4 rounded-2xl border border-gray-100 focus-within:bg-white transition-all">
                       <FaUserTag className="text-gray-900" size={14} />
                       <input placeholder="MENTIONS (comma separated)" value={mentions} onChange={(e) => setMentions(e.target.value)} className="bg-transparent outline-none text-[10px] sm:text-xs w-full font-bold uppercase tracking-widest" />
                    </div>
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