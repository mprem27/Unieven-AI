import express from "express";
import {
  searchUsers,
  searchPosts,
  searchEvents,
  searchAll,
} from "../controllers/searchController.js";

// Middlewares
import optionalAuth from "../middlewares/optionalAuth.js";
import asyncHandler from "../middlewares/asyncHandler.js";

const router = express.Router();

router.get(
  "/",
  optionalAuth,
  asyncHandler(searchAll)
);


router.get(
  "/users",
  optionalAuth,
  asyncHandler(searchUsers)
);


router.get(
  "/posts",
  optionalAuth,
  asyncHandler(searchPosts)
);


router.get(
  "/events",
  optionalAuth,
  asyncHandler(searchEvents)
);

export default router;