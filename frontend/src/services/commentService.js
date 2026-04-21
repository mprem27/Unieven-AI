import API from "../api/axios";

const BASE = {
  post: "/posts",
  reel: "/reels",
  story: "/stories",
};

// GET comments (optional if you embed in item fetch)
export const getComments = async (type, id) => {
  const { data } = await API.get(`${BASE[type]}/${id}`);
  return data;
};

// ADD
export const addComment = async (type, id, text) => {
  const { data } = await API.post(`${BASE[type]}/comment/${id}`, { text });
  return data; // should return updated item or comments
};

// LIKE
export const likeComment = async (type, commentId) => {
  const { data } = await API.post(
    `${BASE[type]}/comment/like/${commentId}`
  );
  return data; // { likes: [...] }
};