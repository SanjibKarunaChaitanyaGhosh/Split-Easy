import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import api from "../api.js";
import { getSocket } from "../socket.js";
import { timeAgo } from "../utils/format.js";

// top bar with the notification bell (live: a socket event refreshes it)
export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const box = useRef(null);

  const load = useCallback(() => {
    api.get("/notifications").then((r) => { setItems(r.data.notifications); setUnread(r.data.unread); }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!user) return;
    load();
    // the socket may connect a moment after login, so retry briefly
    let socket = getSocket();
    const timer = setInterval(() => { socket = getSocket(); if (socket) { socket.on("notification", load); clearInterval(timer); } }, 300);
    const poll = setInterval(load, 60000); // safety net
    return () => { clearInterval(timer); clearInterval(poll); getSocket()?.off("notification", load); };
  }, [user, load]);

  useEffect(() => {
    const close = (e) => box.current && !box.current.contains(e.target) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  async function openItem(n) {
    setOpen(false);
    if (!n.read) { await api.patch(`/notifications/${n._id}/read`).catch(() => {}); load(); }
    if (n.link) navigate(n.link);
  }

  async function readAll() {
    await api.post("/notifications/read-all");
    load();
  }

  return (
    <header className="nav">
      <div className="nav-inner">
        <Link to={user ? "/dashboard" : "/"} className="brand">💸 SplitEasy</Link>
        {user ? (
          <>
            <div className="bell" ref={box}>
              <button className="icon-btn" aria-label={`Notifications, ${unread} unread`} onClick={() => setOpen((o) => !o)}>🔔</button>
              {unread > 0 && <span className="count">{unread}</span>}
              {open && (
                <div className="dropdown">
                  <div className="row between" style={{ padding: "10px 14px", borderBottom: "1px solid var(--line)" }}>
                    <strong>Notifications</strong>
                    {unread > 0 && <button className="link-btn small" onClick={readAll}>Mark all read</button>}
                  </div>
                  {items.length === 0 && <div className="empty small">Nothing yet</div>}
                  {items.map((n) => (
                    <div key={n._id} className={`item ${n.read ? "" : "unread"}`} onClick={() => openItem(n)}>
                      <div>{n.message}</div>
                      <div className="muted small">{timeAgo(n.createdAt)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <span className="muted small nav-user">{user.name}</span>
            <button className="btn ghost sm" onClick={() => { logout(); navigate("/"); }}>Log out</button>
          </>
        ) : (
          <>
            <Link to="/login" className="btn ghost sm">Log in</Link>
            <Link to="/register" className="btn sm">Sign up</Link>
          </>
        )}
      </div>
    </header>
  );
}
