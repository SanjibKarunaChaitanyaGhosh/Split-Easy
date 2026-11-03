import { useEffect, useState } from "react";
import api, { errMsg } from "../api.js";
import { useUI } from "../context/UIContext.jsx";
import { useTrip } from "./TripContext.js";
import { SkeletonList } from "../components/Skeleton.jsx";
import Modal from "../components/Modal.jsx";
import { fmtDateTime } from "../utils/format.js";

export default function People() {
  const { trip, isAdmin, refresh, loadTrip, locked } = useTrip();
  const { toast, confirm } = useUI();
  const [invites, setInvites] = useState(null);
  const [guest, setGuest] = useState({ name: "", email: "" });
  const [email, setEmail] = useState("");
  const [result, setResult] = useState(null); // answer of the last invitation (link to copy when e-mail is not set up)
  const [mergeFor, setMergeFor] = useState(null);
  const [target, setTarget] = useState("");

  const canInvite = isAdmin || trip.membersCanInvite;
  const joinLink = `${window.location.origin}/join/${trip.inviteToken}`;
  const loadInvites = () => isAdmin && api.get(`/trips/${trip._id}/invitations`).then((r) => setInvites(r.data.invitations)).catch(() => setInvites([]));
  useEffect(() => { loadInvites(); }, [trip._id, isAdmin]); // eslint-disable-line

  const copy = async (text) => { try { await navigator.clipboard.writeText(text); toast("Link copied"); } catch { toast.error("Could not copy. Select the link and copy it by hand"); } };
  const whatsapp = (link) => `https://wa.me/?text=${encodeURIComponent(`Join our trip "${trip.name}" on SplitEasy: ${link}`)}`;
  const mailto = (link, to = "") => `mailto:${to}?subject=${encodeURIComponent(`Join "${trip.name}" on SplitEasy`)}&body=${encodeURIComponent(`Hi! Join our trip here: ${link}`)}`;

  async function run(fn, okMsg) {
    try { await fn(); if (okMsg) toast(okMsg); await refresh(); loadInvites(); }
    catch (err) { toast.error(errMsg(err)); }
  }

  const addGuest = (e) => { e.preventDefault(); run(async () => { await api.post(`/trips/${trip._id}/guests`, guest); setGuest({ name: "", email: "" }); }, "Guest added"); };

  async function invite(e) {
    e.preventDefault();
    try {
      const r = await api.post(`/trips/${trip._id}/invitations`, { email });
      setResult(r.data);
      setEmail("");
      toast(r.data.emailSent ? "Invitation sent" : "Invitation created. Share the link below");
      loadInvites();
    } catch (err) { toast.error(errMsg(err)); }
  }

  async function remove(p) {
    if (!(await confirm({ title: `Remove ${p.name}?`, message: "They will no longer be part of this trip.", confirmText: "Remove", danger: true }))) return;
    run(() => api.delete(`/trips/${trip._id}/participants/${p._id}`), `${p.name} removed`);
  }

  async function merge() {
    await run(() => api.post(`/trips/${trip._id}/guests/${mergeFor._id}/merge`, { targetParticipantId: target }), "Guest merged. Nobody is counted twice now");
    setMergeFor(null); setTarget("");
  }

  const resend = (i) => run(async () => {
    const r = await api.post(`/trips/${trip._id}/invitations/${i._id}/resend`);
    setResult({ ...r.data, invitation: i });
  }, "Invitation processed");

  const regen = async (action) => {
    if (action === "regenerate" && !(await confirm({ title: "Make a new invite link?", message: "The old link will stop working.", confirmText: "New link" }))) return;
    run(() => api.post(`/trips/${trip._id}/invite-link`, { action }), "Invite link updated");
  };

  const registeredOthers = trip.participants.filter((p) => p.registered);

  return (
    <div>
      <h2 className="mb">People &amp; invites</h2>

      <div className="card">
        <h3 className="mb">Participants ({trip.participants.length})</h3>
        {trip.participants.map((p) => (
          <div className="item-row" key={p._id}>
            <div className="grow">
              <strong>{p.name}</strong>{" "}
              {p.role === "admin" && <span className="badge accent">Admin</span>}{" "}
              {!p.registered && <span className="badge grey">Not registered</span>}
              {isAdmin && p.email && <div className="muted small">{p.email}</div>}
            </div>
            {isAdmin && !locked && !p.registered && registeredOthers.length > 0 && (
              <button className="btn ghost sm" onClick={() => { setMergeFor(p); setTarget(registeredOthers.find((r) => r.email && r.email === p.email)?._id || ""); }}>Merge into a member</button>
            )}
            {isAdmin && !locked && p.role !== "admin" && <button className="btn ghost sm" onClick={() => remove(p)}>Remove</button>}
          </div>
        ))}
        <p className="hint">Guests have no account. They are included in the split, and the admin answers confirmations for them.</p>
      </div>

      {isAdmin && !locked && (
        <div className="card">
          <h3 className="mb">Add a guest (not registered)</h3>
          <form className="row gap wrap" style={{ alignItems: "flex-end" }} onSubmit={addGuest}>
            <div className="grow"><label htmlFor="gn">Name</label><input id="gn" type="text" required maxLength={60} value={guest.name} onChange={(e) => setGuest({ ...guest, name: e.target.value })} /></div>
            <div className="grow"><label htmlFor="ge">Email (optional)</label><input id="ge" type="email" value={guest.email} onChange={(e) => setGuest({ ...guest, email: e.target.value })} /></div>
            <button className="btn">Add guest</button>
          </form>
        </div>
      )}

      {canInvite && !locked && (
        <div className="card">
          <h3 className="mb">Invite by email</h3>
          <form className="row gap wrap" style={{ alignItems: "flex-end" }} onSubmit={invite}>
            <div className="grow"><label htmlFor="ie">Email address</label><input id="ie" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="friend@example.com" /></div>
            <button className="btn">Send invitation</button>
          </form>
          {result && (
            <div className={`alert ${result.emailSent ? "good" : "info"} mt`} role="status">
              {result.emailSent ? <strong>✓ Invitation sent.</strong> : <><strong>Invitation created, but no email was sent</strong> ({result.emailError || "email not configured"}). Share this link instead:</>}
              <div className="row gap wrap mt">
                <input type="text" readOnly value={result.link} onFocus={(e) => e.target.select()} aria-label="Invitation link" style={{ flex: 1, minWidth: 200 }} />
                <button className="btn sm" onClick={() => copy(result.link)}>Copy</button>
                <a className="btn sm ghost" target="_blank" rel="noreferrer" href={whatsapp(result.link)}>WhatsApp</a>
                <a className="btn sm ghost" href={mailto(result.link, result.invitation?.email)}>Email app</a>
              </div>
            </div>
          )}
        </div>
      )}

      {isAdmin && (
        <>
          <div className="card">
            <h3 className="mb">Invite link</h3>
            <p className="muted small">Anyone with this link can see a preview of the trip and join after signing up or logging in.</p>
            <div className="row gap wrap">
              <input type="text" readOnly value={joinLink} onFocus={(e) => e.target.select()} aria-label="Invite link" style={{ flex: 1, minWidth: 220 }} disabled={!trip.inviteEnabled} />
              <button className="btn sm" disabled={!trip.inviteEnabled} onClick={() => copy(joinLink)}>Copy</button>
              <a className={`btn sm ghost ${!trip.inviteEnabled ? "disabled" : ""}`} target="_blank" rel="noreferrer" href={whatsapp(joinLink)}>WhatsApp</a>
              <a className="btn sm ghost" href={mailto(joinLink)}>Email app</a>
            </div>
            <div className="row gap wrap mt">
              <button className="btn ghost sm" onClick={() => regen("regenerate")}>Make a new link</button>
              <button className="btn ghost sm" onClick={() => regen(trip.inviteEnabled ? "disable" : "enable")}>{trip.inviteEnabled ? "Turn the link off" : "Turn the link on"}</button>
              {!trip.inviteEnabled && <span className="badge disputed">Link is off</span>}
            </div>
            <label className="row gap mt" style={{ fontWeight: 400, cursor: "pointer" }}>
              <input type="checkbox" checked={trip.membersCanInvite} disabled={locked}
                onChange={(e) => run(() => api.put(`/trips/${trip._id}`, {
                  name: trip.name, destination: trip.destination, description: trip.description, emoji: trip.emoji,
                  startDate: trip.startDate, endDate: trip.endDate, membersCanInvite: e.target.checked,
                }), "Setting saved")} />
              Let ordinary members invite people by email too
            </label>
          </div>

          <div className="card">
            <h3 className="mb">Invitations</h3>
            {!invites && <SkeletonList n={1} />}
            {invites && invites.length === 0 && <p className="muted">No email invitations yet.</p>}
            {invites?.map((i) => (
              <div className="item-row" key={i._id}>
                <div className="grow"><strong>{i.email}</strong><div className="muted small">Invited by {i.invitedByName} · {fmtDateTime(i.createdAt)}</div></div>
                <span className={`badge ${i.status === "pending" ? "pending" : i.status === "accepted" ? "confirmed" : "grey"}`}>{i.status}</span>
                {i.status === "pending" && (
                  <>
                    <button className="btn ghost sm" onClick={() => copy(i.link)}>Copy link</button>
                    <button className="btn ghost sm" onClick={() => resend(i)}>Resend</button>
                    <button className="btn ghost sm" onClick={() => run(() => api.delete(`/trips/${trip._id}/invitations/${i._id}`), "Invitation cancelled")}>Cancel</button>
                  </>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      <Modal open={Boolean(mergeFor)} onClose={() => setMergeFor(null)} title={`Merge "${mergeFor?.name}" into a member`} small>
        <p className="muted small">Use this when a guest later signs up. Their expenses, tags and payments move to the real person, so nobody is counted twice.</p>
        <div className="field">
          <label htmlFor="mt">Merge into</label>
          <select id="mt" value={target} onChange={(e) => setTarget(e.target.value)}>
            <option value="">Choose a member...</option>
            {registeredOthers.map((r) => <option key={r._id} value={r._id}>{r.name}</option>)}
          </select>
        </div>
        <button className="btn block" disabled={!target} onClick={merge}>Merge</button>
      </Modal>
    </div>
  );
}
