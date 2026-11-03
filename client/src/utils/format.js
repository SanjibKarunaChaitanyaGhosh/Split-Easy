// Rupees with Indian digit grouping: 1234567.5 -> "₹12,34,567.50"
export function inr(n) {
  const value = Number(n) || 0;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "";

export const fmtDateTime = (d) =>
  d ? new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "";

export const fmtTime = (d) => new Date(d).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });

// yyyy-mm-dd for <input type="date">
export const toInputDate = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "");

export const mapsLink = (lat, lng) => `https://www.google.com/maps?q=${lat},${lng}`;

export function timeAgo(d) {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return fmtDate(d);
}

export const CATEGORIES = ["Food", "Stay", "Transport", "Fuel", "Tickets", "Shopping", "Other"];
export const CATEGORY_ICON = { Food: "🍽️", Stay: "🏨", Transport: "🚕", Fuel: "⛽", Tickets: "🎟️", Shopping: "🛍️", Other: "📌" };
