import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import Loader from "../components/Loader";
import { FaTimes, FaMagic, FaChevronRight, FaImages, FaPalette, FaTrashAlt, FaCamera, FaSmile, FaMusic, FaLayerGroup } from "react-icons/fa";
import { useAuth } from "../context/AuthContext";
import { createStory } from "../services/storyService";
import { Assets } from "../assets/Assets";
import { getProfileImage } from "../utils/getProfileImage";

// 🔥 FIX: Store permanent font keys instead of volatile Tailwind classes
const fonts = [
  { name: "Classic", key: "classic", class: "font-sans font-bold" },
  { name: "Typewriter", key: "typewriter", class: "font-serif italic" },
  { name: "Modern", key: "modern", class: "font-mono uppercase tracking-widest" },
  { name: "Impact", key: "impact", class: "font-black uppercase tracking-tight" },
  { name: "Cursive", key: "cursive", class: "font-[cursive]" },
  { name: "Marker", key: "marker", class: "font-[fantasy] tracking-wide" },
  { name: "Sleek", key: "sleek", class: "font-sans font-light tracking-[0.3em] uppercase" }
];

const fontMap = {
  classic: "font-sans font-bold",
  typewriter: "font-serif italic",
  modern: "font-mono uppercase tracking-widest",
  impact: "font-black uppercase tracking-tight",
  cursive: "font-[cursive]",
  marker: "font-[fantasy] tracking-wide",
  sleek: "font-sans font-light tracking-[0.3em] uppercase",
};

