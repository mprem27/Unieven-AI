import API from "../api/axios";

/**
 * 📰 GET FEED POSTS (USED IN FEED PAGE)
 */
export const getFeed = async () => {
  try {
    const { data } = await API.get("/posts/feed");
    return data;
  } catch (error) {
    throw error.response?.data || { message: "Failed to fetch feed" };
  }
};

/**
 * 📰 FETCH FEED (USED IN PROFILE PAGE)
 * 👉 SAME AS getFeed (alias to fix your error)
 */
export const fetchFeed = async () => {
  try {
    const { data } = await API.get("/posts/feed");
    return data;
  } catch (error) {
    throw error.response?.data || { message: "Failed to fetch feed" };
  }
};

/**
 * 📄 GET SINGLE POST
 */
export const getPostById = async (id) => {
  try {
    const { data } = await API.get(`/posts/${id}`);
    return data;
  } catch (error) {
    throw error.response?.data || { message: "Failed to fetch post" };
  }
};

/**
 * 📸 CREATE POST
 */
export const createPost = async (formData) => {
  try {
    const { data } = await API.post("/posts/create", formData);
    return data;
  } catch (error) {
    throw error.response?.data || { message: "Failed to create post" };
  }
};

/**
 * ❌ DELETE POST
 */
export const deletePost = async (id) => {
  try {
    const { data } = await API.delete(`/posts/${id}`);
    return data;
  } catch (error) {
    throw error.response?.data || { message: "Failed to delete post" };
  }
};

/**
 * ❤️ LIKE / UNLIKE POST
 */
export const likePost = async (id) => {
  try {
    const { data } = await API.post(`/posts/like/${id}`);
    return data;
  } catch (error) {
    throw error.response?.data || { message: "Failed to like post" };
  }
};

/**
 * 💬 ADD COMMENT (POST ONLY - OLD)
 */
export const addComment = async (id, text) => {
  try {
    const { data } = await API.post(`/posts/comment/${id}`, { text });
    return data;
  } catch (error) {
    throw error.response?.data || { message: "Failed to add comment" };
  }
};

/**
 * 🌍 UNIVERSAL COMMENT (POST / REEL / STORY)
 */
export const addUniversalComment = async (type, id, text) => {
  try {
    const { data } = await API.post(`/comments/${type}/${id}`, { text });
    return data;
  } catch (error) {
    throw error.response?.data || { message: "Failed to add comment" };
  }
};

/**
 * ❤️ LIKE COMMENT
 */
export const likeComment = async (commentId) => {
  try {
    const { data } = await API.post(`/comments/like/${commentId}`);
    return data;
  } catch (error) {
    throw error.response?.data || { message: "Failed to like comment" };
  }
};

/**
 * ❌ DELETE COMMENT
 */
export const deleteComment = async (commentId) => {
  try {
    const { data } = await API.delete(`/comments/${commentId}`);
    return data;
  } catch (error) {
    throw error.response?.data || { message: "Failed to delete comment" };
  }
};

/**
 * 🔖 SAVE POST
 */
export const savePost = async (id) => {
  try {
    const { data } = await API.post(`/posts/save/${id}`);
    return data;
  } catch (error) {
    throw error.response?.data || { message: "Failed to save post" };
  }
};

/**
 * 🔓 UNSAVE POST
 */
export const unsavePost = async (id) => {
  try {
    const { data } = await API.delete(`/posts/unsave/${id}`);
    return data;
  } catch (error) {
    throw error.response?.data || { message: "Failed to unsave post" };
  }
};