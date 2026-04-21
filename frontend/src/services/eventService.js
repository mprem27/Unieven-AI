import API from "../api/axios";

/**
 * 🎉 CREATE EVENT
 */
export const createEvent = async (formData) => {
  try {
    const { data } = await API.post("/events/create", formData);
    return data;
  } catch (error) {
    console.error("CREATE EVENT ERROR:", error);
    throw error.response?.data || { message: "Failed to create event" };
  }
};


/**
 * 📅 GET ALL EVENTS
 */
export const getAllEvents = async () => {
  try {
    const { data } = await API.get("/events");
    return data;
  } catch (error) {
    console.error("GET EVENTS ERROR:", error);
    throw error.response?.data || { message: "Failed to fetch events" };
  }
};


/**
 * 🔍 GET SINGLE EVENT
 */
export const getSingleEvent = async (id) => {
  try {
    const { data } = await API.get(`/events/${id}`);
    return data;
  } catch (error) {
    console.error("GET SINGLE EVENT ERROR:", error);
    throw error.response?.data || { message: "Failed to fetch event" };
  }
};


/**
 * 🎟 REGISTER / UNREGISTER EVENT
 * ✅ Supports full payload (eventId + student details)
 */
export const registerForEvent = async (payload) => {
  try {
    const { data } = await API.post(
      "/event-registration/register",
      payload
    );
    return data;
  } catch (error) {
    console.error("REGISTER ERROR:", error);
    throw error.response?.data || { message: "Failed to register" };
  }
};


/**
 * 📌 GET MY EVENTS (TICKETS)
 */
export const getMyEvents = async () => {
  try {
    const { data } = await API.get("/event-registration/my-events");
    return data;
  } catch (error) {
    console.error("MY EVENTS ERROR:", error);
    throw error.response?.data || { message: "Failed to fetch my events" };
  }
};


/**
 * 👥 GET EVENT PARTICIPANTS (FACULTY / ADMIN)
 */
export const getEventParticipants = async (eventId) => {
  try {
    const { data } = await API.get(
      `/event-registration/participants/${eventId}`
    );
    return data;
  } catch (error) {
    console.error("PARTICIPANTS ERROR:", error);
    throw error.response?.data || {
      message: "Failed to fetch participants",
    };
  }
};


/**
 * ✅ MARK ATTENDANCE
 * 🔥 FIXED → MUST BE PUT (matches backend)
 */
export const markAttendance = async (registrationId) => {
  try {
    const { data } = await API.put(
      `/event-registration/attendance/${registrationId}`
    );
    return data;
  } catch (error) {
    console.error("ATTENDANCE ERROR:", error);
    throw error.response?.data || {
      message: "Failed to mark attendance",
    };
  }
};


/**
 * 🗑 DELETE EVENT
 */
export const deleteEvent = async (id) => {
  try {
    const { data } = await API.delete(`/events/${id}`);
    return data;
  } catch (error) {
    console.error("DELETE EVENT ERROR:", error);
    throw error.response?.data || { message: "Failed to delete event" };
  }
};