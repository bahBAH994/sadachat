import React from 'react';
import { Link } from 'react-router-dom';
import { Coins, Crown, Gem, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { resolveAsset } from '../lib/assets';
import { PWAInstallButton } from './PWAInstallButton';

export const TopBar: React.FC = () => {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <header className="sticky top-0 z-40 border-b border-[#D4AF37]/15 bg-[#070913]/85 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 h-14 flex items-center justify-between gap-2 sm:gap-4">
        <Link
          to="/"
          className="flex items-center gap-2.5 shrink-0 whitespace-nowrap group"
        >
          <img
            src={resolveAsset('emblem')}
            alt="شعار صَدَى"
            referrerPolicy="no-referrer"
            className="w-8 h-8 rounded-xl object-cover border border-[#D4AF37]/40 shadow-[0_0_12px_rgba(212,175,55,0.25)]"
          />
          <span className="text-base sm:text-lg font-extrabold tracking-tight gold-gradient-text">
            صَدَى
          </span>
        </Link>

        <div className="flex items-center gap-1.5 sm:gap-2.5 overflow-x-auto no-scrollbar">
          <Link
            to="/wallet"
            title="رصيد الكوينز"
            className="royal-capsule flex items-center gap-1.5 rounded-full px-2.5 sm:px-3 py-1 text-xs font-bold text-[#F7E097] hover:border-[#D4AF37]/60 transition whitespace-nowrap shrink-0"
          >
            <Coins className="w-3.5 h-3.5 text-[#D4AF37] shrink-0" />
            <span className="font-mono-num">{user.coins.toLocaleString('en-US')}</span>
          </Link>

          <Link
            to="/wallet"
            title="رصيد الألماس"
            className="royal-capsule flex items-center gap-1.5 rounded-full px-2.5 sm:px-3 py-1 text-xs font-bold text-sky-200 hover:border-sky-400/50 transition whitespace-nowrap shrink-0"
          >
            <Gem className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            <span className="font-mono-num">{user.diamonds.toLocaleString('en-US')}</span>
          </Link>

          <Link
            to="/profile"
            title="المستوى الملكي"
            className="royal-capsule flex items-center gap-1 rounded-full px-2.5 sm:px-3 py-1 text-xs font-bold text-amber-200 hover:border-[#D4AF37]/60 transition whitespace-nowrap shrink-0"
          >
            <Crown className="w-3.5 h-3.5 text-[#F3D37A] shrink-0" />
            <span className="font-mono-num">Lv.{user.level}</span>
          </Link>

          <div className="hidden sm:flex items-center gap-2">
            <PWAInstallButton variant="compact" />
          </div>

          {user.is_admin && (
            <Link
              to="/admin"
              className="flex items-center gap-1 rounded-full bg-gradient-to-r from-[#D4AF37]/25 to-[#F3D37A]/15 border border-[#D4AF37]/50 px-2.5 sm:px-3 py-1 text-xs font-bold text-[#FCE9A6] hover:bg-[#D4AF37]/30 transition whitespace-nowrap shrink-0"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-[#F3D37A] shrink-0" />
              <span className="hidden md:inline">الإدارة</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
};
