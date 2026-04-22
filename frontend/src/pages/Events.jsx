import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { 
  getAllEvents, 
  getMyEvents, 
  registerForEvent, 
  getEventParticipants, 
  markAttendance 
} from "../services/eventService";
import { toast } from "react-toastify";
import Loader from "../components/Loader";
import { getProfileImage } from "../utils/getProfileImage";
import { 
  FaCalendarAlt, FaClock, FaMapMarkerAlt, FaTicketAlt, 
  FaTimes, FaUsers, FaCheckCircle, FaChevronRight, FaIdBadge, FaBuilding, FaPhoneAlt, FaRegCompass, FaPlus
} from "react-icons/fa";

function Events() {
  const { user: currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState("discover"); 
  
  const [events, setEvents] = useState([]);
  const [myTickets, setMyTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [eventsData, ticketsData] = await Promise.all([
        getAllEvents().catch(() => ({ events: [] })),
        getMyEvents().catch(() => ({ registrations: [] }))
      ]);
      setEvents(eventsData.events || []);
      setMyTickets(ticketsData.registrations || []);
    } catch (error) {
      toast.error("Failed to load events.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const now = new Date();
  const upcomingEvents = events.filter(e => new Date(e.date) >= now || e.status === "upcoming");
  const pastEvents = events.filter(e => new Date(e.date) < now || e.status === "completed")
                           .sort((a, b) => new Date(b.date) - new Date(a.date))
                           .slice(0, 6); 

  if (loading) {
    return <div className="min-h-screen flex justify-center items-center bg-[#F8FAFC]"><Loader size="40px" /></div>;
  }

  return (
    <div className="w-full min-h-screen bg-[#F8FAFC] font-['Poppins',sans-serif] pb-24 relative overflow-hidden">
      
      {/* Ambient Background */}
      <div className="fixed top-[-10%] left-[-10%] w-[500px] h-[500px] bg-blue-300/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-indigo-300/20 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-10 relative z-10">
        
        {/* HEADER SECTION */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 gap-6">
          <div className="space-y-2">
            <span className="text-indigo-600 font-bold tracking-wider uppercase text-sm flex items-center gap-2">
              <FaRegCompass /> University Portal
            </span>
            <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight">Campus Events</h1>
            <p className="text-slate-500 font-medium text-lg max-w-xl">
              Discover opportunities, secure your tickets, and connect with your campus community.
            </p>
          </div>
          {(currentUser?.role === "faculty" || currentUser?.role === "admin") && (
            <Link to="/create/event" className="bg-indigo-600 hover:bg-indigo-700 text-white px-7 py-3.5 rounded-xl font-bold shadow-lg shadow-indigo-600/20 transition-all active:scale-95 flex items-center gap-2 shrink-0">
              <FaPlus /> Create Event
            </Link>
          )}
        </div>

        {/* MODERN PILL TABS */}
        <div className="flex p-1.5 bg-slate-200/50 rounded-xl w-max mb-10 border border-slate-200">
          <button 
            onClick={() => setActiveTab("discover")}
            className={`px-8 py-2.5 rounded-lg font-bold text-sm transition-all duration-300 flex items-center gap-2 ${activeTab === "discover" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
          >
            <FaRegCompass className={activeTab === "discover" ? "text-indigo-500" : ""} /> Discover
          </button>
          <button 
            onClick={() => setActiveTab("tickets")}
            className={`px-8 py-2.5 rounded-lg font-bold text-sm transition-all duration-300 flex items-center gap-2 ${activeTab === "tickets" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
          >
            <FaTicketAlt className={activeTab === "tickets" ? "text-indigo-500" : ""} /> My Tickets
            {myTickets.length > 0 && (
              <span className={`ml-1.5 px-2 py-0.5 rounded-full text-[10px] ${activeTab === "tickets" ? "bg-indigo-100 text-indigo-700" : "bg-slate-300 text-slate-600"}`}>
                {myTickets.length}
              </span>
            )}
          </button>
        </div>

        {/* TAB 1: DISCOVER */}
        {activeTab === "discover" && (
          <div className="flex flex-col gap-14 animate-in fade-in duration-500">
            
            <section>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.6)]" />
                <h2 className="text-2xl font-black text-slate-900">Upcoming Events</h2>
              </div>
              
              {upcomingEvents.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                  {upcomingEvents.map(event => <EventCard key={event._id} event={event} onClick={() => setSelectedEvent(event)} />)}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center bg-white py-16 px-4 rounded-3xl border border-slate-100 shadow-sm">
                  <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mb-4"><FaCalendarAlt size={32} /></div>
                  <h3 className="text-xl font-bold text-slate-800">No upcoming events</h3>
                  <p className="text-slate-500 font-medium mt-1">Check back later for new campus activities.</p>
                </div>
              )}
            </section>

            {pastEvents.length > 0 && (
              <section>
                <h2 className="text-lg font-bold text-slate-400 mb-6 uppercase tracking-widest border-b border-slate-200 pb-2">Past Events Library</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 opacity-80 hover:opacity-100 transition-opacity duration-300">
                  {pastEvents.map(event => <EventCard key={event._id} event={event} onClick={() => setSelectedEvent(event)} isPast />)}
                </div>
              </section>
            )}
          </div>
        )}

        {/* TAB 2: MY TICKETS */}
        {activeTab === "tickets" && (
          <div className="flex flex-col gap-5 animate-in fade-in duration-500 max-w-4xl mx-auto">
            {myTickets.length > 0 ? (
              myTickets.map((ticket) => (
                <div key={ticket._id} onClick={() => setSelectedEvent(ticket.event)} className="bg-white border border-slate-200 rounded-2xl flex items-stretch cursor-pointer hover:shadow-xl transition-all hover:-translate-y-1 overflow-hidden group">
                  {/* Status Color Bar */}
                  <div className={`w-3 shrink-0 ${ticket.status === "attended" ? "bg-emerald-400" : "bg-indigo-500"}`} />
                  
                  {/* Ticket Image */}
                  <div className="w-28 sm:w-40 shrink-0 relative">
                    <img src={ticket.event.image} className="w-full h-full object-cover" alt="event" />
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent to-white border-r border-dashed border-slate-300"></div>
                  </div>

                  {/* Ticket Details */}
                  <div className="p-5 sm:p-6 flex-1 flex flex-col justify-center">
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-1 block">{ticket.event.category}</span>
                        <h3 className="font-black text-lg sm:text-xl text-slate-900 leading-tight mb-2 group-hover:text-indigo-600 transition-colors">{ticket.event.title}</h3>
                        <p className="text-sm text-slate-500 flex items-center gap-2 font-medium">
                          <FaCalendarAlt className="text-slate-400" /> {new Date(ticket.event.date).toLocaleDateString()} • {ticket.event.time}
                        </p>
                      </div>
                      <div className="shrink-0 flex flex-col items-end gap-3 hidden sm:flex">
                        <span className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border ${
                          ticket.status === "attended" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-indigo-50 text-indigo-700 border-indigo-200"
                        }`}>
                          {ticket.status === "attended" ? "Attended" : "Registered"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Mobile Status Badge */}
                  <div className="sm:hidden absolute top-3 right-3">
                    <span className={`w-3 h-3 rounded-full block border-2 border-white shadow-sm ${ticket.status === "attended" ? "bg-emerald-500" : "bg-indigo-500"}`} />
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-24 bg-white rounded-3xl border border-slate-200 shadow-sm">
                <div className="w-24 h-24 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-300 text-4xl mx-auto mb-5">
                  <FaTicketAlt />
                </div>
                <h3 className="text-2xl font-black text-slate-900">No Tickets Yet</h3>
                <p className="text-slate-500 mt-2 font-medium text-lg">Your registered event passes will appear here.</p>
                <button onClick={() => setActiveTab("discover")} className="mt-6 text-indigo-600 font-bold hover:underline">Explore upcoming events &rarr;</button>
              </div>
            )}
          </div>
        )}

      </div>

      {/* MODAL */}
      {selectedEvent && (
        <EventModal 
          event={selectedEvent} 
          currentUser={currentUser} 
          myTickets={myTickets}
          onClose={() => setSelectedEvent(null)} 
          onRefresh={loadData}
        />
      )}
    </div>
  );
}

// ------------------------------------------------------------------
// REUSABLE EVENT CARD COMPONENT
// ------------------------------------------------------------------
const EventCard = ({ event, onClick, isPast }) => {
  const dateObj = new Date(event.date);
  const month = dateObj.toLocaleDateString('en-US', { month: 'short' });
  const day = dateObj.getDate();

  return (
    <div onClick={onClick} className="bg-white rounded-[24px] overflow-hidden shadow-sm hover:shadow-2xl transition-all duration-400 cursor-pointer border border-slate-100 flex flex-col hover:-translate-y-2 group">
      
      <div className="h-[220px] w-full relative overflow-hidden">
        <img src={event.image} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" alt={event.title} />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-transparent opacity-60"></div>
        
        {/* Floating Calendar Date Badge */}
        <div className="absolute top-4 left-4 bg-white/95 backdrop-blur-md rounded-xl text-center p-2 min-w-[55px] shadow-lg border border-white/50 flex flex-col items-center">
          <span className="text-[10px] uppercase font-bold text-indigo-600 tracking-wider">{month}</span>
          <span className="text-2xl font-black text-slate-900 leading-none mt-0.5">{day}</span>
        </div>

        {/* Category Badge */}
        <div className="absolute top-4 right-4 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full text-[10px] font-bold text-white shadow-sm uppercase tracking-wider border border-white/20">
          {event.category}
        </div>

        {isPast && (
          <div className="absolute inset-0 bg-slate-900/60 flex items-center justify-center backdrop-blur-[2px]">
            <span className="bg-white/10 text-white px-6 py-2.5 rounded-full text-sm font-black tracking-widest uppercase border border-white/20 backdrop-blur-md shadow-xl">Event Ended</span>
          </div>
        )}
      </div>

      <div className="p-6 flex flex-col flex-1 bg-white">
        <h3 className="font-black text-lg text-slate-900 leading-snug line-clamp-2 mb-4 group-hover:text-indigo-600 transition-colors">{event.title}</h3>
        
        <div className="mt-auto flex flex-col gap-3 text-[13px] text-slate-600 font-medium">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-500 shrink-0"><FaClock size={12} /></div> 
            <span className="truncate">{event.time}</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center text-red-500 shrink-0"><FaMapMarkerAlt size={12} /></div> 
            <span className="truncate">{event.location}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// ------------------------------------------------------------------
// EVENT DETAILS & DASHBOARD MODAL
// ------------------------------------------------------------------
const EventModal = ({ event, currentUser, myTickets, onClose, onRefresh }) => {
  const [loading, setLoading] = useState(false);
  const [participants, setParticipants] = useState([]);
  
  const [showRegForm, setShowRegForm] = useState(false);
  const [regData, setRegData] = useState({
    studentId: "",
    department: "",
    phone: ""
  });

  useEffect(() => {
    if (currentUser && showRegForm) {
      setRegData(prev => ({
        ...prev,
        studentId: prev.studentId || currentUser.username || "" 
      }));
    }
  }, [currentUser, showRegForm]);
  
  const isCreator = event.createdBy?._id === currentUser?._id || event.createdBy === currentUser?._id;
  const myRegistration = myTickets.find(t => t.event._id === event._id);
  const isPast = new Date(event.date) < new Date() || event.status === "completed";

  useEffect(() => {
    if (isCreator) {
      getEventParticipants(event._id).then(res => {
        if(res.success) setParticipants(res.participants);
      }).catch(err => console.log("Failed to fetch participants", err));
    }
  }, [event._id, isCreator]);

  const handleRegisterSubmit = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);

    try {
      if (myRegistration) {
        await registerForEvent({ eventId: event._id });
        toast.success("Unregistered successfully");
      } else {
        await registerForEvent({
          eventId: event._id,
          studentId: regData.studentId,
          department: regData.department,
          phone: regData.phone,
        });
        toast.success("Registered successfully! 🎉");
      }

      setShowRegForm(false);
      onRefresh();
      onClose();

    } catch (err) {
      console.log("Registration Error:", err);
      toast.error(err.message || "Failed to process registration");
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAttendance = async (regId) => {
    try {
      await markAttendance(regId);
      setParticipants(prev => prev.map(p => p._id === regId ? { ...p, status: "attended" } : p));
      toast.success("Attendance marked!");
    } catch (err) {
      toast.error("Failed to mark attendance");
    }
  };

  const attendedCount = participants.filter(p => p.status === "attended").length;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/70 backdrop-blur-md p-4 sm:p-6 animate-in fade-in duration-200">
      
      {!showRegForm && <div className="absolute inset-0 cursor-pointer" onClick={onClose}></div>}
      
      <div className={`bg-white rounded-[32px] w-full flex flex-col md:flex-row overflow-hidden relative z-10 shadow-2xl animate-in zoom-in-95 duration-300 max-h-[90vh] ${isCreator ? 'max-w-5xl' : 'max-w-3xl'}`}>
        
        <button onClick={onClose} className={`absolute top-5 right-5 z-50 p-2.5 rounded-full transition-all shadow-sm ${!showRegForm ? 'bg-white text-slate-600 hover:bg-slate-100' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`} disabled={showRegForm}>
          <FaTimes size={16} />
        </button>

        {/* LEFT: Event Details */}
        <div className={`w-full ${isCreator ? 'md:w-[45%] border-r border-slate-100' : 'md:w-full'} flex flex-col overflow-y-auto bg-white`}>
          <div className="h-[260px] md:h-[320px] w-full shrink-0 relative bg-slate-100">
            <img src={event.image} alt={event.title} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-transparent"></div>
            
            {/* Title overlay on image for a premium look */}
            <div className="absolute bottom-0 left-0 w-full p-6 pb-8">
               <span className="px-3 py-1 bg-indigo-500 text-white font-bold text-[10px] rounded-md uppercase tracking-widest mb-3 inline-block shadow-sm">{event.category}</span>
               <h2 className="text-2xl md:text-3xl font-black text-white leading-tight tracking-tight drop-shadow-md">{event.title}</h2>
            </div>
          </div>
          
          <div className="p-6 md:p-8 flex flex-col flex-1 bg-white">
            
            <div className="grid grid-cols-1 gap-4 text-slate-700 text-sm font-medium mb-8">
              <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <div className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center text-indigo-500 shrink-0"><FaCalendarAlt size={16} /></div> 
                <div>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-0.5">Date & Time</p>
                  <p className="font-bold text-slate-800">{new Date(event.date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} • {event.time}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <div className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center text-red-500 shrink-0"><FaMapMarkerAlt size={16} /></div> 
                <div>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-0.5">Location</p>
                  <p className="font-bold text-slate-800 leading-snug">{event.location}</p>
                </div>
              </div>
            </div>

            <div className="mb-10">
              <h4 className="text-sm font-black text-slate-900 mb-3 border-b border-slate-100 pb-2">About This Event</h4>
              <p className="text-slate-600 text-[15px] leading-relaxed whitespace-pre-wrap">
                {event.description || "Join us for an exciting campus event!"}
              </p>
            </div>

            {/* REGISTRATION ACTION / FORM SECTION */}
            {!isCreator && !isPast && (
              <div className="mt-auto border-t border-slate-100 pt-6">
                {myRegistration ? (
                  <div className="space-y-4">
                    <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center justify-center gap-3 text-emerald-700 font-bold">
                       <FaCheckCircle size={20} /> You have secured a ticket!
                    </div>
                    <button 
                      onClick={() => handleRegisterSubmit()} 
                      disabled={loading}
                      className="w-full py-3.5 rounded-xl font-bold text-[14px] transition-all hover:bg-red-50 text-red-500 border border-transparent hover:border-red-100 flex items-center justify-center gap-2"
                    >
                      {loading ? <Loader size="18px" color="#ef4444" /> : "Cancel Registration"}
                    </button>
                  </div>
                ) : showRegForm ? (
                  <form onSubmit={handleRegisterSubmit} className="bg-indigo-50/50 p-6 rounded-3xl border border-indigo-100 flex flex-col gap-4 animate-in slide-in-from-bottom-2 duration-300">
                    <div className="mb-2">
                      <h4 className="font-black text-slate-900 text-lg">RSVP Details</h4>
                      <p className="text-xs text-slate-500 font-medium">Please confirm your student information.</p>
                    </div>
                    
                    <div className="relative">
                      <FaIdBadge className="absolute left-4 top-3.5 text-slate-400" />
                      <input required type="text" placeholder="Student ID / Roll No." className="w-full bg-white border border-slate-200 rounded-xl pl-11 pr-4 py-3 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none shadow-sm transition-all" value={regData.studentId} onChange={e => setRegData({...regData, studentId: e.target.value})} />
                    </div>
                    
                    <div className="relative">
                      <FaBuilding className="absolute left-4 top-3.5 text-slate-400" />
                      <input required type="text" placeholder="Department / Major" className="w-full bg-white border border-slate-200 rounded-xl pl-11 pr-4 py-3 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none shadow-sm transition-all" value={regData.department} onChange={e => setRegData({...regData, department: e.target.value})} />
                    </div>
                    
                    <div className="relative">
                      <FaPhoneAlt className="absolute left-4 top-3.5 text-slate-400" />
                      <input required type="tel" placeholder="Phone Number" className="w-full bg-white border border-slate-200 rounded-xl pl-11 pr-4 py-3 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none shadow-sm transition-all" value={regData.phone} onChange={e => setRegData({...regData, phone: e.target.value})} />
                    </div>

                    <div className="flex gap-3 mt-4">
                      <button type="button" onClick={() => setShowRegForm(false)} className="px-6 py-3.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition-colors shadow-sm text-sm">Cancel</button>
                      <button type="submit" disabled={loading} className="flex-1 py-3.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-md shadow-indigo-600/20 flex justify-center items-center transition-all active:scale-95 text-sm">
                        {loading ? <Loader size="20px" color="#fff" /> : "Confirm RSVP"}
                      </button>
                    </div>
                  </form>
                ) : (
                  <button 
                    onClick={() => setShowRegForm(true)}
                    className="w-full py-4 rounded-2xl font-bold text-[16px] shadow-xl shadow-indigo-600/20 transition-all hover:-translate-y-1 active:scale-95 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
                  >
                    <FaTicketAlt /> Reserve Your Spot
                  </button>
                )}
              </div>
            )}

            {!isCreator && isPast && (
               <div className={`mt-auto w-full py-4 rounded-2xl font-bold text-center border ${myRegistration?.status === "attended" ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-slate-100 border-slate-200 text-slate-500"}`}>
                 {myRegistration?.status === "attended" ? "🎉 You attended this event" : "Event has ended"}
               </div>
            )}
          </div>
        </div>

        {/* RIGHT: Faculty Dashboard */}
        {isCreator && (
          <div className="w-full md:w-[55%] p-6 md:p-8 flex flex-col bg-slate-50/50 overflow-y-auto">
            <h3 className="text-2xl font-black text-slate-900 mb-8 flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center shadow-sm"><FaUsers size={20} /></div> 
              Organizer Dashboard
            </h3>
            
            <div className="grid grid-cols-2 gap-5 mb-10">
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden">
                <div className="absolute -right-4 -top-4 w-20 h-20 bg-indigo-50 rounded-full opacity-50"></div>
                <p className="text-4xl font-black text-indigo-600 mb-1">{participants.length}</p>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total RSVPs</p>
              </div>
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden">
                <div className="absolute -right-4 -top-4 w-20 h-20 bg-emerald-50 rounded-full opacity-50"></div>
                <p className="text-4xl font-black text-emerald-500 mb-1">{attendedCount}</p>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Checked In</p>
              </div>
            </div>

            <div className="flex items-center justify-between mb-4">
               <h4 className="text-sm font-black text-slate-900">Guest List</h4>
               <span className="text-xs font-medium text-slate-500 bg-slate-200 px-3 py-1 rounded-full">{participants.length} Students</span>
            </div>
            
            <div className="flex flex-col gap-4 flex-1 overflow-y-auto pr-1 scrollbar-hide">
              {participants.length > 0 ? participants.map(reg => (
                <div key={reg._id} className="flex flex-col bg-white border border-slate-200 p-5 rounded-2xl shadow-sm hover:shadow-md transition-all group">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <img src={getProfileImage(reg.user)} className="w-12 h-12 rounded-full object-cover border-2 border-slate-100 shadow-sm" alt="avatar" />
                      <div>
                        <p className="font-bold text-base text-slate-900 leading-tight">{reg.user.name}</p>
                        <p className="text-xs text-slate-500 font-medium mt-0.5">@{reg.user.username}</p>
                      </div>
                    </div>
                    
                    {reg.status === "attended" ? (
                      <span className="bg-emerald-50 text-emerald-600 border border-emerald-200 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm">
                        <FaCheckCircle size={14} /> Checked In
                      </span>
                    ) : (
                      <button 
                        onClick={() => handleMarkAttendance(reg._id)}
                        className="bg-white border border-slate-300 hover:border-indigo-500 hover:text-indigo-600 hover:bg-indigo-50 text-slate-700 px-5 py-2 rounded-xl text-xs font-bold transition-all shadow-sm"
                      >
                        Mark Present
                      </button>
                    )}
                  </div>

                  {(reg.studentId || reg.department || reg.phone) && (
                    <div className="mt-5 pt-4 border-t border-slate-100 grid grid-cols-3 gap-3">
                      <div>
                        <span className="block text-slate-400 font-bold uppercase text-[10px] tracking-wider mb-1">ID No.</span>
                        <span className="text-slate-800 text-sm font-semibold">{reg.studentId || '-'}</span>
                      </div>
                      <div>
                        <span className="block text-slate-400 font-bold uppercase text-[10px] tracking-wider mb-1">Dept</span>
                        <span className="text-slate-800 text-sm font-semibold truncate block pr-2">{reg.department || '-'}</span>
                      </div>
                      <div>
                        <span className="block text-slate-400 font-bold uppercase text-[10px] tracking-wider mb-1">Phone</span>
                        <span className="text-slate-800 text-sm font-semibold">{reg.phone || '-'}</span>
                      </div>
                    </div>
                  )}
                </div>
              )) : (
                <div className="flex flex-col items-center justify-center py-16 bg-white rounded-3xl border border-slate-200 border-dashed">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mb-4"><FaUsers size={24} /></div>
                  <p className="text-slate-500 font-medium text-sm">No registrations yet.</p>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default Events;