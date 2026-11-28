import React, { useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { fireSvipEntranceConfetti, playVipEntranceSound } from '../lib/sadaAudio';
import type { RoomEntryEvent } from '../types';
import { AvatarWithFrame, VipTierBadge, VipUserName } from './AvatarWithFrame';
import { Fluent3DAsset } from './Fluent3DAsset';
import { TransparentAssetImage, TransparentAssetVideo } from './TransparentAssetImage';

interface VipEntranceOverlayProps {
  entry: RoomEntryEvent | null;
}

export const VipEntranceOverlay: React.FC<VipEntranceOverlayProps> = ({ entry }) => { if (!entry?.entranceAssetUrl) return null;
  const vipLevel = entry?.vipLevel || 'none';

  useEffect(() => {
    if (!entry || entry.entranceAssetUrl) return;
    let stopConfetti: (() => void) | undefined;

    if (vipLevel === 'svip') {
      playVipEntranceSound('svip');
      stopConfetti = fireSvipEntranceConfetti();
    } else if (vipLevel === 'vip3') {
      playVipEntranceSound('vip3');
    } else if (vipLevel === 'vip2') {
      playVipEntranceSound('vip2');
    }

    return () => {
      if (stopConfetti) stopConfetti();
    };
  }, [entry, vipLevel]);

  return (
    <AnimatePresence>
      {entry?.entranceAssetUrl && (
        <motion.div
          key={`store-entrance_${entry.userId}_${entry.timestamp}`}
          initial={{ opacity: 0, scale: 0.76, y: 48 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 1.08, y: -24 }}
          transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
          className="pointer-events-none fixed inset-0 z-[80] flex items-center justify-center overflow-hidden"
          aria-label={`${entry.displayName} دخل الغرفة`}
        >
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(251,191,36,0.22)_0%,rgba(0,0,0,0.12)_48%,rgba(0,0,0,0.46)_100%)]"
          />
          {/(\.mp4|\.webm|\.mov|\.m4v)(?:[?#]|$)/i.test(entry.entranceAssetUrl) ? (
            <video
              src={entry.entranceAssetUrl}
              autoPlay
              muted
              playsInline
              aria-hidden="true"
              className="relative h-full w-full object-contain mix-blend-screen"
            />
          ) : (
            <TransparentAssetImage
              src={entry.entranceAssetUrl}
              alt=""
              className="relative h-full w-full object-contain mix-blend-screen"
            />
          )}
          <div className="absolute inset-x-0 bottom-[12%] flex justify-center px-4">
            <div className="rounded-full border border-amber-200/60 bg-black/65 px-6 py-3 text-center text-sm font-black text-[#FFF7D6] shadow-[0_0_32px_rgba(251,191,36,0.5)] backdrop-blur-md sm:text-lg">
              انضم الملك {entry.displayName} إلى الغرفة
            </div>
          </div>
        </motion.div>
      )}
      {entry && !entry.entranceAssetUrl && vipLevel === 'svip' && (
        <motion.div
          key={`svip_${entry.userId}_${entry.timestamp}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
          className="fixed inset-0 z-[72] pointer-events-none flex items-center justify-center p-4"
        >
          {/* Imperial Full-Screen Radial Backdrop */}
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(245,158,11,0.32)_0%,rgba(124,45,18,0.52)_42%,rgba(7,9,19,0.78)_100%)] backdrop-blur-[2px]"
          />

          {/* Orbiting Imperial Light Rays */}
          <motion.div
            initial={{ scale: 0.65, rotate: -15, opacity: 0 }}
            animate={{ scale: [0.82, 1.05, 1], rotate: 0, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-md rounded-[32px] border-2 border-[#FEF08A] bg-gradient-to-b from-[#2A1405]/95 via-[#130D1F]/95 to-[#070913]/95 px-6 py-7 text-center shadow-[0_0_80px_rgba(251,191,36,0.75)] overflow-hidden"
          >
            {/* Shimmer Sweep */}
            <motion.div
              aria-hidden="true"
              animate={{ x: ['-120%', '140%'] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'linear' }}
              className="absolute inset-y-0 w-24 bg-gradient-to-r from-transparent via-[#FEF08A]/25 to-transparent -skew-x-12 pointer-events-none"
            />

            {/* Floating Imperial Sparks */}
            <div className="flex items-center justify-center gap-3 mb-2">
              <Fluent3DAsset glyph="🔥" alt="نار إمبراطورية" priority sizeClass="w-8 h-8" />
              <VipTierBadge vipTier="svip" />
              <Fluent3DAsset glyph="💎" alt="ألماس إمبراطوري" priority sizeClass="w-8 h-8" />
            </div>

            <div className="my-4 flex justify-center">
              <AvatarWithFrame
                src={entry.avatarUrl}
                alt={entry.displayName}
                frameId={entry.frameId}
                vipTier="svip"
                size="xl"
              />
            </div>

            <h2 className="text-lg sm:text-xl font-black leading-snug text-[#FFFBEB] drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)]">
              👑 تشرف الغرفة بحضور الإمبراطور{' '}
              <VipUserName name={entry.displayName} vipTier="svip" className="inline-block" />!
            </h2>

            <p className="mt-2 text-xs font-bold text-amber-200/90">
              ✨ دخولية الإمبراطور الألماسية الكاملة — حضور استثنائي في صَدَى ✨
            </p>
          </motion.div>
        </motion.div>
      )}

      {entry && !entry.entranceAssetUrl && vipLevel === 'vip3' && (
        <motion.div
          key={`vip3_${entry.userId}_${entry.timestamp}`}
          initial={{ opacity: 0, y: -24, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -18, scale: 0.95 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="fixed top-16 left-1/2 -translate-x-1/2 z-[64] w-[92%] max-w-md pointer-events-none"
        >
          <div className="relative rounded-2xl border-2 border-[#FDE047] bg-gradient-to-r from-[#3B2103]/95 via-[#583307]/95 to-[#261404]/95 px-4 py-3 flex items-center gap-3 shadow-[0_0_40px_rgba(245,158,11,0.7)] overflow-hidden">
            <motion.div
              aria-hidden="true"
              animate={{ x: ['-120%', '150%'] }}
              transition={{ duration: 1.9, repeat: Infinity, ease: 'linear' }}
              className="absolute inset-y-0 w-16 bg-gradient-to-r from-transparent via-amber-200/25 to-transparent -skew-x-12"
            />
            {[10, 32, 68, 88].map((leftPct, idx) => (
              <motion.span
                key={leftPct}
                aria-hidden="true"
                initial={{ opacity: 0.2, scale: 0.6, y: 4 }}
                animate={{ opacity: [0.25, 1, 0.25], scale: [0.6, 1.25, 0.6], y: [4, -6, 4] }}
                transition={{ duration: 1.3 + idx * 0.25, repeat: Infinity, ease: 'easeInOut' }}
                style={{ left: `${leftPct}%`, top: idx % 2 === 0 ? '14%' : '72%' }}
                className="absolute text-[10px] text-[#FEF08A] pointer-events-none select-none drop-shadow-[0_0_6px_rgba(253,224,71,0.9)]"
              >
                ✦
              </motion.span>
            ))}
            <AvatarWithFrame
              src={entry.avatarUrl}
              alt={entry.displayName}
              frameId={entry.frameId}
              vipTier="vip3"
              size="md"
            />
            <div className="min-w-0 flex-1 relative z-10">
              <div className="flex items-center gap-1.5 mb-0.5">
                <VipTierBadge vipTier="vip3" compact />
                <span className="text-[10px] font-bold text-amber-200">✨ شرارات التتويج الملكي</span>
              </div>
              <p className="text-xs sm:text-sm font-extrabold text-[#FEF08A] truncate">
                👑 أطلّ الملك {entry.displayName} بهالة الذهب والأجنحة!
              </p>
            </div>
            <Fluent3DAsset glyph="👑" alt="تاج ملكي" priority sizeClass="w-9 h-9" />
          </div>
        </motion.div>
      )}

      {entry && !entry.entranceAssetUrl && vipLevel === 'vip2' && (
        <motion.div
          key={`vip2_${entry.userId}_${entry.timestamp}`}
          initial={{ opacity: 0, x: 48, scale: 0.94 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: -48, scale: 0.94 }}
          transition={{ duration: 0.32, ease: 'easeOut' }}
          className="fixed top-16 left-1/2 -translate-x-1/2 z-[64] w-[90%] max-w-md pointer-events-none"
        >
          <div className="relative rounded-2xl border border-sky-200/80 bg-gradient-to-r from-[#1E293B]/95 via-[#0C4A6E]/95 to-[#1E293B]/95 px-3.5 py-2.5 flex items-center gap-3 shadow-[0_0_28px_rgba(186,230,253,0.5)] overflow-hidden">
            <span className="vip-frame-silver-sheen absolute inset-y-0 w-14 bg-gradient-to-r from-transparent via-white/30 to-transparent pointer-events-none" />
            <AvatarWithFrame
              src={entry.avatarUrl}
              alt={entry.displayName}
              frameId={entry.frameId}
              vipTier="vip2"
              size="md"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 mb-0.5">
                <VipTierBadge vipTier="vip2" compact />
                <span className="text-[10px] font-bold text-sky-200">⭐ بريق السماء الفضي</span>
              </div>
              <p className="text-xs font-extrabold text-white truncate">
                🥈✨ انضم {entry.displayName} وسط تألق النجوم الفضية!
              </p>
            </div>
            <Fluent3DAsset glyph="⭐" alt="نجمة فضية" priority sizeClass="w-8 h-8" />
          </div>
        </motion.div>
      )}

      {entry &&
        !entry.entranceAssetUrl &&
        vipLevel !== 'svip' &&
        vipLevel !== 'vip3' &&
        vipLevel !== 'vip2' && (
          <motion.div
            key={`store_${entry.userId}_${entry.timestamp}`}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            className="mb-1.5 rounded-2xl border border-amber-300/80 bg-gradient-to-r from-[#3E2405]/95 to-[#171209]/95 px-3 py-2 flex items-center gap-2.5 shadow-[0_0_25px_rgba(251,191,36,0.5)] shrink-0"
          >
            <Fluent3DAsset
              glyph={entry.entryId === 'entry_legendary_30d' ? '🐉' : '🚘'}
              alt="دخولية ملكية"
              priority
              sizeClass="w-8 h-8"
              fallbackTextClass="text-2xl"
            />
            <p className="text-xs font-extrabold text-[#FCE9A6] truncate">
              دخولية ملكية: شرّف {entry.displayName} الوكالة!
            </p>
          </motion.div>
        )}
    </AnimatePresence>
  );
};
