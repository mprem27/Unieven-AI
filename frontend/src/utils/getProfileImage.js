const DEFAULT_PROFILE =
  "https://cdn-icons-png.flaticon.com/512/149/149071.png";

export const getProfileImage = (user) => {
  const url =
    user?.image && user.image !== ""
      ? user.image
      : DEFAULT_PROFILE;

  // 🔥 FIX: force refresh when image updates
  return `${url}?t=${user?.updatedAt || Date.now()}`;
};