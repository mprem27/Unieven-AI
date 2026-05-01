import React, { useState, useEffect, useRef, useMemo } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { 
  getAllEvents, 
  getMyEvents, 
  registerForEvent, 
  getEventParticipants, 
  markAttendance,
  verifyEventQR,
  getEventAnalytics,
  exportParticipantsCSV,
  deleteEvent
} from "../services/eventService";
import { Scanner } from "@yudiel/react-qr-scanner";
import { toast } from "react-toastify";
import Loader from "../components/Loader";
import { getProfileImage } from "../utils/getProfileImage";
import { 
  FaCalendarAlt, FaClock, FaMapMarkerAlt, FaTimes, FaUsers, 
  FaCheckCircle, FaRegCompass, FaPlus, FaIdCard, FaBuilding, FaPhone, FaClipboardList,
  FaDownload, FaQrcode, FaCertificate, FaChartBar, FaTrash, FaArrowLeft, FaSearch, FaFilter
} from "react-icons/fa";

// FONT MAP
const fontMap = {
  classic: "font-sans font-bold",
  typewriter: "font-serif italic",
  modern: "font-mono uppercase tracking-widest",
  impact: "font-black uppercase tracking-tight",
  cursive: "font-[cursive]",
  marker: "font-[fantasy] tracking-wide",
  sleek: "font-sans font-light tracking-[0.3em] uppercase",
};

// TEXT STYLE HELPER
const getTextStyle = (post) => {
  switch (post.textStyle) {
    case "highlight":
      return { background: "rgba(0,0,0,0.45)", padding: "4px 16px", borderRadius: "14px" };
    case "neon":
      return { textShadow: "0 0 8px currentColor, 0 0 16px currentColor" };
    case "outline":
      return { WebkitTextStroke: "1px black" };
    case "glitch":
      return { textShadow: "2px 0 red, -2px 0 cyan" };
    case "3d-pop":
      return { textShadow: "3px 3px 0 rgba(0,0,0,0.4)" };
    default:
      return {};
  }
};

// Event expiry helper
export const isEventExpired = (event) => {
  if (!event?.date) return false;
  try {
    const dateStr = typeof event.date === 'string' ? event.date : new Date(event.date).toISOString();
    const datePart = dateStr.split("T")[0];
    const timePart = event.time || "23:59";
    const eventDateTime = new Date(`${datePart}T${timePart}`);
    return eventDateTime < new Date();
  } catch (e) {
    return new Date(event.date) < new Date();
  }
};

// 3-Day Cleanup Helper (Strictly calculates time difference)
export const isEventOlderThan3Days = (event) => {
  if (!event?.date) return false;
  try {
    const dateStr = typeof event.date === 'string' ? event.date : new Date(event.date).toISOString();
    const datePart = dateStr.split("T")[0];
    const timePart = event.time || "23:59";
    
    const eventDateTime = new Date(`${datePart}T${timePart}`).getTime();
    const currentTime = new Date().getTime();
    
    const diffDays = (currentTime - eventDateTime) / (1000 * 3600 * 24);
    return diffDays > 3;
  } catch (e) {
    return false;
  }
};

export const getEventStatus = (event) => {
  if (isEventExpired(event) || event.status === "completed") return "Completed";
  return "Upcoming";
};

