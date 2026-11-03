import { createContext, useContext, useEffect, useState } from "react";
import api from "../api.js";
import { connectSocket, disconnectSocket } from "../socket.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(localStorage.getItem("token")));

  // on page load: is the saved token still valid?
  useEffect(() => {
    if (!localStorage.getItem("token")) return;
    api
      .get("/auth/me")
      .then((res) => setUser(res.data.user))
      .catch(() => localStorage.removeItem("token"))
      .finally(() => setLoading(false));
  }, []);

  // open the live connection while logged in
  useEffect(() => {
    if (user) connectSocket();
    else disconnectSocket();
  }, [user]);

  function save(data) {
    localStorage.setItem("token", data.token);
    setUser(data.user);
  }

  async function login(email, password) {
    save((await api.post("/auth/login", { email, password })).data);
  }

  async function register(name, email, password) {
    save((await api.post("/auth/register", { name, email, password })).data);
  }

  function logout() {
    localStorage.removeItem("token");
    setUser(null);
  }

  return <AuthContext.Provider value={{ user, loading, login, register, logout }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
