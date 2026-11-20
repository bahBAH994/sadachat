import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeft, Crown, Megaphone, Sparkles, X } from 'lucide-react';
import { useActiveRoom } from '../context/ActiveRoomContext';
import { playGlobalRoyalAnnouncementChime } from '../lib/sadaAudio';
import { Fluent3DAsset } from './Fluent3DAsset';

/**
 * Global Cross-Room Royal Announcement Ticker (>= 5,000 coins gifts)
 * & Admin Public Broadcast Banner shown across all screens.
 */
export const GlobalRoyalGiftTicker: React.FC = () => {
  const navigate = useNavigate();
  const {
    globalRoyalGift,
    dismissGlobalRoyalGift,
    adminAnnouncement,
    dismissAdminAnnouncement,
    activeRoomId,
    isMinimized,
    restoreRoom,
  } = useActiveRoom();

  useEffect(() => {
    if (!globalRoyalGift) return;
    if (activeRoomId !== globalRoyalGift.roomId || isMinimized) {
      playGlobalRoyalAnnouncementChime();
    }
  }, [activeRoomId, globalRoyalGift?.id, globalRoyalGift?.roomId, isMinimized]);

  useEffect(() => {
    if (!adminAnnouncement) return;
    playGlobalRoyalAnnouncementChime();
  }, [adminAnnouncement?.id]);

  const handleJoinAnnouncedRoom = () => {
    if (!globalRoyalGift) return;
    const targetRoomId = globalRoyalGift.roomId;
    dismissGlobalRoyalGift();
    if (activeRoomId === targetRoomId) {
      restoreRoom();
      navigate(`/room/${targetRoomId}`);
      return;
    }
    navigate(`/room/${targetRoomId}`);
  };

  return (
    <div
      className="fixed top-2 inset-x-2 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-[min(94vw,44rem)] z-[68] pointer-events-none flex flex-col gap-2"
      aria-live="polite"
    >
      {/* Global Admin Announcement Top Banner */}
      <AnimatePresence>
        {adminAnnouncement && (
          <motion.div
            key={adminAnnouncement.id}
            initial={{ opacity: 0, y: -32, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -24, scale: 0.95 }}
            transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
            className="pointer-events-auto relative overflow-hidden rounded-2xl border-2 border-emerald-300/90 bg-gradient-to-r from-[#06281E]/96 via-[#0A1424]/96 to-[#06281E]/96 shadow-[0_10px_36px_rgba(16,185,129,0.45)] backdrop-blur-md"
          >
            <motion.div
              aria-hidden="true"
              animate={{ x: ['-130%', '150%'] }}
              transition={{ duration: 2.6, repeat: Infinity, ease: 'linear' }}
              className="absolute inset-y-0 w-24 bg-gradient-to-r from-transparent via-emerald-300/20 to-transparent -skew-x-12 pointer-events-none"
            />
            <div className="relative flex items-center gap-2.5 pr-3 pl-1.5 py-2 min-h-[50px]">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 text-[#04140E] flex items-center justify-center shrink-0 shadow">
                <Megaphone className="w-4 h-4" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-[10px] font-black text-emerald-300">
                  <span>{adminAnnouncement.title || 'إعلان إداري عام'}</span>
                  <span className="text-slate-400">·</span>
                  <span className="text-[#FCE9A6] truncate">{adminAnnouncement.senderName}</span>
                </div>
                <p className="text-xs sm:text-sm font-extrabold text-white leading-snug break-words">
                  {adminAnnouncement.message}
                </p>
              </div>

              <button
                type="button"
                onClick={dismissAdminAnnouncement}
                aria-label="إغلاق الإعلان العام"
                className="min-w-[36px] min-h-[44px] rounded-xl text-emerald-200/80 hover:text-white hover:bg-white/10 flex items-center justify-center shrink-0 cursor-pointer transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Global Royal Gift Ticker */}
      <AnimatePresence>
        {globalRoyalGift && (
          <motion.div
            key={globalRoyalGift.id}
            initial={{ opacity: 0, y: -28, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -24, scale: 0.95 }}
            transition={{ duration: 0.34, ease: [0.16, 1, 0.3, 1] }}
            className="pointer-events-auto relative overflow-hidden rounded-2xl border-2 border-[#FEF08A]/90 bg-gradient-to-r from-[#3D2204]/95 via-[#18110B]/95 to-[#3D2204]/95 shadow-[0_10px_36px_rgba(245,158,11,0.55)] backdrop-blur-md"
          >
            {/* Animated Golden Metallic Shimmer Sweep */}
            <motion.div
              aria-hidden="true"
              animate={{ x: ['-130%', '150%'] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: 'linear' }}
              className="absolute inset-y-0 w-24 bg-gradient-to-r from-transparent via-[#FEF08A]/25 to-transparent -skew-x-12 pointer-events-none"
            />

            <div className="relative flex items-center gap-2 pr-2 pl-1 py-1.5 min-h-[48px]">
              <button
                type="button"
                onClick={handleJoinAnnouncedRoom}
                className="flex-1 min-w-0 min-h-[44px] flex items-center gap-2.5 text-right cursor-pointer group"
              >
                <div className="relative shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br from-[#FDE047]/25 to-[#B45309]/35 border border-[#FCE9A6]/60 flex items-center justify-center shadow-inner">
                  <Fluent3DAsset
                    glyph={globalRoyalGift.giftGlyph}
                    imageUrl={globalRoyalGift.giftImageUrl}
                    alt={globalRoyalGift.giftName}
                    priority
                    sizeClass="w-7 h-7"
                    fallbackTextClass="text-lg"
                  />
                  <Crown className="w-3 h-3 text-[#FEF08A] absolute -top-1 -right-1 drop-shadow" />
                </div>

                <div className="min-w-0 flex-1 overflow-hidden">
                  <div className="flex items-center gap-1.5 text-[10px] font-black text-[#FEF08A]">
                    <Sparkles className="w-3 h-3 text-amber-300 shrink-0" />
                    <span className="truncate">
                      بث ملكي عالمي · {globalRoyalGift.totalCoins.toLocaleString('en-US')} عملة
                    </span>
                  </div>

                  <p className="text-[11px] sm:text-xs font-extrabold text-white leading-snug line-clamp-2 group-hover:text-[#FEF08A] transition">
                    👑 خبر ملكي:{' '}
                    <span className="text-[#FCE9A6]">{globalRoyalGift.senderName}</span> أهدى{' '}
                    <span className="text-amber-300">{globalRoyalGift.giftName}</span> إلى{' '}
                    <span className="text-[#FCE9A6]">{globalRoyalGift.recipientName}</span> في غرفة{' '}
                    <span className="underline decoration-[#FCE9A6]/70">
                      {globalRoyalGift.roomTitle}
                    </span>
                    ! <span className="text-emerald-300 font-black">اضغط للانضمام</span>
                  </p>
                </div>

                <span className="hidden sm:inline-flex items-center gap-1 rounded-xl bg-gradient-to-r from-[#FEF08A] to-[#D4AF37] px-2.5 py-1.5 text-[10px] font-black text-[#070913] shrink-0 shadow">
                  <span>انضمام</span>
                  <ArrowLeft className="w-3 h-3" />
                </span>
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  dismissGlobalRoyalGift();
                }}
                aria-label="إغلاق الإعلان الملكي"
                className="min-w-[36px] min-h-[44px] rounded-xl text-amber-200/80 hover:text-white hover:bg-white/10 flex items-center justify-center shrink-0 cursor-pointer transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
