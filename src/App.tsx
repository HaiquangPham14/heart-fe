import { Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "./pages/Login";
import HeartsNew from "./pages/HeartsNew";
import UsersSearch from "./pages/UsersSearch";
import LoginAdmin from "./pages/admin/LoginAdmin";
// import TeamsSearch from "./pages/TeamsSearch";
import MessagesNew from "./pages/MessagesNew";
import MessagesCompose from "./pages/MessagesCompose";
import Notifications from "./pages/Notifications";
import RegisterPage from "./pages/Register";
import HeartsGive from "./pages/HeartsGive";
import PersonalHearts from "./pages/PersonalHearts"
import TeamHearts from "./pages/TeamHearts";
import UsersAdmin from "./pages/admin/UsersAdmin";
import AdminTeamsManage from "./pages/admin/AdminTeamsManage";
import AdminAdjustmentsManage from "./pages/admin/AdminAdjustmentsManage";
import AdminMessagesManage from "./pages/admin/AdminMessagesManage";
import AdminNotificationsManage from "./pages/admin/AdminNotificationsManage";
import AdminExport from "./pages/admin/AdminExport";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/hearts/new" element={<HeartsNew />} />
      <Route path="/users/search" element={<UsersSearch />} />
      {/* <Route path="/teams/search" element={<TeamsSearch />} /> */}
      <Route path="/messages/new" element={<MessagesNew />} />
      <Route path="/notifications" element={<Notifications />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/hearts/give/:id" element={<HeartsGive />} />
      <Route path="/hearts/personal" element={<PersonalHearts />} />
      <Route path="/hearts/team" element={<TeamHearts />} />
      <Route path="/admin/users" element={<UsersAdmin />} />
      <Route path="/messages/new/:id" element={<MessagesCompose />} />
      <Route path="/admin" element={<LoginAdmin />} />
      <Route path="/admin/teams" element={<AdminTeamsManage />} />
      <Route path="/admin/adjustments" element={<AdminAdjustmentsManage />} />
      <Route path="/admin/messages" element={<AdminMessagesManage />} />
      <Route path="/admin/notifications" element={<AdminNotificationsManage />} />
        <Route path="/admin/export" element={<AdminExport />} />
      <Route path="*" element={<div style={{ padding: 24, color: "white" }}>404 Not Found</div>} />
    </Routes>
  );
}
