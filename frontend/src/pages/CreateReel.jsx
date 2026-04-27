import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { createReel } from "../services/reelService"; 
import { getProfileImage } from "../utils/getProfileImage";
import Loader from "../components/Loader";
import { toast } from "react-toastify";
import { 
  FaVideo, FaMapMarkerAlt, FaHashtag, FaFont, 
  FaPaperPlane, FaTimes, FaPlay, FaPause, 
  FaVolumeUp, FaVolumeMute, FaUserTag, FaArrowLeft, FaMagic
} from "react-icons/fa";

// 🔥 STEP 1: FONT MAP
const fontMap = {
  classic: "font-sans font-bold",
  typewriter: "font-serif italic",
  modern: "font-mono uppercase tracking-widest",
  impact: "font-black uppercase tracking-tight",
  cursive: "font-[cursive]",
  marker: "font-[fantasy] tracking-wide",
  sleek: "font-sans font-light tracking-[0.3em] uppercase",
};

function CreateReel() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  
  // 🔥 STEP 3: PREVIEW REF FOR NORMALIZATION
  const previewRef = useRef(null);

  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const [playing, setPlaying] = useState(true);
  
  // 🔥 STEP 5: DEFAULT SOUND ON
  const [muted, setMuted] = useState(false); 
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [isPublic, setIsPublic] = useState(true);

  const [caption, setCaption] = useState("");
  const [location, setLocation] = useState("");
  const [tags, setTags] = useState("");
  const [mentions, setMentions] = useState(""); 

  // 🔥 STEP 2: CHANGE STATE NAMES & ADD NEW STATES
  const [overlayText, setOverlayText] = useState("");
  const [textFont, setTextFont] = useState("classic");
  const [textColor, setTextColor] = useState("#ffffff");
  const [textStyle, setTextStyle] = useState("classic");
  const [textSize, setTextSize] = useState(42);
  const [activeFilter, setActiveFilter] = useState("none");
  const [bgGradient, setBgGradient] = useState("from-gray-900 to-black");

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

  // 🔥 STEP 6: TEXT STYLE OPTIONS
  const styleOptions = [
    "classic", "highlight", "neon", "outline", "glitch", "3d-pop", "elegant"
  ];

  // 🔥 STEP 8: FILTERS
  const filters = [
    { name: "none", filter: "none" },
    { name: "cinematic", filter: "contrast(1.2) brightness(0.9)" },
    { name: "warm", filter: "sepia(0.25) saturate(1.3)" },
    { name: "vibrant", filter: "saturate(1.5)" },
    { name: "grayscale", filter: "grayscale(1)" }
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

  // Memory Leak Prevention
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const processFile = (selectedFile) => {
    if (selectedFile?.type.startsWith("video/")) {
      setFile(selectedFile);
      setPreview(URL.createObjectURL(selectedFile));
      setTextPos({ x: 0, y: 0 });
      setPlaying(true);
    } else {
      toast.error("Please select a valid video file");
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

  const handleSpeedChange = (speed) => {
    setPlaybackSpeed(speed);
    if (videoRef.current) videoRef.current.playbackRate = speed;
  };

  const handleSubmit = async () => {
    if (!file) return toast.error("Video file is required!");
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("video", file); 
      formData.append("caption", caption);
      formData.append("isPublic", isPublic);
      formData.append("playbackSpeed", playbackSpeed);
      
      const filterString = filters.find(f => f.name === activeFilter)?.filter || "none";
      formData.append("filter", filterString);
      formData.append("bgGradient", bgGradient);

      if (location.trim()) formData.append("location", location);
      if (tags.trim()) formData.append("tags", JSON.stringify(tags.split(",").map(t => t.trim())));
      if (mentions.trim()) formData.append("mentions", JSON.stringify(mentions.split(",").map(m => m.trim())));
      
      if (overlayText.trim()) {
        // 🔥 STEP 4: NORMALIZE POSITION
        let normalizedX = 0.5;
        let normalizedY = 0.5;

        if (previewRef.current) {
          const container = previewRef.current;
          normalizedX = Math.max(0, Math.min(1, (textPos.x + container.clientWidth / 2) / container.clientWidth));
          normalizedY = Math.max(0, Math.min(1, (textPos.y + container.clientHeight / 2) / container.clientHeight));
        }

        // Send exact expected backend names
        formData.append("text", overlayText);
        formData.append("overlayText", overlayText); // Keeping for legacy safety
        formData.append("textFont", textFont); 
        formData.append("textColor", textColor);
        formData.append("textStyle", textStyle);
        formData.append("textSize", textSize);
        formData.append("textX", normalizedX.toFixed(4));
        formData.append("textY", normalizedY.toFixed(4));
      }
      
      await createReel(formData);
      toast.success("Reel Published! 🎉");
      
      // 🔥 STEP 6: GLOBAL SYNC
      window.dispatchEvent(new Event("profileUpdated"));
      navigate("/reels");
    } catch (err) {
      toast.error("Upload failed.");
    } finally {
      setLoading(false);
    }
  };

  const inputStyles = "w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 text-[13px] font-bold outline-none focus:bg-white focus:border-black transition-all text-gray-900";

  return (
    <div className="w-full min-h-screen flex justify-center items-center bg-[#f8f9fa] p-2 sm:p-6 font-['Poppins',sans-serif]">
      <div className="w-full max-w-[1000px] bg-white rounded-[32px] shadow-2xl flex flex-col overflow-hidden h-full max-h-[95vh] md:h-[750px] border border-white">
        
        {/* HEADER */}
        <div className="h-16 border-b border-gray-100 flex items-center justify-between px-6 bg-white z-10 shrink-0">
          <button onClick={() => preview ? setPreview(null) : navigate(-1)} className="text-gray-400 hover:text-black p-2 transition-all active:scale-90">
            <FaArrowLeft size={18} />
          </button>
          <div className="text-center">
            <h1 className="font-black text-gray-900 text-lg tracking-tight">Reel Studio</h1>
            <p className="hidden sm:block text-[10px] uppercase font-bold text-blue-500 tracking-[0.2em]">Creative Mode</p>
          </div>
          <button onClick={handleSubmit} disabled={loading || !preview} className="bg-black text-white px-6 py-2 rounded-full font-black text-xs active:scale-95 transition-all disabled:opacity-30">
            {loading ? <Loader size="14px" color="#fff" /> : "PUBLISH"}
          </button>
        </div>

        <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
          {!preview ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-gray-50"
              onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={() => setDragActive(false)}
              onDrop={(e) => { e.preventDefault(); processFile(e.dataTransfer.files[0]); }}
            >
              <div className={`p-10 w-full max-w-sm rounded-[40px] border-4 border-dashed transition-all ${dragActive ? "border-blue-500 bg-blue-50 scale-105" : "border-gray-200 bg-white"}`}>
                <FaVideo size={60} className="mx-auto text-gray-200 mb-6" />
                <h2 className="text-xl font-black text-gray-800 mb-2">Upload your Reel</h2>
                <p className="text-xs text-gray-400 mb-8 font-bold uppercase">Vertical video works best</p>
                <button onClick={() => fileInputRef.current.click()} className="w-full bg-blue-600 text-white py-4 rounded-[20px] font-black text-xs tracking-widest active:scale-95 shadow-lg shadow-blue-200 transition-all">SELECT VIDEO</button>
              </div>
              <input type="file" ref={fileInputRef} onChange={(e) => processFile(e.target.files[0])} accept="video/*" className="hidden" onClick={(e) => (e.target.value = null)} />
            </div>
          ) : (
            <>
              {/* VIDEO PREVIEW */}
              <div 
                ref={previewRef}
                className="w-full h-[45vh] md:h-full md:w-[50%] bg-[#0a0a0a] relative flex items-center justify-center group shrink-0 overflow-hidden"
                onMouseMove={handlePointerMove} onTouchMove={handlePointerMove} onMouseUp={() => setIsDraggingText(false)} onTouchEnd={() => setIsDraggingText(false)}
              >
                
                <video 
                  ref={videoRef} 
                  src={preview} 
                  autoPlay 
                  loop 
                  muted={muted} 
                  playsInline 
                  className="w-full h-full object-contain pointer-events-none select-none transition-all duration-500" 
                  style={{ filter: filters.find(f => f.name === activeFilter)?.filter || "none" }}
                />
                
                {/* 🔥 STEP 9: PREVIEW MATCHES FINAL EXACTLY */}
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

                {/* FILTERS OVERLAY */}
                <div className="absolute top-4 left-4 right-4 flex gap-2 overflow-x-auto scrollbar-hide bg-black/40 backdrop-blur-xl p-2 rounded-2xl border border-white/10 sm:opacity-0 group-hover:opacity-100 transition-opacity z-30">
                    <FaMagic className="text-white/50 m-2 shrink-0" />
                    {filters.map(f => (
                        <button key={f.name} onClick={() => setActiveFilter(f.name)} className={`px-3 py-1 rounded-lg text-[8px] sm:text-[9px] font-black uppercase tracking-widest whitespace-nowrap ${activeFilter === f.name ? 'bg-white text-black' : 'text-white/70 hover:bg-white/10'}`}>{f.name}</button>
                    ))}
                </div>

                {/* CONTROLS */}
                <div className="absolute bottom-6 left-6 flex gap-3 opacity-0 group-hover:opacity-100 transition-opacity z-30">
                    <button onClick={() => { playing ? videoRef.current.pause() : videoRef.current.play(); setPlaying(!playing); }} className="bg-white/10 backdrop-blur-xl border border-white/20 text-white p-3.5 rounded-2xl active:scale-90"><FaPause /></button>
                    <button onClick={() => { videoRef.current.muted = !muted; setMuted(!muted); }} className="bg-white/10 backdrop-blur-xl border border-white/20 text-white p-3.5 rounded-2xl active:scale-90">{muted ? <FaVolumeMute /> : <FaVolumeUp />}</button>
                </div>
              </div>

              {/* DETAILS FORM - Scrollable sidebar */}
              <div className="flex-1 h-full flex flex-col bg-white overflow-y-auto scrollbar-hide border-l border-gray-100">
                <div className="p-6 flex items-center gap-3 border-b border-gray-50 shrink-0">
                  <img src={getProfileImage(user)} className="w-10 h-10 rounded-xl border border-gray-200 object-cover" alt="" />
                  <div>
                    <span className="font-black text-gray-900 text-sm tracking-tight">{user?.username}</span>
                    <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">Reel Settings</p>
                  </div>
                </div>

                <div className="p-6 space-y-8 pb-12 flex-1">
                  <textarea placeholder="Write a catchy caption..." value={caption} onChange={(e) => setCaption(e.target.value)} rows="3" className="w-full text-sm outline-none bg-gray-50 rounded-2xl p-4 placeholder:text-gray-400 font-bold border border-gray-100 focus:border-black transition-all resize-none" />

                  {/* PRIVACY TOGGLE */}
                  <div className="bg-gray-50 p-5 rounded-[28px] border border-gray-100">
                    <div className="flex items-center justify-between">
                       <span className="font-black text-xs text-gray-800 uppercase tracking-tight">Public Visibility</span>
                       <div onClick={() => setIsPublic(!isPublic)} className={`w-12 h-6.5 rounded-full p-1 cursor-pointer transition-colors duration-300 flex items-center ${isPublic ? 'bg-black' : 'bg-gray-300'}`}>
                          <div className={`bg-white w-4.5 h-4.5 rounded-full shadow-md transition-transform duration-300 ${isPublic ? 'translate-x-5.5' : 'translate-x-0'}`}></div>
                       </div>
                    </div>
                    <p className="text-[10px] text-gray-400 font-bold mt-3 leading-relaxed tracking-wide uppercase">{isPublic ? "Visible to the campus." : "Visible to connects only."}</p>
                  </div>

                  {/* SPEED CONTROL */}
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Speed Effect</label>
                    <div className="flex gap-2">
                       {[0.5, 1, 1.5, 2].map(speed => (
                          <button key={speed} onClick={() => handleSpeedChange(speed)} className={`flex-1 py-2.5 rounded-xl text-[11px] font-black transition-all ${playbackSpeed === speed ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-50 text-gray-400'}`}>{speed}x</button>
                       ))}
                    </div>
                  </div>

                  {/* INPUTS */}
                  <div className="space-y-4">
                    <div className="relative"><FaMapMarkerAlt className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-900" /><input placeholder="LOCATION" value={location} onChange={(e) => setLocation(e.target.value)} className={`${inputStyles} pl-12`} /></div>
                    <div className="relative"><FaHashtag className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-900" /><input placeholder="TAGS (comma separated)" value={tags} onChange={(e) => setTags(e.target.value)} className={`${inputStyles} pl-12`} /></div>
                    <div className="relative"><FaUserTag className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-900" /><input placeholder="MENTIONS (comma separated)" value={mentions} onChange={(e) => setMentions(e.target.value)} className={`${inputStyles} pl-12`} /></div>
                  </div>

                  {/* TEXT OVERLAY STUDIO */}
                  <div className="bg-neutral-900 p-5 sm:p-6 rounded-[32px] sm:rounded-[36px] space-y-4 sm:space-y-5">
                    <label className="text-[9px] font-black text-white/50 uppercase tracking-[0.2em]">Video Text Editor</label>
                    <div className="flex items-center gap-3 bg-white/10 px-4 py-3 sm:py-4 rounded-2xl border border-white/10">
                       <FaFont className="text-white shrink-0" size={14} />
                       <input placeholder="TYPE ON VIDEO..." value={overlayText} onChange={(e) => setOverlayText(e.target.value)} maxLength={40} className="bg-transparent outline-none text-[10px] sm:text-xs w-full font-black tracking-widest text-white" />
                    </div>
                    
                    {overlayText && (
                      <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex gap-2 overflow-x-auto scrollbar-hide py-1">
                          {fontOptions.map(f => (
                            <button key={f.value} onClick={() => setTextFont(f.value)} className={`px-4 py-2 rounded-xl text-[8px] sm:text-[9px] font-black uppercase transition-all shrink-0 ${textFont === f.value ? "bg-white text-black" : "bg-white/10 text-white"}`}>{f.label}</button>
                          ))}
                        </div>
                        
                        {/* TEXT STYLES */}
                        <div className="flex gap-2 overflow-x-auto scrollbar-hide py-1">
                          {styleOptions.map(s => (
                            <button key={s} onClick={() => setTextStyle(s)} className={`px-4 py-2 rounded-xl text-[8px] sm:text-[9px] font-black uppercase transition-all shrink-0 ${textStyle === s ? "bg-blue-500 text-white" : "bg-white/10 text-white"}`}>{s.replace("-", " ")}</button>
                          ))}
                        </div>

                        {/* 🔥 STEP 7: TEXT SIZE */}
                        <div className="pt-2 flex items-center gap-3">
                           <span className="text-[9px] text-white/50 font-black uppercase">Size</span>
                           <input type="range" min="16" max="80" value={textSize} onChange={(e) => setTextSize(Number(e.target.value))} className="w-full accent-blue-500" />
                        </div>

                        <div className="flex gap-3 justify-center pt-3 border-t border-white/5 mt-2">
                          {colors.map(c => (
                            <button key={c} onClick={() => setTextColor(c)} className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full border-4 transition-transform active:scale-75 ${textColor === c ? "border-white scale-110 shadow-lg" : "border-transparent opacity-60 hover:opacity-100"}`} style={{ backgroundColor: c }}></button>
                          ))}
                        </div>
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

export default CreateReel;