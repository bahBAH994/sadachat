/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Component, useEffect, useRef } from 'react';
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
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): { hasError: boolean; error: Error | null } {
    return { hasError: true, error };
  }

  componentDidCatch(error: unknown) {
    console.error('SADA Runtime ErrorBoundary caught:', error);
    if (error instanceof Error && !this.state.error) {
      this.setState({ error });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F5F6FA] flex flex-col items-center justify-center p-6 text-center space-y-4">
          <div className="light-card rounded-3xl p-6 max-w-md w-full space-y-3">
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
                try {
                  if ('serviceWorker' in navigator) {
                    void navigator.serviceWorker
                      .getRegistrations()
                      .then((regs) => regs.forEach((r) => void r.unregister()))
                      .catch(() => {});
                  }
                } catch {
                  // ignore sw cleanup errors
                }
                this.setState({ hasError: false, error: null });
                window.location.href = '/';
              }}
              className="emerald-btn w-full min-h-[42px] rounded-2xl text-sm font-extrabold cursor-pointer"
            >
              العودة للرئيسية
            </button>

            <div
              dir="ltr"
              className="rounded-xl bg-rose-50 border border-rose-300 p-3 text-left text-[11px] text-rose-800 max-h-48 overflow-auto select-text"
            >
              <p className="font-bold text-rose-900 break-words">
                {this.state.error?.message || 'Unknown error'}
              </p>
              {this.state.error?.stack && (
                <pre className="mt-1.5 whitespace-pre-wrap break-all font-mono text-[10px] text-rose-700 leading-snug">
                  {this.state.error.stack}
                </pre>
              )}
            </div>
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
  const { activeRoomId, room, isMinimized, loading, enterRoom, restoreRoom } = useActiveRoom();
  const handledRouteKeyRef = useRef<string | null>(null);
  const hasEnteredRef = useRef(false);

  useEffect(() => {
    if (!id || !user?.id) return;
    const routeKey = `${user.id}:${id}`;
    if (handledRouteKeyRef.current === routeKey) return;
    handledRouteKeyRef.current = routeKey;
    hasEnteredRef.current = true;

    if (activeRoomId === id && room) {
      restoreRoom();
    } else {
      void enterRoom(id);
    }
  }, [activeRoomId, enterRoom, id, restoreRoom, room, user?.id]);

  if (isMinimized) {
    return <LobbyPage />;
  }

  if (hasEnteredRef.current && !activeRoomId && !loading) {
    return <Navigate to="/" replace />;
  }

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
    loading: roomLoading,
    isMinimized: isRoomMinimized,
    setExitModalOpen,
    minimizeRoom,
    leaveActiveRoom,
  } = useActiveRoom();
  const location = useLocation();

  useEffect(() => {
    const handleMinimizeEvent = () => {
      setExitModalOpen(false);
      minimizeRoom();
    };
    const handleLeaveEvent = () => {
      setExitModalOpen(false);
      void leaveActiveRoom();
    };
    window.addEventListener('sada:minimize', handleMinimizeEvent);
    window.addEventListener('sada:leave', handleLeaveEvent);
    return () => {
      window.removeEventListener('sada:minimize', handleMinimizeEvent);
      window.removeEventListener('sada:leave', handleLeaveEvent);
    };
  }, [leaveActiveRoom, minimizeRoom, setExitModalOpen]);

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

  const isFullScreenRoom = Boolean((activeRoomId || roomLoading) && !isRoomMinimized);
  const shouldKeepRoomMounted = Boolean(activeRoomId || room || roomLoading);

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
        <div
          style={{ display: isRoomMinimized ? 'none' : 'flex' }}
          className="fixed inset-0 z-40 flex-col overflow-hidden bg-[#0A0805] text-white"
        >
          <RoomPage />
        </div>
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
