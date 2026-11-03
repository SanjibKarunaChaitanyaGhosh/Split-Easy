import { useEffect, useState } from "react";
import api, { errMsg } from "../api.js";
import { useUI } from "../context/UIContext.jsx";
import { useTrip } from "./TripContext.js";
import Modal from "../components/Modal.jsx";
import { SkeletonList } from "../components/Skeleton.jsx";
import { inr, fmtDate, toInputDate } from "../utils/format.js";

export default function Settle() {
  const { trip, summary, refresh, isAdmin, locked, myId, includePending, setIncludePending } = useTrip();
  const { toast, confirm } = useUI();
  const [payments, setPayments] = useState(null);
  const [pay, setPay] = useState(null); // the suggested payment being recorded
  const [form, setForm] = useState({ amount: "", date: "", note: "" });

  const loadPayments = () => api.get(`/trips/${trip._id}/payments`).then((r) => setPayments(r.data.payments)).catch((e) => toast.error(errMsg(e)));
  useEffect(() => { loadPayments(); }, [trip._id]); // eslint-disable-line

  function startPay(s) {
    setPay(s);
    setForm({ amount: s.amount, date: toInputDate(new Date()), note: "" });
  }

  async function record(e) {
    e.preventDefault();
    try {
      await api.post(`/trips/${trip._id}/payments`, { from: pay.from, to: pay.to, amount: form.amount, date: form.date, note: form.note });
      toast("Payment recorded");
      setPay(null);
      loadPayments();
      refresh();
    } catch (err) { toast.error(errMsg(err)); }
  }

  async function removePayment(p) {
    if (!(await confirm({ title: "Delete this payment?", message: `${p.fromName} → ${p.toName}, ${inr(p.amount)}. The balances will change back.`, confirmText: "Delete", danger: true }))) return;
    try { await api.delete(`/trips/${trip._id}/payments/${p._id}`); toast("Payment deleted"); loadPayments(); refresh(); }
    catch (err) { toast.error(errMsg(err)); }
  }

  async function toggleLock() {
    const lock = !locked;
    const ok = await confirm({
      title: lock ? "Lock this trip?" : "Unlock this trip?",
      message: lock ? "This is the final settlement. Nobody can add or edit expenses until you unlock it. Recording payments still works." : "People will be able to add and edit expenses again.",
      confirmText: lock ? "Lock trip" : "Unlock",
    });
    if (!ok) return;
    try { await api.post(`/trips/${trip._id}/lock`, { locked: lock }); toast(lock ? "Trip locked" : "Trip unlocked"); refresh(); }
    catch (err) { toast.error(errMsg(err)); }
  }

  if (!summary) return <SkeletonList />;
  const mayPay = (s) => isAdmin || s.from === myId || s.to === myId;

  return (
    <div>
      <div className="row between wrap gap mb">
        <h2>Settle up</h2>
        {isAdmin && <button className={`btn ${locked ? "ghost" : ""}`} onClick={toggleLock}>{locked ? "🔓 Unlock trip" : "🔒 Lock trip (final settlement)"}</button>}
      </div>
      {locked && <div className="alert info">🔒 This trip is locked for final settlement. You can still record payments.</div>}

      <div className="card">
        <label className="row gap" style={{ fontWeight: 400, cursor: "pointer", margin: 0 }}>
          <input type="checkbox" checked={includePending} onChange={(e) => setIncludePending(e.target.checked)} /> Include pending expenses (preview)
        </label>
        <p className="hint">By default only confirmed expenses are counted.</p>
      </div>

      <div className="card">
        <h3 className="mb">Suggested payments</h3>
        {summary.settlements.length === 0 ? <p className="muted">Everyone is settled up. 🎉</p> : summary.settlements.map((s, i) => (
          <div className="item-row" key={i}>
            <span className="grow"><strong>{s.fromName}</strong> pays <strong>{s.toName}</strong></span>
            <strong>{inr(s.amount)}</strong>
            {mayPay(s) && <button className="btn sm good" onClick={() => startPay(s)}>Mark as paid</button>}
          </div>
        ))}
        <p className="hint">The fewest payments that clear every balance.</p>
      </div>

      <div className="card">
        <h3 className="mb">Balances</h3>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Person</th><th className="num">Paid</th><th className="num">Share</th><th className="num">Settled</th><th className="num">Balance</th></tr></thead>
            <tbody>
              {summary.rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.name}</td><td className="num">{inr(r.paid)}</td><td className="num">{inr(r.share)}</td>
                  <td className="num">{inr(r.sent - r.received)}</td>
                  <td className={`num ${r.net > 0 ? "pos" : r.net < 0 ? "neg" : ""}`}>{r.net > 0 ? `gets ${inr(r.net)}` : r.net < 0 ? `owes ${inr(-r.net)}` : "settled"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h3 className="mb">Payment history</h3>
        {!payments && <SkeletonList n={1} />}
        {payments && payments.length === 0 && <p className="muted">No payments recorded yet.</p>}
        {payments?.map((p) => (
          <div className="item-row" key={p._id}>
            <div className="grow">
              <strong>{p.fromName}</strong> paid <strong>{p.toName}</strong>
              <div className="muted small">{fmtDate(p.date)}{p.note ? ` · ${p.note}` : ""} · recorded by {p.recordedByName}</div>
            </div>
            <strong>{inr(p.amount)}</strong>
            {p.canDelete && <button className="icon-btn" aria-label="Delete payment" onClick={() => removePayment(p)}>🗑</button>}
          </div>
        ))}
      </div>

      <Modal open={Boolean(pay)} onClose={() => setPay(null)} title="Record a payment" small>
        {pay && (
          <form onSubmit={record}>
            <p><strong>{pay.fromName}</strong> paid <strong>{pay.toName}</strong></p>
            <div className="field"><label htmlFor="pa">Amount (₹)</label><input id="pa" type="number" required min="0.01" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
            <div className="field"><label htmlFor="pd">Date</label><input id="pd" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
            <div className="field"><label htmlFor="pn">Note (optional)</label><input id="pn" type="text" maxLength={200} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="e.g. paid by UPI" /></div>
            <button className="btn block">Record payment</button>
          </form>
        )}
      </Modal>
    </div>
  );
}
