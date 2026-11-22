import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Check, Coins, MessageCircleHeart, Sparkles, Users, X } from 'lucide-react';
import { resolveAsset } from '../lib/assets';
import { getCachedGiftCatalog } from '../lib/sadaCatalog';
import { Fluent3DAsset } from './Fluent3DAsset';
import type { GiftItem, Room, RoomSeat } from '../types';

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

const FEATURED_LUXURY_ORDER = [
  'gift_03', // تاج ملكي ذهبي
  'gift_05', // سيارة رياضية فاخرة
  'gift_01', // باقة ورد حمراء
  'gift_21', // ألماسة زرقاء ملكية
  'gift_24', // صاروخ صَدَى الأسطوري
  'gift_06', // يخت صَدَى الملكي
  'gift_07', // قلعة الأحلام الملكية
  'gift_02', // قلب ذهبي فاخر
];

const FEATURED_LUXURY_IDS = new Set(FEATURED_LUXURY_ORDER);

interface GiftGridItemProps {
  gift: GiftItem;
  active: boolean;
  onSelect: (giftId: string) => void;
}

const GiftGridItem = memo<GiftGridItemProps>(({ gift, active, onSelect }) => {
  const isFeatured = FEATURED_LUXURY_IDS.has(gift.id);
  const isImperial = gift.tier === 'imperial';
  const isRoyal = gift.tier === 'royal';

  return (
    <button
      type="button"
      onClick={() => onSelect(gift.id)}
      className={`relative min-h-[96px] h-auto rounded-xl p-2 shrink-0 flex flex-col items-center justify-between text-center transition cursor-pointer overflow-hidden ${
        active
          ? 'bg-gradient-to-b from-[#3A280B] via-[#241807] to-[#120D05] border-2 border-[#FCE9A6] shadow-[0_0_22px_rgba(243,211,122,0.5)] scale-[1.03]'
          : isImperial
          ? 'bg-gradient-to-b from-[#2A170C]/80 to-[#120C08]/90 border border-amber-400/35 hover:border-[#F3D37A]/70'
          : 'bg-gradient-to-b from-white/[0.08] to-black/55 border border-white/12 hover:border-[#D4AF37]/50'
      }`}
    >
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
          {gift.category === 'lucky' ? 'حظ' : isImperial ? 'VIP 3D' : '3D'}
        </span>
      )}

      <div className="relative w-10 h-10 flex items-center justify-center">
        <span
          aria-hidden="true"
          className={`absolute inset-0.5 rounded-full blur-[6px] transition duration-300 ${
            active
              ? 'bg-gradient-to-tr from-amber-300/60 via-yellow-200/40 to-amber-500/50 scale-115'
              : isImperial
              ? 'bg-gradient-to-tr from-amber-500/35 to-rose-500/25'
              : isRoyal
              ? 'bg-gradient-to-tr from-fuchsia-400/25 to-amber-300/20'
              : 'bg-gradient-to-tr from-sky-400/25 to-indigo-400/15'
          }`}
        />
        <span
          aria-hidden="true"
          className="absolute bottom-0.5 w-11 h-2.5 rounded-full bg-gradient-to-r from-transparent via-[#F3D37A]/45 to-transparent blur-[1px]"
        />
        <div
          className={`relative transition-transform duration-300 drop-shadow-[0_8px_12px_rgba(0,0,0,0.75)] ${
            active ? 'scale-110 -translate-y-1' : 'group-hover:scale-105'
          }`}
        >
          <Fluent3DAsset
            glyph={gift.glyph}
            imageUrl={gift.imageUrl}
            alt={gift.name}
            sizeClass="w-9 h-9"
            fallbackTextClass="text-2xl"
            priority={isFeatured || Boolean(gift.imageUrl)}
          />
        </div>
      </div>

      <span className="w-full min-w-0 text-[10px] font-extrabold text-white break-words leading-tight">
        {gift.name}
      </span>

      <div className="mt-0.5 inline-flex items-center gap-1 text-[9px] font-mono-num font-extrabold text-[#FCE9A6]">
        <Coins className="w-3 h-3 text-[#FCE9A6]" aria-label="كوينز" />
        <span>{gift.coinsCost.toLocaleString('en-US')}</span>
      </div>
    </button>
  );
});

interface RecipientSpeakerChipProps {
  seat: RoomSeat;
  isSelected: boolean;
  onToggle: (uid: string) => void;
}

