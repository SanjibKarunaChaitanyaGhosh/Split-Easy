import { useState } from "react";
import { Link } from "react-router-dom";
import api, { errMsg } from "../api.js";
import { useUI } from "../context/UIContext.jsx";
import { useTrip } from "./TripContext.js";
import Modal from "../components/Modal.jsx";
import { SkeletonCards } from "../components/Skeleton.jsx";
import { inr, fmtDate, toInputDate } from "../utils/format.js";

export default function Overview() {
  const { trip, summary, includePending, setIncludePending, isAdmin, refresh, locked } = useTrip();
  const { toast } = useUI();
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState({});
  const [busy, setBusy] = useState(false);

  async function downloadPdf() {
    try {
      const r = await api.get(`/trips/${trip._id}/pdf`, { params: { includePending }, responseType: "blob" });
      const url = URL.createObjectURL(r.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${trip.name.replace(/[^a-z0-9]+/gi, "_")}_bill.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error("Could not create the PDF");
    }
  }

  function openEdit() {
    setForm({
      name: trip.name, destination: trip.destination || "", description: trip.description || "", emoji: trip.emoji,
      startDate: toInputDate(trip.startDate), endDate: toInputDate(trip.endDate),
    });
    setEditOpen(true);
  }

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.put(`/trips/${trip._id}`, form);
      toast("Trip updated");
      setEditOpen(false);
      refresh();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  if (!summary) return <SkeletonCards n={4} />;
  const mine = summary.mine;
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <div>
      {summary.pendingForMe > 0 && (
        <div className="alert warn row between wrap gap" role="status">
          <span>⏳ <strong>{summary.pendingForMe} expense{summary.pendingForMe > 1 ? "s are" : " is"} waiting for your confirmation</strong></span>
          <Link className="btn sm" to={`/trips/${trip._id}/expenses?filter=mine`}>Review now</Link>
        </div>
      )}

      <div className="grid3">
        <div className="card stat"><div className="label">Total spent</div><div className="value">{inr(summary.totalSpent)}</div><div className="hint">{summary.countedExpenses} counted expense{summary.countedExpenses === 1 ? "" : "s"}</div></div>
        <div className="card stat"><div className="label">My share</div><div className="value">{inr(mine?.share)}</div><div className="hint">I paid {inr(mine?.paid)}</div></div>
        <div className="card stat">
          <div className="label">{mine?.net > 0 ? "I am owed" : mine?.net < 0 ? "I owe" : "My balance"}</div>
          <div className={`value ${mine?.net > 0 ? "pos" : mine?.net < 0 ? "neg" : ""}`}>{mine?.net === 0 ? "All settled" : inr(Math.abs(mine?.net || 0))}</div>
        </div>
        <div className="card stat"><div className="label">Equal share of trip total</div><div className="value">{inr(summary.equalShare)}</div><div className="hint">{inr(summary.totalSpent)} ÷ {summary.participantCount} people</div></div>
      </div>

      <div className="card">
        <div className="row between wrap gap">
          <div>
            <span className="badge confirmed">{summary.expenseCounts.confirmed} confirmed</span>{" "}
            <span className="badge pending">{summary.expenseCounts.pending} pending</span>{" "}
            <span className="badge disputed">{summary.expenseCounts.disputed} disputed</span>
          </div>
          <label className="row gap" style={{ fontWeight: 400, margin: 0, cursor: "pointer" }}>
            <input type="checkbox" checked={includePending} onChange={(e) => setIncludePending(e.target.checked)} />
            Include pending expenses
          </label>
        </div>
        <p className="hint">{includePending ? "Preview: pending expenses are included. Disputed ones never count." : "Only confirmed expenses count in the balances."}</p>
      </div>

      <div className="card">
        <h3 className="mb">Balances</h3>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Person</th><th className="num">Paid</th><th className="num">Share</th><th className="num">Balance</th></tr></thead>
            <tbody>
              {summary.rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.name}{r.id === summary.myParticipantId ? " (you)" : ""}</td>
                  <td className="num">{inr(r.paid)}</td>
                  <td className="num">{inr(r.share)}</td>
                  <td className={`num ${r.net > 0 ? "pos" : r.net < 0 ? "neg" : ""}`}>
                    {r.net > 0 ? `gets ${inr(r.net)}` : r.net < 0 ? `owes ${inr(-r.net)}` : "settled"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="row between"><h3>How to settle up</h3><Link to={`/trips/${trip._id}/settle`}>Open settle up →</Link></div>
        {summary.settlements.length === 0 ? (
          <p className="muted mt">Nothing to pay right now. 🎉</p>
        ) : (
          summary.settlements.map((s, i) => (
            <div className="item-row" key={i}><span className="grow"><strong>{s.fromName}</strong> pays <strong>{s.toName}</strong></span><strong>{inr(s.amount)}</strong></div>
          ))
        )}
      </div>

      <div className="row gap wrap">
        <button className="btn" onClick={downloadPdf}>⬇ Download PDF bill</button>
        {isAdmin && !locked && <button className="btn ghost" onClick={openEdit}>Edit trip details</button>}
      </div>
      {(trip.startDate || trip.description) && (
        <p className="muted small mt">{trip.startDate ? `${fmtDate(trip.startDate)} – ${fmtDate(trip.endDate)}. ` : ""}{trip.description}</p>
      )}

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit trip details">
        <form onSubmit={save}>
          <div className="field"><label htmlFor="en">Trip name</label><input id="en" type="text" required minLength={2} value={form.name || ""} onChange={set("name")} /></div>
          <div className="field"><label htmlFor="ed">Destination</label><input id="ed" type="text" value={form.destination || ""} onChange={set("destination")} /></div>
          <div className="field-row">
            <div className="field"><label htmlFor="es">Start date</label><input id="es" type="date" value={form.startDate || ""} onChange={set("startDate")} /></div>
            <div className="field"><label htmlFor="ee">End date</label><input id="ee" type="date" value={form.endDate || ""} onChange={set("endDate")} /></div>
          </div>
          <div className="field"><label htmlFor="edc">Description</label><textarea id="edc" value={form.description || ""} onChange={set("description")} /></div>
          <div className="field"><label htmlFor="eem">Cover emoji</label><input id="eem" type="text" maxLength={8} value={form.emoji || ""} onChange={set("emoji")} /></div>
          <button className="btn block" disabled={busy}>{busy ? "Saving..." : "Save changes"}</button>
        </form>
      </Modal>
    </div>
  );
}
