import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import api, { errMsg } from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useUI } from "../context/UIContext.jsx";
import { getSocket } from "../socket.js";
import { useTrip } from "./TripContext.js";
import { inr, fmtTime } from "../utils/format.js";
import { Skeleton } from "../components/Skeleton.jsx";

// The text arrives HTML-escaped from the server (&lt; etc). React shows strings literally, so decode first.
const decode = (s) => { const t = document.createElement("textarea"); t.innerHTML = s; return t.value; };

export default function Chat() {
  const { trip } = useTrip();
  const { user } = useAuth();
  const { toast } = useUI();
  const [messages, setMessages] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [text, setText] = useState("");
  const [typing, setTyping] = useState("");
  const log = useRef(null);
  const stick = useRef(true); // auto-scroll to newest unless the user scrolled up / loaded older
  const typingTimer = useRef(null);
  const lastTyping = useRef(0);

  useEffect(() => {
    api.get(`/trips/${trip._id}/messages`).then((r) => { setMessages(r.data.messages); setHasMore(r.data.hasMore); }).catch((e) => toast.error(errMsg(e)));
  }, [trip._id]); // eslint-disable-line

  useEffect(() => {
    let socket = null, timer = null;
    const onMessage = (m) => {
      if (String(m.trip) !== trip._id) return;
      setMessages((list) => (list && !list.some((x) => x._id === m._id) ? [...list, m] : list)); // de-duplicate
      setTyping("");
    };
    const onTyping = ({ tripId, name }) => {
      if (tripId !== trip._id) return;
      setTyping(`${name} is typing...`);
      clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => setTyping(""), 2500);
    };
    const attach = () => {
      socket = getSocket();
      if (!socket) return false;
      socket.on("message:new", onMessage);
      socket.on("typing", onTyping);
      return true;
    };
    if (!attach()) timer = setInterval(() => attach() && clearInterval(timer), 300);
    return () => { clearInterval(timer); socket?.off("message:new", onMessage); socket?.off("typing", onTyping); };
  }, [trip._id]);

  useLayoutEffect(() => {
    if (stick.current && log.current) log.current.scrollTop = log.current.scrollHeight;
  }, [messages]);

  async function loadEarlier() {
    const before = messages[0]._id;
    const r = await api.get(`/trips/${trip._id}/messages`, { params: { before } });
    stick.current = false;
    setMessages((list) => [...r.data.messages, ...list]);
    setHasMore(r.data.hasMore);
  }

  function onType(e) {
    setText(e.target.value);
    const now = Date.now();
    if (now - lastTyping.current > 1500) { lastTyping.current = now; getSocket()?.emit("typing", { tripId: trip._id }); }
  }

  function send(e) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    const socket = getSocket();
    if (!socket?.connected) return toast.error("Not connected to the chat. Check your internet and try again");
    stick.current = true;
    socket.emit("message:send", { tripId: trip._id, text: body }, (ack) => {
      if (!ack?.ok) toast.error(ack?.error || "Message not sent");
    });
    setText("");
  }

  return (
    <div className="card chat">
      <h2 className="mb">Trip chat</h2>
      <div className="chat-log" ref={log} aria-live="polite" aria-label="Messages"
           onScroll={(e) => { const el = e.target; stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60; }}>
        {!messages && <><Skeleton h={34} w="60%" /><Skeleton h={34} w="45%" style={{ marginTop: 10 }} /></>}
        {messages && hasMore && <div className="right" style={{ textAlign: "center" }}><button className="btn ghost sm" onClick={loadEarlier}>Load earlier messages</button></div>}
        {messages && messages.length === 0 && <div className="empty"><div className="emoji">💬</div><p>No messages yet. Say hello to your group!</p></div>}
        {messages?.map((m) => {
          const mine = m.sender === user.id;
          return (
            <div key={m._id} className={`msg ${mine ? "mine" : ""}`}>
              {!mine && <div className="who">{m.senderName}</div>}
              {m.expense?.title && (
                <div className="share-card">
                  🧾 <Link to={`/trips/${trip._id}/expenses?open=${m.expense.id}`} style={{ color: "inherit", fontWeight: 700 }}>{m.expense.title}</Link> · {inr(m.expense.amount)}
                </div>
              )}
              <div>{decode(m.text)}</div>
              <div className="time">{fmtTime(m.createdAt)}</div>
            </div>
          );
        })}
      </div>
      <div className="typing" aria-live="polite">{typing}</div>
      <form className="row gap" onSubmit={send}>
        <input type="text" value={text} onChange={onType} maxLength={1000} placeholder="Type a message" aria-label="Message" autoComplete="off" />
        <button className="btn" disabled={!text.trim()}>Send</button>
      </form>
    </div>
  );
}
