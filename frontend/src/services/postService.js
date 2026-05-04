import API from "../api/axios";

/**
 * 📰 GET FEED POSTS
 */
export const getFeed = async () => {
  try {
    const res = await API.get("/posts/feed");
    return res.data;
  } catch (error) {
    console.error("Get Feed Error:", error);
    throw error?.response?.data || { message: "Failed to fetch feed" };
  }
};

/**
 * 📰 FETCH FEED (Alias)
 */
export const fetchFeed = getFeed;

/**
 * 📄 GET SINGLE POST
 */
export const getPostById = async (id) => {
  try {
    const res = await API.get(`/posts/${id}`);
    return res.data;
  } catch (error) {
    console.error("Get Post Error:", error);
    throw error?.response?.data || { message: "Failed to fetch post" };
  }
};

/**
 * 📸 CREATE POST (IMPORTANT FIX)
 */
export const createPost = async (formData) => {
  try {
    const res = await API.post("/posts/create", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return res.data;
  } catch (error) {
    console.error("Create Post Error:", error);
    throw error?.response?.data || { message: "Failed to create post" };
  }
};

/**
 * ❌ DELETE POST
 */
export const deletePost = async (id) => {
  try {
    const res = await API.delete(`/posts/${id}`);
    return res.data;
  } catch (error) {
    console.error("Delete Post Error:", error);
    throw error?.response?.data || { message: "Failed to delete post" };
  }
};

/**
 * ❤️ LIKE / UNLIKE POST
 */
export const likePost = async (id) => {
  try {
    const res = await API.post(`/posts/like/${id}`);
    return res.data;
  } catch (error) {
    console.error("Like Post Error:", error);
    throw error?.response?.data || { message: "Failed to like post" };
  }
};

/**
 * 💬 ADD COMMENT (POST)
 */
export const addComment = async (id, text) => {
  try {
    const res = await API.post(`/posts/comment/${id}`, { text });
    return res.data;
  } catch (error) {
    console.error("Add Comment Error:", error);
    throw error?.response?.data || { message: "Failed to add comment" };
  }
};

/**
 * 🌍 UNIVERSAL COMMENT (FIXED 🔥)
 */
export const addUniversalComment = async (type, id, text) => {
  try {
    if (!type || !id || !text) {
      throw new Error("Missing required fields");
    }

    const res = await API.post(`/comments/${type}/${id}`, {
      text: text.trim(),
    });

    return res.data;
  } catch (error) {
    console.error("Universal Comment Error:", error);
    throw error?.response?.data || { message: "Failed to add comment" };
  }
};

/**
 * ❤️ LIKE COMMENT
 */
export const likeComment = async (commentId) => {
  try {
    const res = await API.post(`/comments/like/${commentId}`);
    return res.data;
  } catch (error) {
    console.error("Like Comment Error:", error);
    throw error?.response?.data || { message: "Failed to like comment" };
  }
};

/**
 * ❌ DELETE COMMENT
 */
export const deleteComment = async (commentId) => {
  try {
    const res = await API.delete(`/comments/${commentId}`);
    return res.data;
  } catch (error) {
    console.error("Delete Comment Error:", error);
    throw error?.response?.data || { message: "Failed to delete comment" };
  }
};

/**
 * 🔖 SAVE POST
 */
export const savePost = async (id) => {
  try {
    const res = await API.post(`/posts/save/${id}`);
    return res.data;
  } catch (error) {
    console.error("Save Post Error:", error);
    throw error?.response?.data || { message: "Failed to save post" };
  }
};

/**
 * 🔓 UNSAVE POST
 */
export const unsavePost = async (id) => {
  try {
    const res = await API.delete(`/posts/unsave/${id}`);
    return res.data;
  } catch (error) {
    console.error("Unsave Post Error:", error);
    throw error?.response?.data || { message: "Failed to unsave post" };
  }
};