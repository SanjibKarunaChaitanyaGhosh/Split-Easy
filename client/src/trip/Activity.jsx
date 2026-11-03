import { useEffect, useState } from "react";
import api, { errMsg } from "../api.js";
import { useUI } from "../context/UIContext.jsx";
import { useTrip } from "./TripContext.js";
import { SkeletonList } from "../components/Skeleton.jsx";
import { fmtDateTime } from "../utils/format.js";

const ICON = {
  trip_created: "🧳", trip_updated: "✏️", trip_locked: "🔒", trip_unlocked: "🔓", member_joined: "👋", member_removed: "🚪",
  guest_added: "👤", guest_merged: "🔗", invitation_sent: "✉️", invitation_cancelled: "🚫", invite_link: "🔗",
  expense_added: "🧾", expense_edited: "✏️", expense_deleted: "🗑️", expense_confirmed: "✅", expense_fully_confirmed: "🎉",
  expense_disputed: "⚠️", request_raised: "🙋", request_resolved: "☑️", payment_recorded: "💸", payment_deleted: "↩️",
};

// automatic timeline of everything that happened in the trip
export default function Activity() {
  const { trip } = useTrip();
  const { toast } = useUI();
  const [items, setItems] = useState(null);

  useEffect(() => {
    api.get(`/trips/${trip._id}/activity`).then((r) => setItems(r.data.activity)).catch((e) => toast.error(errMsg(e)));
  }, [trip._id]); // eslint-disable-line

  return (
    <div>
      <h2 className="mb">Activity log</h2>
      {!items && <SkeletonList />}
      {items && items.length === 0 && <div className="card empty">Nothing has happened yet.</div>}
      {items && items.length > 0 && (
        <div className="card">
          <div className="timeline">
            {items.map((a) => (
              <div className="t-item" key={a._id}>
                <div>{ICON[a.type] || "•"} {a.message}</div>
                <div className="muted small">{fmtDateTime(a.createdAt)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
