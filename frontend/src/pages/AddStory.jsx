import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import Loader from "../components/Loader";
import { 
  FaTimes, 
  FaFont, 
  FaMagic, 
  FaCheck, 
  FaChevronRight, 
  FaImages, 
  FaCircle,
  FaPalette,
  FaTrashAlt,
  FaCamera,
  FaSmile,
  FaMusic
} from "react-icons/fa";
import { useAuth } from "../context/AuthContext";
import { createStory } from "../services/storyService";
import { Assets } from "../assets/Assets";
import { getProfileImage } from "../utils/getProfileImage";

function AddStory() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const fileInputRef = useRef(null);
  const trashRef = useRef(null); // 🔥 Added ref for trash detection

  const DEFAULT_AVATAR = "https://cdn-icons-png.flaticon.com/512/149/149071.png";

  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [mediaType, setMediaType] = useState(null); 
  const [loading, setLoading] = useState(false);
  const [activeTool, setActiveTool] = useState("none"); 

  const [text, setText] = useState("");
  const [textColor, setTextColor] = useState("white");
  const [textFont, setTextFont] = useState("font-sans");
  const [textStyle, setTextStyle] = useState("classic");
  const [filter, setFilter] = useState("filter-none");
  const [textBgIndex, setTextBgIndex] = useState(0);

  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isOverTrash, setIsOverTrash] = useState(false); // 🔥 Added hover state
  const dragOffset = useRef({ x: 0, y: 0 });

  const colors = ["white", "black", "#ef4444", "#3b82f6", "#22c55e", "#eab308", "#a855f7", "#ec4899"];
  const fonts = [
    { name: "Classic", class: "font-sans font-bold" },
    { name: "Typewriter", class: "font-serif italic" },
    { name: "Modern", class: "font-mono uppercase tracking-widest" },
    { name: "Impact", class: "font-black uppercase" },
    { name: "Cursive", class: "font-[cursive]" }
  ];

  const filters = [
    { name: "Normal", class: "filter-none" },
    { name: "Vintage", class: "sepia contrast-125" },
    { name: "B&W", class: "grayscale contrast-150" },
    { name: "Cinematic", class: "saturate-[1.5] contrast-110" },
    { name: "Cool", class: "hue-rotate-90 saturate-150" },
    { name: "Warm", class: "sepia-[.4] saturate-[1.8]" }
  ];

  const gradients = [
    "from-purple-500 via-pink-500 to-red-500",
    "from-blue-600 via-indigo-600 to-purple-600",
    "from-green-400 via-emerald-500 to-teal-600",
    "from-orange-400 via-amber-500 to-yellow-500",
    "from-gray-900 via-gray-800 to-black"
  ];

  const textStyles = ["classic", "highlight", "neon", "playful"];

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;
    if (selectedFile.type.startsWith("video/")) {
      const videoNode = document.createElement("video");
      videoNode.preload = "metadata";
      videoNode.onloadedmetadata = () => {
        window.URL.revokeObjectURL(videoNode.src);
        if (videoNode.duration > 30) {
          toast.error("Video must be 30s or less!");
          return;
        }
        setFile(selectedFile);
        setMediaType("video");
        setPreview(URL.createObjectURL(selectedFile));
      };
      videoNode.src = URL.createObjectURL(selectedFile);
    } else if (selectedFile.type.startsWith("image/")) {
      setFile(selectedFile);
      setMediaType("image");
      setPreview(URL.createObjectURL(selectedFile));
    }
  };

  const initTextStory = () => {
    setMediaType("text");
    setPreview("text-mode");
    setActiveTool("text");
  };

  const handleStart = (e) => {
    if (!text || activeTool !== "none") return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    setIsDragging(true);
    dragOffset.current = { x: clientX - position.x, y: clientY - position.y };
  };

  const handleMove = (e) => {
    if (!isDragging) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    setPosition({ x: clientX - dragOffset.current.x, y: clientY - dragOffset.current.y });

    // 🔥 Detection Logic: Check if dragging over trash can
    if (trashRef.current) {
      const rect = trashRef.current.getBoundingClientRect();
      const over = clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
      setIsOverTrash(over);
    }
  };

  const handleEnd = () => {
    // 🔥 Remove text if dropped on trash
    if (isOverTrash) {
      clearText();
    }
    setIsDragging(false);
    setIsOverTrash(false);
  };

  const clearText = () => {
    setText("");
    setPosition({ x: 0, y: 0 });
  };

  const handleSubmit = async () => {
    if (!preview) return;
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("type", mediaType);
      if (file) formData.append("media", file);
      if (text) {
        formData.append("text", text);
        formData.append("textColor", textColor);
        formData.append("textFont", textFont);
        formData.append("textStyle", textStyle);
        formData.append("textX", position.x);
        formData.append("textY", position.y);
      }
      if (mediaType === "text") formData.append("bgGradient", gradients[textBgIndex]);
      else formData.append("filter", filter);
      await createStory(formData);
      toast.success("Added to your story!");
      navigate("/feed");
    } catch (err) {
      toast.error("Failed to upload story");
    } finally {
      setLoading(false);
    }
  };

  const getDynamicTextClasses = () => {
    let base = `absolute cursor-move px-6 py-3 text-4xl whitespace-nowrap select-none transition-all duration-200 ${textFont} z-30 touch-none`;
    if (isOverTrash) base += " scale-75 opacity-50"; // 🔥 Visual feedback
    if (textStyle === "highlight") base += ` rounded-xl`;
    else if (textStyle === "neon") base += ` drop-shadow-[0_0_15px_rgba(255,255,255,0.8)]`;
    else if (textStyle === "playful") base += ` -rotate-6 scale-110 drop-shadow-[4px_4px_0_rgba(0,0,0,0.5)] skew-x-[-5deg]`;
    else base += ` drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]`;
    return base;
  };

  const getDynamicTextStyles = () => {
    if (textStyle === "highlight") {
      return {
        backgroundColor: textColor,
        color: textColor === "white" || textColor === "#eab308" ? "black" : "white",
        transform: `translate(${position.x}px, ${position.y}px)`
      };
    }
    return { color: textColor, transform: `translate(${position.x}px, ${position.y}px)` };
  };

  return (
    <div className="fixed inset-0 bg-[#050505] z-[100] flex flex-col h-[100dvh] overflow-hidden font-['Poppins',sans-serif] select-none text-white">
      <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*,video/*" className="hidden" />

      {!preview && (
        <div className="w-full h-full flex flex-col relative bg-neutral-950">
          <div className="absolute top-0 left-0 w-full p-6 flex justify-between z-20">
            <button onClick={() => navigate("/feed")} className="w-12 h-12 flex items-center justify-center bg-white/10 backdrop-blur-md rounded-2xl border border-white/10 active:scale-90 transition-all">
              <FaTimes size={22} />
            </button>
            <button className="w-12 h-12 flex items-center justify-center bg-white/10 backdrop-blur-md rounded-2xl border border-white/10 active:scale-90 transition-all">
              <FaMagic size={20} />
            </button>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center px-4">
            <div className="w-full h-full max-h-[75vh] bg-gradient-to-b from-neutral-900 to-black rounded-[40px] border border-white/5 flex items-center justify-center relative overflow-hidden shadow-2xl">
              <div className="absolute inset-0 pointer-events-none opacity-20">
                <div className="absolute top-1/3 w-full h-[1px] bg-white"></div>
                <div className="absolute top-2/3 w-full h-[1px] bg-white"></div>
                <div className="absolute left-1/3 h-full w-[1px] bg-white"></div>
                <div className="absolute left-2/3 h-full w-[1px] bg-white"></div>
              </div>
              <div className="z-10 flex gap-6 sm:gap-10 items-center text-white/50 font-bold uppercase tracking-widest text-[10px]">
                <div className="flex flex-col items-center gap-3 cursor-pointer group" onClick={() => fileInputRef.current.click()}>
                  <div className="w-16 h-16 border border-white/20 rounded-full flex items-center justify-center bg-white/5 backdrop-blur-xl group-hover:bg-white/10 active:scale-90 transition-all shadow-lg"><FaCamera size={24} className="text-white"/></div>
                  <span>Camera</span>
                </div>
                <div className="flex flex-col items-center gap-3 cursor-pointer group" onClick={() => fileInputRef.current.click()}>
                  <div className="w-16 h-16 border border-white/20 rounded-full flex items-center justify-center bg-white/5 backdrop-blur-xl group-hover:bg-white/10 active:scale-90 transition-all shadow-lg"><FaSmile size={26} className="text-white"/></div>
                  <span>Effects</span>
                </div>
                <div className="flex flex-col items-center gap-3 cursor-pointer group" onClick={() => fileInputRef.current.click()}>
                  <div className="w-16 h-16 border border-white/20 rounded-full flex items-center justify-center bg-white/5 backdrop-blur-xl group-hover:bg-white/10 active:scale-90 transition-all shadow-lg"><FaMusic size={22} className="text-white"/></div>
                  <span>Music</span>
                </div>
              </div>
            </div>
          </div>

          <div className="h-[140px] flex items-center justify-around px-8 pb-8 bg-neutral-950">
            <button onClick={() => fileInputRef.current.click()} className="active:scale-90 transition-transform">
              <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center border border-white/10"><FaImages size={24} /></div>
            </button>
            <button onClick={() => fileInputRef.current.click()} className="group relative p-1 active:scale-90 transition-transform">
              <div className="w-22 h-22 sm:w-24 sm:h-24 rounded-full border-[6px] border-white p-1">
                <img src={Assets.shutter} alt="Shutter" className="w-full h-full rounded-full object-cover" />
              </div>
            </button>
            <button onClick={initTextStory} className="active:scale-90 transition-transform">
              <div className="w-14 h-14 bg-white/5 rounded-full flex items-center justify-center border border-white/10"><span className="font-bold text-xl font-serif italic">Aa</span></div>
            </button>
          </div>
        </div>
      )}

      {preview && (
        <div className="relative w-full h-full flex justify-center items-center overflow-hidden"
          onMouseMove={handleMove} onMouseUp={handleEnd} onTouchMove={handleMove} onTouchEnd={handleEnd}>
          
          {activeTool === "none" && (
            <div className="absolute top-0 left-0 w-full p-6 flex justify-between items-start z-40 bg-gradient-to-b from-black/80 to-transparent">
              <button onClick={() => { setPreview(null); setFile(null); clearText(); }} className="w-12 h-12 flex items-center justify-center bg-black/20 backdrop-blur-xl rounded-2xl border border-white/10 active:scale-90"><FaTimes size={22} /></button>
              <div className="flex gap-4 p-2 bg-black/20 backdrop-blur-xl rounded-3xl border border-white/10">
                {mediaType === "text" && <button onClick={() => setTextBgIndex((prev) => (prev + 1) % gradients.length)} className="p-3"><FaPalette size={22} /></button>}
                {mediaType !== "text" && <button onClick={() => setActiveTool("filter")} className="p-3"><FaMagic size={22} /></button>}
                <button onClick={() => setActiveTool("text")} className="p-3"><span className="font-bold text-xl font-serif italic">Aa</span></button>
              </div>
            </div>
          )}

          <div onClick={() => { if (activeTool === "none") setActiveTool("text"); }}
            className={`relative w-full h-full md:max-w-[420px] md:h-[90%] md:rounded-[48px] shadow-2xl overflow-hidden bg-black flex items-center justify-center border border-white/5 ${mediaType === "text" ? `bg-gradient-to-br ${gradients[textBgIndex]}` : ""}`}>
            {mediaType === "video" && <video src={preview} autoPlay loop muted playsInline className={`w-full h-full object-cover transition-all duration-700 ${filter}`} />}
            {mediaType === "image" && <img src={preview} alt="Preview" className={`w-full h-full object-cover transition-all duration-700 ${filter}`} />}

            {text && activeTool === "none" && (
              <div onMouseDown={handleStart} onTouchStart={handleStart} className={getDynamicTextClasses()}
                style={getDynamicTextStyles()}
                onClick={(e) => { e.stopPropagation(); setActiveTool("text"); }}>
                {text}
              </div>
            )}
          </div>

          {/* 🔥 DYNAMIC TRASH CAN */}
          {text && isDragging && (
            <div ref={trashRef} className="absolute bottom-[130px] flex flex-col items-center gap-2 z-40 transition-all duration-200">
                <div className={`p-5 rounded-full backdrop-blur-xl border transition-all duration-200 ${isOverTrash ? "bg-red-500 text-white scale-150 border-white shadow-lg" : "bg-red-500/20 text-red-500 border-red-500/20 scale-100"}`}>
                    <FaTrashAlt size={isOverTrash ? 28 : 24} />
                </div>
                <span className={`text-[10px] font-black uppercase tracking-widest transition-opacity ${isOverTrash ? "opacity-100" : "opacity-0"}`}>Release to Delete</span>
            </div>
          )}

          {activeTool === "none" && (
            <div className="absolute bottom-10 right-6 z-40 flex items-center gap-3">
              <div className="bg-black/60 backdrop-blur-xl text-white pl-2 pr-5 py-2 rounded-full text-xs font-black border border-white/10 flex items-center gap-3 shadow-lg">
                <div className="p-1 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500">
                    <img src={user ? getProfileImage(user) : DEFAULT_AVATAR} alt="Profile" className="w-8 h-8 rounded-full object-cover border-2 border-black" />
                </div>
                YOUR STORY
              </div>
              <button onClick={handleSubmit} disabled={loading} className="w-16 h-16 bg-white text-black rounded-full flex items-center justify-center shadow-xl active:scale-90 disabled:opacity-50">
                {loading ? <Loader size="24px" color="#000" /> : <FaChevronRight size={24} />}
              </button>
            </div>
          )}
        </div>
      )}

      {/* TEXT EDITOR */}
      {activeTool === "text" && preview && (
        <div className="absolute inset-0 bg-black/80 flex flex-col justify-between z-50 p-6 backdrop-blur-[30px] animate-in fade-in duration-300">
          <div className="flex justify-between items-center mt-6">
            <button onClick={() => {
              const idx = textStyles.indexOf(textStyle);
              setTextStyle(textStyles[(idx + 1) % textStyles.length]);
            }} className="px-6 py-2.5 bg-white/10 text-white rounded-2xl font-black text-xs border border-white/10 uppercase tracking-widest">Style: {textStyle}</button>
            <button onClick={() => setActiveTool("none")} className="text-blue-500 font-black text-lg p-2 active:scale-90">Done</button>
          </div>
          <div className="flex-1 flex items-center justify-center w-full px-4">
            <textarea autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder="Type something..."
              className={`bg-transparent text-center text-4xl sm:text-5xl w-full outline-none border-none resize-none overflow-hidden drop-shadow-2xl ${textFont}`}
              style={{
                color: textStyle === 'highlight' && (textColor === 'white' || textColor === '#eab308') ? 'black' : textColor,
                backgroundColor: textStyle === 'highlight' ? textColor : 'transparent',
                padding: textStyle === 'highlight' ? '20px' : '0',
                borderRadius: '24px'
              }}
            />
          </div>
          <div className="flex flex-col items-center gap-8 mb-10">
            <div className="flex gap-3 overflow-x-auto scrollbar-hide w-full px-4">
              {fonts.map(f => (
                <button key={f.name} onClick={() => setTextFont(f.class)} className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-tighter whitespace-nowrap transition-all ${textFont === f.class ? "bg-white text-black scale-105" : "bg-white/10 text-white/60"}`}>{f.name}</button>
              ))}
            </div>
            <div className="flex gap-4 overflow-x-auto scrollbar-hide w-full justify-center px-4">
              {colors.map(c => (
                <button key={c} onClick={() => setTextColor(c)} className={`w-9 h-9 rounded-full border-4 shrink-0 transition-transform active:scale-75 ${textColor === c ? "border-white scale-125 shadow-lg" : "border-transparent opacity-60"}`} style={{ backgroundColor: c }}></button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* FILTER TRAY */}
      {activeTool === "filter" && preview && mediaType !== "text" && (
        <div className="absolute inset-0 z-50 flex flex-col justify-end animate-in slide-in-from-bottom duration-500">
          <div className="w-full bg-black/60 backdrop-blur-3xl border-t border-white/10 rounded-t-[40px] pt-10 pb-14 px-6 shadow-[0_-20px_50px_rgba(0,0,0,0.5)]">
            <div className="flex justify-between items-center mb-8 px-2">
              <h3 className="text-white font-black text-lg tracking-widest uppercase opacity-40">Filters</h3>
              <button onClick={() => setActiveTool("none")} className="bg-white text-black font-black text-xs px-6 py-2.5 rounded-2xl active:scale-95 transition-all uppercase">Apply</button>
            </div>
            <div className="flex gap-5 overflow-x-auto scrollbar-hide snap-x pb-4">
              {filters.map(f => (
                <div key={f.name} onClick={() => setFilter(f.class)} className="flex flex-col items-center gap-3 cursor-pointer snap-center group shrink-0">
                  <div className={`w-20 h-20 rounded-3xl overflow-hidden border-4 transition-all duration-300 shadow-xl ${filter === f.class ? "border-blue-500 scale-110 shadow-blue-500/20" : "border-white/5 opacity-50 grayscale hover:opacity-100 hover:grayscale-0"}`}>
                    <img src={mediaType === "image" ? preview : "https://via.placeholder.com/150"} className={`w-full h-full object-cover ${f.class}`} alt={f.name} />
                  </div>
                  <span className={`text-[10px] font-black uppercase tracking-tighter ${filter === f.class ? "text-blue-400" : "text-white/40"}`}>{f.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default AddStory;