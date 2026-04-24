import API from "../api/axios";

/**
 * 👤 GET PROFILE
 */
export const getProfile = async (username) => {
  try {
    const { data } = await API.get(`/users/profile/${username}`);
    return data;
  } catch (error) {
    throw error.response?.data || { message: "Failed to fetch profile" };
  }
};

/**
 * 📸 GET USER POSTS
 */
export const getUserPosts = async (userId) => {
  try {
    const { data } = await API.get(`/users/posts/${userId}`);
    return data;
  } catch (error) {
    console.log("getUserPosts error:", error);
    return { posts: [] };
  }
};

/**
 * ✏️ UPDATE PROFILE (🔥 FIXED)
 */
export const updateProfile = async (formData) => {
  try {
    const { data } = await API.put("/users/update", formData);
    // ❌ removed headers

    return data;
  } catch (error) {
    console.error("Update Profile Error:", error);
    throw error.response?.data || { message: "Failed to update profile" };
  }
};

/**
 * 🔥 SUGGESTED USERS
 */
export const getSuggestedUsers = async () => {
  try {
    const { data } = await API.get("/users/suggested");
    return data;
  } catch (error) {
    console.log("getSuggestedUsers error:", error);
    return { users: [] };
  }
};

/**
 * 🔥 FOLLOW USER
 */
export const followUser = async (userId) => {
  try {
    const { data } = await API.post(`/follow/${userId}`);
    return data;
  } catch (error) {
    console.log("followUser error:", error);
    throw error.response?.data || { message: "Follow failed" };
  }
};

/**
 * 🔥 UNFOLLOW USER
 */
export const unfollowUser = async (userId) => {
  try {
    const { data } = await API.post(`/follow/unfollow/${userId}`);
    return data;
  } catch (error) {
    console.log("unfollowUser error:", error);
    throw error.response?.data || { message: "Unfollow failed" };
  }
};