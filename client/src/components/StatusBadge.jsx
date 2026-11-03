const LABEL = { pending: "Pending", confirmed: "Confirmed", disputed: "Disputed" };
export default function StatusBadge({ status }) {
  return <span className={`badge ${status}`}>{LABEL[status] || status}</span>;
}
