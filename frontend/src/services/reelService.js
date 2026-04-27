import API from "../api/axios";

// ============================================
// GET ALL REELS
// ============================================
export const getReels = async () => {
  try {
    const { data } = await API.get("/reels");
    return data;
  } catch (error) {
    throw (
      error.response?.data || {
        success: false,
        message: "Failed to fetch reels",
      }
    );
  }
};

// ============================================
// CREATE REEL
// ============================================
export const createReel = async (formData) => {
  try {
    const { data } = await API.post(
      "/reels/create",
      formData,
      {
        headers: {
          "Content-Type":
            "multipart/form-data",
        },
      }
    );

    return data;
  } catch (error) {
    throw (
      error.response?.data || {
        success: false,
        message:
          "Failed to create reel",
      }
    );
  }
};

// ============================================
// LIKE / UNLIKE REEL
// ============================================
export const likeReel = async (
  id
) => {
  try {
    const { data } =
      await API.post(
        `/reels/like/${id}`
      );

    return data;
  } catch (error) {
    throw (
      error.response?.data || {
        success: false,
        message:
          "Failed to like reel",
      }
    );
  }
};

// ============================================
// ADD COMMENT TO REEL
// ============================================
export const addCommentToReel =
  async (id, text) => {
    try {
      const { data } =
        await API.post(
          `/reels/comment/${id}`,
          { text }
        );

      return data;
    } catch (error) {
      throw (
        error.response?.data || {
          success: false,
          message:
            "Failed to comment",
        }
      );
    }
  };

// ============================================
// DELETE REEL COMMENT
// ============================================
export const deleteReelComment =
  async (commentId) => {
    try {
      const { data } =
        await API.delete(
          `/reels/comment/${commentId}`
        );

      return data;
    } catch (error) {
      throw (
        error.response?.data || {
          success: false,
          message:
            "Failed to delete comment",
        }
      );
    }
  };

// ============================================
// LIKE / UNLIKE REEL COMMENT
// ============================================
export const likeReelComment =
  async (commentId) => {
    try {
      const { data } =
        await API.post(
          `/reels/comment/like/${commentId}`
        );

      return data;
    } catch (error) {
      throw (
        error.response?.data || {
          success: false,
          message:
            "Failed to like comment",
        }
      );
    }
  };

// ============================================
// INCREMENT VIEW COUNT
// ============================================
export const viewReel = async (
  id
) => {
  try {
    const { data } =
      await API.post(
        `/reels/view/${id}`
      );

    return data;
  } catch (error) {
    throw (
      error.response?.data || {
        success: false,
        message:
          "Failed to update views",
      }
    );
  }
};

// ============================================
// DELETE REEL
// ============================================
export const deleteReel = async (
  id
) => {
  try {
    const { data } =
      await API.delete(
        `/reels/${id}`
      );

    return data;
  } catch (error) {
    throw (
      error.response?.data || {
        success: false,
        message:
          "Failed to delete reel",
      }
    );
  }
};

// ============================================
// SAVE REEL (OPTIONAL)
// ============================================
export const saveReel = async (
  id
) => {
  try {
    const { data } =
      await API.post(
        `/users/save-reel/${id}`
      );

    return data;
  } catch (error) {
    throw (
      error.response?.data || {
        success: false,
        message:
          "Failed to save reel",
      }
    );
  }
};

// ============================================
// UNSAVE REEL (OPTIONAL)
// ============================================
export const unsaveReel =
  async (id) => {
    try {
      const { data } =
        await API.post(
          `/users/unsave-reel/${id}`
        );

      return data;
    } catch (error) {
      throw (
        error.response?.data || {
          success: false,
          message:
            "Failed to unsave reel",
        }
      );
    }
  };