import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api, { errMsg } from "../api.js";
import { useUI } from "../context/UIContext.jsx";
import Modal from "../components/Modal.jsx";
import { SkeletonCards } from "../components/Skeleton.jsx";
import { fmtDate } from "../utils/format.js";

const EMOJIS = ["✈️", "🏖️", "🏔️", "🚗", "🏕️", "🍕", "🎉", "🏠"];
const empty = { name: "", destination: "", startDate: "", endDate: "", description: "", emoji: "✈️" };

export default function Dashboard() {
  const { toast } = useUI();
  const navigate = useNavigate();
  const [trips, setTrips] = useState(null);
  const [invites, setInvites] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => {
    api.get("/trips").then((r) => setTrips(r.data.trips)).catch((e) => toast.error(errMsg(e)));
    api.get("/invitations/mine").then((r) => setInvites(r.data.invitations)).catch(() => {});
  };
  useEffect(load, []); // eslint-disable-line

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function create(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const body = { ...form };
      if (!body.startDate) delete body.startDate;
      if (!body.endDate) delete body.endDate;
      const r = await api.post("/trips", body);
      toast("Trip created");
      navigate(`/trips/${r.data.trip._id}`);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  async function accept(inv) {
    try {
      const r = await api.post(`/invitations/${inv.id}/accept`);
      toast(`You joined ${inv.tripName}`);
      navigate(`/trips/${r.data.tripId}`);
    } catch (err) {
      toast.error(errMsg(err));
    }
  }

  return (
    <div className="container">
      <div className="row between wrap gap mb">
        <div>
          <h1>My trips</h1>
          <p className="muted">Create a trip, add your friends and start splitting.</p>
        </div>
        <button className="btn" onClick={() => { setForm(empty); setError(""); setOpen(true); }}>+ Create trip</button>
      </div>

      {invites.map((inv) => (
        <div className="alert info row between wrap gap" key={inv.id} role="status">
          <span>🎉 <strong>You've been invited to {inv.emoji} {inv.tripName}</strong>{inv.invitedByName ? ` by ${inv.invitedByName}` : ""}</span>
          <button className="btn sm" onClick={() => accept(inv)}>Accept invitation</button>
        </div>
      ))}

      {!trips && <SkeletonCards n={3} />}
      {trips && trips.length === 0 && (
        <div className="card empty">
          <div className="emoji">🧳</div>
          <h3>No trips yet</h3>
          <p>Create your first trip, then invite friends with a link or an email.</p>
          <button className="btn" onClick={() => setOpen(true)}>Create a trip</button>
        </div>
      )}
      <div className="grid3">
        {trips?.map((t) => (
          <Link key={t._id} to={`/trips/${t._id}`} className="card" style={{ textDecoration: "none", color: "inherit" }}>
            <div className="row between">
              <span style={{ fontSize: "2rem" }}>{t.emoji}</span>
              <span>
                {t.locked && <span className="badge grey">🔒 Locked</span>}{" "}
                <span className={`badge ${t.role === "admin" ? "accent" : "grey"}`}>{t.role === "admin" ? "Admin" : "Member"}</span>
              </span>
            </div>
            <h3 style={{ marginTop: 8 }}>{t.name}</h3>
            <p className="muted small" style={{ margin: 0 }}>
              {t.destination || "No destination"}{t.startDate ? ` · ${fmtDate(t.startDate)}` : ""}
            </p>
            <p className="muted small" style={{ margin: "6px 0 0" }}>👥 {t.memberCount} {t.memberCount === 1 ? "person" : "people"}</p>
          </Link>
        ))}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Create a trip">
        {error && <div className="alert error" role="alert">{error}</div>}
        <form onSubmit={create}>
          <div className="field">
            <label htmlFor="tname">Trip name</label>
            <input id="tname" type="text" required minLength={2} maxLength={80} value={form.name} onChange={set("name")} placeholder="e.g. Goa Beach Trip" />
          </div>
          <div className="field">
            <label htmlFor="dest">Destination</label>
            <input id="dest" type="text" maxLength={100} value={form.destination} onChange={set("destination")} />
          </div>
          <div className="field-row">
            <div className="field"><label htmlFor="sd">Start date</label><input id="sd" type="date" value={form.startDate} onChange={set("startDate")} /></div>
            <div className="field"><label htmlFor="ed">End date</label><input id="ed" type="date" min={form.startDate} value={form.endDate} onChange={set("endDate")} /></div>
          </div>
          <div className="field">
            <label htmlFor="desc">Description (optional)</label>
            <textarea id="desc" maxLength={500} value={form.description} onChange={set("description")} />
          </div>
          <div className="field">
            <label>Cover emoji</label>
            <div className="chips">
              {EMOJIS.map((e) => (
                <button type="button" key={e} className={`chip ${form.emoji === e ? "on" : ""}`} aria-pressed={form.emoji === e} onClick={() => setForm({ ...form, emoji: e })}>{e}</button>
              ))}
            </div>
          </div>
          <button className="btn block" disabled={busy}>{busy ? "Creating..." : "Create trip"}</button>
        </form>
      </Modal>
    </div>
  );
}
