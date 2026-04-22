import userModel from "../models/User.js";
import postModel from "../models/Post.js";
import eventModel from "../models/Event.js";


const cleanQuery = (q) => q?.trim();

// --- 1. SEARCH USERS ---
export const searchUsers = async (req, res) => {
  try {
    const query = cleanQuery(req.query.query);
    const page = Number(req.query.page) || 1;
    const limit = 10;

    if (!query) {
      return res.json({ success: true, users: [] });
    }

    const users = await userModel
      .find({
        $or: [
          { username: { $regex: query, $options: "i" } },
          { name: { $regex: query, $options: "i" } },
        ],
      })
      .select("username name image role followers")
      .sort({ followers: -1 }) 
      .skip((page - 1) * limit)
      .limit(limit);

    res.json({ success: true, users });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};



// --- 2. SEARCH POSTS ---
export const searchPosts = async (req, res) => {
  try {
    const query = cleanQuery(req.query.query);
    const page = Number(req.query.page) || 1;
    const limit = 12;

    if (!query) {
      return res.json({ success: true, posts: [] });
    }

    // 🔥 support hashtags (#event)
    const hashtag = query.startsWith("#")
      ? query.slice(1)
      : query;

    const posts = await postModel
      .find({
        caption: { $regex: hashtag, $options: "i" },
      })
      .populate("user", "username image")
      .sort({ createdAt: -1 }) 
      .skip((page - 1) * limit)
      .limit(limit);

    res.json({ success: true, posts });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};



// --- 3. SEARCH EVENTS ---
export const searchEvents = async (req, res) => {
  try {
    const query = cleanQuery(req.query.query);
    const page = Number(req.query.page) || 1;
    const limit = 10;

    if (!query) {
      return res.json({ success: true, events: [] });
    }

    const events = await eventModel
      .find({
        $or: [
          { title: { $regex: query, $options: "i" } },
          { location: { $regex: query, $options: "i" } },
          { category: { $regex: query, $options: "i" } },
        ],
      })
      .populate("createdBy", "name role")
      .sort({ date: 1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.json({ success: true, events });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// --- 4. 🔥 GLOBAL SEARCH (NEW) ---
export const searchAll = async (req, res) => {
  try {
    const query = cleanQuery(req.query.query);

    if (!query) {
      return res.json({
        success: true,
        users: [],
        posts: [],
        events: [],
      });
    }

    const hashtag = query.startsWith("#")
      ? query.slice(1)
      : query;

    const [users, posts, events] = await Promise.all([

      userModel
        .find({
          $or: [
            { username: { $regex: query, $options: "i" } },
            { name: { $regex: query, $options: "i" } },
          ],
        })
        .select("username name image role")
        .limit(5),

      postModel
        .find({
          caption: { $regex: hashtag, $options: "i" },
        })
        .populate("user", "username image role")
        .sort({ createdAt: -1 })
        .limit(20),

      eventModel
        .find({
          $or: [
            { title: { $regex: query, $options: "i" } },
            { location: { $regex: query, $options: "i" } },
          ],
        })
        .sort({ date: 1 })
        .limit(10),
    ]);

    res.json({
      success: true,
      users,
      posts,
      events,
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};