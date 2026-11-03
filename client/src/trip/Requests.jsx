import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { errMsg } from "../api.js";
import { useUI } from "../context/UIContext.jsx";
import { useTrip } from "./TripContext.js";
import Modal from "../components/Modal.jsx";
import { SkeletonList } from "../components/Skeleton.jsx";
import { fmtDateTime } from "../utils/format.js";

// Full history of edit requests: who asked, why, what to correct, status, who resolved it.
export default function Requests() {
  const { trip } = useTrip();
  const { toast } = useUI();
  const [list, setList] = useState(null);
  const [open, setOpen] = useState(false);
  const [expenses, setExpenses] = useState([]);
  const [form, setForm] = useState({ expenseId: "", reason: "", correction: "" });
  const [notes, setNotes] = useState({});

  const load = () => api.get(`/trips/${trip._id}/requests`).then((r) => setList(r.data.requests)).catch((e) => toast.error(errMsg(e)));
  useEffect(() => { load(); }, [trip._id]); // eslint-disable-line

  async function openForm() {
    const r = await api.get(`/trips/${trip._id}/expenses`);
    setExpenses(r.data.expenses);
    setForm({ expenseId: "", reason: "", correction: "" });
    setOpen(true);
  }

  async function raise(e) {
    e.preventDefault();
    try {
      const body = { reason: form.reason, correction: form.correction };
      if (form.expenseId) body.expenseId = form.expenseId;
      await api.post(`/trips/${trip._id}/requests`, body);
      toast("Request raised");
      setOpen(false);
      load();
    } catch (err) { toast.error(errMsg(err)); }
  }

  async function close(r, status) {
    try {
      await api.put(`/trips/${trip._id}/requests/${r._id}`, { status, note: notes[r._id] || "" });
      toast(`Request ${status}`);
      load();
    } catch (err) { toast.error(errMsg(err)); }
  }

  return (
    <div>
      <div className="row between wrap gap mb">
        <div><h2>Edit requests</h2><p className="muted small" style={{ margin: 0 }}>Ask for a correction. The admin or the person who added the expense can resolve it.</p></div>
        <button className="btn" onClick={openForm}>+ Raise a request</button>
      </div>

      {!list && <SkeletonList />}
      {list && list.length === 0 && <div className="card empty"><div className="emoji">✏️</div><h3>No edit requests</h3><p>If something is wrong or missing, raise a request.</p></div>}
      {list?.map((r) => (
        <div className="card" key={r._id}>
          <div className="row between wrap gap">
            <strong>{r.expenseTitle ? <>About <Link to={`/trips/${trip._id}/expenses?open=${r.expense}`}>{r.expenseTitle}</Link></> : "General request"}</strong>
            <span className={`badge ${r.status}`}>{r.status}</span>
          </div>
          <dl className="kv mt">
            <dt>Asked by</dt><dd>{r.requestedByName} · {fmtDateTime(r.createdAt)}</dd>
            <dt>Why</dt><dd>{r.reason}</dd>
            <dt>Correction</dt><dd>{r.correction}</dd>
            {r.status !== "open" && <><dt>Closed by</dt><dd>{r.resolvedByName} · {fmtDateTime(r.resolvedAt)}{r.resolvedNote ? ` · “${r.resolvedNote}”` : ""}</dd></>}
          </dl>
          {r.canResolve && (
            <div className="row gap wrap mt">
              <input type="text" placeholder="Note (optional)" maxLength={300} value={notes[r._id] || ""} onChange={(e) => setNotes({ ...notes, [r._id]: e.target.value })} aria-label="Resolution note" style={{ flex: 1, minWidth: 180 }} />
              <button className="btn good sm" onClick={() => close(r, "resolved")}>Mark resolved</button>
              <button className="btn danger sm" onClick={() => close(r, "rejected")}>Reject</button>
            </div>
          )}
        </div>
      ))}

      <Modal open={open} onClose={() => setOpen(false)} title="Raise an edit request">
        <form onSubmit={raise}>
          <div className="field">
            <label htmlFor="rx">About which expense? (optional)</label>
            <select id="rx" value={form.expenseId} onChange={(e) => setForm({ ...form, expenseId: e.target.value })}>
              <option value="">General / a missing item</option>
              {expenses.map((e) => <option key={e._id} value={e._id}>{e.title}</option>)}
            </select>
          </div>
          <div className="field"><label htmlFor="rr">Why?</label><textarea id="rr" required minLength={3} maxLength={500} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></div>
          <div className="field"><label htmlFor="rc">What needs to be corrected?</label><textarea id="rc" required minLength={3} maxLength={500} value={form.correction} onChange={(e) => setForm({ ...form, correction: e.target.value })} /></div>
          <button className="btn block">Send request</button>
        </form>
      </Modal>
    </div>
  );
}
