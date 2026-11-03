import { Routes, Route, Navigate } from "react-router-dom";
import Navbar from "./components/Navbar.jsx";
import PrivateRoute from "./components/PrivateRoute.jsx";
import Landing from "./pages/Landing.jsx";
import AuthPage from "./pages/AuthPage.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Join from "./pages/Join.jsx";
import TripLayout from "./trip/TripLayout.jsx";
import Overview from "./trip/Overview.jsx";
import Expenses from "./trip/Expenses.jsx";
import People from "./trip/People.jsx";
import Chat from "./trip/Chat.jsx";
import Requests from "./trip/Requests.jsx";
import Activity from "./trip/Activity.jsx";
import Settle from "./trip/Settle.jsx";

export default function App() {
  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<AuthPage mode="login" />} />
        <Route path="/register" element={<AuthPage mode="register" />} />
        {/* the invite preview is public; joining asks you to log in */}
        <Route path="/join/:token" element={<Join />} />

        <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
        <Route path="/trips/:id" element={<PrivateRoute><TripLayout /></PrivateRoute>}>
          <Route index element={<Overview />} />
          <Route path="expenses" element={<Expenses />} />
          <Route path="people" element={<People />} />
          <Route path="chat" element={<Chat />} />
          <Route path="requests" element={<Requests />} />
          <Route path="activity" element={<Activity />} />
          <Route path="settle" element={<Settle />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
