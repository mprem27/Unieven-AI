export const usersData = [
  {
    id: 1,
    name: "Prem",
    image: "https://i.pravatar.cc/150?img=1",
    hasStory: true,
    isFollowed: true,
    role: "student",
    createdAt: new Date().toISOString(), // 🔥 fresh story
  },
  {
    id: 2,
    name: "Rahul",
    image: "https://i.pravatar.cc/150?img=2",
    hasStory: true,
    isFollowed: true,
    role: "student",
    createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(), // 5 hrs ago
  },
  {
    id: 3,
    name: "Admin",
    image: "https://i.pravatar.cc/150?img=3",
    hasStory: true,
    isFollowed: false,
    role: "admin",
    createdAt: new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 4,
    name: "Faculty",
    image: "https://i.pravatar.cc/150?img=4",
    hasStory: false,
    isFollowed: false,
    role: "faculty",
    createdAt: new Date().toISOString(),
  },
  {
    id: 5,
    name: "Friend",
    image: "https://i.pravatar.cc/150?img=5",
    hasStory: true,
    isFollowed: true,
    role: "student",
    createdAt: new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString(), // still valid
  },
  {
    id: 6,
    name: "Old Story",
    image: "https://i.pravatar.cc/150?img=6",
    hasStory: true,
    isFollowed: true,
    role: "student",
    createdAt: new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString(), // ❌ expired
  },
];