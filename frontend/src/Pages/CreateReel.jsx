import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { createReel } from "../services/reelService"; 
import { getProfileImage } from "../utils/getProfileImage";
import Loader from "../components/Loader";
import { toast } from "react-toastify";
import { 
  FaVideo, 
  FaMapMarkerAlt, 
  FaHashtag, 
  FaFont, 
  FaPaperPlane, 
  FaTimes,
  FaPlay,
  FaPause,
  FaVolumeUp,
  FaVolumeMute
} from "react-icons/fa";

function CreateReel() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);

  // General States
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  // Video Control States
  const [playing, setPlaying] = useState(true);
  const [muted, setMuted] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  // Form Data States
  const [caption, setCaption] = useState("");
  const [overlayText, setOverlayText] = useState("");
  const [overlayFont, setOverlayFont] = useState("font-sans");
  const [location, setLocation] = useState("");
  const [tags, setTags] = useState("");

  // Draggable Text States
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

  // 🎥 HANDLE VIDEO FILE PROCESSING
  const processFile = (selectedFile) => {
    if (selectedFile) {
      if (!selectedFile.type.startsWith("video/")) {
        toast.error("Please select a valid VIDEO file");
        return;
      }
      setFile(selectedFile);
      setPreview(URL.createObjectURL(selectedFile));
      setTextPos({ x: 0, y: 0 });
      setPlaying(true);
    }
  };

  const handleFileChange = (e) => processFile(e.target.files[0]);

  // 🖱️ DRAG AND DROP HANDLERS
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

  const handlePointerUp = () => setIsDraggingText(false);

  // ▶️ PLAY / PAUSE
  const togglePlay = (e) => {
    e.stopPropagation();
    if (!videoRef.current) return;
    if (playing) videoRef.current.pause();
    else videoRef.current.play();
    setPlaying(!playing);
  };

  // 🔊 MUTE TOGGLE
  const toggleMute = (e) => {
    e.stopPropagation();
    if (!videoRef.current) return;
    videoRef.current.muted = !muted;
    setMuted(!muted);
  };

  // ⏩ CHANGE SPEED
  const handleSpeedChange = (speed) => {
    setPlaybackSpeed(speed);
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
  };

  // ❌ RESET FORM
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

  // 🚀 SUBMIT TO BACKEND
  const handleSubmit = async () => {
    if (!file) return toast.error("Please select a video to post!");

    setLoading(true);
    try {
      const formData = new FormData();
      
      formData.append("video", file); 
      formData.append("caption", caption);
      
      // Sending effect/meta data just in case backend wants to save it
      formData.append("playbackSpeed", playbackSpeed);
      
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

      await createReel(formData);
      toast.success("Reel uploaded successfully! 🎉");
      navigate("/reels");

    } catch (err) {
      toast.error(err.message || "Failed to upload reel.");
    } finally {
      setLoading(false);
    }
  };

  const inputStyles = "w-full bg-[#fafafa] border border-[#dbdbdb] rounded-xl px-4 py-3 text-[14px] focus:bg-white focus:border-[#0095f6] focus:ring-1 focus:ring-[#0095f6] outline-none transition-all duration-300 shadow-sm text-[#262626]";

  return (
    <div className="w-full min-h-screen flex justify-center items-center bg-[#F8FAFC] font-['Poppins',sans-serif] antialiased py-10 px-4">
      
      {/* Background Decorative Blurs */}
      <div className="fixed top-[-10%] left-[-10%] w-[400px] h-[400px] bg-blue-100 rounded-full blur-[120px] opacity-40 -z-10" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[400px] h-[400px] bg-purple-100 rounded-full blur-[120px] opacity-40 -z-10" />

      {/* MAIN CONTAINER (Split Screen) */}
      <div className="w-full max-w-[900px] bg-white/60 backdrop-blur-2xl border border-white/60 rounded-[30px] shadow-xl overflow-hidden flex flex-col md:flex-row">
        
        {/* ================= LEFT SIDE: VIDEO PREVIEW ================= */}
        <div 
          className="w-full md:w-1/2 min-h-[500px] bg-black flex flex-col items-center justify-center relative border-r border-gray-200/50"
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onMouseMove={handlePointerMove}
          onMouseUp={handlePointerUp}
          onMouseLeave={handlePointerUp}
          onTouchMove={handlePointerMove}
          onTouchEnd={handlePointerUp}
        >
          
          {preview ? (
            <div className="relative w-full h-full flex items-center justify-center overflow-hidden group">
              <video 
                ref={videoRef}
                src={preview} 
                className="w-full h-full object-contain"
                autoPlay
                loop
                muted={muted}
                playsInline
              />
              
              {/* Gradients for text readability */}
              <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/60 pointer-events-none"></div>

              {/* 🔥 DRAGGABLE OVERLAY TEXT */}
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

              {/* Video Controls (Play/Pause & Mute) */}
              <div className="absolute bottom-6 left-6 flex gap-3 z-50">
                <button 
                  onClick={togglePlay} 
                  className="bg-black/40 hover:bg-black/60 text-white p-3 rounded-full backdrop-blur-md transition-all border border-white/10 shadow-lg"
                >
                  {playing ? <FaPause size={14} /> : <FaPlay size={14} className="ml-0.5" />}
                </button>
                <button 
                  onClick={toggleMute} 
                  className="bg-black/40 hover:bg-black/60 text-white p-3 rounded-full backdrop-blur-md transition-all border border-white/10 shadow-lg"
                >
                  {muted ? <FaVolumeMute size={16} /> : <FaVolumeUp size={16} />}
                </button>
              </div>

              {/* Remove Video Button */}
              <button 
                onClick={handleDiscard}
                className="absolute top-4 right-4 bg-black/50 hover:bg-red-500 text-white p-2.5 rounded-full backdrop-blur-md transition-all opacity-0 group-hover:opacity-100 z-50"
                title="Remove Video"
              >
                <FaTimes size={14} />
              </button>
            </div>
          ) : (
            <div 
              onClick={() => fileInputRef.current.click()}
              className="flex flex-col items-center justify-center gap-4 cursor-pointer w-full h-full p-10 hover:bg-gray-900 transition-colors"
            >
              <div className={`w-20 h-20 bg-gray-800 rounded-full flex items-center justify-center shadow-sm border border-gray-700 text-blue-400 transition-all ${dragActive && "scale-110 bg-gray-700"}`}>
                <FaVideo size={30} />
              </div>
              <h3 className="text-xl font-black text-white">Select a Video</h3>
              <p className="text-sm text-gray-400 font-medium">Click or drag a video file here</p>
            </div>
          )}
          
          <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="video/*" className="hidden" />
        </div>

        {/* ================= RIGHT SIDE: FORM DETAILS ================= */}
        <div className="w-full md:w-1/2 p-6 md:p-8 flex flex-col bg-white/40 overflow-y-auto">
          
          {/* Header */}
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100 shrink-0">
            <img 
              src={getProfileImage(user)} 
              className="w-10 h-10 rounded-full object-cover border border-gray-200"
              alt="Profile"
            />
            <span className="font-bold text-gray-900">{user?.username || "Create New Reel"}</span>
          </div>

          <div className="flex flex-col gap-5 flex-1">
            
            {/* CAPTION */}
            <div>
              <textarea 
                placeholder="Write a caption for your reel..." 
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                rows="3"
                className={`${inputStyles} resize-none bg-transparent border-none px-0 focus:ring-0 focus:border-transparent text-[15px]`}
              />
            </div>

            <hr className="border-gray-100" />

            {/* 🎛 PLAYBACK SPEED EFFECT PREVIEW */}
            <div>
              <p className="text-[13px] font-bold text-gray-500 uppercase tracking-wide mb-2">Effect Preview (Speed)</p>
              <div className="flex gap-2">
                {[0.5, 1, 1.5, 2].map((speed) => (
                  <button
                    key={speed}
                    onClick={() => handleSpeedChange(speed)}
                    disabled={!preview}
                    className={`flex-1 py-1.5 rounded-lg text-[13px] font-bold transition-all shadow-sm ${
                      playbackSpeed === speed 
                        ? "bg-[#0095f6] text-white" 
                        : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                    }`}
                  >
                    {speed}x
                  </button>
                ))}
              </div>
            </div>

            {/* OVERLAY TEXT & FONT SELECTOR */}
            <div className="flex flex-col gap-3">
              <p className="text-[13px] font-bold text-gray-500 uppercase tracking-wide">Draggable Text Overlay</p>
              <div className="relative flex items-center">
                <FaFont className="absolute left-3 text-gray-400" />
                <input 
                  type="text" 
                  placeholder="Type to add text on video..." 
                  value={overlayText}
                  onChange={(e) => setOverlayText(e.target.value)}
                  maxLength={40}
                  disabled={!preview}
                  className={`${inputStyles} pl-10 ${!preview && "opacity-50 cursor-not-allowed"}`}
                />
              </div>

              {preview && overlayText && (
                <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide py-1">
                  {fontOptions.map((font) => (
                    <button
                      key={font.value}
                      onClick={() => setOverlayFont(font.value)}
                      className={`px-4 py-1.5 rounded-full text-[13px] font-bold whitespace-nowrap transition-all shadow-sm ${
                        overlayFont === font.value 
                          ? "bg-gray-800 text-white scale-105" 
                          : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                      } ${font.value}`}
                    >
                      {font.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* LOCATION */}
            <div className="relative flex items-center">
              <FaMapMarkerAlt className="absolute left-3 text-gray-400" />
              <input 
                type="text" 
                placeholder="Add location" 
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className={`${inputStyles} pl-10`}
              />
            </div>

            {/* TAGS */}
            <div className="relative flex items-center">
              <FaHashtag className="absolute left-3 text-gray-400" />
              <input 
                type="text" 
                placeholder="Add tags (comma separated)" 
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                className={`${inputStyles} pl-10`}
              />
            </div>
          </div>

          {/* SUBMIT BUTTON */}
          <button
            onClick={handleSubmit}
            disabled={loading || !file}
            className="mt-8 w-full bg-[#0095f6] hover:bg-[#1877f2] text-white py-3.5 rounded-xl font-bold text-[15px] transition-all duration-300 disabled:opacity-50 shadow-md active:scale-95 flex items-center justify-center gap-2 shrink-0"
          >
            {loading ? (
              <Loader size="20px" color="#ffffff" />
            ) : (
              <>
                Upload Reel <FaPaperPlane size={14} />
              </>
            )}
          </button>

        </div>
      </div>
    </div>
  );
}

export default CreateReel;