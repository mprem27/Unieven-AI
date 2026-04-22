import React, { useState, useRef } from "react";
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
import { getProfileImage } from "../utils/getProfileImage"; // ✅ IMPORTED PROFILE IMAGE LOGIC

function AddStory() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const fileInputRef = useRef(null);

  // Default placeholder image if the user has no profile picture
  const DEFAULT_AVATAR = "https://cdn-icons-png.flaticon.com/512/149/149071.png";

  // 📸 Media States
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [mediaType, setMediaType] = useState(null); // 'image', 'video', 'text'
  const [loading, setLoading] = useState(false);

  // 🎨 Editor States
  const [activeTool, setActiveTool] = useState("none"); // 'none', 'text', 'filter', 'bg'

  // 📝 Text Overlay States
  const [text, setText] = useState("");
  const [textColor, setTextColor] = useState("white");
  const [textFont, setTextFont] = useState("font-sans");
  const [textStyle, setTextStyle] = useState("classic");

  // 🪄 Filter & Background States
  const [filter, setFilter] = useState("filter-none");
  const [textBgIndex, setTextBgIndex] = useState(0);

  // ✋ Dragging States
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Options
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
    { name: "Warm", class: "sepia-[.4] saturate-[1.8]" },
    { name: "Dreamy", class: "blur-[1.5px] brightness-110 saturate-50" },
    { name: "Invert", class: "invert" }
  ];

  const gradients = [
    "from-purple-500 via-pink-500 to-red-500",
    "from-blue-600 via-indigo-600 to-purple-600",
    "from-green-400 via-emerald-500 to-teal-600",
    "from-orange-400 via-amber-500 to-yellow-500",
    "from-gray-900 via-gray-800 to-black"
  ];

  const textStyles = ["classic", "highlight", "neon", "playful"];

  // 📁 Handle File Upload
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

  // ✨ Enable Text-Only Mode
  const initTextStory = () => {
    setMediaType("text");
    setPreview("text-mode");
    setActiveTool("text");
  };

  // ✋ Drag Handlers
  const handleMouseDown = (e) => {
    if (!text || activeTool !== "none") return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };
  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };
  const handleMouseUp = () => setIsDragging(false);

  // 🗑️ Delete Text
  const clearText = () => {
    setText("");
    setPosition({ x: 0, y: 0 });
  };

  // 🚀 Submit Story
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

      if (mediaType === "text") {
        formData.append("bgGradient", gradients[textBgIndex]);
      } else {
        formData.append("filter", filter);
      }

      await createStory(formData);
      toast.success("Added to your story!");
      navigate("/feed");
    } catch (err) {
      toast.error("Failed to upload story");
    } finally {
      setLoading(false);
    }
  };

  // Dynamic Text Styling
  const getDynamicTextClasses = () => {
    let base = `absolute cursor-move px-6 py-3 text-4xl whitespace-nowrap select-none transition-all duration-200 ${textFont} z-30`;
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
    <div className="fixed inset-0 bg-black z-[100] flex flex-col h-[100dvh] overflow-hidden font-['Poppins',sans-serif] select-none">

      {/* Hidden File Input */}
      <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*,video/*" className="hidden" />

      {/* =========================================
          EMPTY STATE (CAMERA STYLE UI)
      ========================================== */}
      {!preview && (
        <div className="w-full h-full flex flex-col relative bg-[#111]">
          {/* Top Controls */}
          <div className="absolute top-0 left-0 w-full p-6 flex justify-between z-10">
            <button onClick={() => navigate("/feed")} className="text-white drop-shadow-md hover:scale-110 transition-transform">
              <FaTimes size={28} />
            </button>
            <button className="text-white drop-shadow-md hover:scale-110 transition-transform">
              <FaMagic size={24} />
            </button>
          </div>

          {/* Camera Viewfinder Area */}
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="w-full h-full max-h-[70vh] bg-black/40 rounded-3xl border border-white/10 m-4 flex items-center justify-center relative overflow-hidden">

              <div className="absolute inset-0 flex items-center justify-center opacity-20 pointer-events-none z-0">
                {/* Faux framing grid */}
                <div className="w-[80%] h-[80%] border border-dashed border-white/30 rounded-3xl"></div>
              </div>

              {/* CUSTOM ICON PLACEHOLDERS */}
              <div className="z-10 flex gap-8 items-center text-white/90 font-bold uppercase tracking-widest text-xs">

                {/* ICON 1: CAMERA */}
                <div className="flex flex-col items-center gap-3 cursor-pointer group" onClick={() => fileInputRef.current.click()}>
                  <div className="w-14 h-14 border border-white/40 rounded-full flex items-center justify-center bg-black/20 backdrop-blur-sm group-hover:bg-white/20 group-hover:scale-105 transition-all shadow-lg">
                    <FaCamera size={22} className="text-white" />
                  </div>
                  <span className="text-[9px] drop-shadow-md">Camera</span>
                </div>

                {/* ICON 2: EFFECTS (SMILE) */}
                <div className="flex flex-col items-center gap-3 cursor-pointer group" onClick={() => fileInputRef.current.click()}>
                  <div className="w-14 h-14 border border-white/40 rounded-full flex items-center justify-center bg-black/20 backdrop-blur-sm group-hover:bg-white/20 group-hover:scale-105 transition-all shadow-lg">
                    <FaSmile size={24} className="text-white" />
                  </div>
                  <span className="text-[9px] drop-shadow-md">Effects</span>
                </div>

                {/* ICON 3: MUSIC */}
                <div className="flex flex-col items-center gap-3 cursor-pointer group" onClick={() => fileInputRef.current.click()}>
                  <div className="w-14 h-14 border border-white/40 rounded-full flex items-center justify-center bg-black/20 backdrop-blur-sm group-hover:bg-white/20 group-hover:scale-105 transition-all shadow-lg">
                    <FaMusic size={20} className="text-white" />
                  </div>
                  <span className="text-[9px] drop-shadow-md">Music</span>
                </div>

              </div>

            </div>
          </div>

          {/* Bottom Camera Controls */}
          <div className="h-[140px] flex items-center justify-around px-8 pb-8">
            <button onClick={() => fileInputRef.current.click()} className="flex flex-col items-center gap-2 group">
              <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center border border-white/20 group-hover:bg-white/20 transition-all">
                <FaImages size={20} className="text-white" />
              </div>
            </button>

            {/* Shutter Button */}
            <button onClick={() => fileInputRef.current.click()} className="w-20 h-20 rounded-full border-[4px] border-white p-1 hover:scale-95 transition-transform">
              <img
                src={Assets.shutter} 
                alt="Shutter"
                className="w-full h-full rounded-full object-cover"
              />
            </button>

            <button onClick={initTextStory} className="flex flex-col items-center gap-2 group">
              <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center border border-white/20 group-hover:bg-white/20 transition-all">
                <span className="text-white font-bold text-lg font-serif italic">Aa</span>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* =========================================
          EDITOR WORKSPACE
      ========================================== */}
      {preview && (
        <div
          className="relative w-full h-full flex justify-center items-center overflow-hidden"
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {/* 🔝 TOP TOOLS */}
          {activeTool === "none" && (
            <div className="absolute top-0 left-0 w-full p-6 flex justify-between items-start z-40 bg-gradient-to-b from-black/60 to-transparent">
              <button onClick={() => { setPreview(null); setFile(null); clearText(); }} className="text-white drop-shadow-md hover:scale-110 transition-transform">
                <FaTimes size={28} />
              </button>

              <div className="flex gap-5">
                {mediaType === "text" && (
                  <button onClick={() => setTextBgIndex((prev) => (prev + 1) % gradients.length)} className="text-white drop-shadow-md hover:scale-110 transition-transform">
                    <FaPalette size={26} />
                  </button>
                )}
                {mediaType !== "text" && (
                  <button onClick={() => setActiveTool("filter")} className="text-white drop-shadow-md hover:scale-110 transition-transform">
                    <FaMagic size={26} />
                  </button>
                )}
                <button onClick={() => setActiveTool("text")} className="text-white drop-shadow-md hover:scale-110 transition-transform">
                  <span className="font-bold text-2xl font-serif italic">Aa</span>
                </button>
              </div>
            </div>
          )}

          {/* 🖼️ THE CANVAS */}
          <div
            onClick={() => { if (activeTool === "none") setActiveTool("text"); }}
            className={`relative w-full h-full md:max-w-[420px] md:h-[90%] md:rounded-3xl shadow-2xl overflow-hidden bg-black flex items-center justify-center ${mediaType === "text" ? `bg-gradient-to-br ${gradients[textBgIndex]}` : ""}`}
          >
            {mediaType === "video" && (
              <video src={preview} autoPlay loop muted playsInline className={`w-full h-full object-cover transition-all duration-300 ${filter}`} />
            )}
            {mediaType === "image" && (
              <img src={preview} alt="Preview" className={`w-full h-full object-cover transition-all duration-300 ${filter}`} />
            )}

            {/* 📝 DRAGGABLE TEXT */}
            {text && activeTool === "none" && (
              <div
                onMouseDown={handleMouseDown}
                className={getDynamicTextClasses()}
                style={getDynamicTextStyles()}
                onClick={(e) => { e.stopPropagation(); setActiveTool("text"); }}
              >
                {text}
              </div>
            )}
          </div>

          {/* 🗑️ TRASH CAN (Visible if text exists) */}
          {text && activeTool === "none" && (
            <button onClick={clearText} className="absolute bottom-[120px] bg-black/40 text-white p-4 rounded-full backdrop-blur-md hover:bg-red-500/80 transition-colors z-40 shadow-lg">
              <FaTrashAlt size={20} />
            </button>
          )}

          {/* 🚀 SEND BUTTON (BOTTOM RIGHT) WITH PROFILE IMAGE */}
          {activeTool === "none" && (
            <div className="absolute bottom-8 right-6 z-40 flex items-center gap-3">
              <div className="bg-black/50 backdrop-blur-md text-white px-4 py-2 rounded-full text-sm font-bold border border-white/10 shadow-lg flex items-center gap-2">
                {/* ✅ ADDED PROFILE IMAGE HERE */}
                <img 
                  src={user ? getProfileImage(user) : DEFAULT_AVATAR} 
                  onError={(e) => { e.target.onerror = null; e.target.src = DEFAULT_AVATAR; }}
                  alt="Profile" 
                  className="w-6 h-6 rounded-full object-cover border border-white/30"
                />
                Your Story
              </div>
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="w-14 h-14 bg-white text-black rounded-full flex items-center justify-center hover:scale-105 transition-transform shadow-[0_0_20px_rgba(255,255,255,0.3)] active:scale-95"
              >
                {/* You can change FaChevronRight to your custom icon here if you want */}
                {loading ? <Loader size="20px" color="#000" /> : <FaChevronRight size={20} />}
              </button>
            </div>
          )}
        </div>
      )}

      {/* =========================================
          TEXT EDITOR OVERLAY
      ========================================== */}
      {activeTool === "text" && preview && (
        <div className="absolute inset-0 bg-black/60 flex flex-col justify-between z-50 p-6 backdrop-blur-md animate-in fade-in duration-200">

          <div className="flex justify-between items-center mt-4">
            <button onClick={() => {
              const idx = textStyles.indexOf(textStyle);
              setTextStyle(textStyles[(idx + 1) % textStyles.length]);
            }} className="w-10 h-10 bg-white/20 text-white rounded-full flex items-center justify-center font-black text-sm border border-white/40">
              A
            </button>
            <button onClick={() => setActiveTool("none")} className="text-white font-black text-lg drop-shadow-md">Done</button>
          </div>

          <div className="flex-1 flex items-center justify-center w-full">
            <input
              type="text"
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type something..."
              className={`bg-transparent text-center text-4xl w-full outline-none border-none pb-2 drop-shadow-2xl ${textFont}`}
              style={{
                color: textStyle === 'highlight' && (textColor === 'white' || textColor === '#eab308') ? 'black' : textColor,
                backgroundColor: textStyle === 'highlight' ? textColor : 'transparent',
                padding: textStyle === 'highlight' ? '12px 24px' : '0',
                borderRadius: '16px'
              }}
            />
          </div>

          <div className="flex flex-col items-center gap-6 mb-4">
            <div className="flex gap-2 bg-black/50 p-2 rounded-full backdrop-blur-md overflow-x-auto max-w-[100%] scrollbar-hide">
              {fonts.map(f => (
                <button key={f.name} onClick={() => setTextFont(f.class)} className={`px-4 py-2 text-white text-xs font-bold rounded-full transition-colors whitespace-nowrap ${textFont === f.class ? "bg-white text-black" : "hover:bg-white/20"}`}>
                  {f.name}
                </button>
              ))}
            </div>

            <div className="flex gap-3 bg-black/50 p-3 rounded-full backdrop-blur-md overflow-x-auto max-w-[100%] scrollbar-hide border border-white/10">
              {colors.map(c => (
                <div key={c} onClick={() => setTextColor(c)} className={`w-8 h-8 rounded-full cursor-pointer border-2 transition-transform shrink-0 ${textColor === c ? "border-white scale-110" : "border-transparent"}`} style={{ backgroundColor: c }}></div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* =========================================
          FILTER TRAY OVERLAY
      ========================================== */}
      {activeTool === "filter" && preview && mediaType !== "text" && (
        <div className="absolute inset-0 z-50 flex flex-col justify-end pb-10 animate-in slide-in-from-bottom-10 duration-200">
          <div className="w-full bg-gradient-to-t from-black via-black/90 to-transparent pt-20 pb-10 px-4">

            <div className="flex justify-between items-center mb-6 px-4">
              <h3 className="text-white font-black text-lg tracking-wide drop-shadow-md">Filters</h3>
              <button onClick={() => setActiveTool("none")} className="text-white font-bold bg-white/20 px-5 py-2 rounded-full backdrop-blur-md hover:bg-white/30 transition-colors">Done</button>
            </div>

            <div className="flex gap-5 overflow-x-auto scrollbar-hide snap-x px-4 pb-4">
              {filters.map(f => (
                <div key={f.name} onClick={() => setFilter(f.class)} className="flex flex-col items-center gap-3 cursor-pointer snap-center group shrink-0">
                  <div className={`w-16 h-16 rounded-full overflow-hidden border-[3px] transition-all duration-200 shadow-xl ${filter === f.class ? "border-blue-500 scale-110" : "border-white/40 group-hover:border-white/80"}`}>
                    <img src={mediaType === "image" ? preview : "https://via.placeholder.com/150"} className={`w-full h-full object-cover ${f.class}`} alt={f.name} />
                  </div>
                  <span className={`text-[10px] font-black uppercase tracking-widest ${filter === f.class ? "text-blue-400" : "text-white/80"}`}>{f.name}</span>
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