import API from "../api/axios";

// =====================================================
// 📝 REGISTER / UNREGISTER EVENT
// =====================================================
/**
 * Registers a user for an event.
 * @param {Object} payload 
 * @param {string} payload.eventId - ID of the event
 * @param {string} payload.studentId - User's Student ID
 * @param {string} payload.department - User's Department
 * @param {string} payload.phone - User's Phone Number
 * @param {string} payload.email - User's Email Address (New)
 * @param {string} [payload.degree] - User's Degree (New, Optional depending on validation)
 * @param {number} [payload.yearOfStudy] - User's Year of Study (New, Optional)
 * @param {string} [payload.collegeName] - User's College Name (New, Optional)
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

    throw (
      error.response?.data || {
        success: false,
        message: "Failed to register",
      }
    );
  }
};

// =====================================================
// 📅 GET MY REGISTERED EVENTS
// =====================================================
export const getMyEvents = async () => {
  try {
    const { data } = await API.get(
      "/event-registration/my-events"
    );

    return data;
  } catch (error) {
    console.error("MY EVENTS ERROR:", error);

    throw (
      error.response?.data || {
        success: false,
        message: "Failed to fetch tickets",
      }
    );
  }
};

// =====================================================
// 👥 GET EVENT PARTICIPANTS
// =====================================================
export const getEventParticipants = async (eventId) => {
  try {
    const { data } = await API.get(
      `/event-registration/participants/${eventId}`
    );

    return data;
  } catch (error) {
    console.error("PARTICIPANTS ERROR:", error);

    throw (
      error.response?.data || {
        success: false,
        message: "Failed to fetch participants",
      }
    );
  }
};

// =====================================================
// ✅ MARK ATTENDANCE MANUALLY
// FIXED TO MATCH BACKEND (PUT)
// =====================================================
export const markAttendance = async (registrationId) => {
  try {
    const { data } = await API.put(
      `/event-registration/attendance/${registrationId}`
    );

    return data;
  } catch (error) {
    console.error("ATTENDANCE ERROR:", error);

    throw (
      error.response?.data || {
        success: false,
        message: "Failed to mark attendance",
      }
    );
  }
};

// =====================================================
// 📱 VERIFY QR CODE
// =====================================================
export const verifyEventQR = async (qrData) => {
  try {
    const { data } = await API.post(
      "/event-registration/verify-qr",
      {
        qrData,
      }
    );

    return data;
  } catch (error) {
    console.error("QR VERIFY ERROR:", error);

    throw (
      error.response?.data || {
        success: false,
        message: "Failed to verify QR",
      }
    );
  }
};

// =====================================================
// 📊 GET EVENT ANALYTICS
// =====================================================
export const getEventAnalytics = async (eventId) => {
  try {
    const { data } = await API.get(
      `/event-registration/analytics/${eventId}`
    );

    return data;
  } catch (error) {
    console.error("ANALYTICS ERROR:", error);

    throw (
      error.response?.data || {
        success: false,
        message: "Failed to fetch analytics",
      }
    );
  }
};

// =====================================================
// 📥 EXPORT PARTICIPANTS CSV
// =====================================================
export const exportParticipantsCSV = async (eventId) => {
  try {
    const response = await API.get(
      `/event-registration/export/${eventId}`,
      {
        responseType: "blob", // Required to handle binary file downloads
      }
    );

    return response.data;
  } catch (error) {
    console.error("CSV EXPORT ERROR:", error);

    throw (
      error.response?.data || {
        success: false,
        message: "Failed to export CSV",
      }
    );
  }
};