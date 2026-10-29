import userModel from "../models/User.js";
import postModel from "../models/Post.js";
import reelModel from "../models/Reel.js";
import followModel from "../models/Follow.js";
import cloudinary from "../configs/cloudinary.js";

// =====================================================
//  GET USER PROFILE
// =====================================================
export const getUserProfile =
  async (req, res) => {
    try {
      const { username } =
        req.params;

      const user =
        await userModel
          .findOne({
            username:
              username.toLowerCase(),
          })
          .select(
            "-password -resetOTP -otpExpires"
          );

      if (!user) {
        return res
          .status(404)
          .json({
            success: false,
            message:
              "User not found",
          });
      }

      let isFollowing =
        false;
      let isRequested =
        false;

      if (req.user?.id) {
        const followRelation =
          await followModel.findOne(
            {
              from:
                req.user.id,
              to: user._id,
            }
          );

        if (
          followRelation?.status ===
          "accepted"
        ) {
          isFollowing =
            true;
        } else if (
          followRelation?.status ===
          "requested"
        ) {
          isRequested =
            true;
        }
      }

      return res.json({
        success: true,
        user: {
          ...user._doc,
          isFollowing,
          isRequested,
        },
      });
    } catch (error) {
      console.error(
        "GET PROFILE ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,
          message:
            error.message,
        });
    }
  };

// =====================================================
//  UPDATE USER PROFILE
// =====================================================
export const updateUserProfile =
  async (req, res) => {
    try {
      const {
        name,
        bio,
        gender,
        username,
        isPrivate,
      } = req.body;

      const imageFile =
        req.file;

      const user =
        await userModel.findById(
          req.user.id
        );

      if (!user) {
        return res
          .status(404)
          .json({
            success: false,
            message:
              "User not found",
          });
      }

      if (
        username &&
        username.toLowerCase() !==
          user.username
      ) {
        const exists =
          await userModel.findOne(
            {
              username:
                username.toLowerCase(),
              _id: {
                $ne:
                  user._id,
              },
            }
          );

        if (exists) {
          return res
            .status(400)
            .json({
              success: false,
              message:
                "Username already taken",
            });
        }

        user.username =
          username.toLowerCase();
      }

      if (name)
        user.name = name;

      if (
        bio !==
        undefined
      )
        user.bio = bio;

      if (gender)
        user.gender =
          gender;

      if (
        isPrivate !==
        undefined
      ) {
        user.isPrivate =
          isPrivate ===
            true ||
          isPrivate ===
            "true";
      }

      if (
        imageFile &&
        imageFile.path
      ) {
        try {
          const fixedPath =
            imageFile.path.replace(
              /\\/g,
              "/"
            );

          const uploadRes =
            await cloudinary.uploader.upload(
              fixedPath
            );

          user.image =
            uploadRes.secure_url;
        } catch (err) {
          console.error(
            "Cloudinary Error:",
            err
          );

          return res
            .status(500)
            .json({
              success: false,
              message:
                "Image upload failed",
            });
        }
      }

      await user.save();

      return res.json({
        success: true,
        message:
          "Profile updated",
        user,
      });
    } catch (error) {
      console.error(
        "UPDATE ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,
          message:
            error.message,
        });
    }
  };

// =====================================================
//  GET USER PROFILE CONTENT
//  POSTS + REELS + EVENTS
// =====================================================
export const getUserPosts =
  async (req, res) => {
    try {
      const { userId } =
        req.params;

      const posts =
        await postModel
          .find({
            user: userId,
          })
          .sort({
            createdAt: -1,
          })
          .populate(
            "user",
            "username name image role"
          );

      const reels =
        await reelModel
          .find({
            user: userId,
          })
          .sort({
            createdAt: -1,
          })
          .populate(
            "user",
            "username name image role"
          );

      return res.json({
        success: true,
        posts,
        reels,
      });
    } catch (error) {
      console.error(
        "GET USER CONTENT ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,
          message:
            error.message,
          posts: [],
          reels: [],
        });
    }
  };

// =====================================================
//  GET SAVED POSTS + SAVED REELS
// =====================================================
export const getSavedPosts =
  async (req, res) => {
    try {
      const user =
        await userModel
          .findById(
            req.user.id
          )
          .populate({
            path: "savedPosts",
            populate: {
              path: "user",
              select:
                "username name image role",
            },
          })
          .populate({
            path: "savedReels",
            populate: {
              path: "user",
              select:
                "username name image role",
            },
          });

      if (!user) {
        return res
          .status(404)
          .json({
            success: false,
            message:
              "User not found",
          });
      }

      return res.json({
        success: true,
        savedPosts:
          user.savedPosts ||
          [],
        savedReels:
          user.savedReels ||
          [],
      });
    } catch (error) {
      return res
        .status(500)
        .json({
          success: false,
          message:
            error.message,
        });
    }
  };

// =====================================================
//  SEARCH USERS
// =====================================================
export const searchUsers =
  async (req, res) => {
    try {
      const { query } =
        req.query;

      if (
        !query ||
        query.trim() ===
          ""
      ) {
        return res.json({
          success: true,
          users: [],
        });
      }

      const users =
        await userModel
          .find({
            $or: [
              {
                username:
                  {
                    $regex:
                      query,
                    $options:
                      "i",
                  },
              },
              {
                name: {
                  $regex:
                    query,
                  $options:
                    "i",
                },
              },
            ],
          })
          .select(
            "username name image role"
          )
          .limit(10);

      return res.json({
        success: true,
        users,
      });
    } catch (error) {
      return res
        .status(500)
        .json({
          success: false,
          message:
            error.message,
        });
    }
  };

// =====================================================
//  CHECK USERNAME
// =====================================================
export const checkUsernameAvailability =
  async (
    req,
    res
  ) => {
    try {
      const {
        username,
      } = req.query;

      if (
        !username ||
        username.trim()
          .length < 3
      ) {
        return res.json({
          success: true,
          available:
            false,
        });
      }

      const existingUser =
        await userModel.findOne(
          {
            username:
              username.toLowerCase(),
          }
        );

      return res.json({
        success: true,
        available:
          !existingUser,
      });
    } catch (error) {
      return res
        .status(500)
        .json({
          success: false,
          message:
            error.message,
        });
    }
  };

// =====================================================
//  SUGGEST USERS
// =====================================================
export const getSuggestedUsers =
  async (req, res) => {
    try {
      const currentUserId =
        req.user.id;

      const users =
        await userModel
          .find({
            _id: {
              $ne:
                currentUserId,
            },
          })
          .select(
            "username name image role"
          )
          .limit(10)
          .sort({
            createdAt: -1,
          });

      return res.json({
        success: true,
        users,
      });
    } catch (error) {
      return res
        .status(500)
        .json({
          success: false,
          message:
            error.message,
        });
    }
  };