const RecipientSpeakerChip = memo<RecipientSpeakerChipProps>(
  ({ seat, isSelected, onToggle }) => {
    const uid = seat.userId!;
    return (
      <button
        type="button"
        onClick={() => onToggle(uid)}
        className="relative z-20 flex flex-col items-center gap-1 shrink-0 cursor-pointer group pointer-events-auto"
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
            loading="lazy"
            decoding="async"
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
  }
);

export const RoomGiftDrawer: React.FC<RoomGiftDrawerProps> = memo(({
  room,
  gifts: rawGifts,
  userCoins,
  currentUserId,
  initialTargets,
  sending,
  onSend,
  onOpenPM,
  onClose,
}) => {
  const gifts = useMemo(
    () => (rawGifts.length > 0 ? rawGifts : getCachedGiftCatalog()),
    [rawGifts]
  );
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
  const [tierFilter, setTierFilter] = useState<'all' | 'light' | 'medium' | 'royal'>('all');
  const [quantity, setQuantity] = useState<number>(1);
  const [insufficientNotice, setInsufficientNotice] = useState(false);
  const [selectedGiftId, setSelectedGiftId] = useState<string>(() => {
    const firstFixed = gifts.find((g) => g.category !== 'lucky');
    return firstFixed?.id || gifts[0]?.id || 'gift_01';
  });

  const fixedGifts = useMemo(() => {
    const list = gifts.filter((g) => g.category !== 'lucky');
    return [...list].sort((a, b) => {
      const idxA = FEATURED_LUXURY_ORDER.indexOf(a.id);
      const idxB = FEATURED_LUXURY_ORDER.indexOf(b.id);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.coinsCost - b.coinsCost;
    });
  }, [gifts]);
  const luckyGifts = useMemo(
    () => gifts.filter((g) => g.category === 'lucky'),
    [gifts]
  );

  const visibleGifts = useMemo(() => {
    const base = giftTab === 'lucky' ? luckyGifts : fixedGifts;
    if (tierFilter === 'light') return base.filter((g) => g.coinsCost < 100);
    if (tierFilter === 'medium') {
      return base.filter((g) => g.coinsCost >= 100 && g.coinsCost < 1000);
    }
    if (tierFilter === 'royal') return base.filter((g) => g.coinsCost >= 1000);
    return base;
  }, [fixedGifts, giftTab, luckyGifts, tierFilter]);

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
      setSelectedTargetIds([]);
    } else {
      setSelectedTargetIds(allSeatedIds);
    }
  };

  const toggleTarget = useCallback((uid: string) => {
    setSelectedTargetIds((prev) => {
      if (prev.includes(uid)) return prev.filter((id) => id !== uid);
      return [...prev, uid];
    });
  }, []);

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
      className="fixed inset-0 z-50 flex items-end justify-center bg-[#0d111e]"
      onClick={onClose}
    >
      {insufficientNotice && (
        <div
          role="alert"
          className="fixed top-3 left-1/2 -translate-x-1/2 z-[70] w-[calc(100%-24px)] max-w-md rounded-2xl border border-rose-400/70 bg-rose-950/95 px-4 py-3 text-center text-sm font-extrabold text-rose-100 shadow-2xl"
        >
          رصيد الكوينز غير كافٍ لإرسال هذه الهدية
        </div>
      )}
      <motion.div
        initial={{ y: 70, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 70, opacity: 0 }}
        transition={{ duration: 0.15, ease: 'easeOut' }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl rounded-t-[28px] border-t border-x border-[#F3D37A]/45 bg-[#0d111e] shadow-[0_-18px_50px_rgba(0,0,0,0.85)] flex flex-col max-h-[58vh] overflow-hidden"
      >
        {/* Top Drawer Header */}
        <div className="flex items-center justify-between px-4 py-1.5 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-[#FDE047] via-[#D4AF37] to-[#9A6E13] flex items-center justify-center shadow-[0_0_16px_rgba(243,211,122,0.5)]">
              <Fluent3DAsset glyph="🎁" alt="الهدايا الملكية" sizeClass="w-7 h-7" priority />
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
        <div className="px-4 py-1.5 bg-black/35 border-b border-white/10 shrink-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold text-amber-100/90">
              اختر المُرسَل إليه ({selectedTargetIds.length}):
            </span>
            {seatedSpeakers.length > 1 && (
              <span className="text-[10px] text-amber-300/80">
                يمكنك اختيار أكثر من متحدث أو الكل
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5 overflow-x-auto touch-pan-x no-scrollbar pb-1">
            {/* ALL Button */}
            <button
              type="button"
              onClick={toggleAllSeated}
              className="relative z-20 flex flex-col items-center gap-1 shrink-0 cursor-pointer group pointer-events-auto"
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
                className="relative z-20 flex flex-col items-center gap-1 shrink-0 cursor-pointer pointer-events-auto"
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
                    loading="lazy"
                    decoding="async"
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
            {seatedSpeakers.map((seat) => (
              <RecipientSpeakerChip
                key={seat.seatIndex}
                seat={seat}
                isSelected={selectedTargetIds.includes(seat.userId!)}
                onToggle={toggleTarget}
              />
            ))}
          </div>
        </div>

        {/* Gift Tabs */}
        <div className="px-4 py-1.5 shrink-0">
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

          {giftTab !== 'history' && (
            <div className="flex items-center gap-1.5 mt-1 overflow-x-auto touch-pan-x no-scrollbar">
              {[
                { id: 'all', label: 'الكل' },
                { id: 'light', label: 'خفيفة (<100)' },
                { id: 'medium', label: 'متوسطة (100-999)' },
                { id: 'royal', label: 'ملكية (1000+)' },
              ].map((tf) => (
                <button
                  key={tf.id}
                  type="button"
                  onClick={() =>
                    setTierFilter(tf.id as 'all' | 'light' | 'medium' | 'royal')
                  }
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold whitespace-nowrap shrink-0 transition cursor-pointer ${
                    tierFilter === tf.id
                      ? 'bg-[#D4AF37]/25 border border-[#FCE9A6]/70 text-[#FCE9A6]'
                      : 'bg-white/5 border border-white/10 text-slate-300 hover:text-white'
                  }`}
                >
                  {tf.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Gifts Grid OR History */}
        <div className="flex-1 min-h-0 flex flex-col px-2 py-1">
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
          ) : visibleGifts.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-10">
              لا توجد هدايا في هذه الفئة ضمن هذا التبويب.
            </p>
          ) : (
            <div className="flex-1 min-h-[200px] overflow-y-auto grid grid-cols-4 gap-2 p-2 pb-8">
              {visibleGifts.map((gift) => (
                <GiftGridItem
                  key={gift.id}
                  gift={gift}
                  active={selectedGift?.id === gift.id}
                  onSelect={setSelectedGiftId}
                />
              ))}
            </div>
          )}
        </div>

        {/* Compact Quantity & Send Bar */}
        {giftTab !== 'history' && selectedGift && (
          <div className="relative z-20 shrink-0 bg-[#14161f] border-t border-amber-500/20 px-3 py-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1 overflow-x-auto touch-pan-x no-scrollbar min-w-0">
              {QUANTITIES.map((qty) => (
                <button
                  key={qty}
                  type="button"
                  onClick={() => setQuantity(qty)}
                  className={`min-w-[38px] h-8 px-1.5 rounded-full text-[10px] font-mono-num font-extrabold transition cursor-pointer shrink-0 ${
                    quantity === qty
                      ? 'bg-gradient-to-r from-[#FCE9A6] to-[#D4AF37] text-[#070913] shadow-[0_0_12px_rgba(243,211,122,0.55)]'
                      : 'bg-white/10 text-slate-200 hover:bg-white/15 border border-white/10'
                  }`}
                >
                  {qty}x
                </button>
              ))}
            </div>

            <div className="text-left shrink-0">
              <div className="text-[9px] text-slate-400 leading-tight">الإجمالي</div>
              <div className={`text-xs font-mono-num font-extrabold flex items-center gap-1 ${canAfford ? 'text-[#FCE9A6]' : 'text-rose-400'}`}>
                <Coins className="w-3 h-3" aria-label="كوينز" />
                <span>{totalCost.toLocaleString('en-US')}</span>
              </div>
            </div>

            <button
              type="button"
              disabled={sending}
              onClick={() => {
                if (!canAfford) {
                  setInsufficientNotice(true);
                  window.setTimeout(() => setInsufficientNotice(false), 2600);
                  return;
                }
                if (selectedTargetIds.length === 0) {
                  setInsufficientNotice(false);
                  return;
                }
                void onSend(selectedGift.id, selectedTargetIds, quantity);
              }}
              className="min-h-[38px] min-w-[82px] rounded-xl font-extrabold text-xs flex items-center justify-center gap-1.5 px-3 transition cursor-pointer bg-gradient-to-r from-[#FDE047] via-[#D4AF37] to-[#B45309] text-[#070913] shadow-[0_0_18px_rgba(243,211,122,0.5)] hover:brightness-105 active:scale-[0.99] disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5 shrink-0" />
              <span>إرسال</span>
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
});
