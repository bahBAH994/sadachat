/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ActiveRoomProvider } from './context/ActiveRoomContext';
import { MiniProfileProvider } from './context/MiniProfileContext';
import { TopBar } from './components/TopBar';
import { BottomNav } from './components/BottomNav';
import { FloatingMinimizedRoom } from './components/FloatingMinimizedRoom';
import { OfflineIndicator } from './components/PWAInstallButton';
import { UserMiniProfileModal } from './components/UserMiniProfileModal';
import { LoginPage } from './pages/LoginPage';
import { LobbyPage } from './pages/LobbyPage';
import { MeetPage } from './pages/MeetPage';
import { RoomPage } from './pages/RoomPage';
import { CompetitionsPage } from './pages/CompetitionsPage';
import { WalletPage } from './pages/WalletPage';
import { StorePage } from './pages/StorePage';
import { BagPage } from './pages/BagPage';
import { ProfilePage } from './pages/ProfilePage';
import { MessagesPage } from './pages/MessagesPage';
import { AgencyPage } from './pages/AgencyPage';
import { GamesCenterPage } from './pages/GamesCenterPage';
import { AdminPage } from './pages/AdminPage';

const ProtectedShell: React.FC<{
  children: React.ReactNode;
  requireAdmin?: boolean;
}> = ({ children, requireAdmin = false }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F6FA] flex items-center justify-center">
        <div className="light-card rounded-2xl px-6 py-4 text-sm font-extrabold text-emerald-700">
          جارٍ تجهيز الوكالة الصوتية...
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requireAdmin && !user.is_admin) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <TopBar />
      <main className="flex-1">{children}</main>
      <BottomNav />
      <FloatingMinimizedRoom />
      <UserMiniProfileModal />
    </div>
  );
};

const LoginRoute: React.FC = () => {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F6FA] flex items-center justify-center">
        <div className="light-card rounded-2xl px-6 py-4 text-sm font-extrabold text-emerald-700">
          جارٍ التحقق من الجلسة...
        </div>
      </div>
    );
  }
  if (user) {
    return <Navigate to={user.is_admin ? '/admin' : '/'} replace />;
  }
  return <LoginPage />;
};

export default function App() {
  return (
    <AuthProvider>
      <ActiveRoomProvider>
        <MiniProfileProvider>
          <OfflineIndicator />
          <HashRouter>
          <Routes>
            <Route path="/login" element={<LoginRoute />} />
            <Route
              path="/"
              element={
                <ProtectedShell>
                  <LobbyPage />
                </ProtectedShell>
              }
            />
            <Route
              path="/meet"
              element={
                <ProtectedShell>
                  <MeetPage />
                </ProtectedShell>
              }
            />
            <Route
              path="/room/:id"
              element={
                <ProtectedShell>
                  <RoomPage />
                </ProtectedShell>
              }
            />
            <Route
              path="/competitions"
              element={
                <ProtectedShell>
                  <CompetitionsPage />
                </ProtectedShell>
              }
            />
            <Route
              path="/games"
              element={
                <ProtectedShell>
                  <GamesCenterPage />
                </ProtectedShell>
              }
            />
            <Route
              path="/store"
              element={
                <ProtectedShell>
                  <StorePage />
                </ProtectedShell>
              }
            />
            <Route
              path="/bag"
              element={
                <ProtectedShell>
                  <BagPage />
                </ProtectedShell>
              }
            />
            <Route
              path="/wallet"
              element={
                <ProtectedShell>
                  <WalletPage />
                </ProtectedShell>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedShell>
                  <ProfilePage />
                </ProtectedShell>
              }
            />
            <Route
              path="/messages"
              element={
                <ProtectedShell>
                  <MessagesPage />
                </ProtectedShell>
              }
            />
            <Route
              path="/agency"
              element={
                <ProtectedShell>
                  <AgencyPage />
                </ProtectedShell>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedShell requireAdmin>
                  <AdminPage />
                </ProtectedShell>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </HashRouter>
        </MiniProfileProvider>
      </ActiveRoomProvider>
    </AuthProvider>
  );
}
