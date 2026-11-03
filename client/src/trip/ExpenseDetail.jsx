import { useCallback, useEffect, useState } from "react";
import api, { errMsg, fileUrl } from "../api.js";
import { useUI } from "../context/UIContext.jsx";
import { useTrip } from "./TripContext.js";
import { getSocket } from "../socket.js";
import Modal from "../components/Modal.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { Skeleton } from "../components/Skeleton.jsx";
import { inr, fmtDate, fmtDateTime, mapsLink, CATEGORY_ICON } from "../utils/format.js";

// Everything about one expense: who confirmed, version history, and the actions.
export default function ExpenseDetail({ id, onClose, onChanged, onEdit }) {
  const { trip, nameOf, isAdmin, refresh } = useTrip();
  const { toast, confirm } = useUI();
  const [exp, setExp] = useState(null);
  const [versions, setVersions] = useState([]);
  const [disputing, setDisputing] = useState(false);
  const [reason, setReason] = useState("");
  const [asking, setAsking] = useState(false);
  const [req, setReq] = useState({ reason: "", correction: "" });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [a, b] = await Promise.all([
      api.get(`/trips/${trip._id}/expenses/${id}`),
      api.get(`/trips/${trip._id}/expenses/${id}/history`),
    ]);
    setExp(a.data.expense);
    setVersions(b.data.versions);
  }, [trip._id, id]);

  useEffect(() => { if (id) load().catch((e) => { toast.error(errMsg(e)); onClose(); }); else setExp(null); }, [id]); // eslint-disable-line

  const changed = async () => { await load(); onChanged(); refresh(); };

  async function answer(kind, participantId) {
    setBusy(true);
    try {
      const body = { participantId };
      if (kind === "dispute") body.reason = reason;
      await api.post(`/trips/${trip._id}/expenses/${id}/${kind}`, body);
      toast(kind === "confirm" ? "Confirmed" : "Disputed. The person who added it was notified");
      setDisputing(false); setReason("");
      await changed();
    } catch (err) { toast.error(errMsg(err)); } finally { setBusy(false); }
  }

  async function remove() {
    if (!(await confirm({ title: "Delete this expense?", message: `"${exp.title}" will be removed. It stays in the activity log.`, confirmText: "Delete", danger: true }))) return;
    try {
      await api.delete(`/trips/${trip._id}/expenses/${id}`);
      toast("Expense deleted");
      onChanged(); refresh(); onClose();
    } catch (err) { toast.error(errMsg(err)); }
  }

  function shareInChat() {
    const socket = getSocket();
    if (!socket) return toast.error("Chat is not connected");
    socket.emit("message:send", { tripId: trip._id, text: `Shared an expense: ${exp.title}`, expenseId: exp._id }, (ack) =>
      ack?.ok ? toast("Shared in the trip chat") : toast.error(ack?.error || "Could not share"));
  }

  async function sendRequest(e) {
    e.preventDefault();
    try {
      await api.post(`/trips/${trip._id}/requests`, { ...req, expenseId: id });
      toast("Edit request sent to the admin");
      setAsking(false); setReq({ reason: "", correction: "" });
    } catch (err) { toast.error(errMsg(err)); }
  }

  const isGuest = (pid) => !trip.participants.find((p) => String(p._id) === String(pid))?.registered;
  const showVal = (v) => (v === "" || v === undefined || v === null ? "—" : typeof v === "number" ? v : String(v).length > 40 && !isNaN(Date.parse(v)) ? fmtDate(v) : String(v));

  return (
    <Modal open={Boolean(id)} onClose={onClose} title={exp ? `${CATEGORY_ICON[exp.category]} ${exp.title}` : "Expense"} wide>
      {!exp ? <><Skeleton h={22} w="50%" /><Skeleton h={14} style={{ marginTop: 12 }} /><Skeleton h={14} style={{ marginTop: 12 }} /></> : (
        <>
          <div className="row between wrap gap mb">
            <span style={{ fontSize: "1.7rem", fontWeight: 800 }}>{inr(exp.amount)}</span>
            <StatusBadge status={exp.status} />
          </div>
          <dl className="kv">
            <dt>Paid by</dt><dd>{nameOf(exp.paidBy)}</dd>
            <dt>Date</dt><dd>{fmtDate(exp.date)}</dd>
            <dt>Category</dt><dd>{exp.category}</dd>
            <dt>Split</dt><dd>{exp.splitMode === "whole" ? `Whole trip (${trip.participants.length} people)` : exp.splitAmong.map(nameOf).join(", ")}</dd>
            {exp.place && <><dt>Place</dt><dd>{exp.place}</dd></>}
            {exp.location?.lat !== undefined && <><dt>Location</dt><dd><a href={mapsLink(exp.location.lat, exp.location.lng)} target="_blank" rel="noreferrer">View on map</a></dd></>}
            {exp.notes && <><dt>Notes</dt><dd>{exp.notes}</dd></>}
            <dt>Added by</dt><dd>{exp.createdByName}</dd>
          </dl>
          {exp.billImage && <p className="mt"><a href={fileUrl(exp.billImage)} target="_blank" rel="noreferrer"><img className="bill-img" src={fileUrl(exp.billImage)} alt="Bill" /></a></p>}

          <h3 className="mt mb">Confirmations</h3>
          {exp.confirmations.length === 0 && <p className="muted">Nobody needs to confirm this expense.</p>}
          {exp.confirmations.map((c) => (
            <div className="item-row" key={c.participant}>
              <div className="grow">
                <strong>{nameOf(c.participant)}</strong>{isGuest(c.participant) && <span className="badge grey" style={{ marginLeft: 6 }}>Not registered</span>}
                {c.reason && <div className="muted small">“{c.reason}”</div>}
              </div>
              <StatusBadge status={c.status} />
              {isAdmin && isGuest(c.participant) && c.status !== "confirmed" && !trip.locked && (
                <button className="btn sm ghost" disabled={busy} onClick={() => answer("confirm", c.participant)}>Confirm for guest</button>
              )}
            </div>
          ))}

          {exp.myConfirmation && exp.myConfirmation !== "confirmed" && !trip.locked && (
            <div className="alert warn mt">
              <strong>{exp.myConfirmation === "disputed" ? "You disputed this expense." : "Please check this expense."}</strong> Is it correct?
              {!disputing ? (
                <div className="row gap mt">
                  <button className="btn good sm" disabled={busy} onClick={() => answer("confirm")}>✓ Confirm</button>
                  {exp.myConfirmation !== "disputed" && <button className="btn danger sm" onClick={() => setDisputing(true)}>✕ Dispute</button>}
                </div>
              ) : (
                <div className="mt">
                  <label htmlFor="dr">Why is it wrong? (required)</label>
                  <textarea id="dr" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />
                  <div className="row gap mt">
                    <button className="btn danger sm" disabled={busy || reason.trim().length < 3} onClick={() => answer("dispute")}>Send dispute</button>
                    <button className="btn ghost sm" onClick={() => setDisputing(false)}>Cancel</button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="row gap wrap mt">
            {exp.canEdit && <button className="btn sm" onClick={() => onEdit(exp)}>✏️ Edit</button>}
            {exp.canDelete && <button className="btn sm danger" onClick={remove}>🗑 Delete</button>}
            <button className="btn sm ghost" onClick={shareInChat}>💬 Share in chat</button>
            <button className="btn sm ghost" onClick={() => setAsking(true)}>Raise edit request</button>
          </div>
          {!exp.canDelete && !trip.locked && <p className="hint">Only the person who added this expense can delete it.</p>}
          {!exp.canEdit && !trip.locked && <p className="hint">Only the person who added it can edit while it is pending or disputed. Others can raise an edit request.</p>}

          {asking && (
            <form className="card flat mt" onSubmit={sendRequest}>
              <h3 className="mb">Edit request</h3>
              <div className="field"><label htmlFor="rq1">Why?</label><input id="rq1" type="text" required minLength={3} value={req.reason} onChange={(e) => setReq({ ...req, reason: e.target.value })} /></div>
              <div className="field"><label htmlFor="rq2">What needs to be corrected?</label><input id="rq2" type="text" required minLength={3} value={req.correction} onChange={(e) => setReq({ ...req, correction: e.target.value })} /></div>
              <div className="row gap"><button className="btn sm">Send request</button><button type="button" className="btn ghost sm" onClick={() => setAsking(false)}>Cancel</button></div>
            </form>
          )}

          <h3 className="mt mb">Edit history</h3>
          {versions.length === 0 ? <p className="muted">This expense has not been edited.</p> : (
            [...versions].reverse().map((v, i) => (
              <div className="card flat" key={i}>
                <div className="small"><strong>{v.byName}</strong> · {fmtDateTime(v.at)}{v.reason ? ` · reason: ${v.reason}` : ""}</div>
                <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                  {v.changes.map((c, j) => <li key={j} className="small"><strong>{c.field}</strong>: {showVal(c.from)} → {showVal(c.to)}</li>)}
                </ul>
              </div>
            ))
          )}
        </>
      )}
    </Modal>
  );
}
