import API from "../api/axios";

const BASE = {
  post: "/posts",
  reel: "/reels",
  story: "/stories",
};

//////////////////////////////////////////////////////
// VALIDATE TYPE
//////////////////////////////////////////////////////
const getBaseRoute = (type) => {
  const route = BASE[type];

  if (!route) {
    throw new Error(`Invalid comment type: ${type}`);
  }

  return route;
};

//////////////////////////////////////////////////////
// GET COMMENTS
//////////////////////////////////////////////////////
export const getComments = async (type, id) => {
  try {
    const route = getBaseRoute(type);

    const { data } = await API.get(`${route}/${id}`);

    return data;
  } catch (error) {
    console.error("Get comments error:", error);

    throw (
      error.response?.data || {
        success: false,
        message: "Failed to fetch comments",
      }
    );
  }
};

//////////////////////////////////////////////////////
// ADD COMMENT
//////////////////////////////////////////////////////
export const addComment = async (type, id, text) => {
  try {
    const route = getBaseRoute(type);

    const { data } = await API.post(
      `${route}/comment/${id}`,
      {
        text: text.trim(),
      }
    );

    return data;
  } catch (error) {
    console.error("Add comment error:", error);

    throw (
      error.response?.data || {
        success: false,
        message: "Failed to add comment",
      }
    );
  }
};

//////////////////////////////////////////////////////
// LIKE COMMENT
//////////////////////////////////////////////////////
export const likeComment = async (type, commentId) => {
  try {
    const route = getBaseRoute(type);

    const { data } = await API.post(
      `${route}/comment/like/${commentId}`
    );

    return data;
  } catch (error) {
    console.error("Like comment error:", error);

    throw (
      error.response?.data || {
        success: false,
        message: "Failed to like comment",
      }
    );
  }
};

//////////////////////////////////////////////////////
// DELETE COMMENT
//////////////////////////////////////////////////////
export const deleteComment = async (type, commentId) => {
  try {
    const route = getBaseRoute(type);

    const { data } = await API.delete(
      `${route}/comment/${commentId}`
    );

    return data;
  } catch (error) {
    console.error("Delete comment error:", error);

    throw (
      error.response?.data || {
        success: false,
        message: "Failed to delete comment",
      }
    );
  }
};