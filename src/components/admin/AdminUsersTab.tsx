import React, { useMemo, useState } from 'react';
import {
  Ban,
  CheckCircle2,
  Coins,
  Crown,
  Minus,
  Plus,
  Search,
  ShieldCheck,
  Users,
} from 'lucide-react';
import {
  formatShortNumericId,
  getUserVipTierInfo,
  SUPER_ADMIN_EMAIL,
} from '../../lib/sadaCatalog';
import { AvatarWithFrame } from '../AvatarWithFrame';
import type { User, VipTierKey } from '../../types';

export type AdminUserRoleChoice = 'user' | 'vip1' | 'vip2' | 'vip3' | 'svip' | 'admin';

interface AdminUsersTabProps {
  users: User[];
  search: string;
  onSearchChange: (value: string) => void;
  onCoinsAdjust: (targetId: string, delta: number) => Promise<void>;
  onRoleChange: (target: User, roleChoice: AdminUserRoleChoice) => Promise<void>;
  onToggleBan: (target: User) => Promise<void>;
}

type UserFilter = 'all' | 'vip' | 'admins' | 'banned';

export const AdminUsersTab: React.FC<AdminUsersTabProps> = ({
  users,
  search,
  onSearchChange,
  onCoinsAdjust,
  onRoleChange,
  onToggleBan,
}) => {
  const [filter, setFilter] = useState<UserFilter>('all');
  const [coinDrafts, setCoinDrafts] = useState<Record<string, string>>({});
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      const shortId = formatShortNumericId(u.id).toLowerCase();
      const vipInfo = getUserVipTierInfo(u);
      const matchesSearch =
        !q ||
        u.displayName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.id.toLowerCase().includes(q) ||
        shortId.includes(q);

      if (!matchesSearch) return false;
      if (filter === 'admins') return Boolean(u.is_admin || u.role === 'admin');
      if (filter === 'vip') return vipInfo.key !== 'none';
      if (filter === 'banned') return Boolean(u.is_banned);
      return true;
    });
  }, [users, search, filter]);

  const counts = useMemo(() => {
    let vipCount = 0;
    let adminCount = 0;
    let bannedCount = 0;
    for (const u of users) {
      if (getUserVipTierInfo(u).key !== 'none') vipCount += 1;
      if (u.is_admin || u.role === 'admin') adminCount += 1;
      if (u.is_banned) bannedCount += 1;
    }
    return { total: users.length, vipCount, adminCount, bannedCount };
  }, [users]);

  const runAction = async (userId: string, fn: () => Promise<void>) => {
    setBusyUserId(userId);
    try {
      await fn();
    } finally {
      setBusyUserId((prev) => (prev === userId ? null : prev));
    }
  };

  const getCoinAmount = (userId: string) => {
    const raw = coinDrafts[userId] ?? '1000';
    const parsed = Math.floor(Number(raw) || 0);
    return Math.max(1, parsed);
  };

  const resolveCurrentRoleChoice = (u: User, vipKey: VipTierKey): AdminUserRoleChoice => {
    if (u.is_admin || u.role === 'admin') return 'admin';
    if (vipKey === 'vip1' || vipKey === 'vip2' || vipKey === 'vip3' || vipKey === 'svip') {
      return vipKey;
    }
    return 'user';
  };

  return (
    <section className="space-y-4">
      <div className="royal-glass rounded-3xl p-4 sm:p-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-[#D4AF37]/15 border border-[#D4AF37]/40 flex items-center justify-center text-[#FCE9A6]">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-[#FCE9A6]">
                إدارة المستخدمين ({filteredUsers.length} / {users.length})
              </h2>
              <p className="text-xs text-slate-400">
                ابحث بالاسم أو الـ ID وعدّل الرصيد أو الرتبة أو حالة الحظر فورياً
              </p>
            </div>
          </div>

          <div className="relative w-full lg:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="بحث بالاسم، ID الرقمي، أو البريد..."
              className="w-full min-h-[44px] rounded-2xl bg-[#070913]/90 border border-[#D4AF37]/30 pr-10 pl-3.5 text-xs sm:text-sm text-white placeholder:text-slate-400 focus:outline-none focus:border-[#D4AF37]"
            />
          </div>
        </div>

        {/* Filter Chips */}
        <div className="flex items-center gap-2 overflow-x-auto touch-pan-x no-scrollbar pb-1">
          {(
            [
              { id: 'all', label: `الكل (${counts.total})` },
              { id: 'vip', label: `VIP (${counts.vipCount})` },
              { id: 'admins', label: `الإدارة (${counts.adminCount})` },
              { id: 'banned', label: `المحظورون (${counts.bannedCount})` },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              className={`min-h-[38px] rounded-xl px-3.5 text-xs font-bold whitespace-nowrap shrink-0 border cursor-pointer transition ${
                filter === item.id
                  ? 'bg-[#D4AF37] border-[#FCE9A6] text-[#070913]'
                  : 'bg-[#070913]/75 border-white/10 text-slate-300 hover:border-[#D4AF37]/40'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {filteredUsers.length === 0 ? (
        <div className="royal-glass rounded-3xl p-8 text-center text-xs sm:text-sm text-slate-400">
          لا يوجد مستخدمون مطابقون لنتيجة البحث الحالية.
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {filteredUsers.map((u) => {
            const shortId = formatShortNumericId(u.id);
            const vipInfo = getUserVipTierInfo(u);
            const isProtectedSuper = u.email.toLowerCase() === SUPER_ADMIN_EMAIL;
            const roleChoice = resolveCurrentRoleChoice(u, vipInfo.key);
            const isBusy = busyUserId === u.id;
            const coinInputVal = coinDrafts[u.id] ?? '1000';

            return (
              <article
                key={u.id}
                className={`royal-glass rounded-3xl p-4 sm:p-5 space-y-3.5 border transition ${
                  u.is_banned
                    ? 'border-rose-500/45 bg-rose-950/15'
                    : 'border-[#D4AF37]/25'
                }`}
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <AvatarWithFrame
                      src={u.avatarUrl}
                      alt={u.displayName}
                      frameId={u.frameId}
                      vipTier={vipInfo.key}
                      size="md"
                    />
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <h3 className="text-sm sm:text-base font-extrabold text-white truncate max-w-[180px] sm:max-w-[230px]">
                          {u.displayName}
                        </h3>
                        <span
                          dir="ltr"
                          className="rounded-lg bg-white/10 border border-white/15 px-2 py-0.5 text-[10px] font-mono-num font-bold text-slate-200"
                        >
                          ID: {shortId}
                        </span>
                        {u.femaleVerifiedBadge && (
                          <span className="rounded-lg bg-pink-500/20 border border-pink-400/40 px-2 py-0.5 text-[10px] font-bold text-pink-200">
                            {u.femaleVerifiedBadge}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 truncate" dir="ltr">
                        {u.email}
                      </p>
                    </div>
                  </div>

                  {/* Role & Ban Status Badges */}
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {u.is_admin || u.role === 'admin' ? (
                      <span className="inline-flex items-center gap-1 rounded-xl bg-amber-500/20 border border-[#D4AF37]/60 px-2.5 py-1 text-[11px] font-extrabold text-[#FCE9A6]">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>إدارة</span>
                      </span>
                    ) : vipInfo.key !== 'none' ? (
                      <span
                        className={`inline-flex items-center gap-1 rounded-xl border px-2.5 py-1 text-[11px] font-extrabold ${vipInfo.badgeBgClass} ${vipInfo.badgeTextClass}`}
                      >
                        <Crown className="w-3 h-3" />
                        <span>{vipInfo.shortLabel}</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-xl bg-white/5 border border-white/15 px-2.5 py-1 text-[11px] font-bold text-slate-300">
                        مستخدم
                      </span>
                    )}

                    {u.is_banned && (
                      <span className="inline-flex items-center gap-1 rounded-xl bg-rose-500/25 border border-rose-400/60 px-2 py-0.5 text-[10px] font-extrabold text-rose-200">
                        <Ban className="w-3 h-3" />
                        <span>محظور</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Live Balances */}
                <div className="grid grid-cols-3 gap-2 rounded-2xl bg-[#070913]/80 border border-white/10 p-2.5 text-center">
                  <div>
                    <span className="block text-[10px] text-slate-400">الكوينز</span>
                    <span className="text-xs sm:text-sm font-extrabold font-mono-num text-[#FCE9A6]">
                      {(u.coins || 0).toLocaleString('en-US')}
                    </span>
                  </div>
                  <div className="border-x border-white/10">
                    <span className="block text-[10px] text-slate-400">الألماس</span>
                    <span className="text-xs sm:text-sm font-extrabold font-mono-num text-sky-300">
                      {(u.diamonds || 0).toLocaleString('en-US')} 💎
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-400">المستوى</span>
                    <span className="text-xs sm:text-sm font-extrabold font-mono-num text-emerald-300">
                      Lv.{u.level || 1}
                    </span>
                  </div>
                </div>

                {/* Direct Coins Adjustment Bar */}
                <div className="rounded-2xl bg-[#070913]/75 border border-[#D4AF37]/20 p-2.5 space-y-2">
                  <div className="flex items-center justify-between text-[11px] text-slate-300">
                    <span className="flex items-center gap-1 font-bold text-[#FCE9A6]">
                      <Coins className="w-3.5 h-3.5 text-[#D4AF37]" />
                      <span>شحن / خصم العملات الفوري</span>
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void runAction(u.id, () => onCoinsAdjust(u.id, 5000))}
                        className="rounded-lg bg-[#D4AF37]/20 border border-[#D4AF37]/40 px-2 py-0.5 text-[10px] font-bold text-[#FCE9A6] hover:bg-[#D4AF37]/30 cursor-pointer disabled:opacity-50"
                      >
                        +5,000
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void runAction(u.id, () => onCoinsAdjust(u.id, -1000))}
                        className="rounded-lg bg-rose-950/60 border border-rose-500/40 px-2 py-0.5 text-[10px] font-bold text-rose-200 hover:bg-rose-900/60 cursor-pointer disabled:opacity-50"
                      >
                        -1,000
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      value={coinInputVal}
                      onChange={(e) =>
                        setCoinDrafts((prev) => ({ ...prev, [u.id]: e.target.value }))
                      }
                      dir="ltr"
                      aria-label={`مقدار العملات للعضو ${u.displayName}`}
                      className="w-28 sm:flex-1 min-h-[40px] rounded-xl bg-[#0B0F20] border border-[#D4AF37]/30 px-3 text-xs font-mono-num text-white text-left focus:outline-none focus:border-[#D4AF37]"
                    />
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() =>
                        void runAction(u.id, () => onCoinsAdjust(u.id, getCoinAmount(u.id)))
                      }
                      className="flex-1 sm:flex-initial min-h-[40px] rounded-xl bg-emerald-600 hover:bg-emerald-500 border border-emerald-400/50 px-3.5 text-xs font-extrabold text-white flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>شحن</span>
                    </button>
                    <button
                      type="button"
                      disabled={isBusy || (u.coins || 0) <= 0}
                      onClick={() =>
                        void runAction(u.id, () => onCoinsAdjust(u.id, -getCoinAmount(u.id)))
                      }
                      className="flex-1 sm:flex-initial min-h-[40px] rounded-xl bg-rose-700 hover:bg-rose-600 border border-rose-400/50 px-3.5 text-xs font-extrabold text-white flex items-center justify-center gap-1 cursor-pointer disabled:opacity-45"
                    >
                      <Minus className="w-3.5 h-3.5" />
                      <span>خصم</span>
                    </button>
                  </div>
                </div>

                {/* Rank & Ban Direct Controls */}
                <div className="flex flex-wrap items-center gap-2 pt-0.5">
                  <div className="flex-1 min-w-[165px]">
                    <select
                      disabled={isBusy || isProtectedSuper}
                      value={roleChoice}
                      onChange={(e) =>
                        void runAction(u.id, () =>
                          onRoleChange(u, e.target.value as AdminUserRoleChoice)
                        )
                      }
                      aria-label={`تغيير رتبة ${u.displayName}`}
                      className="w-full min-h-[42px] rounded-xl bg-[#070913]/90 border border-[#D4AF37]/35 px-3 text-xs font-bold text-[#FCE9A6] focus:outline-none focus:border-[#D4AF37] disabled:opacity-55 cursor-pointer"
                    >
                      <option value="user">الرتبة: مستخدم عادي</option>
                      <option value="vip1">الرتبة: VIP 1 (البرونز)</option>
                      <option value="vip2">الرتبة: VIP 2 (الفضي)</option>
                      <option value="vip3">الرتبة: VIP 3 (الذهبي)</option>
                      <option value="svip">الرتبة: SVIP الإمبراطوري</option>
                      <option value="admin">الرتبة: إدارة عليا</option>
                    </select>
                  </div>

                  {!isProtectedSuper ? (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => void runAction(u.id, () => onToggleBan(u))}
                      className={`min-h-[42px] rounded-xl px-4 text-xs font-extrabold border flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 transition ${
                        u.is_banned
                          ? 'bg-emerald-600 hover:bg-emerald-500 border-emerald-400/60 text-white'
                          : 'bg-rose-950/75 hover:bg-rose-900/80 border-rose-500/50 text-rose-200'
                      }`}
                    >
                      {u.is_banned ? (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>تفعيل الحساب</span>
                        </>
                      ) : (
                        <>
                          <Ban className="w-4 h-4" />
                          <span>حظر الحساب</span>
                        </>
                      )}
                    </button>
                  ) : (
                    <span className="min-h-[42px] inline-flex items-center rounded-xl bg-[#D4AF37]/15 border border-[#D4AF37]/40 px-3 text-[11px] font-bold text-[#FCE9A6]">
                      المدير العام المحمي
                    </span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};
