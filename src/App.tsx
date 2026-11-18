/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Component, useCallback, useEffect, useRef } from 'react';
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

class AppErrorBoundary extends Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error('SADA Runtime ErrorBoundary caught:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F5F6FA] flex flex-col items-center justify-center p-6 text-center space-y-4">
          <div className="light-card rounded-3xl p-6 max-w-sm space-y-3">
            <h2 className="text-base font-extrabold text-slate-900">
              حدث خطأ غير متوقع في العرض
            </h2>
            <p className="text-xs text-slate-600">
              اضغط الزر بالأسفل للعودة السريعة إلى الواجهة الرئيسية دون فقدان بياناتك.
            </p>
            <button
              type="button"
              onClick={() => {
                try {
                  const keysToRemove: string[] = [];
                  for (let i = 0; i < window.localStorage.length; i += 1) {
                    const key = window.localStorage.key(i);
                    if (
                      key &&
                      (key.toLowerCase().includes('room') ||
                        key.toLowerCase().includes('sada_active') ||
                        key.toLowerCase().includes('agency'))
                    ) {
                      keysToRemove.push(key);
                    }
                  }
                  keysToRemove.forEach((k) => window.localStorage.removeItem(k));
                } catch {
                  // ignore storage cleanup errors
                }
                try {
                  window.sessionStorage.clear();
                } catch {
                  // ignore sessionStorage cleanup errors
                }
                this.setState({ hasError: false });
                window.location.href = '/';
              }}
              className="emerald-btn w-full min-h-[42px] rounded-2xl text-sm font-extrabold cursor-pointer"
            >
              العودة للرئيسية
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

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

const AuthenticatedAppShell: React.FC = () => {
  const { user, loading } = useAuth();
  const {
    activeRoomId,
    room,
    isMinimized: isRoomMinimized,
    setExitModalOpen,
    minimizeRoom,
    leaveActiveRoom,
  } = useActiveRoom();
  const location = useLocation();
  const navigate = useNavigate();

  const handleMinimizeRoom = useCallback(() => {
    try {
      setExitModalOpen?.(false);
      minimizeRoom?.();
      if (location.pathname.startsWith('/room/')) {
        navigate('/', { replace: true });
      }
    } catch (err) {
      console.error('Minimize room error:', err);
    }
  }, [location.pathname, minimizeRoom, navigate, setExitModalOpen]);

  const handleLeaveRoom = useCallback(async () => {
    try {
      setExitModalOpen?.(false);
      void leaveActiveRoom?.();
      if (location.pathname !== '/') {
        navigate('/', { replace: true });
      }
    } catch (err) {
      console.error('Leave room error:', err);
    }
  }, [leaveActiveRoom, location.pathname, navigate, setExitModalOpen]);

  const handlersRef = useRef({
    handleMinimizeRoom,
    handleLeaveRoom,
  });
  handlersRef.current = {
    handleMinimizeRoom,
    handleLeaveRoom,
  };

  useEffect(() => {
    window.minimizeCurrentRoom = () => {
      try {
        handlersRef.current?.handleMinimizeRoom?.();
      } catch (err) {
        console.error('window.minimizeCurrentRoom error:', err);
      }
    };
    window.exitCurrentRoom = async () => {
      try {
        await handlersRef.current?.handleLeaveRoom?.();
      } catch (err) {
        console.error('window.exitCurrentRoom error:', err);
      }
    };
    return () => {
      delete window.minimizeCurrentRoom;
      delete window.exitCurrentRoom;
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F6FA] flex items-center justify-center">
        <div className="light-card rounded-2xl px-6 py-4 text-sm font-extrabold text-emerald-700">
          جارٍ تجهيز الوكالة الصوتية...
        </div>
      </div>
    );
  }

  if (location.pathname === '/login') {
    return <LoginRoute />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const isOnRoomRoute = location.pathname.startsWith('/room/');
  const isFullScreenRoom =
    Boolean(activeRoomId && !isRoomMinimized) || (isOnRoomRoute && !isRoomMinimized);
  const shouldKeepRoomMounted = Boolean(activeRoomId || room || isOnRoomRoute);

  return (
    <div className="min-h-screen flex flex-col">
      {!isFullScreenRoom && <TopBar />}
      <main className={isFullScreenRoom ? 'hidden' : 'flex-1'}>
        <Routes>
          <Route path="/" element={<LobbyPage />} />
          <Route path="/meet" element={<MeetPage />} />
          <Route path="/room/:id" element={<RoomRouteBridge />} />
          <Route path="/competitions" element={<CompetitionsPage />} />
          <Route path="/games" element={<GamesCenterPage />} />
          <Route path="/store" element={<StorePage />} />
          <Route path="/bag" element={<BagPage />} />
          <Route path="/diamond-wallet" element={<DiamondWalletPage />} />
          <Route path="/my-level" element={<MyLevelPage />} />
          <Route path="/wallet" element={<WalletPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/messages" element={<MessagesPage />} />
          <Route path="/agency" element={<AgencyPage />} />
          <Route
            path="/admin"
            element={
              isSuperAdminUser(user) ? <AdminPage /> : <Navigate to="/" replace />
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
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

export default function App() {
  return (
    <AppErrorBoundary>
      <AuthProvider>
        <ActiveRoomProvider>
          <MiniProfileProvider>
            <OfflineIndicator />
            <HashRouter>
              <AuthenticatedAppShell />
            </HashRouter>
          </MiniProfileProvider>
        </ActiveRoomProvider>
      </AuthProvider>
    </AppErrorBoundary>
  );
}
