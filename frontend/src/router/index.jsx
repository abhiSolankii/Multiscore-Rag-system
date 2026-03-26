import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import PrivateRoute from './PrivateRoute';
import AppLayout from '../components/layout/AppLayout';
import LoginPage from '../pages/auth/LoginPage';
import SignupPage from '../pages/auth/SignupPage';
import ChatsPage from '../pages/ChatsPage';
import ChatPage from '../pages/ChatPage';
import IngestPage from '../pages/IngestPage';
import SettingsPage from '../pages/SettingsPage';
import AdminPage from '../pages/AdminPage';
import NotFoundPage from '../pages/NotFoundPage';

const AppRouter = () => (
  <BrowserRouter>
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />

      {/* Protected routes */}
      <Route element={<PrivateRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/chats" element={<ChatsPage />} />
          <Route path="/chats/:chatId" element={<ChatPage />} />
          <Route path="/ingest" element={<IngestPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/admin" element={<AdminPage />} />
        </Route>
      </Route>

      {/* Default redirect & 404 */}
      <Route path="/" element={<Navigate to="/chats" replace />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  </BrowserRouter>
);

export default AppRouter;
