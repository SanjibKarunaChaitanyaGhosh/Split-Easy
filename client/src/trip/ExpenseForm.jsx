import { useEffect, useState } from "react";
import api, { errMsg } from "../api.js";
import { useUI } from "../context/UIContext.jsx";
import { useTrip } from "./TripContext.js";
import Modal from "../components/Modal.jsx";
import { CATEGORIES, mapsLink, toInputDate } from "../utils/format.js";

// Add / edit an expense. Sent as multipart/form-data because of the optional bill photo.
export default function ExpenseForm({ open, onClose, expense, onSaved }) {
  const { trip, myId } = useTrip();
  const { toast } = useUI();
  const editing = Boolean(expense);

  const blank = () => ({
    title: "", amount: "", category: "Food", date: toInputDate(new Date()), paidBy: myId, notes: "", place: "",
    splitMode: "tagged", splitAmong: [], lat: "", lng: "", reason: "",
  });
  const [f, setF] = useState(blank());
  const [file, setFile] = useState(null);
  const [removeBill, setRemoveBill] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(""); setFile(null); setRemoveBill(false);
    if (expense) {
      setF({
        title: expense.title, amount: expense.amount, category: expense.category, date: toInputDate(expense.date),
        paidBy: String(expense.paidBy), notes: expense.notes || "", place: expense.place || "",
        splitMode: expense.splitMode, splitAmong: expense.splitAmong.map(String),
        lat: expense.location?.lat ?? "", lng: expense.location?.lng ?? "", reason: "",
      });
    } else setF(blank());
  }, [open, expense]); // eslint-disable-line

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const toggle = (id) => setF({ ...f, splitAmong: f.splitAmong.includes(id) ? f.splitAmong.filter((x) => x !== id) : [...f.splitAmong, id] });
  const everyone = trip.participants.map((p) => String(p._id));

  function pickFile(e) {
    const picked = e.target.files[0];
    if (!picked) return setFile(null);
    if (!picked.type.startsWith("image/")) { e.target.value = ""; return setError("The bill must be an image file"); }
    if (picked.size > 2 * 1024 * 1024) { e.target.value = ""; return setError("The bill photo must be 2 MB or smaller"); }
    setError(""); setFile(picked);
  }

  function useMyLocation() {
    if (!navigator.geolocation) return toast.error("Location is not available in this browser");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => { setF((x) => ({ ...x, lat: +pos.coords.latitude.toFixed(6), lng: +pos.coords.longitude.toFixed(6) })); setLocating(false); },
      () => { setLocating(false); toast.error("Could not get your location (permission denied?)"); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (f.splitMode === "tagged" && f.splitAmong.length === 0) return setError("Tag at least one person who shares this expense");
    if (editing && expense.reasonRequired && f.reason.trim().length < 3) return setError("Please give a reason for the edit");

    const body = new FormData();
    ["title", "amount", "category", "date", "paidBy", "notes", "place", "splitMode", "reason"].forEach((k) => body.append(k, f[k]));
    body.append("splitAmong", JSON.stringify(f.splitMode === "tagged" ? f.splitAmong : []));
    if (f.lat !== "" && f.lng !== "") body.append("location", JSON.stringify({ lat: f.lat, lng: f.lng }));
    if (file) body.append("billImage", file);
    if (removeBill) body.append("removeBill", "true");

    setBusy(true);
    try {
      if (editing) await api.put(`/trips/${trip._id}/expenses/${expense._id}`, body);
      else await api.post(`/trips/${trip._id}/expenses`, body);
      toast(editing ? "Expense updated. Tagged people will confirm it again" : "Expense added. Tagged people were notified");
      onSaved();
      onClose();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  const share = f.amount && f.splitMode === "tagged" && f.splitAmong.length ? Number(f.amount) / f.splitAmong.length
    : f.amount && f.splitMode === "whole" ? Number(f.amount) / everyone.length : null;

  return (
    <Modal open={open} onClose={onClose} title={editing ? "Edit expense" : "Add an expense"} wide>
      {error && <div className="alert error" role="alert">{error}</div>}
      <form onSubmit={submit}>
        <div className="field-row">
          <div className="field"><label htmlFor="x-title">What was it for?</label><input id="x-title" type="text" required maxLength={120} value={f.title} onChange={set("title")} placeholder="e.g. Lunch at the beach" /></div>
          <div className="field"><label htmlFor="x-amt">Amount (₹)</label><input id="x-amt" type="number" required min="0.01" step="0.01" value={f.amount} onChange={set("amount")} inputMode="decimal" /></div>
        </div>
        <div className="field-row">
          <div className="field"><label htmlFor="x-cat">Category</label>
            <select id="x-cat" value={f.category} onChange={set("category")}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></div>
          <div className="field"><label htmlFor="x-date">Date</label><input id="x-date" type="date" required value={f.date} onChange={set("date")} /></div>
        </div>
        <div className="field-row">
          <div className="field"><label htmlFor="x-paid">Paid by</label>
            <select id="x-paid" value={f.paidBy} onChange={set("paidBy")}>
              {trip.participants.map((p) => <option key={p._id} value={p._id}>{p.name}{String(p._id) === myId ? " (me)" : ""}</option>)}
            </select></div>
          <div className="field"><label htmlFor="x-place">Place name (optional)</label><input id="x-place" type="text" maxLength={120} value={f.place} onChange={set("place")} /></div>
        </div>

        <div className="field">
          <label>How is it split?</label>
          <div className="chips" role="radiogroup" aria-label="Split mode">
            <button type="button" role="radio" aria-checked={f.splitMode === "tagged"} className={`chip ${f.splitMode === "tagged" ? "on" : ""}`} onClick={() => setF({ ...f, splitMode: "tagged" })}>Tagged people</button>
            <button type="button" role="radio" aria-checked={f.splitMode === "whole"} className={`chip ${f.splitMode === "whole" ? "on" : ""}`} onClick={() => setF({ ...f, splitMode: "whole" })}>Whole trip</button>
          </div>
        </div>

        {f.splitMode === "tagged" ? (
          <div className="field">
            <div className="row between"><label>Who shares it? (tap to tag)</label>
              <span>
                <button type="button" className="link-btn small" onClick={() => setF({ ...f, splitAmong: everyone })}>Select all</button>{" · "}
                <button type="button" className="link-btn small" onClick={() => setF({ ...f, splitAmong: [] })}>Clear</button>
              </span></div>
            <div className="chips">
              {trip.participants.map((p) => {
                const on = f.splitAmong.includes(String(p._id));
                return <button type="button" key={p._id} className={`chip ${on ? "on" : ""}`} aria-pressed={on} onClick={() => toggle(String(p._id))}>{on ? "✓ " : ""}{p.name}{!p.registered ? " (guest)" : ""}</button>;
              })}
            </div>
          </div>
        ) : (
          <div className="alert info">Shared equally by everyone in the trip ({everyone.length} people).</div>
        )}
        {share !== null && <p className="hint" style={{ marginTop: -6 }}>Each person's share: about ₹{share.toFixed(2)}</p>}

        <div className="field"><label htmlFor="x-notes">Notes (optional)</label><textarea id="x-notes" maxLength={500} value={f.notes} onChange={set("notes")} /></div>

        <div className="field">
          <label>Location (optional)</label>
          <div className="row gap wrap">
            <button type="button" className="btn ghost sm" onClick={useMyLocation} disabled={locating}>{locating ? "Locating..." : "📍 Use my location"}</button>
            {f.lat !== "" && f.lng !== "" && (
              <>
                <a href={mapsLink(f.lat, f.lng)} target="_blank" rel="noreferrer">View on map</a>
                <button type="button" className="link-btn small" onClick={() => setF({ ...f, lat: "", lng: "" })}>Remove</button>
              </>
            )}
          </div>
        </div>

        <div className="field">
          <label htmlFor="x-bill">Bill photo (optional, max 2 MB)</label>
          <input id="x-bill" type="file" accept="image/*" onChange={pickFile} />
          {editing && expense.billImage && (
            <label className="row gap" style={{ fontWeight: 400, marginTop: 6 }}>
              <input type="checkbox" checked={removeBill} onChange={(e) => setRemoveBill(e.target.checked)} /> Remove the current photo
            </label>
          )}
        </div>

        {editing && (
          <div className="field">
            <label htmlFor="x-reason">Reason for edit {expense.reasonRequired ? "(required)" : "(optional)"}</label>
            <input id="x-reason" type="text" maxLength={300} value={f.reason} onChange={set("reason")} placeholder="Why are you changing this?" />
            <div className="hint">Everyone tagged will be asked to confirm this expense again.</div>
          </div>
        )}
        <button className="btn block" disabled={busy}>{busy ? "Saving..." : editing ? "Save changes" : "Add expense"}</button>
      </form>
    </Modal>
  );
}
