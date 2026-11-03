import axios from "axios";

const base = import.meta.env.VITE_API_URL || "/api";
const api = axios.create({ baseURL: base });

// where uploaded bill photos and the socket live (same site in dev, API host when VITE_API_URL is set)
export const API_ORIGIN = /^https?:/.test(base) ? new URL(base).origin : "";
export const fileUrl = (p) => (p ? API_ORIGIN + p : "");

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// an expired / invalid token -> back to the login page (but not for the login form itself)
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const url = err.config?.url || "";
    const isAuthForm = url.includes("/auth/login") || url.includes("/auth/register");
    if (err.response?.status === 401 && !isAuthForm) {
      localStorage.removeItem("token");
      if (!window.location.pathname.startsWith("/login")) {
        window.location.href = "/login?expired=1";
      }
    }
    return Promise.reject(err);
  }
);

// turns any failed request into a readable message
export function errMsg(err, fallback = "Something went wrong") {
  if (!err.response) return "Cannot reach the server. Is the backend running?";
  return err.response.data?.error || fallback;
}

export default api;
