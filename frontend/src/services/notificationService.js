import API from "../api/axios";

/**
 * 🔔 GET ALL NOTIFICATIONS
 */
export const getNotifications = async () => {
  try {
    const { data } = await API.get("/notifications");
    return data || { notifications: [] };
  } catch (error) {
    console.log("getNotifications error:", error);
    return { notifications: [] }; // ✅ safe fallback
  }
};

/**
 * ✅ MARK AS READ (single or all)
 */
export const markAsRead = async (notificationId = null) => {
  try {
    const { data } = await API.post("/notifications/read", {
      notificationId,
    });
    return data;
  } catch (error) {
    console.log("markAsRead error:", error);
    return { success: false };
  }
};

/**
 * 🗑 DELETE NOTIFICATION
 */
export const deleteNotification = async (id) => {
  try {
    const { data } = await API.delete(`/notifications/${id}`);
    return data;
  } catch (error) {
    console.log("deleteNotification error:", error);
    return { success: false };
  }
};

/**
 * ✅ ACCEPT FOLLOW REQUEST
 */
export const acceptFollowRequest = async (requestId) => {
  try {
    const { data } = await API.post(`/follow/accept/${requestId}`);
    return data;
  } catch (error) {
    console.log("acceptFollowRequest error:", error);
    return { success: false };
  }
};

/**
 * ❌ REJECT FOLLOW REQUEST
 */
export const rejectFollowRequest = async (requestId) => {
  try {
    const { data } = await API.post(`/follow/reject/${requestId}`);
    return data;
  } catch (error) {
    console.log("rejectFollowRequest error:", error);
    return { success: false };
  }
};