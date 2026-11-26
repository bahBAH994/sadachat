import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useActiveRoom } from '../context/ActiveRoomContext';
import { FriendsIcon, InboxIcon, PartyIcon, ProfileIcon } from './AppIcons';

export const BottomNav: React.FC = () => {
  const { user } = useAuth();
  const { isMinimized } = useActiveRoom();
  const location = useLocation();

  if (!user) return null;
  if (location.pathname.startsWith('/room/') && !isMinimized) return null;

  const items = [
    { to: '/', label: 'الحفلة', icon: PartyIcon },
    { to: '/meet', label: 'الأصدقاء', icon: FriendsIcon },
    { to: '/messages', label: 'الرسائل', icon: InboxIcon },
    { to: '/profile', label: 'ملفي', icon: ProfileIcon },
  ];

  return (
    <nav
      aria-label="التنقل الرئيسي"
      className="fixed bottom-0 left-0 right-0 z-40 bg-[#090C14]/95 backdrop-blur-xl border-t border-amber-300/15 shadow-[0_-8px_30px_rgba(0,0,0,0.35)] pt-1.5 pb-[max(env(safe-area-inset-bottom,0px),14px)] px-2"
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
                isActive ? 'text-[#FCE9A6]' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <div
                className={`w-9 h-8 rounded-xl flex items-center justify-center transition-all ${
                  isActive
                    ? 'bg-gradient-to-br from-[#FCE9A6] via-[#D4AF37] to-[#9A6D18] text-[#17120A] shadow-[0_4px_16px_rgba(212,175,55,0.32)]'
                    : ''
                }`}
              >
                <Icon className="w-6 h-6" />
              </div>
              <span
                className={`text-[11px] mt-0.5 leading-none ${
                  isActive ? 'font-extrabold text-[#FCE9A6]' : 'font-semibold'
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
