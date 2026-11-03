import { io } from "socket.io-client";
import { API_ORIGIN } from "./api.js";

// one shared socket for the whole app, authenticated with the same JWT as the REST API
let socket = null;

export function connectSocket() {
  if (socket) return socket;
  socket = io(API_ORIGIN || undefined, {
    // a function, so a reconnect always uses the latest token
    auth: (cb) => cb({ token: localStorage.getItem("token") }),
  });
  return socket;
}

export const getSocket = () => socket;

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
