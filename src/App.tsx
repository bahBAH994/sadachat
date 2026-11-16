/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { TopBar } from './components/TopBar';
import { BottomNav } from './components/BottomNav';
import { OfflineIndicator } from './components/PWAInstallButton';
import { LoginPage } from './pages/LoginPage';
import { LobbyPage } from './pages/LobbyPage';
import { RoomPage } from './pages/RoomPage';
import { CompetitionsPage } from './pages/CompetitionsPage';
import { WalletPage } from './pages/WalletPage';
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="royal-glass rounded-2xl px-6 py-4 text-sm font-bold text-[#F3D37A]">
          جارٍ تجهيز المجلس الملكي...
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
    </div>
  );
};

const LoginRoute: React.FC = () => {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="royal-glass rounded-2xl px-6 py-4 text-sm font-bold text-[#F3D37A]">
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
    </AuthProvider>
  );
}
