import axios from "axios";

const AUTH_API = axios.create({
  baseURL:
    import.meta.env.VITE_API_URL ||
    "http://localhost:4000/api",
});
export default AUTH_API;