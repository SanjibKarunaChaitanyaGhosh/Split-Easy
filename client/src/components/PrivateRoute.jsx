import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { SkeletonList } from "./Skeleton.jsx";

// Pages that need a login. We remember where the person was going (e.g. an invite link)
// so that after logging in they are sent straight back.
export default function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="container"><SkeletonList /></div>;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  return children;
}
