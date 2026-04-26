import API from "../api/axios";

// 👤 GET USER PROFILE (FIXED)
export const getProfile = async (username) => {
  try {
    if (!username) {
      throw { message: "Username is required" };
    }

    // 🔥 Decode + normalize
    const cleanUsername = decodeURIComponent(username)
      .toLowerCase()
      .trim();

    const { data } = await API.get(
      `/users/profile/${cleanUsername}`
    );

    return data;

  } catch (error) {
    console.error("getProfile error:", error?.response?.data || error);

    throw (
      error.response?.data || {
        success: false,
        message: "Failed to fetch profile",
      }
    );
  }
};


// GET USER POSTS
export const getUserPosts = async (userId) => {
  try {
    if (!userId) {
      return { success: true, posts: [] };
    }

    const { data } = await API.get(`/users/posts/${userId}`);

    return data;

  } catch (error) {
    console.error("getUserPosts error:", error?.response?.data || error);

    return {
      success: false,
      posts: [],
    };
  }
};

//  UPDATE PROFILE
export const updateProfile = async (formData) => {
  try {
    const { data } = await API.put(
      "/users/update",
      formData
    );

    return data;

  } catch (error) {
    console.error(
      "Update Profile Error:",
      error?.response?.data || error
    );

    throw (
      error.response?.data || {
        success: false,
        message: "Failed to update profile",
      }
    );
  }
};

// GET SUGGESTED USERS
export const getSuggestedUsers = async () => {
  try {
    const { data } = await API.get("/users/suggested");

    return data;

  } catch (error) {
    console.error(
      "getSuggestedUsers error:",
      error?.response?.data || error
    );

    return {
      success: false,
      users: [],
    };
  }
};

//  FOLLOW / CONNECT USER (SMART TOGGLE)
export const followUser = async (userId) => {
  try {
    if (!userId) {
      throw { message: "User ID required" };
    }

    const { data } = await API.post(`/follow/${userId}`);

    return data;

  } catch (error) {
    console.error(
      "followUser error:",
      error?.response?.data || error
    );

    throw (
      error.response?.data || {
        success: false,
        message: "Follow action failed",
      }
    );
  }
};

// UNFOLLOW USER
export const unfollowUser = async (userId) => {
  try {
    if (!userId) {
      throw { message: "User ID required" };
    }

    const { data } = await API.post(
      `/follow/unfollow/${userId}`
    );

    return data;

  } catch (error) {
    console.error(
      "unfollowUser error:",
      error?.response?.data || error
    );

    throw (
      error.response?.data || {
        success: false,
        message: "Unfollow failed",
      }
    );
  }
};

//  GET FOLLOWERS
export const getFollowers = async (userId) => {
  try {
    if (!userId) {
      return {
        success: true,
        followers: [],
      };
    }

    const { data } = await API.get(
      `/follow/followers/${userId}`
    );

    return data;

  } catch (error) {
    console.error(
      "getFollowers error:",
      error?.response?.data || error
    );

    return {
      success: false,
      followers: [],
    };
  }
};
//  GET FOLLOWING
export const getFollowing = async (userId) => {
  try {
    if (!userId) {
      return {
        success: true,
        following: [],
      };
    }

    const { data } = await API.get(
      `/follow/following/${userId}`
    );

    return data;

  } catch (error) {
    console.error(
      "getFollowing error:",
      error?.response?.data || error
    );

    return {
      success: false,
      following: [],
    };
  }
};