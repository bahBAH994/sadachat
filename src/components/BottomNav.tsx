import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Compass, Home, MessageCircle, UserCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useActiveRoom } from '../context/ActiveRoomContext';

export const BottomNav: React.FC = () => {
  const { user } = useAuth();
  const { isMinimized } = useActiveRoom();
  const location = useLocation();

  if (!user) return null;
  if (location.pathname.startsWith('/room/') && !isMinimized) return null;

  const items = [
    { to: '/', label: 'حفلة', icon: Home },
    { to: '/meet', label: 'الأصدقاء', icon: Compass },
    { to: '/messages', label: 'صندوق الوارد', icon: MessageCircle },
    { to: '/profile', label: 'شخصي', icon: UserCircle2 },
  ];

  return (
    <nav
      aria-label="التنقل الرئيسي"
      className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 border-t border-slate-200/80 shadow-[0_-6px_26px_rgba(15,23,42,0.08)] pt-1.5 pb-[max(env(safe-area-inset-bottom,0px),14px)] px-2"
    >
      <div className="max-w-xl mx-auto grid grid-cols-4 items-center gap-1">
        {items.map((item) => {
          const isActive =
            item.to === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(item.to);
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`relative flex flex-col items-center justify-center min-h-[46px] py-1 rounded-2xl transition-all duration-150 ${
                isActive ? 'text-emerald-600' : 'text-slate-400 hover:text-slate-700'
              }`}
            >
              <div
                className={`w-9 h-8 rounded-xl flex items-center justify-center transition-all ${
                  isActive
                    ? 'bg-gradient-to-br from-[#22E568] to-[#10B981] text-white shadow-[0_4px_14px_rgba(16,185,129,0.45)]'
                    : ''
                }`}
              >
                <Icon className="w-5 h-5" />
              </div>
              <span
                className={`text-[11px] mt-0.5 leading-none ${
                  isActive ? 'font-extrabold text-emerald-700' : 'font-semibold'
                }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};
