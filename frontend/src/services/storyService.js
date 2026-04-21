import API from "../api/axios";

/**
 * 📖 GET STORIES (GROUPED BY USER)
 */
export const getStories = async () => {
  try {
    const { data } = await API.get("/stories");
    return data;
  } catch (error) {
    throw error.response?.data || {
      message: error.message || "Failed to fetch stories",
    };
  }
};

/**
 * 👁️ VIEW STORY
 */
export const viewStory = async (storyId) => {
  try {
    const { data } = await API.post(`/stories/view/${storyId}`);
    return data;
  } catch (error) {
    throw error.response?.data || {
      message: error.message || "Failed to mark story as viewed",
    };
  }
};

/**
 * ✅ CREATE STORY (FIXED — matches AddStory.jsx)
 */
export const createStory = async (formData) => {
  try {
    const { data } = await API.post("/stories/upload", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return data;
  } catch (error) {
    throw error.response?.data || {
      message: error.message || "Failed to upload story",
    };
  }
};

/**
 * ❌ DELETE STORY
 */
export const deleteStory = async (id) => {
  try {
    const { data } = await API.delete(`/stories/${id}`);
    return data;
  } catch (error) {
    throw error.response?.data || {
      message: error.message || "Failed to delete story",
    };
  }
};