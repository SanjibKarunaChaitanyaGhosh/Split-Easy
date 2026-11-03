import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function Landing() {
  const { user } = useAuth();
  if (user) return <Navigate to="/dashboard" replace />;
  return (
    <div className="container">
      <section className="hero">
        <h1>Split trip expenses with friends, <span style={{ color: "var(--accent)" }}>without the arguments</span></h1>
        <p>Everyone adds what they spent and tags who shared it. The others confirm, so nothing is silently wrong. SplitEasy then shows who owes whom, and gives you a PDF bill to send around.</p>
        <div className="row gap wrap" style={{ justifyContent: "center" }}>
          <Link to="/register" className="btn">Create a free account</Link>
          <Link to="/login" className="btn ghost">I already have an account</Link>
        </div>
      </section>
      <section className="features">
        <div className="card feature"><div className="emoji">🧾</div><h3>Tag &amp; confirm</h3><p className="muted">Tag the people who share an expense. They confirm or dispute it, and only confirmed expenses count.</p></div>
        <div className="card feature"><div className="emoji">💬</div><h3>Group chat</h3><p className="muted">Every trip has a live chat. Share an expense in the chat with one tap.</p></div>
        <div className="card feature"><div className="emoji">🤝</div><h3>Fewest payments</h3><p className="muted">See the smallest number of payments that settles everybody, and mark them paid.</p></div>
        <div className="card feature"><div className="emoji">📄</div><h3>PDF bill</h3><p className="muted">Download a clean bill for friends who are not on the app.</p></div>
      </section>
    </div>
  );
}