function Events() {
  const { user: currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState("discover"); 
  const [events, setEvents] = useState([]);
  const [myRegistrations, setMyRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState(null);
  
  const [participantsCache, setParticipantsCache] = useState({});

  const isFacultyOrAdmin = currentUser?.role === "faculty" || currentUser?.role === "admin";

  const loadData = async () => {
    setLoading(true);
    try {
      const [eventsData, regsData] = await Promise.all([
        getAllEvents().catch(() => ({ events: [] })),
        getMyEvents().catch(() => ({ registrations: [] }))
      ]);
      setEvents(eventsData.events || []);
      setMyRegistrations(regsData.registrations || []);
    } catch (error) {
      toast.error("Failed to load campus events.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const upcomingEvents = events.filter(
    (e) => e && !isEventExpired(e) && e.status !== "completed"
  );

  // PUBLIC FEED: Hides events 3 days after completion
  const pastEvents = events
    .filter((e) => e && (isEventExpired(e) || e.status === "completed") && !isEventOlderThan3Days(e))
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 6);

  // USER TABS: Active Events
  const activeRegistrations = myRegistrations.filter(
    (reg) => reg?.event && !isEventExpired(reg.event) && reg.event.status !== "completed"
  );
  
  // USER TABS: History (Keeps all past events permanently)
  const pastRegistrations = myRegistrations.filter(
    (reg) => reg?.event && (isEventExpired(reg.event) || reg.event.status === "completed")
  ).sort((a, b) => new Date(b.event.date) - new Date(a.event.date));

  if (loading) {
    return <div className="min-h-screen flex justify-center items-center bg-[#F8FAFC]"><Loader size="40px" color="#4f46e5" /></div>;
  }

  const renderRegistrations = (regs, emptyMessage) => (
    <div className="grid grid-cols-1 gap-4 max-w-3xl mx-auto px-4 md:px-0">
      {regs.length > 0 ? regs.map(reg => (
        <div key={reg._id} onClick={() => setSelectedEvent(reg.event)} className="bg-white border border-slate-100 p-4 md:p-6 rounded-[32px] flex items-center gap-4 md:gap-6 cursor-pointer hover:shadow-xl transition-all group relative overflow-hidden">
          <div className="w-20 h-20 md:w-32 md:h-32 shrink-0 rounded-[24px] overflow-hidden shadow-sm relative">
            <img src={reg.event.image || "/default-event.jpg"} className="w-full h-full object-cover group-hover:scale-110 transition-transform" alt="" />
            {(isEventExpired(reg.event) || reg.event.status === "completed") && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <span className="text-white text-[9px] font-black uppercase tracking-widest bg-black/50 px-2 py-1 rounded-md">Past</span>
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest">{reg.event.category}</span>
            <h3 className="font-black text-slate-900 md:text-xl truncate mt-1">{reg.event.title}</h3>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-slate-400 font-bold text-[10px] uppercase">
              <span className="flex items-center gap-1.5"><FaCalendarAlt /> {new Date(reg.event.date).toLocaleDateString()}</span>
              <span className="flex items-center gap-1.5"><FaClock /> {reg.event.time}</span>
            </div>
          </div>
          <div className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-tighter hidden md:block ${reg.status === 'attended' ? 'bg-emerald-50 text-emerald-600' : (isEventExpired(reg.event) || reg.event.status === "completed") ? 'bg-slate-100 text-slate-500' : 'bg-blue-50 text-blue-600'}`}>
            {isFacultyOrAdmin 
              ? (isEventExpired(reg.event) ? 'Concluded' : 'Hosting') 
              : (reg.status === 'attended' ? 'Verified' : (isEventExpired(reg.event) || reg.event.status === "completed") ? 'Expired' : 'Registered')}
          </div>
        </div>
      )) : (
        <div className="text-center py-20 bg-white rounded-[40px] border border-slate-100 border-dashed">
          <p className="text-slate-400 font-bold uppercase tracking-widest text-[11px]">{emptyMessage}</p>
        </div>
      )}
    </div>
  );

  return (
    <div className="w-full min-h-screen bg-[#F8FAFC] font-['Poppins',sans-serif] pb-24 relative overflow-x-hidden">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-8 md:py-12">
        
        <div className="flex flex-col md:flex-row justify-between items-center mb-12 gap-6 text-center md:text-left">
          <div className="space-y-2">
            <h1 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tight">University Events</h1>
            <p className="text-slate-500 font-medium max-w-lg italic">University Event Managements </p>
          </div>
          {isFacultyOrAdmin && (
            <Link to="/create/event" className="w-full md:w-auto bg-black text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-indigo-600 transition-all active:scale-95 flex items-center justify-center gap-2">
              <FaPlus /> New Event
            </Link>
          )}
        </div>

        <div className="flex justify-start md:justify-start gap-3 mb-10 overflow-x-auto pb-4 scrollbar-hide w-full snap-x">
          <button 
            onClick={() => setActiveTab("discover")}
            className={`shrink-0 snap-center px-6 md:px-8 py-3 rounded-2xl font-black text-[10px] md:text-[11px] uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === "discover" ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" : "bg-white text-slate-400 border border-slate-100 hover:bg-slate-50"}`}
          >
            Discover Events
          </button>
          
          <button 
            onClick={() => setActiveTab("registrations")}
            className={`shrink-0 snap-center px-6 md:px-8 py-3 rounded-2xl font-black text-[10px] md:text-[11px] uppercase tracking-widest transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === "registrations" ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" : "bg-white text-slate-400 border border-slate-100 hover:bg-slate-50"}`}
          >
            {isFacultyOrAdmin ? "My Events" : "My Registrations"} {activeRegistrations.length > 0 && <span className="bg-white/20 px-2 py-0.5 rounded-lg text-[10px]">{activeRegistrations.length}</span>}
          </button>
          <button 
            onClick={() => setActiveTab("history")}
            className={`shrink-0 snap-center px-6 md:px-8 py-3 rounded-2xl font-black text-[10px] md:text-[11px] uppercase tracking-widest transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === "history" ? "bg-slate-800 text-white shadow-lg shadow-slate-200" : "bg-white text-slate-400 border border-slate-100 hover:bg-slate-50"}`}
          >
            History {pastRegistrations.length > 0 && <span className="bg-white/20 px-2 py-0.5 rounded-lg text-[10px]">{pastRegistrations.length}</span>}
          </button>
        </div>

        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          {activeTab === "discover" && (
            <div className="space-y-16">
              <section>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
                  {upcomingEvents.map(event => <EventCard key={event._id} event={event} onClick={() => setSelectedEvent(event)} />)}
                  {upcomingEvents.length === 0 && (
                    <div className="col-span-full py-10 text-center text-slate-400 font-bold uppercase tracking-widest text-[11px]">No upcoming events right now.</div>
                  )}
                </div>
              </section>
              {pastEvents.length > 0 && (
                <section className="opacity-60">
                  <h2 className="text-xs font-black text-slate-400 uppercase tracking-[0.3em] mb-8 border-l-4 border-slate-200 pl-4">Completed Events</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                    {pastEvents.map(event => <EventCard key={event._id} event={event} onClick={() => setSelectedEvent(event)} isPast />)}
                  </div>
                </section>
              )}
            </div>
          )}
          {activeTab === "registrations" && renderRegistrations(activeRegistrations, isFacultyOrAdmin ? "No active events found" : "No active registrations found")}
          {activeTab === "history" && renderRegistrations(pastRegistrations, "No history found")}
        </div>
      </div>

      {selectedEvent && (
        <EventModal 
          event={selectedEvent} 
          currentUser={currentUser} 
          myRegistrations={myRegistrations}
          onClose={() => setSelectedEvent(null)} 
          onRefresh={loadData}
          participantsCache={participantsCache}
          setParticipantsCache={setParticipantsCache}
        />
      )}
    </div>
  );
}

const EventCard = ({ event, onClick, isPast }) => {
  const d = new Date(event.date);
  const status = getEventStatus(event);

  return (
    <div onClick={onClick} className="group bg-white rounded-[32px] overflow-hidden shadow-sm hover:shadow-2xl transition-all duration-500 cursor-pointer border border-white hover:-translate-y-2 flex flex-col h-full w-full">
      <div className="h-48 md:h-56 w-full relative overflow-hidden bg-slate-100">
        <img src={event.image || "/default-event.jpg"} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt="" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
        <div className="absolute top-4 left-4 bg-white/95 backdrop-blur-md rounded-2xl p-3 text-center min-w-[62px] shadow-xl">
          <p className="text-[9px] font-black text-indigo-600 uppercase">{d.toLocaleDateString('en-US', { month: 'short' })}</p>
          <p className="text-2xl font-black text-slate-900 leading-none">{d.getDate()}</p>
        </div>
        {isPast && (
          <div className="absolute inset-0 bg-slate-900/60 flex items-center justify-center backdrop-blur-[1px]">
            <span className="bg-white/10 text-white px-5 py-2 rounded-full text-[10px] font-black tracking-[0.2em] uppercase border border-white/20">Session Over</span>
          </div>
        )}
      </div>
      <div className="p-5 md:p-6 flex flex-col flex-1">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[8px] md:text-[9px] font-black text-indigo-500 uppercase tracking-widest px-2 py-0.5 bg-indigo-50 rounded-lg w-fit">{event.category}</span>
          <span className={`text-[8px] md:text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg w-fit ${status === 'Completed' ? 'bg-slate-100 text-slate-500' : 'bg-emerald-50 text-emerald-600'}`}>{status}</span>
        </div>
        <h3 className="font-black text-base md:text-lg text-slate-900 leading-tight mb-4 group-hover:text-indigo-600 transition-colors line-clamp-2">{event.title}</h3>
        <div className="mt-auto space-y-2">
           <div className="flex items-center gap-2 text-slate-400 font-bold text-[9px] md:text-[10px] uppercase">
              <FaClock className="text-indigo-400 shrink-0" /> <span className="truncate">{event.time}</span>
           </div>
           <div className="flex items-center gap-2 text-slate-400 font-bold text-[9px] md:text-[10px] uppercase">
              <FaMapMarkerAlt className="text-red-400 shrink-0" /> <span className="truncate">{event.location}</span>
           </div>
        </div>
      </div>
    </div>
  );
};

// =====================================================
// NEW FULL-PAGE ANALYTICS DASHBOARD
// =====================================================
const EventAnalyticsDashboard = ({ event, analytics, participants, onClose, onOpenScanner }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const filteredParticipants = useMemo(() => {
    return participants.filter((p) => {
      const matchesSearch = 
        p.user?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.studentId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.department?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === "all" ? true : p.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
  }, [participants, searchTerm, statusFilter]);

  const handleExport = async () => {
    try {
      const blob = await exportParticipantsCSV(event._id);
      const url = window.URL.createObjectURL(new Blob([blob]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `${event.title}-Analytics.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success("CSV Exported Successfully");
    } catch {
      toast.error("CSV export failed");
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-[#F8FAFC] overflow-y-auto animate-in slide-in-from-bottom-8 duration-300">
      
      {/* Top Navigation Bar */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10 px-4 py-4 md:px-8 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-4">
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors active:scale-95">
            <FaArrowLeft className="text-slate-600" />
          </button>
          <div>
            <h1 className="font-black text-lg md:text-xl text-slate-900 leading-none truncate max-w-[150px] md:max-w-md">{event.title}</h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Analytics & Roster</p>
          </div>
        </div>
        
        {/* Export & Scan Buttons in Dashboard */}
        <div className="flex items-center gap-2 md:gap-3">
          <button onClick={onOpenScanner} className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-3 md:px-5 py-2 md:py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 hover:shadow-md transition-all duration-300 active:scale-95">
            <FaQrcode className="text-indigo-600" /> <span className="hidden md:inline">Scan QR</span>
          </button>
          <button onClick={handleExport} className="flex items-center gap-2 bg-indigo-600 text-white px-3 md:px-5 py-2 md:py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-700 hover:shadow-md transition-all duration-300 active:scale-95 shadow-sm">
            <FaDownload /> <span className="hidden md:inline">Export</span>
          </button>
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto p-4 md:p-8 space-y-6 md:space-y-8">
        
        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm flex flex-col items-center justify-center text-center">
            <span className="text-3xl font-black text-slate-800">{analytics.totalRegistered || 0}</span>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Total Registered</span>
          </div>
          <div className="bg-emerald-50 border border-emerald-100 p-6 rounded-[24px] shadow-sm flex flex-col items-center justify-center text-center">
            <span className="text-3xl font-black text-emerald-600">{analytics.totalAttended || 0}</span>
            <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mt-2">Attended</span>
          </div>
          <div className="bg-orange-50 border border-orange-100 p-6 rounded-[24px] shadow-sm flex flex-col items-center justify-center text-center">
            <span className="text-3xl font-black text-orange-500">{(analytics.totalRegistered || 0) - (analytics.totalAttended || 0)}</span>
            <span className="text-[10px] font-black text-orange-400 uppercase tracking-widest mt-2">Pending</span>
          </div>
          <div className="bg-blue-50 border border-blue-100 p-6 rounded-[24px] shadow-sm flex flex-col items-center justify-center text-center">
            <span className="text-3xl font-black text-blue-600">{analytics.attendanceRate || 0}%</span>
            <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest mt-2">Attendance Rate</span>
          </div>
        </div>

        {/* Charts & Breakdown Area */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
          <div className="bg-white p-6 md:p-8 rounded-[32px] border border-slate-100 shadow-sm">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
              <FaBuilding className="text-indigo-500" /> Department Breakdown
            </h3>
            <div className="space-y-4">
              {Object.entries(analytics.departmentStats || {}).map(([dept, count]) => (
                <div key={dept}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-bold text-slate-700 truncate pr-4">{dept}</span>
                    <span className="text-xs font-black text-slate-900">{count}</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2">
                    <div className="bg-indigo-500 h-2 rounded-full" style={{ width: `${(count / analytics.totalRegistered) * 100}%` }}></div>
                  </div>
                </div>
              ))}
              {Object.keys(analytics.departmentStats || {}).length === 0 && (
                <p className="text-sm text-slate-400 font-medium italic">No department data available.</p>
              )}
            </div>
          </div>

          <div className="bg-white p-6 md:p-8 rounded-[32px] border border-slate-100 shadow-sm flex flex-col">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
              <FaChartBar className="text-emerald-500" /> Event Health
            </h3>
            <div className="flex-1 flex items-center justify-center">
              <div className="relative w-48 h-48 rounded-full border-[16px] border-slate-100 flex items-center justify-center">
                {/* Simulated Donut Chart Overlay */}
                <div 
                  className="absolute inset-[-16px] rounded-full border-[16px] border-emerald-500 border-r-transparent border-t-transparent transition-all duration-1000"
                  style={{ transform: `rotate(${(analytics.attendanceRate / 100) * 360}deg)` }}
                />
                <div className="text-center z-10 bg-white rounded-full w-full h-full flex flex-col items-center justify-center">
                   <span className="text-4xl font-black text-slate-800">{analytics.attendanceRate || 0}%</span>
                   <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Turnout</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Detailed Data Table */}
        <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden flex flex-col h-[500px]">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row gap-4 justify-between items-center">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-[0.2em]">Participant Data</h3>
            <div className="flex w-full md:w-auto gap-2">
              <div className="relative flex-1 md:w-64">
                <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Search name, ID, dept..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl py-2 pl-9 pr-4 text-xs font-bold outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
              <div className="relative">
                <FaFilter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <select 
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-white border border-slate-200 rounded-xl py-2 pl-9 pr-8 text-xs font-bold outline-none focus:border-indigo-500 transition-colors appearance-none cursor-pointer"
                >
                  <option value="all">All</option>
                  <option value="attended">Attended</option>
                  <option value="registered">Pending</option>
                </select>
              </div>
            </div>
          </div>
          
          <div className="overflow-y-auto flex-1 p-0">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">Participant</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">ID / Dept</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 hidden md:table-cell">Contact</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredParticipants.map(p => (
                  <tr key={p._id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <img src={getProfileImage(p.user || {})} className="w-8 h-8 rounded-full object-cover border border-slate-200" alt="" />
                        <div>
                          <p className="text-xs font-black text-slate-800">{p.user?.name || "Unknown"}</p>
                          <p className="text-[9px] font-bold text-slate-400">@{p.user?.username || "unknown"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-xs font-bold text-slate-700">{p.studentId}</p>
                      <p className="text-[10px] font-semibold text-slate-500 truncate max-w-[120px]">{p.department}</p>
                    </td>
                    <td className="px-6 py-4 hidden md:table-cell text-xs font-medium text-slate-600">
                      {p.phone}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {p.status === "attended" ? (
                        <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-600 px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border border-emerald-100">
                          <FaCheckCircle /> Verified
                        </span>
                      ) : (
                        <span className="inline-block bg-orange-50 text-orange-500 px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border border-orange-100">
                          Pending
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredParticipants.length === 0 && (
                  <tr>
                    <td colSpan="4" className="px-6 py-12 text-center text-sm font-bold text-slate-400">
                      No participants found matching your criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
};

const EventModal = ({ event, currentUser, myRegistrations, onClose, onRefresh, participantsCache, setParticipantsCache }) => {
  const [loading, setLoading] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [showRegForm, setShowRegForm] = useState(false);
  const [regData, setRegData] = useState({ studentId: "", department: "", phone: "" });
  
  const [analytics, setAnalytics] = useState(null);
  const [showAnalyticsDashboard, setShowAnalyticsDashboard] = useState(false);

  const [showQRScanner, setShowQRScanner] = useState(false);
  const [showMyQR, setShowMyQR] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const isCreator = event.createdBy?._id === currentUser?._id || event.createdBy === currentUser?._id;
  const myReg = myRegistrations.find(t => t.event._id === event._id);
  
  const isPast = isEventExpired(event) || event.status === "completed"; 

  useEffect(() => {
    if (isCreator) {
      if (participantsCache[event._id]) {
        setParticipants(participantsCache[event._id]);
      } else {
        getEventParticipants(event._id).then(res => {
          if (res.success) {
            setParticipants(res.participants);
            setParticipantsCache(prev => ({ ...prev, [event._id]: res.participants }));
          }
        });
      }
    }
  }, [event._id, isCreator, participantsCache, setParticipantsCache]);

  const handleRSVP = async (e) => {
    if (e) e.preventDefault();
    if (isPast && !myReg) {
      toast.error("Registration is closed for past events.");
      return;
    }
    setLoading(true);
    try {
      if (myReg) {
        await registerForEvent({ eventId: event._id });
        toast.success("RSVP Cancelled");
      } else {
        await registerForEvent({ eventId: event._id, ...regData });
        toast.success("Registered Successfully! 🎉");
      }
      onRefresh();
      onClose();
    } catch (err) {
      toast.error(err.message || "Failed to process RSVP");
    } finally {
      setLoading(false);
    }
  };

  const attendancePercentage = participants.length > 0 
    ? Math.round((participants.filter(p => p.status === "attended").length / participants.length) * 100) 
    : 0;

  // Base style for admin control buttons
  const adminBtnClass = "group flex flex-col items-center justify-center p-4 bg-white border border-slate-200 rounded-2xl hover:bg-slate-50 hover:border-indigo-100 hover:shadow-md transition-all duration-300 text-slate-600 gap-2 shadow-sm active:scale-95 hover:-translate-y-0.5";

  return (
    <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center sm:p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in duration-300">
      <div className="absolute inset-0" onClick={onClose} />
      <div className={`bg-white rounded-t-[32px] md:rounded-[40px] w-full flex flex-col md:flex-row overflow-hidden relative z-10 shadow-2xl animate-in slide-in-from-bottom md:zoom-in-95 duration-300 max-h-[90vh] ${isCreator ? 'max-w-6xl' : 'max-w-2xl'}`}>
        
        {/* MOBILE DRAG HANDLE */}
        <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto my-3 md:hidden shrink-0"></div>

        {/* LEFT PANEL: SMART EVENT DETAILS */}
        <div className={`w-full ${isCreator ? 'md:w-[40%] border-r border-slate-50' : 'w-full'} flex flex-col overflow-y-auto bg-white scrollbar-hide`}>
          <div className="h-56 md:h-80 relative shrink-0">
            <img src={event.image || "/default-event.jpg"} className="w-full h-full object-cover" alt="" />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/20 to-transparent p-6 md:p-8 flex flex-col justify-end">
              <div className="flex gap-2 mb-3">
                <span className="bg-indigo-600 text-white text-[9px] font-black uppercase px-3 py-1 rounded-lg tracking-widest">{event.category}</span>
                {isPast && <span className="bg-red-500 text-white text-[9px] font-black uppercase px-3 py-1 rounded-lg tracking-widest">Closed</span>}
              </div>
              <h2 className="text-2xl md:text-3xl font-black text-white leading-tight">{event.title}</h2>
            </div>
            <button onClick={onClose} className="absolute top-4 right-4 md:top-6 md:right-6 bg-white/10 backdrop-blur-md text-white p-2.5 md:p-3 rounded-2xl hover:bg-red-500 transition-all active:scale-90">
              <FaTimes size={14} className="md:w-4 md:h-4" />
            </button>
          </div>

          <div className="p-6 md:p-8 space-y-6 md:space-y-8 flex-1">
            <div className="grid grid-cols-1 gap-4">
               <div className="flex items-center gap-4 bg-slate-50 p-4 md:p-5 rounded-[24px] border border-slate-100">
                  <div className="w-10 h-10 md:w-11 md:h-11 bg-white rounded-xl shadow-sm flex items-center justify-center text-indigo-600"><FaCalendarAlt /></div>
                  <div>
                    <p className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest">Date & Time</p>
                    <p className="text-xs md:text-sm font-bold text-slate-800">{new Date(event.date).toDateString()} | {event.time}</p>
                  </div>
               </div>
               <div className="flex items-center gap-4 bg-slate-50 p-4 md:p-5 rounded-[24px] border border-slate-100">
                  <div className="w-10 h-10 md:w-11 md:h-11 bg-white rounded-xl shadow-sm flex items-center justify-center text-red-500"><FaMapMarkerAlt /></div>
                  <div>
                    <p className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest">Venue</p>
                    <p className="text-xs md:text-sm font-bold text-slate-800">{event.location}</p>
                  </div>
               </div>
            </div>

            <div className="space-y-3 md:space-y-4">
              <p className="text-[9px] md:text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] border-l-2 border-indigo-200 pl-3">Event Abstract</p>
              <p className="text-xs md:text-sm text-slate-600 leading-relaxed font-medium">{event.description}</p>
            </div>

            {!isCreator && (
              <div className="pt-2 md:pt-4 pb-4 md:pb-0">
                {myReg ? (
                  <div className="space-y-4">
                    <div className="bg-emerald-50 text-emerald-700 p-4 md:p-5 rounded-[24px] flex items-center justify-center gap-3 font-black text-[10px] md:text-xs uppercase tracking-widest border border-emerald-100">
                      <FaCheckCircle size={18} /> {myReg.status === 'attended' ? 'Attendance Verified' : 'RSVP Confirmed'}
                    </div>
                    <button
                      onClick={() => setShowMyQR(true)}
                      className="w-full py-4 bg-black text-white rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95 shadow-md hover:bg-gray-800"
                    >
                      <FaQrcode size={14} /> View My QR Pass
                    </button>
                    {!isPast && (
                      <button onClick={handleRSVP} disabled={loading} className="w-full text-red-400 font-black text-[10px] uppercase tracking-widest hover:text-red-600 transition-colors">Withdraw My Registration</button>
                    )}
                  </div>
                ) : showRegForm ? (
                  <form onSubmit={handleRSVP} className="bg-slate-50 p-5 md:p-6 rounded-[32px] space-y-4 border border-slate-100">
                    <h4 className="text-[10px] md:text-[11px] font-black uppercase tracking-widest text-slate-400 mb-2 text-center">RSVP Details</h4>
                    <div className="space-y-3">
                      <div className="relative">
                        <FaIdCard className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                        <input required className="w-full bg-white rounded-2xl py-3.5 md:py-4 pl-12 pr-4 text-xs font-bold outline-none border border-transparent focus:border-indigo-500 transition-all" placeholder="STUDENT ID / ROLL NO" value={regData.studentId} onChange={e => setRegData({...regData, studentId: e.target.value})} />
                      </div>
                      <div className="relative">
                        <FaBuilding className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                        <input required className="w-full bg-white rounded-2xl py-3.5 md:py-4 pl-12 pr-4 text-xs font-bold outline-none border border-transparent focus:border-indigo-500 transition-all" placeholder="FACULTY / DEPT" value={regData.department} onChange={e => setRegData({...regData, department: e.target.value})} />
                      </div>
                      <div className="relative">
                        <FaPhone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                        <input required type="tel" className="w-full bg-white rounded-2xl py-3.5 md:py-4 pl-12 pr-4 text-xs font-bold outline-none border border-transparent focus:border-indigo-500 transition-all" placeholder="CONTACT NUMBER" value={regData.phone} onChange={e => setRegData({...regData, phone: e.target.value})} />
                      </div>
                    </div>
                    <div className="flex gap-2">
                       <button type="button" onClick={() => setShowRegForm(false)} className="px-6 py-4 bg-white rounded-2xl font-black text-[10px] uppercase text-slate-400 transition-all hover:bg-slate-100">Back</button>
                       <button type="submit" disabled={loading} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-indigo-100 active:scale-95 transition-all">Confirm</button>
                    </div>
                  </form>
                ) : (
                  <button 
                    onClick={() => setShowRegForm(true)} 
                    disabled={isPast}
                    className={`w-full py-4 md:py-5 rounded-[24px] font-black text-[10px] md:text-xs uppercase tracking-widest shadow-xl transition-all active:scale-95 flex items-center justify-center gap-3 ${isPast ? 'bg-slate-200 text-slate-400 shadow-none cursor-not-allowed' : 'bg-black text-white shadow-slate-200'}`}
                  >
                    <FaClipboardList /> {isPast ? 'Registration Closed' : 'RSVP for Event'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT PANEL: SMART MANAGEMENT DASHBOARD (CREATOR ONLY) */}
        {isCreator && (
          <div className="flex-1 p-6 md:p-8 bg-slate-50 overflow-y-auto scrollbar-hide relative flex flex-col">
            <div className="flex justify-between items-center mb-6 md:mb-8">
              <h3 className="text-[10px] md:text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] flex items-center gap-2 md:gap-3">
                 <FaClipboardList className="text-indigo-500" /> Admin Controller
              </h3>
              {isPast && <span className="bg-slate-200 text-slate-500 text-[8px] md:text-[9px] px-2 py-1 rounded uppercase font-black tracking-widest">Concluded</span>}
            </div>

            <div className="grid grid-cols-3 gap-3 mb-8">
                <button onClick={() => setShowQRScanner(true)} className={adminBtnClass}>
                    <FaQrcode className="text-indigo-500 text-xl md:text-2xl group-hover:scale-110 transition-transform duration-300" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-center group-hover:text-indigo-600 transition-colors mt-1">Scan QR</span>
                </button>
                
                <button onClick={() => toast.success("Certificates module ready for next integration")} className={adminBtnClass}>
                    <FaCertificate className="text-emerald-500 text-xl md:text-2xl group-hover:scale-110 transition-transform duration-300" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-center group-hover:text-emerald-600 transition-colors mt-1">Certificates</span>
                </button>
                
                <button onClick={async () => {
                  try {
                    const res = await getEventAnalytics(event._id);
                    setAnalytics(res.analytics);
                    setShowAnalyticsDashboard(true);
                  } catch {
                    toast.error("Analytics failed to load");
                  }
                }} className={adminBtnClass}>
                    <FaChartBar className="text-blue-500 text-xl md:text-2xl group-hover:scale-110 transition-transform duration-300" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-center group-hover:text-blue-600 transition-colors mt-1">Full Analytics</span>
                </button>
            </div>

            <div className="grid grid-cols-3 gap-3 md:gap-4 mb-8 md:mb-10">
                <div className="bg-white p-4 md:p-5 rounded-[24px] md:rounded-[28px] border border-slate-100 shadow-sm flex flex-col items-center text-center hover:-translate-y-1 transition-transform duration-300">
                   <FaUsers className="text-indigo-600 mb-2 text-lg md:text-xl" />
                   <p className="text-xl md:text-2xl font-black text-slate-900 leading-none">{participants.length}</p>
                   <p className="text-[7px] md:text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1.5">Registered</p>
                </div>
                <div className="bg-white p-4 md:p-5 rounded-[24px] md:rounded-[28px] border border-slate-100 shadow-sm flex flex-col items-center text-center hover:-translate-y-1 transition-transform duration-300">
                   <FaCheckCircle className="text-emerald-500 mb-2 text-lg md:text-xl" />
                   <p className="text-xl md:text-2xl font-black text-slate-900 leading-none">{participants.filter(p => p.status === "attended").length}</p>
                   <p className="text-[7px] md:text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1.5">Verified</p>
                </div>
                <div className="bg-white p-4 md:p-5 rounded-[24px] md:rounded-[28px] border border-slate-100 shadow-sm flex flex-col items-center text-center hover:-translate-y-1 transition-transform duration-300">
                   <div className="text-blue-500 mb-2 text-lg md:text-xl font-black">%</div>
                   <p className="text-xl md:text-2xl font-black text-slate-900 leading-none">{attendancePercentage}%</p>
                   <p className="text-[7px] md:text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1.5">Attendance</p>
                </div>
            </div>

            <div className="space-y-4 flex-1">
               <div className="flex justify-between items-center ml-1">
                 <p className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">Recent Enrolments</p>
               </div>
               
               <div className="space-y-3">
                  {participants.filter(reg => reg?.user).slice(0, 5).map(reg => (
                    <div key={reg._id} className="bg-white p-4 rounded-[20px] md:rounded-[24px] border border-slate-100 flex flex-col gap-4 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between">
                         <div className="flex items-center gap-3 min-w-0">
                            <img src={getProfileImage(reg.user || {})} className="w-10 h-10 rounded-full object-cover border border-slate-100 shrink-0" alt="" />
                            <div className="min-w-0">
                               <p className="text-[11px] md:text-xs font-black text-slate-800 leading-none mb-1 truncate">{reg.user?.name || "Unknown User"}</p>
                               <p className="text-[8px] md:text-[9px] text-slate-400 font-bold tracking-widest truncate">@{reg.user?.username || "unknown"}</p>
                            </div>
                         </div>
                         {reg.status === 'attended' ? (
                           <div className="bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-lg text-[8px] md:text-[9px] font-black uppercase flex items-center gap-1.5 shrink-0"><FaCheckCircle /> Verified</div>
                         ) : (
                           <button onClick={() => markAttendance(reg._id).then(res => {
                               if(res.success) {
                                 toast.success("Attendance verified manually!");
                                 const updated = participants.map(p => p._id === reg._id ? {...p, status: 'attended'} : p);
                                 setParticipants(updated);
                                 setParticipantsCache(prev => ({...prev, [event._id]: updated}));
                               }
                           })} className="bg-indigo-600 text-white px-3 md:px-4 py-2 rounded-xl text-[8px] md:text-[9px] font-black uppercase active:scale-95 transition-all shrink-0 shadow-md">Verify Manually</button>
                         )}
                      </div>
                    </div>
                  ))}
                  {participants.filter(reg => reg?.user).length === 0 && (
                    <div className="text-center py-10 border border-dashed border-slate-200 rounded-3xl">
                      <p className="text-[10px] md:text-[11px] font-black text-slate-400 uppercase tracking-widest">No registrations yet</p>
                    </div>
                  )}
                  {participants.length > 5 && (
                    <button 
                      onClick={async () => {
                        try {
                          const res = await getEventAnalytics(event._id);
                          setAnalytics(res.analytics);
                          setShowAnalyticsDashboard(true);
                        } catch {
                          toast.error("Analytics failed to load");
                        }
                      }} 
                      className="w-full text-center text-xs font-bold text-indigo-600 hover:underline pt-2"
                    >
                      View all {participants.length} participants
                    </button>
                  )}
               </div>
            </div>

            <div className="mt-8 pt-6 border-t border-slate-200 shrink-0">
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full py-3 md:py-4 bg-red-50 text-red-500 hover:bg-red-500 hover:text-white transition-all rounded-2xl font-black text-[10px] uppercase tracking-widest border border-red-100 hover:border-red-500 shadow-sm flex justify-center items-center gap-2"
              >
                <FaTrash /> Delete Event
              </button>
            </div>

          </div>
        )}
        
        {/* QR PASS MODAL */}
        {showMyQR && myReg?.qrCode && (
          <div className="fixed inset-0 bg-slate-900/90 flex items-center justify-center z-[250] p-4 backdrop-blur-md">
            <div className="bg-white p-8 rounded-[32px] text-center max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200">
              <h3 className="font-black text-xl mb-6 text-slate-800 tracking-tight uppercase">Event QR Pass</h3>
              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 inline-block mb-6 shadow-inner">
                <img src={myReg.qrCode} alt="QR Pass" className="w-56 h-56 mx-auto rounded-xl mix-blend-multiply" />
              </div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-6">Present at entrance</p>
              <button onClick={() => setShowMyQR(false)} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl shadow-slate-900/20 active:scale-95 transition-all">
                Close
              </button>
            </div>
          </div>
        )}

        {/* QR SCANNER MODAL */}
        {showQRScanner && (
          <div className="fixed inset-0 bg-slate-900/95 flex items-center justify-center z-[250] p-4 backdrop-blur-md">
            <div className="bg-white p-6 md:p-8 rounded-[32px] max-w-md w-full animate-in zoom-in-95 duration-200 shadow-2xl">
              <h3 className="font-black text-xl mb-6 text-center text-slate-800 uppercase tracking-tight">
                Scan Student QR
              </h3>
              
              <div className="rounded-3xl overflow-hidden shadow-inner bg-black border-4 border-slate-100 relative aspect-square flex items-center justify-center">
                <Scanner
                  constraints={{
                    facingMode: "environment",
                  }}
                  onScan={async (result) => {
                    if (result?.[0]?.rawValue) {
                      try {
                        const res = await verifyEventQR(
                          result[0].rawValue
                        );

                        toast.success(res.message);

                        const updated = participants.map((p) =>
                          p._id === res.participant._id
                            ? {
                                ...p,
                                status: "attended",
                              }
                            : p
                        );

                        setParticipants(updated);

                        setParticipantsCache((prev) => ({
                          ...prev,
                          [event._id]: updated,
                        }));

                        setShowQRScanner(false);
                      } catch (err) {
                        toast.error(
                          err.message || "Invalid QR Code"
                        );
                        setShowQRScanner(false);
                      }
                    }
                  }}
                  onError={(error) =>
                    console.error(error)
                  }
                />
              </div>
              
              <p className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-6 mb-6">Position QR inside frame</p>
              <button onClick={() => setShowQRScanner(false)} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest active:scale-95 transition-all shadow-xl shadow-slate-900/20">
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* FULL PAGE ANALYTICS DASHBOARD OVERLAY */}
        {showAnalyticsDashboard && analytics && (
          <EventAnalyticsDashboard 
            event={event} 
            analytics={analytics} 
            participants={participants} 
            onClose={() => setShowAnalyticsDashboard(false)}
            onOpenScanner={() => setShowQRScanner(true)}
          />
        )}

        {/* 🔥 CUSTOM EVENT DELETE CONFIRMATION MODAL */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-[32px] w-full max-w-[340px] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="p-6 md:p-8 text-center flex flex-col items-center">
                <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-5 shadow-inner">
                  <FaTrash className="text-red-500 text-2xl" />
                </div>
                <h3 className="text-xl font-black text-slate-900 mb-2 tracking-tight">Delete Event?</h3>
                <p className="text-[13px] text-slate-500 font-medium mb-8 leading-relaxed px-2">
                  Are you sure you want to permanently delete <span className="font-bold text-slate-700">{event.title}</span>? This action cannot be undone.
                </p>
                <div className="flex gap-3 w-full">
                  <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 py-3 text-[11px] uppercase tracking-widest font-black text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-2xl transition-colors">Cancel</button>
                  <button onClick={async () => {
                    try {
                      await deleteEvent(event._id);
                      toast.success("Event deleted successfully");
                      onRefresh();
                      onClose();
                    } catch {
                      toast.error("Delete failed");
                    }
                  }} className="flex-1 py-3 text-[11px] uppercase tracking-widest font-black text-white bg-red-500 hover:bg-red-600 rounded-2xl transition-colors shadow-lg shadow-red-500/20 active:scale-95">Delete</button>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default Events;