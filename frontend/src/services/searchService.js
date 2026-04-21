import API from "../api/axios";

/**
 * 🔍 GLOBAL SEARCH (users + posts + events)
 */
export const searchAll = async (query) => {
  try {
    const q = query?.trim();

    // ✅ prevent empty API call
    if (!q) {
      return {
        users: [],
        posts: [],
        events: [],
      };
    }

    const { data } = await API.get(`/search?query=${encodeURIComponent(q)}`);

    return {
      users: data?.users || [],
      posts: data?.posts || [],
      events: data?.events || [],
    };

  } catch (error) {
    console.log("searchAll error:", error);
    return { users: [], posts: [], events: [] }; // ✅ safe fallback
  }
};


/**
 * 👤 SEARCH USERS ONLY
 */
export const searchUsers = async (query, page = 1) => {
  try {
    const q = query?.trim();
    if (!q) return { users: [] };

    const { data } = await API.get(
      `/search/users?query=${encodeURIComponent(q)}&page=${page}`
    );

    return {
      users: data?.users || [],
    };

  } catch (error) {
    console.log("searchUsers error:", error);
    return { users: [] };
  }
};


/**
 * 📸 SEARCH POSTS
 */
export const searchPosts = async (query, page = 1) => {
  try {
    const q = query?.trim();
    if (!q) return { posts: [] };

    const { data } = await API.get(
      `/search/posts?query=${encodeURIComponent(q)}&page=${page}`
    );

    return {
      posts: data?.posts || [],
    };

  } catch (error) {
    console.log("searchPosts error:", error);
    return { posts: [] };
  }
};


/**
 * 🎉 SEARCH EVENTS
 */
export const searchEvents = async (query, page = 1) => {
  try {
    const q = query?.trim();
    if (!q) return { events: [] };

    const { data } = await API.get(
      `/search/events?query=${encodeURIComponent(q)}&page=${page}`
    );

    return {
      events: data?.events || [],
    };

  } catch (error) {
    console.log("searchEvents error:", error);
    return { events: [] };
  }
};