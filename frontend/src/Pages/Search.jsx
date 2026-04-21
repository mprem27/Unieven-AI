import React, { useEffect, useState, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { searchAll } from "../services/searchService";
import { getReels } from "../services/reelService"; 
import { getAllEvents } from "../services/eventService"; 
import { getProfileImage } from "../utils/getProfileImage";
import RoleBadge from "../components/RoleBadge";
import Loader from "../components/Loader";
import { FaSearch, FaPlay, FaCalendarAlt } from "react-icons/fa"; 

function Search() {
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState([]);
  
  // ✅ Cleanly split state for Reels and Events
  const [exploreReels, setExploreReels] = useState([]); 
  const [exploreEvents, setExploreEvents] = useState([]); 
  
  const [searchReels, setSearchReels] = useState([]);
  const [searchEvents, setSearchEvents] = useState([]);
  
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  const location = useLocation();
  const navigate = useNavigate();
  const inputRef = useRef();

  // 🔥 AUTO FOCUS WHEN CLICK FROM SIDEBAR
  useEffect(() => {
    if (location.state?.focus) {
      inputRef.current?.focus();
    }
  }, [location]);

  // 🔥 LOAD DEFAULT EXPLORE PAGE (Reels & Events ONLY, Randomized)
  useEffect(() => {
    const loadExploreData = async () => {
      try {
        const [reelsRes, eventsRes] = await Promise.all([
          getReels().catch(() => null),
          getAllEvents().catch(() => null)
        ]);

        const now = new Date();

        // Format and Randomize Reels
        let formattedReels = (reelsRes?.reels || []).map(r => ({ 
          ...r, 
          feedItemType: "reel", 
          media: r.video || r.media, 
          type: "video" 
        }));
        
        for (let i = formattedReels.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [formattedReels[i], formattedReels[j]] = [formattedReels[j], formattedReels[i]];
        }

        // Format, Filter, and Randomize Events
        let formattedEvents = (eventsRes?.events || [])
          .filter(e => new Date(e.date) >= now && e.status !== "completed")
          .map(e => ({ 
            ...e, 
            isEvent: true, 
            media: e.image || e.mediaUrl 
          }));

        for (let i = formattedEvents.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [formattedEvents[i], formattedEvents[j]] = [formattedEvents[j], formattedEvents[i]];
        }

        setExploreReels(formattedReels);
        setExploreEvents(formattedEvents);

      } catch (err) {
        console.error("Explore load error:", err);
      } finally {
        setInitialLoading(false);
      }
    };
    
    loadExploreData();
  }, []);

  // 🔥 LIVE SEARCH WITH DEBOUNCE
  useEffect(() => {
    const delay = setTimeout(async () => {
      if (!query.trim()) {
        setUsers([]);
        setSearchReels([]);
        setSearchEvents([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const res = await searchAll(query);

        setUsers(res?.users || []);

        // Filter backend search results for Reels
        let backendReels = res?.reels || [];
        if (backendReels.length === 0 && exploreReels.length > 0) {
          backendReels = exploreReels.filter(item => 
            (item.caption?.toLowerCase().includes(query.toLowerCase()) || 
             item.user?.username?.toLowerCase().includes(query.toLowerCase()))
          );
        }

        const now = new Date();

        // Filter backend search results for Events
        const formattedEvents = (res?.events || [])
          .filter(e => new Date(e.date) >= now && e.status !== "completed")
          .map(e => ({...e, isEvent: true, media: e.image || e.mediaUrl}))
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
          
        const formattedReels = backendReels
          .map(r => ({...r, feedItemType: "reel", media: r.video || r.media, type: "video"}))
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        setSearchReels(formattedReels);
        setSearchEvents(formattedEvents);

      } catch (err) {
        console.error("Search error:", err);
      } finally {
        setLoading(false);
      }
    }, 400);

    return () => clearTimeout(delay);
  }, [query, exploreReels]);

  // Determine what to display based on whether user is searching
  const displayReels = query.trim() ? searchReels : exploreReels;
  const displayEvents = query.trim() ? searchEvents : exploreEvents;

  if (initialLoading) {
    return <div className="h-screen flex justify-center items-center bg-[#fafafa]"><Loader size="40px" color="#3b82f6" /></div>;
  }

  return (
    <div className="w-full flex flex-col items-center bg-[#fafafa] min-h-screen font-['Poppins',sans-serif] antialiased pb-20">

      {/* 🔍 SEARCH BAR */}
      <div className="w-full max-w-[800px] p-4 sticky top-0 z-30 bg-[#fafafa]/80 backdrop-blur-xl">
        <div className="relative group">
          <FaSearch className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search users, reels, events..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-white border border-gray-200 pl-12 pr-12 py-3.5 rounded-2xl outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all shadow-sm font-medium text-gray-800 placeholder:text-gray-400"
          />

          {loading && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              <Loader size="18px" color="#3b82f6" />
            </div>
          )}
        </div>

        {/* 🔥 LIVE USERS DROPDOWN */}
        {query && users.length > 0 && !loading && (
          <div className="absolute left-4 right-4 top-[calc(100%-4px)] bg-white/95 backdrop-blur-2xl border border-gray-100 mt-2 rounded-2xl shadow-2xl max-h-[300px] overflow-y-auto z-40 p-2 animate-in fade-in slide-in-from-top-2 duration-200">
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider px-3 pt-2 pb-1">Accounts</h4>
            {users.map((u) => (
              <div
                key={u._id}
                onClick={() => navigate(`/user/${encodeURIComponent(u.username)}`)}
                className="flex items-center justify-between p-3 rounded-xl hover:bg-blue-50 cursor-pointer transition-colors group"
              >
                <div className="flex items-center gap-4">
                  <img
                    src={getProfileImage(u)}
                    className="w-12 h-12 rounded-full object-cover border border-gray-200 shadow-sm"
                    alt={u.username}
                  />
                  <div className="flex flex-col">
                    <span className="font-bold text-[15px] flex items-center gap-1.5 text-gray-900 leading-tight">
                      {u.username}
                      <RoleBadge role={u.role} />
                    </span>
                    <span className="text-xs font-medium text-gray-500">{u.name}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ❌ NO RESULTS */}
      {!loading && query && users.length === 0 && displayReels.length === 0 && displayEvents.length === 0 && (
        <div className="flex flex-col items-center justify-center mt-32 text-center animate-in fade-in zoom-in-95">
          <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-5 shadow-inner">
            <FaSearch className="text-3xl text-gray-300" />
          </div>
          <h3 className="text-xl font-black text-gray-800">No results found</h3>
          <p className="text-sm text-gray-500 font-medium mt-2">Try searching for different keywords or usernames.</p>
        </div>
      )}

      {/* 🔥 MAIN CONTENT AREA */}
      {(displayReels.length > 0 || displayEvents.length > 0) && (
        <div className="w-full max-w-[1000px] px-1 sm:px-2 mt-4 animate-in fade-in duration-500">
          
          {/* 🌟 REELS SECTION */}
          {displayReels.length > 0 && (
            <div className="mb-10 px-2">
              <h4 className="text-sm font-black text-gray-800 mb-4 tracking-wide flex items-center gap-2 uppercase">
                <FaPlay className="text-blue-500" /> {query.trim() ? "Reels Results" : "Top Reels"}
              </h4>
              
              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-1 md:gap-2">
                {displayReels.map((item, index) => (
                  <div 
                    key={item._id || index} 
                    onClick={() => navigate("/reels")}
                    className="relative aspect-[9/16] group overflow-hidden bg-black cursor-pointer md:rounded-xl shadow-sm"
                  >
                    <video src={item.media} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" muted autoPlay loop playsInline />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    
                    <div className="absolute top-2 right-2 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] z-10">
                      <FaPlay className="text-[12px] md:text-[14px]" />
                    </div>

                    {item.overlayText && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 p-2">
                        <p className={`text-center text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)] text-[10px] md:text-[14px] font-black leading-tight truncate w-full`}>
                          {item.overlayText}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 🌟 EVENTS SECTION */}
          {displayEvents.length > 0 && (
            <div className="mb-10 px-2">
              <h4 className="text-sm font-black text-gray-800 mb-4 tracking-wide flex items-center gap-2 uppercase pt-4 border-t border-gray-200">
                <FaCalendarAlt className="text-purple-500" /> {query.trim() ? "Events Results" : "Upcoming Events"}
              </h4>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-4">
                {displayEvents.map((item, index) => (
                  <div 
                    key={item._id || index} 
                    onClick={() => navigate("/events")}
                    className="relative aspect-square group overflow-hidden bg-gray-200 cursor-pointer rounded-lg md:rounded-2xl shadow-sm hover:shadow-md transition-shadow"
                  >
                    <img src={item.media || "/placeholder.png"} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt="event content" />

                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                    
                    <div className="absolute top-2 left-2 bg-white/90 backdrop-blur-md px-2 py-0.5 rounded shadow-sm text-center border border-white/50">
                       <p className="text-[8px] md:text-[10px] font-black text-purple-600 uppercase tracking-widest">{new Date(item.date || item.createdAt).toLocaleDateString('en-US', {month: 'short'})}</p>
                       <p className="text-sm md:text-lg font-black text-gray-900 leading-none">{new Date(item.date || item.createdAt).getDate()}</p>
                    </div>

                    <div className="absolute bottom-2 left-2 right-2 text-white">
                       <p className="text-[12px] md:text-[14px] font-black line-clamp-1 leading-snug drop-shadow-md">{item.title || "Campus Event"}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}

export default Search;