import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { errMsg } from "../api.js";

// Login and Register share this page. After success the user is sent back to where they were going
// (for example an invite link) - that place is passed in location.state.from by PrivateRoute / Join.
export default function AuthPage({ mode }) {
  const isLogin = mode === "login";
  const { user, login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const from = location.state?.from;
  const target = from ? `${from.pathname}${from.search || ""}` : "/dashboard";

  if (user) return <Navigate to={target} replace />;

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (isLogin) await login(form.email, form.password);
      else await register(form.name, form.email, form.password);
      navigate(target, { replace: true });
    } catch (err) {
      setError(errMsg(err, isLogin ? "Login failed" : "Registration failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container">
      <div className="card auth">
        <h1>{isLogin ? "Welcome back" : "Create your account"}</h1>
        <p className="muted">{isLogin ? "Log in to see your trips." : "It takes a few seconds."}</p>
        {from?.pathname?.startsWith("/join/") && <div className="alert info">Log in or sign up to join the trip you were invited to.</div>}
        {params.get("expired") && <div className="alert warn">Your session expired. Please log in again.</div>}
        {error && <div className="alert error" role="alert">{error}</div>}
        <form onSubmit={submit}>
          {!isLogin && (
            <div className="field">
              <label htmlFor="name">Your name</label>
              <input id="name" type="text" required minLength={2} maxLength={60} value={form.name} onChange={set("name")} autoComplete="name" />
            </div>
          )}
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" required value={form.email} onChange={set("email")} autoComplete="email" />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input id="password" type="password" required minLength={isLogin ? undefined : 6} value={form.password} onChange={set("password")} autoComplete={isLogin ? "current-password" : "new-password"} />
            {!isLogin && <div className="hint">At least 6 characters.</div>}
          </div>
          <button className="btn block" disabled={busy}>{busy ? "Please wait..." : isLogin ? "Log in" : "Sign up"}</button>
        </form>
        <p className="muted small mt">
          {isLogin ? "New here? " : "Already have an account? "}
          <Link to={isLogin ? "/register" : "/login"} state={location.state}>{isLogin ? "Create an account" : "Log in"}</Link>
        </p>
      </div>
    </div>
  );
}
