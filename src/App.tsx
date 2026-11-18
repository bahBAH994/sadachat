/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useRef } from 'react';
import {
  HashRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ActiveRoomProvider, useActiveRoom } from './context/ActiveRoomContext';
import { MiniProfileProvider } from './context/MiniProfileContext';
import { isSuperAdminUser } from './lib/sadaCatalog';
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
import { DiamondWalletPage } from './pages/DiamondWalletPage';
import { MyLevelPage } from './pages/MyLevelPage';
import { ProfilePage } from './pages/ProfilePage';
import { MessagesPage } from './pages/MessagesPage';
import { AgencyPage } from './pages/AgencyPage';
import { GamesCenterPage } from './pages/GamesCenterPage';
import { AdminPage } from './pages/AdminPage';

const RoomRouteBridge: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { activeRoomId, room, enterRoom, restoreRoom } = useActiveRoom();
  const handledRouteKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!id || !user?.id) return;
    const routeKey = `${user.id}:${id}`;
    if (handledRouteKeyRef.current === routeKey) return;
    handledRouteKeyRef.current = routeKey;

    if (activeRoomId === id && room) {
      restoreRoom();
    } else {
      void enterRoom(id);
    }
  }, [activeRoomId, enterRoom, id, restoreRoom, room, user?.id]);

  return null;
};

const ProtectedShell: React.FC<{
  children: React.ReactNode;
  requireAdmin?: boolean;
}> = ({ children, requireAdmin = false }) => {
  const { user, loading } = useAuth();
  const {
    activeRoomId,
    isMinimized: isRoomMinimized,
    minimizeRoom,
    leaveActiveRoom,
  } = useActiveRoom();
  const location = useLocation();
  const navigate = useNavigate();

  const handleMinimizeRoom = useCallback(() => {
    minimizeRoom();
    if (location.pathname.startsWith('/room/')) {
      navigate('/', { replace: true });
    }
  }, [location.pathname, minimizeRoom, navigate]);

  const handleLeaveRoom = useCallback(async () => {
    if (location.pathname !== '/') {
      navigate('/', { replace: true });
    }
    await leaveActiveRoom();
  }, [leaveActiveRoom, location.pathname, navigate]);

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

  if (requireAdmin && !isSuperAdminUser(user)) {
    return <Navigate to="/" replace />;
  }

  const isOnRoomRoute = location.pathname.startsWith('/room/');
  const isFullScreenRoom =
    Boolean(activeRoomId && !isRoomMinimized) || (isOnRoomRoute && !isRoomMinimized);
  const shouldKeepRoomMounted = Boolean(activeRoomId) || isOnRoomRoute;

  return (
    <div className="min-h-screen flex flex-col">
      {!isFullScreenRoom && <TopBar />}
      <main className={isFullScreenRoom ? 'hidden' : 'flex-1'}>{children}</main>
      {!isFullScreenRoom && <BottomNav />}
      {shouldKeepRoomMounted && (
        <RoomPage
          onMinimizeRoom={handleMinimizeRoom}
          onLeaveRoom={handleLeaveRoom}
        />
      )}
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
    return <Navigate to={isSuperAdminUser(user) ? '/admin' : '/'} replace />;
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
                  <RoomRouteBridge />
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
              path="/diamond-wallet"
              element={
                <ProtectedShell>
                  <DiamondWalletPage />
                </ProtectedShell>
              }
            />
            <Route
              path="/my-level"
              element={
                <ProtectedShell>
                  <MyLevelPage />
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
