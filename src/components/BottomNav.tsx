import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Building2,
  Gamepad2,
  MessageCircleHeart,
  Mic2,
  ShieldCheck,
  Trophy,
  UserCircle2,
  Wallet,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const BottomNav: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) return null;
  if (location.pathname.startsWith('/room/')) return null;

  const items = [
    { to: '/', label: 'المجالس', icon: Mic2 },
    { to: '/competitions', label: 'المسابقات', icon: Trophy },
    { to: '/games', label: 'مركز الألعاب', icon: Gamepad2 },
    { to: '/messages', label: 'الرسائل', icon: MessageCircleHeart },
    { to: '/agency', label: 'الوكالات', icon: Building2 },
    { to: '/wallet', label: 'الخزنة', icon: Wallet },
    { to: '/profile', label: 'حسابي', icon: UserCircle2 },
    ...(user.is_admin ? [{ to: '/admin', label: 'الإدارة', icon: ShieldCheck }] : []),
  ];

  return (
    <nav
      aria-label="التنقل الرئيسي"
      className="fixed bottom-3 left-2 right-2 z-40 pointer-events-none pb-safe"
    >
      <div className="max-w-3xl mx-auto royal-glass rounded-2xl px-1.5 py-1.5 pointer-events-auto flex items-center justify-around gap-0.5 overflow-x-auto no-scrollbar shadow-[0_12px_40px_rgba(0,0,0,0.75)]">
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
              className={`relative flex flex-col items-center justify-center min-h-[44px] min-w-[44px] px-1.5 py-1 rounded-xl transition-all duration-200 whitespace-nowrap ${
                isActive
                  ? 'text-[#FCE9A6]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {isActive && (
                <span className="absolute inset-0 rounded-xl bg-gradient-to-b from-[#D4AF37]/20 to-transparent border border-[#D4AF37]/30 shadow-[0_0_16px_rgba(212,175,55,0.28)]" />
              )}
              <Icon
                className={`relative w-5 h-5 transition-transform duration-200 ${
                  isActive ? 'scale-110 drop-shadow-[0_0_8px_rgba(243,211,122,0.8)]' : ''
                }`}
              />
              <span className="relative text-[11px] font-semibold mt-0.5 leading-none">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};
