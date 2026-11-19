import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Coins, Crown, Gem, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { resolveAsset } from '../lib/assets';
import { isSuperAdminUser } from '../lib/sadaCatalog';
import { PWAInstallButton } from './PWAInstallButton';

export const TopBar: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  if (!user) return null;

  // Primary screenshot-matched tabs render their own tailored headers
  const isCustomHeaderRoute =
    location.pathname === '/' ||
    location.pathname === '/messages' ||
    location.pathname === '/profile' ||
    location.pathname.startsWith('/room/');

  if (isCustomHeaderRoute) return null;

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur-xl">
      <div className="max-w-5xl mx-auto px-3 sm:px-5 h-14 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 cursor-pointer transition"
            aria-label="رجوع"
          >
            <ArrowRight className="w-4 h-4" />
          </button>

          <Link to="/" className="flex items-center gap-2 shrink-0 whitespace-nowrap">
            <img
              src={resolveAsset('emblem')}
              alt="شعار صَدَى"
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              className="w-8 h-8 rounded-xl object-cover border border-amber-300 shadow-sm"
            />
            <span className="text-base font-extrabold text-slate-900">صَدَى - SADA</span>
          </Link>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar">
          <Link
            to="/wallet"
            title="رصيد الكوينز"
            className="flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-1 text-xs font-extrabold text-amber-800 whitespace-nowrap shrink-0"
          >
            <Coins className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span className="font-mono-num">{user.coins.toLocaleString('en-US')}</span>
          </Link>

          <Link
            to="/bag"
            title="محفظة الألماس والحقيبة"
            className="flex items-center gap-1 rounded-full bg-sky-50 border border-sky-200 px-2.5 py-1 text-xs font-extrabold text-sky-800 whitespace-nowrap shrink-0"
          >
            <Gem className="w-3.5 h-3.5 text-sky-500 shrink-0" />
            <span className="font-mono-num">{user.diamonds.toLocaleString('en-US')}</span>
          </Link>

          <Link
            to="/profile"
            className="flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-xs font-extrabold text-emerald-700 whitespace-nowrap shrink-0"
          >
            <Crown className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span className="font-mono-num">Lv.{user.level}</span>
          </Link>

          <div className="hidden sm:flex items-center">
            <PWAInstallButton variant="compact" />
          </div>

          {isSuperAdminUser(user) && (
            <Link
              to="/admin"
              className="flex items-center gap-1 rounded-full bg-slate-900 text-[#FCE9A6] px-2.5 py-1 text-xs font-bold whitespace-nowrap shrink-0"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span className="hidden md:inline">الإدارة</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
};