function AddStory() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const fileInputRef = useRef(null);
  const trashRef = useRef(null);
  const previewRef = useRef(null);
  const editableRef = useRef(null);

  const DEFAULT_AVATAR = "https://cdn-icons-png.flaticon.com/512/149/149071.png";

  const [files, setFiles] = useState([]);
  const [preview, setPreview] = useState(null);
  const [mediaType, setMediaType] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTool, setActiveTool] = useState("none");

  const [text, setText] = useState("");
  const [textColor, setTextColor] = useState("white");
  const [textFont, setTextFont] = useState("classic");
  const [textStyle, setTextStyle] = useState("classic");
  const [textSize, setTextSize] = useState(36);
  
  const [filter, setFilter] = useState("filter-none");
  const [tempFilter, setTempFilter] = useState("filter-none");
  const [textBgIndex, setTextBgIndex] = useState(0);

  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isOverTrash, setIsOverTrash] = useState(false);
  
  const dragOffset = useRef({ x: 0, y: 0, startX: 0, startY: 0 });
  const hasDraggedRef = useRef(false);

  const colors = ["white", "black", "#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899"];

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

  const textStyles = ["classic", "highlight", "neon", "playful", "outline", "glitch", "3d-pop", "elegant"];

  // Sync effect for contentEditable
  useEffect(() => {
    if (
      activeTool === "text" &&
      editableRef.current &&
      editableRef.current.textContent !== text
    ) {
      editableRef.current.textContent = text;
    }
  }, [activeTool, text]);

  // 🔥 FIX 3: Memory leak cleanup for blob URLs
  useEffect(() => {
    return () => {
      if (preview && preview.startsWith("blob:")) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    if (!selectedFiles.length) return;

    const firstFile = selectedFiles[0];

    if (firstFile.type.startsWith("video/")) {
      const videoNode = document.createElement("video");
      videoNode.preload = "metadata";
      videoNode.onloadedmetadata = () => {
        window.URL.revokeObjectURL(videoNode.src);
        if (videoNode.duration > 30) {
          toast.error("First video must be 30s or less!");
          return;
        }
        setFiles(selectedFiles);
        setMediaType("video");
        setPreview(URL.createObjectURL(firstFile)); 
      };
      videoNode.src = URL.createObjectURL(firstFile);
    } else if (firstFile.type.startsWith("image/")) {
      setFiles(selectedFiles);
      setMediaType("image");
      setPreview(URL.createObjectURL(firstFile));
    }
  };

  const initTextStory = () => {
    setMediaType("text");
    setPreview("text-mode");
    setActiveTool("text");
  };

  const handleStart = (e) => {
    if (!text || activeTool !== "none" || !previewRef.current) return;
    
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const rect = previewRef.current.getBoundingClientRect();
    
    setIsDragging(true);
    hasDraggedRef.current = false; 
    
    dragOffset.current = { 
      x: clientX - rect.left - (position.x + rect.width / 2), 
      y: clientY - rect.top - (position.y + rect.height / 2),
      startX: clientX,
      startY: clientY
    };
  };

  const handleMove = (e) => {
    if (!isDragging || !previewRef.current) return;
    
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const rect = previewRef.current.getBoundingClientRect();
    
    const dist = Math.hypot(clientX - dragOffset.current.startX, clientY - dragOffset.current.startY);
    if (dist > 5) hasDraggedRef.current = true; 

    setPosition({ 
      x: clientX - rect.left - dragOffset.current.x - rect.width / 2, 
      y: clientY - rect.top - dragOffset.current.y - rect.height / 2
    });

    if (trashRef.current) {
      const trashRect = trashRef.current.getBoundingClientRect();
      const trashCenterX = trashRect.left + trashRect.width / 2;
      const trashCenterY = trashRect.top + trashRect.height / 2;
      const distance = Math.hypot(clientX - trashCenterX, clientY - trashCenterY);
      setIsOverTrash(distance < 70); 
    }
  };

  const handleEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);

    if (isOverTrash) {
      clearText();
    }
    setIsOverTrash(false);
  };

  const handleTextClick = (e) => {
    e.stopPropagation();
    if (hasDraggedRef.current) return; 
    setActiveTool("text");
  };

  // 🔥 FIX 1: Complete state reset
  const clearText = () => {
    setText("");
    if (editableRef.current) editableRef.current.textContent = "";
    setPosition({ x: 0, y: 0 }); 
    setTextFont("classic");
    setTextStyle("classic");
    setTextSize(36);
    setTextColor("white");
  };

  // 🔥 FIX 5: Safer text slicing to protect contentEditable cursor
  const handleEditableInput = (e) => {
    const newText = e.currentTarget.textContent || "";
    setText(newText.slice(0, 250));
  };

  const handleSubmit = async () => {
    if (!preview && mediaType !== "text") return;

    // 🔥 FIX 4: Prevent empty text story submission
    if (mediaType === "text" && !text.trim()) {
      toast.error("Text story cannot be empty");
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("type", mediaType);
      
      if (files && files.length > 0) {
        files.forEach((file) => {
          formData.append("media", file);
        });
      }

      if (text && previewRef.current) {
        formData.append("text", text);
        formData.append("textColor", textColor);
        formData.append("textFont", textFont); 
        formData.append("textStyle", textStyle);
        formData.append("textSize", textSize);
        
        // 🔥 FIX 2: Strict coordinate clamping (0.0 to 1.0)
        const normalizedX = Math.max(
          0,
          Math.min(
            1,
            (position.x + previewRef.current.clientWidth / 2) /
              previewRef.current.clientWidth
          )
        );

        const normalizedY = Math.max(
          0,
          Math.min(
            1,
            (position.y + previewRef.current.clientHeight / 2) /
              previewRef.current.clientHeight
          )
        );

        formData.append("textX", normalizedX.toFixed(4));
        formData.append("textY", normalizedY.toFixed(4));
      }
      
      if (mediaType === "text") formData.append("bgGradient", gradients[textBgIndex]);
      else formData.append("filter", filter);
      
      await createStory(formData);
      toast.success(files.length > 1 ? `Uploaded ${files.length} stories!` : "Added to your story!");
      navigate("/feed");
    } catch (err) {
      toast.error("Failed to upload story");
    } finally {
      setLoading(false);
    }
  };

  const getDynamicStyles = (isEditing = false) => {
    let baseTransform = `translate(-50%, -50%) translate3d(${position.x}px, ${position.y}px, 0)`;

    let style = {
      position: "absolute",
      left: "50%",
      top: "50%",
      color: textColor,
      fontSize: `${textSize}px`,
      display: "inline-block",
      textAlign: "center",
      whiteSpace: "pre-wrap",
      lineHeight: "1.4", 
      maxWidth: "90%",
      wordBreak: "break-word",
      transform: baseTransform,
      zIndex: 30,
    };

    if (!isEditing) {
      style.transition = isDragging ? "none" : "transform 0.2s ease, opacity 0.2s ease";
      if (isOverTrash) style.opacity = 0.5;
    }

    if (textStyle === "highlight") {
      style.backgroundColor = textColor;
      style.color = textColor === "white" || textColor === "#eab308" ? "black" : "white";
      style.padding = "4px 16px"; 
      style.borderRadius = "12px";
      style.boxDecorationBreak = "clone";
      style.WebkitBoxDecorationBreak = "clone";
    } else if (textStyle === "neon") {
      style.textShadow = `0 0 10px ${textColor}, 0 0 20px ${textColor}, 0 0 30px ${textColor}`;
      style.color = "white";
    } else if (textStyle === "outline") {
      style.WebkitTextStroke = `1.5px ${textColor === "black" ? "white" : "black"}`;
    } else if (textStyle === "3d-pop") {
      style.textShadow = `2px 2px 0px #000, 4px 4px 0px #222, 6px 6px 0px #444`;
    } else if (textStyle === "glitch") {
      style.textShadow = `3px 0 0 red, -3px 0 0 cyan`;
    } else if (textStyle === "playful") {
      style.transform = `${baseTransform} rotate(-5deg)`;
      style.textShadow = "3px 3px 0px rgba(0,0,0,0.5)";
    } else if (textStyle === "elegant") {
      style.textShadow = "0px 2px 4px rgba(0,0,0,0.3)";
      style.letterSpacing = "2px";
    } else {
      style.textShadow = "0 2px 10px rgba(0,0,0,0.8)";
    }

    return style;
  };

  const getDynamicTextClasses = () => {
    const fontClass = fontMap[textFont] || fontMap.classic;
    let base = `absolute cursor-move px-6 py-3 whitespace-pre-wrap break-words select-none transition-all duration-200 ${fontClass} z-30 touch-none`;

    if (isOverTrash) {
      base += " scale-50 opacity-50";
    } else {
      if (textStyle === "playful") {
        base += ` -rotate-6 scale-110 skew-x-[-5deg]`;
      }
    }

    return base;
  };

  return (
    <div className="fixed inset-0 bg-[#050505] z-[100] flex flex-col h-[100dvh] overflow-hidden font-['Poppins',sans-serif] select-none text-white">
      <input type="file" multiple ref={fileInputRef} onChange={handleFileChange} accept="image/*,video/*" className="hidden" />

      {/* START SCREEN (No Preview) */}
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

      {/* STORY EDITOR (Preview Mode) */}
      {preview && (
        <div className="relative w-full h-full flex justify-center items-center overflow-hidden"
          onMouseMove={handleMove} onMouseUp={handleEnd} onTouchMove={handleMove} onTouchEnd={handleEnd} onMouseLeave={handleEnd}>
          
          {/* Top Navbar */}
          {activeTool === "none" && (
            <div className="absolute top-0 left-0 w-full p-6 flex justify-between items-start z-40 bg-gradient-to-b from-black/80 to-transparent pointer-events-auto">
              <button onClick={() => { setPreview(null); setFiles([]); clearText(); }} className="w-12 h-12 flex items-center justify-center bg-black/20 backdrop-blur-xl rounded-2xl border border-white/10 active:scale-90"><FaTimes size={22} /></button>
              <div className="flex gap-4 p-2 bg-black/20 backdrop-blur-xl rounded-3xl border border-white/10">
                {mediaType === "text" && <button onClick={() => setTextBgIndex((prev) => (prev + 1) % gradients.length)} className="p-3"><FaPalette size={22} /></button>}
                {mediaType !== "text" && <button onClick={() => { setTempFilter(filter); setActiveTool("filter"); }} className="p-3"><FaMagic size={22} /></button>}
                <button onClick={() => setActiveTool("text")} className="p-3"><span className="font-bold text-xl font-serif italic">Aa</span></button>
              </div>
            </div>
          )}

          {/* Media Container with Ref */}
          <div ref={previewRef} onClick={() => { if (activeTool === "none") setActiveTool("text"); }}
            className={`relative w-full max-w-[420px] h-[100dvh] sm:h-[90vh] sm:max-h-[850px] bg-black sm:rounded-[32px] overflow-hidden flex flex-col items-center justify-center border sm:border-white/10 ${mediaType === "text" ? `bg-gradient-to-br ${gradients[textBgIndex]}` : ""}`}>
            
            {mediaType === "video" && <video src={preview} autoPlay loop muted playsInline className={`w-full h-full object-cover transition-all duration-700 ${activeTool === 'filter' ? tempFilter : filter}`} />}
            {mediaType === "image" && <img src={preview} alt="Preview" className={`w-full h-full object-cover transition-all duration-700 ${activeTool === 'filter' ? tempFilter : filter}`} />}

            {/* Draggable Text Overlay */}
            {text && activeTool === "none" && (
              <div 
                onMouseDown={handleStart} 
                onTouchStart={handleStart} 
                className={getDynamicTextClasses()}
                style={getDynamicStyles(false)}
                onClick={handleTextClick}
              >
                {text}
              </div>
            )}
          </div>

          {/* Trash Can UI */}
          {text && isDragging && (
            <div className="absolute bottom-20 left-0 w-full flex justify-center z-50 pointer-events-none transition-all duration-200">
              <div 
                ref={trashRef}
                className={`flex items-center justify-center rounded-full backdrop-blur-xl border transition-all duration-200 ${
                  isOverTrash 
                    ? "w-16 h-16 bg-red-600 border-red-500 shadow-[0_0_30px_rgba(239,68,68,0.8)] scale-110" 
                    : "w-12 h-12 bg-black/50 border-white/20 scale-100"
                }`}
              >
                <FaTrashAlt size={isOverTrash ? 24 : 18} className={isOverTrash ? "text-white" : "text-white/80"} />
              </div>
            </div>
          )}

          {/* Bottom Footer (Submit) */}
          {activeTool === "none" && (
            <div className="absolute bottom-10 right-6 z-40 flex items-center gap-3 pointer-events-auto">
              
              {files.length > 1 && (
                <div className="bg-black/60 backdrop-blur-xl text-white px-4 py-2 rounded-full text-xs font-black border border-white/10 flex items-center gap-2 shadow-lg">
                  <FaLayerGroup size={14} className="text-blue-400" />
                  {files.length} STORIES
                </div>
              )}

              <div className="bg-black/60 backdrop-blur-xl text-white pl-2 pr-5 py-2 rounded-full text-xs font-black border border-white/10 flex items-center gap-3 shadow-lg">
                <div className="p-1 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500">
                  <img src={user ? getProfileImage(user) : DEFAULT_AVATAR} alt="Profile" className="w-8 h-8 rounded-full object-cover border-2 border-black" />
                </div>
                YOUR STORY
              </div>
              <button onClick={handleSubmit} disabled={loading} className="w-16 h-16 bg-white text-black rounded-full flex items-center justify-center shadow-xl active:scale-90 disabled:opacity-50 transition-all">
                {loading ? <Loader size="24px" color="#000" /> : <FaChevronRight size={24} />}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ACTIVE TEXT EDITING MODE */}
      {activeTool === "text" && preview && (
        <>
          <div className="absolute inset-0 z-40 bg-black/80 backdrop-blur-[30px]" onClick={() => setActiveTool("none")}></div>
          
          <div className="absolute inset-0 flex flex-col justify-between z-50 p-6 pointer-events-none">
            <div className="flex justify-between items-center mt-6 pointer-events-auto">
              <button onClick={() => {
                const idx = textStyles.indexOf(textStyle);
                setTextStyle(textStyles[(idx + 1) % textStyles.length]);
              }} className="px-6 py-2.5 bg-white/10 text-white rounded-2xl font-black text-xs border border-white/10 uppercase tracking-widest">
                Style: {textStyle}
              </button>
              <div className="flex items-center gap-4">
                <button onClick={clearText} className="text-white/60 hover:text-white font-bold text-xs uppercase tracking-widest">Clear</button>
                <button onClick={() => setActiveTool("none")} className="text-blue-500 font-black text-lg p-2 active:scale-90">Done</button>
              </div>
            </div>
            
            <div className="flex-1 flex items-center justify-center w-full px-4 relative pointer-events-auto">
              <div className="absolute left-0 h-48 w-1 bg-white/20 rounded-full flex flex-col justify-between items-center py-2">
                <input 
                  type="range" min="16" max="100" value={textSize} 
                  onChange={(e) => setTextSize(Number(e.target.value))}
                  className="w-48 h-1 -rotate-90 appearance-none bg-transparent cursor-pointer"
                  style={{ WebkitAppearance: 'none', transformOrigin: 'center' }}
                />
              </div>

              {/* Ref-Controlled ContentEditable Div with fontMap */}
              <div 
                ref={editableRef}
                contentEditable
                suppressContentEditableWarning
                spellCheck={false}
                onInput={handleEditableInput}
                onFocus={() => {
                  requestAnimationFrame(() => {
                    if (editableRef.current) {
                      const range = document.createRange();
                      const sel = window.getSelection();
                      range.selectNodeContents(editableRef.current);
                      range.collapse(false);
                      sel.removeAllRanges();
                      sel.addRange(range);
                    }
                  });
                }}
                className={`bg-transparent outline-none border-none min-w-[40px] min-h-[40px] cursor-text px-6 py-3 whitespace-pre-wrap break-words text-center inline-block max-w-[90%] empty:before:content-['Type_something...'] empty:before:opacity-50 empty:before:text-white/50 ${fontMap[textFont] || fontMap.classic}`}
                style={{
                  ...getDynamicStyles(true),
                  userSelect: "text",
                  WebkitUserSelect: "text",
                  caretColor: textColor,
                  touchAction: "manipulation",
                }}
              ></div>
            </div>
            
            <div className="flex flex-col items-center gap-8 mb-10 pointer-events-auto">
              <div className="flex gap-3 overflow-x-auto scrollbar-hide w-full px-4">
                {fonts.map(f => (
                  <button 
                    key={f.key} 
                    onClick={() => setTextFont(f.key)} 
                    className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-tighter whitespace-nowrap transition-all ${textFont === f.key ? "bg-white text-black scale-105" : "bg-white/10 text-white/60"}`}
                  >
                    {f.name}
                  </button>
                ))}
              </div>
              <div className="flex gap-4 overflow-x-auto scrollbar-hide w-full justify-center px-4">
                {colors.map(c => (
                  <button key={c} onClick={() => setTextColor(c)} className={`w-9 h-9 rounded-full border-4 shrink-0 transition-transform active:scale-75 ${textColor === c ? "border-white scale-125 shadow-lg" : "border-transparent opacity-60"}`} style={{ backgroundColor: c }}></button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* FILTER TRAY */}
      {activeTool === "filter" && preview && mediaType !== "text" && (
        <>
          <div className="absolute inset-0 z-40 bg-transparent" onClick={() => { setTempFilter(filter); setActiveTool("none"); }}></div>
          <div className="absolute inset-x-0 bottom-0 z-50 flex flex-col justify-end animate-in slide-in-from-bottom duration-500 pointer-events-auto">
            <div className="w-full bg-black/60 backdrop-blur-3xl border-t border-white/10 rounded-t-[40px] pt-8 pb-14 px-6 shadow-[0_-20px_50px_rgba(0,0,0,0.5)]">
              <div className="flex justify-between items-center mb-6 px-2">
                <button onClick={() => { setTempFilter(filter); setActiveTool("none"); }} className="text-white/60 hover:text-white font-bold text-xs uppercase tracking-widest px-2">Cancel</button>
                <h3 className="text-white font-black text-lg tracking-widest uppercase opacity-40">Filters</h3>
                <button onClick={() => { setFilter(tempFilter); setActiveTool("none"); }} className="bg-white text-black font-black text-xs px-6 py-2.5 rounded-2xl active:scale-95 transition-all uppercase">Apply</button>
              </div>
              <div className="flex gap-5 overflow-x-auto scrollbar-hide snap-x pb-4">
                {filters.map(f => (
                  <div key={f.name} onClick={() => setTempFilter(f.class)} className="flex flex-col items-center gap-3 cursor-pointer snap-center group shrink-0">
                    <div className={`w-20 h-20 rounded-3xl overflow-hidden border-4 transition-all duration-300 shadow-xl ${tempFilter === f.class ? "border-blue-500 scale-110 shadow-blue-500/20" : "border-white/5 opacity-50 grayscale hover:opacity-100 hover:grayscale-0"}`}>
                      <img src={mediaType === "image" ? preview : "https://via.placeholder.com/150"} className={`w-full h-full object-cover ${f.class}`} alt={f.name} />
                    </div>
                    <span className={`text-[10px] font-black uppercase tracking-tighter ${tempFilter === f.class ? "text-blue-400" : "text-white/40"}`}>{f.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default AddStory;