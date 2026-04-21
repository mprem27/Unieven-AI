import API from "../api/axios";

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
    console.log("REGISTER ERROR:", error);
    throw error.response?.data || { message: "Failed to register" };
  }
};

/**
 * 📅 GET MY EVENTS (TICKETS)
 */
export const getMyEvents = async () => {
  try {
    const { data } = await API.get("/event-registration/my-events");
    return data;
  } catch (error) {
    console.log("MY EVENTS ERROR:", error);
    throw error.response?.data || { message: "Failed to fetch tickets" };
  }
};

/**
 * 👥 GET EVENT PARTICIPANTS
 */
export const getEventParticipants = async (eventId) => {
  try {
    const { data } = await API.get(
      `/event-registration/participants/${eventId}`
    );
    return data;
  } catch (error) {
    console.log("PARTICIPANTS ERROR:", error);
    throw error.response?.data || {
      message: "Failed to fetch participants",
    };
  }
};

/**
 * ✅ MARK ATTENDANCE
 */
export const markAttendance = async (registrationId) => {
  try {
    const { data } = await API.post(
      `/event-registration/attendance/${registrationId}`
    );
    return data;
  } catch (error) {
    console.log("ATTENDANCE ERROR:", error);
    throw error.response?.data || {
      message: "Failed to mark attendance",
    };
  }
};