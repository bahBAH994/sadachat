import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Check, Coins, MessageCircleHeart, Plus, Sparkles, Users, X } from 'lucide-react';
import { resolveAsset } from '../lib/assets';
import type { GiftItem, Room } from '../types';

interface RoomGiftDrawerProps {
  room: Room;
  gifts: GiftItem[];
  userCoins: number;
  currentUserId?: string;
  initialTargets?: string[];
  sending: boolean;
  onSend: (giftId: string, targetUserIds: string[], quantity: number) => Promise<void>;
  onOpenPM: (userId: string) => void;
  onRecharge: () => void;
  onClose: () => void;
}

const QUANTITIES = [1, 9, 25, 50, 100] as const;

const FEATURED_LUXURY_IDS = new Set([
  'gift_01',
  'gift_02',
  'gift_03',
  'gift_04',
  'gift_05',
  'gift_06',
  'gift_07',
]);

export const RoomGiftDrawer: React.FC<RoomGiftDrawerProps> = ({
  room,
  gifts,
  userCoins,
  currentUserId,
  initialTargets,
  sending,
  onSend,
  onOpenPM,
  onRecharge,
  onClose,
}) => {
  const seatedSpeakers = useMemo(
    () => room.seats.filter((s) => Boolean(s.userId)),
    [room.seats]
  );

  const defaultSelection = useMemo(() => {
    if (initialTargets && initialTargets.length > 0) return initialTargets;
    if (seatedSpeakers.length > 0) {
      const nonSelf = seatedSpeakers.find((s) => s.userId && s.userId !== currentUserId);
      return [nonSelf?.userId || seatedSpeakers[0].userId!];
    }
    return [room.hostId];
  }, [currentUserId, initialTargets, room.hostId, seatedSpeakers]);

  const [selectedTargetIds, setSelectedTargetIds] = useState<string[]>(defaultSelection);

  useEffect(() => {
    if (initialTargets && initialTargets.length > 0) {
      setSelectedTargetIds(initialTargets);
    }
  }, [initialTargets]);

  const [giftTab, setGiftTab] = useState<'fixed' | 'lucky' | 'history'>('fixed');
  const [quantity, setQuantity] = useState<number>(1);
  const [selectedGiftId, setSelectedGiftId] = useState<string>(() => {
    const firstFixed = gifts.find((g) => g.category !== 'lucky');
    return firstFixed?.id || gifts[0]?.id || 'gift_01';
  });

  const fixedGifts = useMemo(
    () => gifts.filter((g) => g.category !== 'lucky'),
    [gifts]
  );
  const luckyGifts = useMemo(
    () => gifts.filter((g) => g.category === 'lucky'),
    [gifts]
  );

  const visibleGifts = giftTab === 'lucky' ? luckyGifts : fixedGifts;
  const selectedGift = useMemo(
    () =>
      gifts.find((g) => g.id === selectedGiftId) ||
      visibleGifts[0] ||
      gifts[0] ||
      null,
    [gifts, selectedGiftId, visibleGifts]
  );

  const allSeatedIds = useMemo(
    () => seatedSpeakers.map((s) => s.userId!).filter(Boolean),
    [seatedSpeakers]
  );

  const hostIsSeated = useMemo(
    () => seatedSpeakers.some((s) => s.userId === room.hostId),
    [room.hostId, seatedSpeakers]
  );

  const isAllSelected =
    allSeatedIds.length > 0 &&
    allSeatedIds.every((id) => selectedTargetIds.includes(id));

  const toggleAllSeated = () => {
    if (allSeatedIds.length === 0) {
      setSelectedTargetIds([room.hostId]);
      return;
    }
    if (isAllSelected) {
      setSelectedTargetIds([allSeatedIds[0]]);
    } else {
      setSelectedTargetIds(allSeatedIds);
    }
  };

  const toggleTarget = (uid: string) => {
    setSelectedTargetIds((prev) => {
      if (prev.includes(uid)) {
        if (prev.length === 1) return prev;
        return prev.filter((id) => id !== uid);
      }
      return [...prev, uid];
    });
  };

  const effectiveTargetCount = Math.max(1, selectedTargetIds.length);
  const totalCost = selectedGift
    ? selectedGift.coinsCost * quantity * effectiveTargetCount
    : 0;
  const canAfford = totalCost <= userCoins;

  const singlePmTarget =
    selectedTargetIds.length === 1 && selectedTargetIds[0] !== currentUserId
      ? selectedTargetIds[0]
      : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 70, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 70, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl rounded-t-[28px] border-t border-x border-[#F3D37A]/45 bg-gradient-to-b from-[#1A140B]/98 via-[#110D08]/98 to-[#090704] shadow-[0_-18px_50px_rgba(0,0,0,0.85)] flex flex-col max-h-[82dvh] overflow-hidden"
      >
        {/* Top Drawer Header */}
        <div className="flex items-center justify-between px-4 pt-3.5 pb-2 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-[#FDE047] via-[#D4AF37] to-[#9A6E13] flex items-center justify-center shadow-[0_0_16px_rgba(243,211,122,0.5)] text-lg">
              🎁
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-extrabold gold-gradient-text leading-tight">
                صندوق الهدايا الملكية 3D
              </h3>
              <div className="flex items-center gap-1 text-[11px] font-mono-num text-amber-200/90">
                <Coins className="w-3 h-3 text-[#FCE9A6]" />
                <span>رصيدك: {userCoins.toLocaleString('en-US')} كوينز</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {singlePmTarget && (
              <button
                type="button"
                onClick={() => onOpenPM(singlePmTarget)}
                className="inline-flex items-center gap-1 rounded-full border border-[#D4AF37]/45 bg-[#D4AF37]/15 px-2.5 py-1 text-[10px] font-extrabold text-[#FCE9A6] cursor-pointer"
              >
                <MessageCircleHeart className="w-3.5 h-3.5" />
                <span>رسالة خاصة</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 flex items-center justify-center cursor-pointer"
              aria-label="إغلاق"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Horizontal Seated Speakers Recipient Bar + "الكل" Toggle */}
        <div className="px-4 py-2.5 bg-black/35 border-b border-white/10 shrink-0">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-bold text-amber-100/90">
              اختر المُرسَل إليه ({selectedTargetIds.length}):
            </span>
            {seatedSpeakers.length > 1 && (
              <span className="text-[10px] text-amber-300/80">
                يمكنك اختيار أكثر من متحدث أو الكل
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5 overflow-x-auto no-scrollbar pb-1">
            {/* ALL Button */}
            <button
              type="button"
              onClick={toggleAllSeated}
              className="flex flex-col items-center gap-1 shrink-0 cursor-pointer group"
            >
              <div
                className={`relative w-11 h-11 rounded-full flex items-center justify-center border-2 transition ${
                  isAllSelected
                    ? 'bg-gradient-to-br from-[#FDE047] via-[#D4AF37] to-[#B45309] border-[#FFF3C4] text-[#070913] shadow-[0_0_16px_rgba(243,211,122,0.75)]'
                    : 'bg-white/10 border-white/25 text-amber-200 group-hover:border-[#F3D37A]/70'
                }`}
              >
                <Users className="w-4 h-4" />
                {isAllSelected && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border border-black text-white flex items-center justify-center">
                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                  </span>
                )}
              </div>
              <span
                className={`text-[10px] font-extrabold ${
                  isAllSelected ? 'text-[#FCE9A6]' : 'text-slate-300'
                }`}
              >
                الكل
              </span>
            </button>

            {/* Host Fallback Pill if Host is not seated */}
            {!hostIsSeated && (
              <button
                type="button"
                onClick={() => toggleTarget(room.hostId)}
                className="flex flex-col items-center gap-1 shrink-0 cursor-pointer"
              >
                <div
                  className={`relative w-11 h-11 rounded-full p-[2px] transition ${
                    selectedTargetIds.includes(room.hostId)
                      ? 'bg-gradient-to-tr from-[#FCE9A6] to-[#D4AF37] shadow-[0_0_14px_rgba(243,211,122,0.7)]'
                      : 'bg-white/20'
                  }`}
                >
                  <img
                    src={resolveAsset(room.hostAvatar)}
                    alt={room.hostName}
                    referrerPolicy="no-referrer"
                    className="w-full h-full rounded-full object-cover bg-[#14110B]"
                  />
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-[#D4AF37] text-[#070913] px-1 text-[8px] font-extrabold leading-tight">
                    مضيف
                  </span>
                  {selectedTargetIds.includes(room.hostId) && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border border-black text-white flex items-center justify-center">
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-bold text-slate-200 max-w-[48px] truncate">
                  {room.hostName}
                </span>
              </button>
            )}

            {/* Seated Mic Speakers */}
            {seatedSpeakers.map((seat) => {
              const uid = seat.userId!;
              const isSelected = selectedTargetIds.includes(uid);
              return (
                <button
                  key={seat.seatIndex}
                  type="button"
                  onClick={() => toggleTarget(uid)}
                  className="flex flex-col items-center gap-1 shrink-0 cursor-pointer group"
                >
                  <div
                    className={`relative w-11 h-11 rounded-full p-[2px] transition ${
                      isSelected
                        ? 'bg-gradient-to-tr from-[#FCE9A6] via-[#F3D37A] to-amber-500 shadow-[0_0_16px_rgba(243,211,122,0.75)] scale-105'
                        : 'bg-white/20 opacity-75 hover:opacity-100'
                    }`}
                  >
                    <img
                      src={resolveAsset(seat.avatarUrl)}
                      alt={seat.displayName || 'متحدث'}
                      referrerPolicy="no-referrer"
                      className="w-full h-full rounded-full object-cover bg-[#14110B]"
                    />
                    <span
                      className={`absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full px-1.5 text-[8px] font-mono-num font-extrabold leading-tight shadow ${
                        isSelected
                          ? 'bg-[#FCE9A6] text-[#070913]'
                          : 'bg-black/80 text-white border border-white/20'
                      }`}
                    >
                      {seat.seatIndex + 1}
                    </span>
                    {isSelected && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border border-black text-white flex items-center justify-center shadow">
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </span>
                    )}
                  </div>
                  <span
                    className={`text-[10px] font-bold max-w-[50px] truncate ${
                      isSelected ? 'text-[#FCE9A6]' : 'text-slate-300'
                    }`}
                  >
                    {seat.displayName}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Gift Tabs */}
        <div className="px-4 pt-2 pb-1.5 shrink-0">
          <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-black/55 border border-[#D4AF37]/25">
            {[
              { id: 'fixed', label: `هدايا 3D (${fixedGifts.length})` },
              { id: 'lucky', label: `هدايا الحظ 🎰 (${luckyGifts.length})` },
              { id: 'history', label: 'سجل الهدايا' },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  const next = t.id as 'fixed' | 'lucky' | 'history';
                  setGiftTab(next);
                  if (next === 'fixed' && fixedGifts[0]) {
                    setSelectedGiftId(fixedGifts[0].id);
                  } else if (next === 'lucky' && luckyGifts[0]) {
                    setSelectedGiftId(luckyGifts[0].id);
                  }
                }}
                className={`flex-1 min-h-[34px] rounded-xl text-[11px] font-extrabold transition cursor-pointer ${
                  giftTab === t.id
                    ? 'bg-gradient-to-r from-[#FCE9A6] via-[#D4AF37] to-[#B58922] text-[#070913] shadow'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Gifts Grid OR History */}
        <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-4 py-2">
          {giftTab === 'history' ? (
            <div className="space-y-2 py-2">
              {room.messages.filter((m) => m.type === 'gift').length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-10">
                  لم تُرسل هدايا في هذه الجلسة بعد.
                </p>
              ) : (
                room.messages
                  .filter((m) => m.type === 'gift')
                  .slice()
                  .reverse()
                  .map((gm) => (
                    <div
                      key={gm.id}
                      className="rounded-xl border border-[#D4AF37]/30 bg-black/55 px-3 py-2 text-xs font-semibold text-[#FCE9A6]"
                    >
                      {gm.text}
                    </div>
                  ))
              )}
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 pb-2">
              {visibleGifts.map((gift) => {
                const active = selectedGift?.id === gift.id;
                const isFeatured = FEATURED_LUXURY_IDS.has(gift.id);
                const isImperial = gift.tier === 'imperial';
                const isRoyal = gift.tier === 'royal';

                return (
                  <button
                    key={gift.id}
                    type="button"
                    onClick={() => setSelectedGiftId(gift.id)}
                    className={`relative rounded-2xl p-2.5 flex flex-col items-center text-center transition cursor-pointer overflow-hidden ${
                      active
                        ? 'bg-gradient-to-b from-[#3A280B] via-[#241807] to-[#120D05] border-2 border-[#FCE9A6] shadow-[0_0_22px_rgba(243,211,122,0.5)] scale-[1.03]'
                        : isImperial
                        ? 'bg-gradient-to-b from-[#2A170C]/80 to-[#120C08]/90 border border-amber-400/35 hover:border-[#F3D37A]/70'
                        : 'bg-gradient-to-b from-white/[0.08] to-black/55 border border-white/12 hover:border-[#D4AF37]/50'
                    }`}
                  >
                    {/* Tier / 3D Badge */}
                    {(isFeatured || isImperial || gift.category === 'lucky') && (
                      <span
                        className={`absolute top-1.5 right-1.5 rounded-full px-1.5 py-[1px] text-[8px] font-extrabold tracking-tight ${
                          gift.category === 'lucky'
                            ? 'bg-emerald-500/25 text-emerald-200 border border-emerald-400/40'
                            : isImperial
                            ? 'bg-gradient-to-r from-amber-300 to-rose-400 text-[#070913]'
                            : isRoyal
                            ? 'bg-amber-400/25 text-[#FCE9A6] border border-amber-300/40'
                            : 'bg-sky-400/20 text-sky-200 border border-sky-300/35'
                        }`}
                      >
                        {gift.category === 'lucky'
                          ? 'حظ'
                          : isImperial
                          ? 'VIP 3D'
                          : '3D'}
                      </span>
                    )}

                    {/* 3D Pedestal + Floating Glowing Icon */}
                    <div className="relative mt-1 mb-1.5 w-14 h-14 flex items-center justify-center">
                      <span
                        aria-hidden="true"
                        className={`absolute inset-1 rounded-full blur-md transition ${
                          active
                            ? 'bg-amber-300/45 scale-110'
                            : isImperial
                            ? 'bg-amber-500/30'
                            : isRoyal
                            ? 'bg-fuchsia-400/25'
                            : 'bg-sky-400/20'
                        }`}
                      />
                      <span
                        aria-hidden="true"
                        className="absolute bottom-0.5 w-11 h-2.5 rounded-full bg-gradient-to-r from-transparent via-[#F3D37A]/45 to-transparent blur-[1px]"
                      />
                      <span
                        className={`relative text-[34px] leading-none select-none transition-transform duration-300 drop-shadow-[0_6px_10px_rgba(0,0,0,0.65)] ${
                          active ? 'scale-115 -translate-y-0.5' : ''
                        }`}
                      >
                        {gift.glyph}
                      </span>
                    </div>

                    <span className="text-[11px] font-extrabold text-white line-clamp-1 leading-tight">
                      {gift.name}
                    </span>

                    <div className="mt-1 inline-flex items-center gap-0.5 text-[10px] font-mono-num font-extrabold text-[#FCE9A6]">
                      <span>🪙</span>
                      <span>{gift.coinsCost.toLocaleString('en-US')}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Sticky Bottom Quantity & Send Bar + Bottom-Left Coins Balance & (+) Recharge */}
        {giftTab !== 'history' && selectedGift && (
          <div className="px-4 pt-2.5 pb-[max(env(safe-area-inset-bottom,0px),12px)] bg-black/75 border-t border-[#D4AF37]/30 space-y-2 shrink-0">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                {QUANTITIES.map((qty) => (
                  <button
                    key={qty}
                    type="button"
                    onClick={() => setQuantity(qty)}
                    className={`min-w-[44px] h-8 px-2 rounded-full text-[11px] font-mono-num font-extrabold transition cursor-pointer shrink-0 ${
                      quantity === qty
                        ? 'bg-gradient-to-r from-[#FCE9A6] to-[#D4AF37] text-[#070913] shadow-[0_0_12px_rgba(243,211,122,0.55)]'
                        : 'bg-white/10 text-slate-200 hover:bg-white/15 border border-white/10'
                    }`}
                  >
                    ×{qty}
                  </button>
                ))}
              </div>

              <div className="text-left shrink-0">
                <div className="text-[10px] text-slate-400">الإجمالي</div>
                <div
                  className={`text-xs font-mono-num font-extrabold ${
                    canAfford ? 'text-[#FCE9A6]' : 'text-rose-400'
                  }`}
                >
                  🪙 {totalCost.toLocaleString('en-US')}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2.5">
              <button
                type="button"
                disabled={sending || !canAfford}
                onClick={() => void onSend(selectedGift.id, selectedTargetIds, quantity)}
                className={`flex-1 min-h-[44px] rounded-2xl font-extrabold text-xs sm:text-sm flex items-center justify-center gap-1.5 px-3 transition cursor-pointer ${
                  canAfford
                    ? 'bg-gradient-to-r from-[#FDE047] via-[#D4AF37] to-[#B45309] text-[#070913] shadow-[0_0_24px_rgba(243,211,122,0.55)] hover:brightness-105 active:scale-[0.99]'
                    : 'bg-rose-950/70 border border-rose-400/40 text-rose-200 cursor-not-allowed'
                }`}
              >
                <Sparkles className="w-4 h-4 shrink-0" />
                <span className="truncate">
                  {sending
                    ? 'جارٍ الإرسال...'
                    : !canAfford
                    ? 'رصيد الكوينز غير كافٍ'
                    : `إرسال ${selectedGift.glyph} (${selectedGift.name}) ×${quantity}${
                        effectiveTargetCount > 1 ? ` إلى ${effectiveTargetCount}` : ''
                      }`}
                </span>
              </button>

              {/* Real User Coins Balance + (+) Quick Recharge on Bottom-Left (RTL end) */}
              <div
                onClick={onRecharge}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') onRecharge();
                }}
                className="flex items-center gap-1.5 rounded-2xl bg-[#1A1308] border border-[#F3D37A]/50 px-2.5 py-1.5 shadow-[0_0_12px_rgba(212,175,55,0.22)] shrink-0 cursor-pointer hover:border-[#FCE9A6]"
                title="رصيدك الحالي · اضغط للشحن السريع"
              >
                <span className="text-sm leading-none">🪙</span>
                <span className="text-xs sm:text-sm font-mono-num font-black text-[#FCE9A6]">
                  {userCoins.toLocaleString('en-US')}
                </span>
                <span className="w-6 h-6 rounded-full bg-gradient-to-br from-[#FDE047] to-[#D4AF37] text-[#070913] flex items-center justify-center shadow-sm">
                  <Plus className="w-3.5 h-3.5 stroke-[3]" />
                </span>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};
