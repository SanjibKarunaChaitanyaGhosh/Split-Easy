import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// In development the React app (port 5173) forwards /api, /uploads and the socket.io
// connection to the Express server, so no CORS setup is needed.
// The backend address comes from client/.env  ->  VITE_PROXY_TARGET=http://localhost:8000
// (loadEnv is needed because vite.config.js does not see .env files by itself).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const target = (env.VITE_PROXY_TARGET || "http://localhost:4000").replace(/\/$/, "");
  const proxy = {
    "/api": { target, changeOrigin: true },
    "/uploads": { target, changeOrigin: true },
    "/socket.io": { target, changeOrigin: true, ws: true },
  };
  return {
    plugins: [react()],
    server: { port: 5173, proxy },
    preview: { port: 4173, proxy },
  };
});
