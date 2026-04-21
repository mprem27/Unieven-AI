import API from "../api/axios";

/**
 * 🎬 GET ALL REELS
 */
export const getReels = async () => {
  try {
    const { data } = await API.get("/reels");
    return data;
  } catch (error) {
    throw error.response?.data || { message: "Failed to fetch reels" };
  }
};

/**
 * 📤 CREATE REEL
 */
export const createReel = async (formData) => {
  try {
    const { data } = await API.post("/reels/create", formData);
    return data;
  } catch (error) {
    throw error.response?.data || { message: "Failed to create reel" };
  }
};

/**
 * ❤️ LIKE / UNLIKE
 */
export const likeReel = async (id) => {
  try {
    const { data } = await API.post(`/reels/like/${id}`);
    return data;
  } catch (error) {
    throw error.response?.data || { message: "Failed to like reel" };
  }
};

/**
 * 💬 COMMENT
 */
export const addCommentToReel = async (id, text) => {
  try {
    const { data } = await API.post(`/reels/comment/${id}`, { text });
    return data;
  } catch (error) {
    throw error.response?.data || { message: "Failed to comment" };
  }
};

/**
 * 👁️ VIEW
 */
export const viewReel = async (id) => {
  try {
    const { data } = await API.post(`/reels/view/${id}`);
    return data;
  } catch (error) {
    throw error.response?.data || { message: "Failed to update views" };
  }
};