import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
// 🔥 STEP 1: UPDATED IMPORTS
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
// 🔥 REPLACED QR READER FOR REACT 19 COMPATIBILITY
import { Scanner } from "@yudiel/react-qr-scanner";
import { toast } from "react-toastify";
import Loader from "../components/Loader";
import { getProfileImage } from "../utils/getProfileImage";
import { 
  FaCalendarAlt, FaClock, FaMapMarkerAlt, FaTimes, FaUsers, 
  FaCheckCircle, FaRegCompass, FaPlus, FaIdCard, FaBuilding, FaPhone, FaClipboardList,
  FaDownload, FaQrcode, FaCertificate, FaChartBar, FaTrash
} from "react-icons/fa";

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

  // 🔥 ISSUE 4 FIX: DISCOVER TAB SHOULD EXCLUDE COMPLETED
  const upcomingEvents = events.filter(
    (e) => e && !isEventExpired(e) && e.status !== "completed"
  );

  const pastEvents = events
    .filter((e) => e && (isEventExpired(e) || e.status === "completed"))
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 6);

  // 🔥 ISSUE 3 FIX: ACTIVE TAB EXCLUDES COMPLETED
  const activeRegistrations = myRegistrations.filter(
    (reg) => reg?.event && !isEventExpired(reg.event) && reg.event.status !== "completed"
  );
  
  // 🔥 ISSUE 2 FIX: HISTORY TAB ONLY COMPLETED/EXPIRED
  const pastRegistrations = myRegistrations.filter(
    (reg) => reg?.event && (isEventExpired(reg.event) || reg.event.status === "completed")
  ).sort((a, b) => new Date(b.event.date) - new Date(a.event.date));

  if (loading) {
    return <div className="min-h-screen flex justify-center items-center bg-[#F8FAFC]"><Loader size="40px" color="#4f46e5" /></div>;
  }

  const renderRegistrations = (regs, emptyMessage) => (
    <div className="grid grid-cols-1 gap-4 max-w-3xl mx-auto">
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
            {reg.status === 'attended' ? 'Verified' : (isEventExpired(reg.event) || reg.event.status === "completed") ? 'Expired' : 'Registered'}
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
    <div className="w-full min-h-screen bg-[#F8FAFC] font-['Poppins',sans-serif] pb-24 relative">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-8 md:py-12">
        
        <div className="flex flex-col md:flex-row justify-between items-center mb-12 gap-6 text-center md:text-left">
          <div className="space-y-2">
            <h1 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tight">University Events</h1>
            <p className="text-slate-500 font-medium max-w-lg italic">University Event Managements </p>
          </div>
          {(currentUser?.role === "faculty" || currentUser?.role === "admin") && (
            <Link to="/create/event" className="w-full md:w-auto bg-black text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-indigo-600 transition-all active:scale-95 flex items-center justify-center gap-2">
              <FaPlus /> New Event
            </Link>
          )}
        </div>

        <div className="flex justify-center md:justify-start gap-4 mb-10 overflow-x-auto pb-2 scrollbar-hide">
          <button 
            onClick={() => setActiveTab("discover")}
            className={`px-8 py-3 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === "discover" ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" : "bg-white text-slate-400 border border-slate-100"}`}
          >
            Discover Events
          </button>
          <button 
            onClick={() => setActiveTab("registrations")}
            className={`px-8 py-3 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === "registrations" ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" : "bg-white text-slate-400 border border-slate-100"}`}
          >
            My Registrations {activeRegistrations.length > 0 && <span className="bg-white/20 px-2 py-0.5 rounded-lg text-[10px]">{activeRegistrations.length}</span>}
          </button>
          <button 
            onClick={() => setActiveTab("history")}
            className={`px-8 py-3 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === "history" ? "bg-slate-800 text-white shadow-lg shadow-slate-200" : "bg-white text-slate-400 border border-slate-100"}`}
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
          {activeTab === "registrations" && renderRegistrations(activeRegistrations, "No active registrations found")}
          {activeTab === "history" && renderRegistrations(pastRegistrations, "No past registrations found")}
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
    <div onClick={onClick} className="group bg-white rounded-[32px] overflow-hidden shadow-sm hover:shadow-2xl transition-all duration-500 cursor-pointer border border-white hover:-translate-y-2 flex flex-col h-full">
      <div className="h-56 w-full relative overflow-hidden bg-slate-100">
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
      <div className="p-6 flex flex-col flex-1">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest px-2 py-0.5 bg-indigo-50 rounded-lg w-fit">{event.category}</span>
          <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg w-fit ${status === 'Completed' ? 'bg-slate-100 text-slate-500' : 'bg-emerald-50 text-emerald-600'}`}>{status}</span>
        </div>
        <h3 className="font-black text-lg text-slate-900 leading-tight mb-4 group-hover:text-indigo-600 transition-colors line-clamp-2">{event.title}</h3>
        <div className="mt-auto space-y-2">
           <div className="flex items-center gap-2 text-slate-400 font-bold text-[10px] uppercase">
              <FaClock className="text-indigo-400" /> {event.time}
           </div>
           <div className="flex items-center gap-2 text-slate-400 font-bold text-[10px] uppercase">
              <FaMapMarkerAlt className="text-red-400" /> {event.location}
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
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [showMyQR, setShowMyQR] = useState(false);

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

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xl animate-in fade-in duration-300">
      <div className="absolute inset-0" onClick={onClose} />
      <div className={`bg-white rounded-[40px] w-full flex flex-col md:flex-row overflow-hidden relative z-10 shadow-2xl animate-in zoom-in-95 duration-300 max-h-[95vh] ${isCreator ? 'max-w-6xl' : 'max-w-2xl'}`}>
        
        {/* LEFT PANEL: SMART EVENT DETAILS */}
        <div className={`w-full ${isCreator ? 'md:w-[40%] border-r border-slate-50' : 'w-full'} flex flex-col overflow-y-auto bg-white scrollbar-hide`}>
          <div className="h-64 md:h-80 relative shrink-0">
            <img src={event.image || "/default-event.jpg"} className="w-full h-full object-cover" alt="" />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/20 to-transparent p-8 flex flex-col justify-end">
              <div className="flex gap-2 mb-3">
                <span className="bg-indigo-600 text-white text-[9px] font-black uppercase px-3 py-1 rounded-lg tracking-widest">{event.category}</span>
                {isPast && <span className="bg-red-500 text-white text-[9px] font-black uppercase px-3 py-1 rounded-lg tracking-widest">Closed</span>}
              </div>
              <h2 className="text-2xl md:text-3xl font-black text-white leading-tight">{event.title}</h2>
            </div>
            <button onClick={onClose} className="absolute top-6 right-6 bg-white/10 backdrop-blur-md text-white p-3 rounded-2xl hover:bg-red-500 transition-all active:scale-90">
              <FaTimes size={16} />
            </button>
          </div>

          <div className="p-8 space-y-8 flex-1">
            <div className="grid grid-cols-1 gap-4">
               <div className="flex items-center gap-4 bg-slate-50 p-5 rounded-[24px] border border-slate-100">
                  <div className="w-11 h-11 bg-white rounded-xl shadow-sm flex items-center justify-center text-indigo-600"><FaCalendarAlt /></div>
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Date & Time</p>
                    <p className="text-sm font-bold text-slate-800">{new Date(event.date).toDateString()} | {event.time}</p>
                  </div>
               </div>
               <div className="flex items-center gap-4 bg-slate-50 p-5 rounded-[24px] border border-slate-100">
                  <div className="w-11 h-11 bg-white rounded-xl shadow-sm flex items-center justify-center text-red-500"><FaMapMarkerAlt /></div>
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Venue</p>
                    <p className="text-sm font-bold text-slate-800">{event.location}</p>
                  </div>
               </div>
            </div>

            <div className="space-y-4">
              <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] border-l-2 border-indigo-200 pl-3">Event Abstract</p>
              <p className="text-sm text-slate-600 leading-relaxed font-medium">{event.description}</p>
            </div>

            {!isCreator && (
              <div className="pt-4">
                {myReg ? (
                  <div className="space-y-4">
                    <div className="bg-emerald-50 text-emerald-700 p-5 rounded-[24px] flex items-center justify-center gap-3 font-black text-xs uppercase tracking-widest border border-emerald-100">
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
                  <form onSubmit={handleRSVP} className="bg-slate-50 p-6 rounded-[32px] space-y-4 border border-slate-100">
                    <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-2 text-center">RSVP Details</h4>
                    <div className="space-y-3">
                      <div className="relative">
                        <FaIdCard className="absolute left-4 top-4 text-slate-300" />
                        <input required className="w-full bg-white rounded-2xl py-4 pl-12 pr-4 text-xs font-bold outline-none border border-transparent focus:border-indigo-500 transition-all" placeholder="STUDENT ID / ROLL NO" value={regData.studentId} onChange={e => setRegData({...regData, studentId: e.target.value})} />
                      </div>
                      <div className="relative">
                        <FaBuilding className="absolute left-4 top-4 text-slate-300" />
                        <input required className="w-full bg-white rounded-2xl py-4 pl-12 pr-4 text-xs font-bold outline-none border border-transparent focus:border-indigo-500 transition-all" placeholder="FACULTY / DEPT" value={regData.department} onChange={e => setRegData({...regData, department: e.target.value})} />
                      </div>
                      <div className="relative">
                        <FaPhone className="absolute left-4 top-4 text-slate-300" />
                        <input required type="tel" className="w-full bg-white rounded-2xl py-4 pl-12 pr-4 text-xs font-bold outline-none border border-transparent focus:border-indigo-500 transition-all" placeholder="CONTACT NUMBER" value={regData.phone} onChange={e => setRegData({...regData, phone: e.target.value})} />
                      </div>
                    </div>
                    <div className="flex gap-2">
                       <button type="button" onClick={() => setShowRegForm(false)} className="px-6 py-4 bg-white rounded-2xl font-black text-[10px] uppercase text-slate-400 transition-all">Back</button>
                       <button type="submit" disabled={loading} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-indigo-100 active:scale-95 transition-all">Confirm Enrollment</button>
                    </div>
                  </form>
                ) : (
                  <button 
                    onClick={() => setShowRegForm(true)} 
                    disabled={isPast}
                    className={`w-full py-5 rounded-[24px] font-black text-xs uppercase tracking-widest shadow-xl transition-all active:scale-95 flex items-center justify-center gap-3 ${isPast ? 'bg-slate-200 text-slate-400 shadow-none cursor-not-allowed' : 'bg-black text-white shadow-slate-200'}`}
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
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] flex items-center gap-3">
                 <FaClipboardList className="text-indigo-500" /> Admin Controller
              </h3>
              {isPast && <span className="bg-slate-200 text-slate-500 text-[9px] px-2 py-1 rounded uppercase font-black tracking-widest">Event Concluded</span>}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
                <button onClick={async () => {
                  try {
                    const blob = await exportParticipantsCSV(event._id);
                    const url = window.URL.createObjectURL(new Blob([blob]));
                    const link = document.createElement("a");
                    link.href = url;
                    link.setAttribute("download", `${event.title}-participants.csv`);
                    document.body.appendChild(link);
                    link.click();
                    link.remove();
                    toast.success("CSV Exported");
                  } catch {
                    toast.error("CSV export failed");
                  }
                }} className="flex flex-col items-center justify-center p-3 bg-white border border-slate-100 rounded-2xl hover:bg-slate-50 transition text-slate-600 gap-2 shadow-sm active:scale-95">
                    <FaDownload className="text-indigo-500 text-lg" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-center">Export CSV</span>
                </button>
                
                <button onClick={() => setShowQRScanner(true)} className="flex flex-col items-center justify-center p-3 bg-white border border-slate-100 rounded-2xl hover:bg-slate-50 transition text-slate-600 gap-2 shadow-sm active:scale-95">
                    <FaQrcode className="text-indigo-500 text-lg" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-center">Scan QR</span>
                </button>
                
                <button onClick={() => toast.success("Certificates module ready for next integration")} className="flex flex-col items-center justify-center p-3 bg-white border border-slate-100 rounded-2xl hover:bg-slate-50 transition text-slate-600 gap-2 shadow-sm active:scale-95">
                    <FaCertificate className="text-emerald-500 text-lg" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-center">Certificates</span>
                </button>
                
                <button onClick={async () => {
                  try {
                    const res = await getEventAnalytics(event._id);
                    setAnalytics(res.analytics);
                  } catch {
                    toast.error("Analytics failed");
                  }
                }} className="flex flex-col items-center justify-center p-3 bg-white border border-slate-100 rounded-2xl hover:bg-slate-50 transition text-slate-600 gap-2 shadow-sm active:scale-95">
                    <FaChartBar className="text-blue-500 text-lg" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-center">Analytics</span>
                </button>
            </div>

            {analytics && (
              <div className="bg-white rounded-[32px] p-6 border border-slate-100 mb-6 animate-in fade-in slide-in-from-top-4 duration-300 shadow-sm">
                <h4 className="font-black text-sm uppercase mb-4 text-indigo-600 tracking-widest flex items-center justify-between">
                  <span>Analytics Dashboard</span>
                  <button onClick={() => setAnalytics(null)} className="text-slate-400 hover:text-slate-600"><FaTimes /></button>
                </h4>

                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="bg-slate-50 p-4 rounded-2xl flex flex-col items-center">
                    <span className="text-2xl font-black text-slate-800">{analytics.totalRegistered}</span>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Total</span>
                  </div>
                  <div className="bg-emerald-50 p-4 rounded-2xl flex flex-col items-center">
                    <span className="text-2xl font-black text-emerald-600">{analytics.totalAttended}</span>
                    <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest mt-1">Attended</span>
                  </div>
                  <div className="bg-blue-50 p-4 rounded-2xl flex flex-col items-center">
                    <span className="text-2xl font-black text-blue-600">{analytics.attendanceRate}%</span>
                    <span className="text-[9px] font-bold text-blue-400 uppercase tracking-widest mt-1">Rate</span>
                  </div>
                </div>

                <div>
                  <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">Department Breakdown</h5>
                  {Object.entries(analytics.departmentStats || {}).map(([dept, count]) => (
                    <div key={dept} className="flex justify-between py-2 border-b border-slate-50 last:border-0">
                      <span className="text-xs font-bold text-slate-600 uppercase">{dept}</span>
                      <span className="text-xs font-black text-slate-800 bg-slate-100 px-2 py-0.5 rounded">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-4 mb-10">
                <div className="bg-white p-5 rounded-[28px] border border-slate-100 shadow-sm flex flex-col items-center text-center">
                   <FaUsers className="text-indigo-600 mb-2 text-xl" />
                   <p className="text-2xl font-black text-slate-900 leading-none">{participants.length}</p>
                   <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1.5">Registered</p>
                </div>
                <div className="bg-white p-5 rounded-[28px] border border-slate-100 shadow-sm flex flex-col items-center text-center">
                   <FaCheckCircle className="text-emerald-500 mb-2 text-xl" />
                   <p className="text-2xl font-black text-slate-900 leading-none">{participants.filter(p => p.status === "attended").length}</p>
                   <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1.5">Verified</p>
                </div>
                <div className="bg-white p-5 rounded-[28px] border border-slate-100 shadow-sm flex flex-col items-center text-center">
                   <div className="text-blue-500 mb-2 text-xl font-black">%</div>
                   <p className="text-2xl font-black text-slate-900 leading-none">{attendancePercentage}%</p>
                   <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1.5">Attendance</p>
                </div>
            </div>

            <div className="space-y-4 flex-1">
               <div className="flex justify-between items-center ml-1">
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Enrolled Roster</p>
                 <span className="text-[10px] font-bold text-indigo-500">{participants.length} Total</span>
               </div>
               
               <div className="space-y-3">
                  {/* 🔥 ISSUE 1 FIX: SAFE PARTICIPANTS MAPPING */}
                  {participants.filter(reg => reg?.user).map(reg => (
                    <div key={reg._id} className="bg-white p-4 rounded-[24px] border border-slate-100 flex flex-col gap-4 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between">
                         <div className="flex items-center gap-3 min-w-0">
                            <img src={getProfileImage(reg.user || {})} className="w-10 h-10 rounded-full object-cover border border-slate-100 shrink-0" alt="" />
                            <div className="min-w-0">
                               <p className="text-xs font-black text-slate-800 leading-none mb-1 truncate">{reg.user?.name || "Unknown User"}</p>
                               <p className="text-[9px] text-slate-400 font-bold tracking-widest truncate">@{reg.user?.username || "unknown"}</p>
                            </div>
                         </div>
                         {reg.status === 'attended' ? (
                           <div className="bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase flex items-center gap-1.5 shrink-0"><FaCheckCircle /> Verified</div>
                         ) : (
                           <button onClick={() => markAttendance(reg._id).then(res => {
                               if(res.success) {
                                 const updated = participants.map(p => p._id === reg._id ? {...p, status: 'attended'} : p);
                                 setParticipants(updated);
                                 setParticipantsCache(prev => ({...prev, [event._id]: updated}));
                               }
                           })} className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase active:scale-95 transition-all shrink-0 shadow-md">Verify RSVP</button>
                         )}
                      </div>
                      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-50 text-center">
                         <div><p className="text-[7px] font-black text-slate-300 uppercase mb-0.5">ID No.</p><p className="text-[10px] font-bold text-slate-600 truncate">{reg.studentId}</p></div>
                         <div><p className="text-[7px] font-black text-slate-300 uppercase mb-0.5">Dept</p><p className="text-[10px] font-bold text-slate-600 truncate">{reg.department}</p></div>
                         <div><p className="text-[7px] font-black text-slate-300 uppercase mb-0.5">Mobile</p><p className="text-[10px] font-bold text-slate-600 truncate">{reg.phone}</p></div>
                      </div>
                    </div>
                  ))}
                  {participants.filter(reg => reg?.user).length === 0 && (
                    <div className="text-center py-10 border border-dashed border-slate-200 rounded-3xl">
                      <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">No registrations yet</p>
                    </div>
                  )}
               </div>
            </div>

            <div className="mt-8 pt-6 border-t border-slate-200 shrink-0">
              <button
                onClick={async () => {
                  if (!window.confirm("Delete this event permanently?")) return;
                  try {
                    await deleteEvent(event._id);
                    toast.success("Event deleted");
                    onRefresh();
                    onClose();
                  } catch {
                    toast.error("Delete failed");
                  }
                }}
                className="w-full py-4 bg-red-50 text-red-500 hover:bg-red-500 hover:text-white transition-all rounded-2xl font-black text-[10px] uppercase tracking-widest border border-red-100 hover:border-red-500 shadow-sm flex justify-center items-center gap-2"
              >
                <FaTrash /> Delete Event
              </button>
            </div>

          </div>
        )}
        
        {showMyQR && myReg?.qrCode && (
          <div className="fixed inset-0 bg-slate-900/90 flex items-center justify-center z-[120] p-4 backdrop-blur-md">
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

        {showQRScanner && (
          <div className="fixed inset-0 bg-slate-900/95 flex items-center justify-center z-[120] p-4 backdrop-blur-md">
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

      </div>
    </div>
  );
};

export default Events;