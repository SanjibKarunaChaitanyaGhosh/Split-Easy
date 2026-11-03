import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api, { errMsg } from "../api.js";
import { useUI } from "../context/UIContext.jsx";
import { useTrip } from "./TripContext.js";
import ExpenseForm from "./ExpenseForm.jsx";
import ExpenseDetail from "./ExpenseDetail.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { SkeletonList } from "../components/Skeleton.jsx";
import { inr, fmtDate, CATEGORY_ICON } from "../utils/format.js";

const FILTERS = [["all", "All"], ["mine", "Needs my confirmation"], ["pending", "Pending"], ["confirmed", "Confirmed"], ["disputed", "Disputed"]];

export default function Expenses() {
  const { trip, nameOf, locked, refresh } = useTrip();
  const { toast } = useUI();
  const [params, setParams] = useSearchParams();
  const [list, setList] = useState(null);
  const [filter, setFilter] = useState(params.get("filter") || "all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [openId, setOpenId] = useState(params.get("open"));

  const load = () => api.get(`/trips/${trip._id}/expenses`).then((r) => setList(r.data.expenses)).catch((e) => toast.error(errMsg(e)));
  useEffect(() => { load(); }, [trip._id]); // eslint-disable-line

  const afterChange = () => { load(); refresh(); };
  const closeDetail = () => { setOpenId(null); if (params.get("open")) { params.delete("open"); setParams(params, { replace: true }); } };

  const shown = (list || []).filter((e) =>
    filter === "all" ? true : filter === "mine" ? e.needsMyConfirmation : e.status === filter);

  return (
    <div>
      <div className="row between wrap gap mb">
        <h2>Expenses</h2>
        <button className="btn" disabled={locked} onClick={() => { setEditing(null); setFormOpen(true); }}>+ Add expense</button>
      </div>
      {locked && <div className="alert info">🔒 This trip is locked. No new expenses or edits until the admin unlocks it.</div>}

      <div className="chips mb">
        {FILTERS.map(([k, label]) => (
          <button key={k} className={`chip ${filter === k ? "on" : ""}`} aria-pressed={filter === k} onClick={() => setFilter(k)}>{label}</button>
        ))}
      </div>

      {!list && <SkeletonList />}
      {list && shown.length === 0 && (
        <div className="card empty">
          <div className="emoji">🧾</div>
          <h3>{list.length === 0 ? "No expenses yet" : "Nothing matches this filter"}</h3>
          <p>{list.length === 0 ? "Add the first one: what you spent, and tag who shares it." : "Try another filter."}</p>
        </div>
      )}
      {shown.map((e) => (
        <div key={e._id} className="card exp-card" onClick={() => setOpenId(e._id)} role="button" tabIndex={0}
             onKeyDown={(ev) => (ev.key === "Enter" || ev.key === " ") && setOpenId(e._id)}>
          <div className="row gap">
            <span style={{ fontSize: "1.6rem" }}>{CATEGORY_ICON[e.category]}</span>
            <div className="grow">
              <strong>{e.title}</strong>
              <div className="muted small">
                Paid by {nameOf(e.paidBy)} · {fmtDate(e.date)}{e.place ? ` · ${e.place}` : ""} · {e.splitMode === "whole" ? "whole trip" : `${e.splitAmong.length} tagged`}
              </div>
            </div>
            <div className="right">
              <div className="amount">{inr(e.amount)}</div>
              <StatusBadge status={e.status} />
            </div>
          </div>
          {e.needsMyConfirmation && <div className="alert warn small" style={{ margin: "10px 0 0" }}>⏳ Waiting for your confirmation</div>}
        </div>
      ))}

      <ExpenseDetail id={openId} onClose={closeDetail} onChanged={afterChange}
        onEdit={(exp) => { setOpenId(null); setEditing(exp); setFormOpen(true); }} />
      <ExpenseForm open={formOpen} expense={editing} onClose={() => setFormOpen(false)} onSaved={afterChange} />
    </div>
  );
}
