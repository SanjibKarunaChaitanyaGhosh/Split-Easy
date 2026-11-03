import { useCallback, useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate, useParams } from "react-router-dom";
import api, { errMsg } from "../api.js";
import { getSocket } from "../socket.js";
import { TripContext } from "./TripContext.js";
import { useAuth } from "../context/AuthContext.jsx";
import { SkeletonList } from "../components/Skeleton.jsx";

export default function TripLayout() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [trip, setTrip] = useState(null);
  const [summary, setSummary] = useState(null);
  const [includePending, setIncludePending] = useState(false);
  const [unread, setUnread] = useState(0);
  const [error, setError] = useState("");

  const onChat = location.pathname.endsWith("/chat");
  const onChatRef = useRef(onChat);
  onChatRef.current = onChat; // always the latest value inside the socket handler

  const loadTrip = useCallback(
    () => api.get(`/trips/${id}`).then((r) => setTrip(r.data.trip)),
    [id]
  );
  const loadSummary = useCallback(
    () => api.get(`/trips/${id}/summary`, { params: { includePending } }).then((r) => setSummary(r.data.summary)),
    [id, includePending]
  );
  // reload both after something changed
  const refresh = useCallback(() => Promise.all([loadTrip(), loadSummary()]).catch(() => {}), [loadTrip, loadSummary]);

  useEffect(() => {
    setTrip(null);
    setSummary(null);
    setError("");
    loadTrip().catch((e) => setError(errMsg(e, "Could not open this trip")));
  }, [id, loadTrip]);

  useEffect(() => { loadSummary().catch(() => {}); }, [loadSummary]);

  // other people can join, confirm or pay while I'm on another tab, so reload when I switch tabs
  const firstNav = useRef(true);
  useEffect(() => {
    if (firstNav.current) { firstNav.current = false; return; }
    refresh();
  }, [location.pathname]); // eslint-disable-line

  // chat: join this trip's room and count unread messages while I'm on another tab
  useEffect(() => {
    api.get(`/trips/${id}/messages/unread`).then((r) => setUnread(r.data.unread)).catch(() => {});
    let socket = null;
    const handler = (m) => {
      if (String(m.trip) === id && m.sender !== user.id && !onChatRef.current) setUnread((n) => n + 1);
    };
    const attach = () => {
      socket = getSocket();
      if (!socket) return false;
      const join = () => socket.emit("trip:join", id);
      join();
      socket.on("connect", join); // re-join after a reconnect
      socket.on("message:new", handler);
      return true;
    };
    let timer = null;
    if (!attach()) timer = setInterval(() => attach() && clearInterval(timer), 300);
    return () => {
      clearInterval(timer);
      if (socket) { socket.emit("trip:leave", id); socket.off("message:new", handler); }
    };
  }, [id]); // eslint-disable-line

  // opening the chat clears the badge
  useEffect(() => {
    if (onChat) { setUnread(0); api.post(`/trips/${id}/messages/read`).catch(() => {}); }
  }, [onChat, id]);

  if (error) {
    return (
      <div className="container">
        <div className="alert error" role="alert">{error}</div>
        <button className="btn ghost" onClick={() => navigate("/dashboard")}>← Back to my trips</button>
      </div>
    );
  }
  if (!trip) return <div className="container"><SkeletonList n={3} /></div>;

  const value = {
    trip, summary, refresh, loadTrip, loadSummary, includePending, setIncludePending, unread, setUnread,
    isAdmin: trip.me.role === "admin", myId: String(trip.me.participantId), locked: trip.locked,
    nameOf: (pid) => trip.participants.find((p) => String(p._id) === String(pid))?.name || "(removed)",
  };

  const link = (to, label, end, badge) => (
    <NavLink to={to} end={end} className={({ isActive }) => (isActive ? "active" : "")}>
      <span>{label}</span>
      {badge > 0 && <span className="dot-count">{badge}</span>}
    </NavLink>
  );

  return (
    <TripContext.Provider value={value}>
      <div className="container">
        <div className="row gap mb" style={{ alignItems: "flex-start" }}>
          <span style={{ fontSize: "2.2rem" }}>{trip.emoji}</span>
          <div className="grow">
            <h1>{trip.name} {trip.locked && <span className="badge grey">🔒 Locked</span>}</h1>
            <p className="muted small" style={{ margin: 0 }}>
              {trip.destination || "No destination"} · 👥 {trip.participants.length}
            </p>
          </div>
        </div>
        <div className="trip-shell">
          <nav className="sidebar" aria-label="Trip sections">
            {link(`/trips/${id}`, "📊 Overview", true, summary?.pendingForMe)}
            {link(`/trips/${id}/expenses`, "🧾 Expenses")}
            {link(`/trips/${id}/people`, "👥 People & invites")}
            {link(`/trips/${id}/chat`, "💬 Chat", false, unread)}
            {link(`/trips/${id}/requests`, "✏️ Edit requests")}
            {link(`/trips/${id}/activity`, "🕒 Activity log")}
            {link(`/trips/${id}/settle`, "🤝 Settle up")}
          </nav>
          <main><Outlet /></main>
        </div>
      </div>
    </TripContext.Provider>
  );
}
