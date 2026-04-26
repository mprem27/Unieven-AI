import API from "../api/axios";

export const getReels = async () => {
  try {
    const { data } = await API.get("/reels");
    return data;
  } catch (error) {
    throw error.response?.data || { message: "Failed to fetch reels" };
  }
};

export const createReel = async (formData) => {
  try {
    const { data } = await API.post("/reels/create", formData);
    return data;
  } catch (error) {
    throw error.response?.data || { message: "Failed to create reel" };
  }
};

export const likeReel = async (id) => {
  try {
    const { data } = await API.post(`/reels/like/${id}`);
    return data;
  } catch (error) {
    throw error.response?.data || { message: "Failed to like reel" };
  }
};

export const addCommentToReel = async (id, text) => {
  try {
    const { data } = await API.post(`/reels/comment/${id}`, { text });
    return data;
  } catch (error) {
    throw error.response?.data || { message: "Failed to comment" };
  }
};

export const viewReel = async (id) => {
  try {
    const { data } = await API.post(`/reels/view/${id}`);
    return data;
  } catch (error) {
    throw error.response?.data || { message: "Failed to update views" };
  }
};

export const deleteReel = async (id) => {
  try {
    const { data } = await API.delete(`/reels/${id}`);
    return data;
  } catch (error) {
    throw error.response?.data || { message: "Failed to delete reel" };
  }
};