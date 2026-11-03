import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import api, { errMsg } from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { fmtDate } from "../utils/format.js";
import { Skeleton } from "../components/Skeleton.jsx";

// /join/<token>: anyone sees a preview. A logged-in person joins automatically;
// everybody else is asked to register or log in and then comes straight back here.
export default function Join() {
  const { token } = useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get(`/trips/join/${token}`).then((r) => setPreview(r.data.preview)).catch((e) => setError(errMsg(e, "This invite link is not valid")));
  }, [token]);

  useEffect(() => {
    if (loading || !user || !preview) return;
    api.post(`/trips/join/${token}`)
      .then((r) => navigate(`/trips/${r.data.tripId}`, { replace: true }))
      .catch((e) => setError(errMsg(e, "Could not join the trip")));
  }, [loading, user, preview, token, navigate]);

  const state = { from: location };

  return (
    <div className="container">
      <div className="card auth">
        {error && <div className="alert error" role="alert">{error}</div>}
        {!preview && !error && <><Skeleton h={26} w="60%" /><Skeleton h={14} style={{ marginTop: 14 }} /></>}
        {preview && (
          <>
            <div style={{ fontSize: "2.6rem" }}>{preview.emoji}</div>
            <p className="muted small">You have been invited to join</p>
            <h1>{preview.name}</h1>
            <dl className="kv mt">
              {preview.destination && <><dt>Destination</dt><dd>{preview.destination}</dd></>}
              {(preview.startDate || preview.endDate) && <><dt>Dates</dt><dd>{fmtDate(preview.startDate)} {preview.endDate ? `– ${fmtDate(preview.endDate)}` : ""}</dd></>}
              <dt>Trip admin</dt><dd>{preview.adminName}</dd>
              <dt>Members</dt><dd>{preview.memberCount}</dd>
            </dl>
            {user ? (
              !error && <p className="muted mt">Joining the trip...</p>
            ) : (
              <div className="stack mt">
                <Link to="/register" state={state} className="btn block">Sign up to join</Link>
                <Link to="/login" state={state} className="btn ghost block">I already have an account</Link>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
