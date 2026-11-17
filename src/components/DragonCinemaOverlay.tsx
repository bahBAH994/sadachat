import React, { useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Flame, Sparkles } from 'lucide-react';
import type { RoomFlyingGiftEvent } from '../context/ActiveRoomContext';
import { fireDragonFireworksBurst, playDragonRoarAndFireworks } from '../lib/sadaAudio';

interface DragonCinemaOverlayProps {
  event: RoomFlyingGiftEvent | null;
  hostName: string;
}

const EMBER_SEEDS = Array.from({ length: 18 }, (_, i) => ({
  id: i,
  left: `${8 + ((i * 53) % 84)}%`,
  delay: (i % 6) * 0.28,
  duration: 2.1 + (i % 4) * 0.45,
  size: 4 + (i % 3) * 3,
}));

/**
 * Full-Screen 5-Second Animated Dragon Cinema Stage for Mega Gifts.
 * Non-blocking (pointer-events-none) so users can keep tapping Combo / Mic / Chat.
 */
export const DragonCinemaOverlay: React.FC<DragonCinemaOverlayProps> = ({
  event,
  hostName,
}) => {
  useEffect(() => {
    if (!event) return;
    playDragonRoarAndFireworks();
    const cancelBurst = fireDragonFireworksBurst();
    return () => {
      cancelBurst();
    };
  }, [event?.id]);

  return (
    <div className="fixed inset-0 z-[55] pointer-events-none overflow-hidden flex flex-col items-center justify-center">
      <AnimatePresence>
        {event && (
          <motion.div
            key={event.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 1, 0.96, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 5, times: [0, 0.08, 0.78, 0.92, 1] }}
            className="relative w-full h-full flex flex-col items-center justify-center"
          >
            {/* Atmospheric Dark Gold & Crimson Spotlight Backdrop */}
            <div
              className="absolute inset-0"
              style={{
                background:
                  'radial-gradient(circle at 50% 44%, rgba(245, 158, 11, 0.34) 0%, rgba(127, 29, 29, 0.42) 38%, rgba(5, 7, 15, 0.78) 85%)',
              }}
            />

            {/* Floating Fire Embers */}
            {EMBER_SEEDS.map((ember) => (
              <motion.span
                key={ember.id}
                initial={{ y: '85vh', opacity: 0, scale: 0.6 }}
                animate={{
                  y: ['75vh', '12vh'],
                  opacity: [0, 0.95, 0.85, 0],
                  scale: [0.6, 1.2, 0.4],
                }}
                transition={{
                  duration: ember.duration,
                  delay: ember.delay,
                  repeat: 1,
                  ease: 'easeOut',
                }}
                style={{
                  left: ember.left,
                  width: ember.size,
                  height: ember.size,
                }}
                className="absolute rounded-full bg-gradient-to-tr from-orange-500 via-amber-300 to-yellow-100 shadow-[0_0_12px_rgba(251,146,60,0.95)]"
              />
            ))}

            {/* Swooping Golden Fire Dragon Centerpiece */}
            <motion.div
              initial={{ x: '45vw', y: '-18vh', scale: 0.45, rotate: -14 }}
              animate={{
                x: ['45vw', '0vw', '-2vw', '3vw', '-18vw'],
                y: ['-18vh', '0vh', '-3vh', '1vh', '-8vh'],
                scale: [0.45, 1.08, 1.15, 1.05, 0.82],
                rotate: [-14, 0, -3, 2, 10],
              }}
              transition={{ duration: 4.8, times: [0, 0.22, 0.55, 0.8, 1], ease: 'easeOut' }}
              className="relative flex flex-col items-center justify-center"
            >
              {/* Flame Breath Cone */}
              <motion.div
                animate={{
                  scaleX: [0.85, 1.25, 0.95, 1.3],
                  opacity: [0.65, 1, 0.75, 1],
                }}
                transition={{ duration: 0.7, repeat: Infinity }}
                className="absolute -left-28 sm:-left-40 top-1/2 -translate-y-1/3 w-44 sm:w-64 h-20 sm:h-28 origin-right pointer-events-none"
                style={{
                  background:
                    'radial-gradient(ellipse at right, rgba(254, 240, 138, 0.95) 0%, rgba(249, 115, 22, 0.8) 38%, rgba(220, 38, 38, 0.38) 70%, transparent 100%)',
                  filter: 'blur(6px)',
                  clipPath: 'polygon(100% 42%, 0% 5%, 10% 52%, 0% 95%)',
                }}
              />

              {/* Illustrated Golden Fire Dragon SVG */}
              <svg
                viewBox="0 0 320 220"
                className="w-[270px] h-[190px] sm:w-[370px] sm:h-[255px] drop-shadow-[0_14px_38px_rgba(245,158,11,0.85)]"
                aria-label="التنين الذهبي الأسطوري"
              >
                <defs>
                  <linearGradient id="dragonGoldBody" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#FEF9C3" />
                    <stop offset="40%" stopColor="#F59E0B" />
                    <stop offset="85%" stopColor="#B45309" />
                    <stop offset="100%" stopColor="#451A03" />
                  </linearGradient>
                  <linearGradient id="dragonWingMembrane" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#FDE047" stopOpacity="0.95" />
                    <stop offset="55%" stopColor="#EA580C" stopOpacity="0.88" />
                    <stop offset="100%" stopColor="#7F1D1D" stopOpacity="0.92" />
                  </linearGradient>
                </defs>

                {/* Back Wing */}
                <g className="animate-dragon-wing origin-[165px_100px]">
                  <path
                    d="M168 95 C195 30, 255 18, 295 36 C268 58, 252 72, 272 95 C238 92, 212 96, 185 112 Z"
                    fill="url(#dragonWingMembrane)"
                    stroke="#FEF08A"
                    strokeWidth="2.2"
                  />
                  {/* Front Majestic Wing */}
                  <path
                    d="M150 96 C125 22, 62 12, 20 34 C52 56, 65 76, 42 102 C82 95, 112 98, 140 116 Z"
                    fill="url(#dragonWingMembrane)"
                    stroke="#FEF9C3"
                    strokeWidth="2.4"
                  />
                </g>

                {/* Undulating Tail */}
                <path
                  d="M178 130 C215 168, 256 172, 292 146 C272 184, 218 198, 166 154 Z"
                  fill="url(#dragonGoldBody)"
                  stroke="#FDE68A"
                  strokeWidth="2"
                />
                <polygon points="286,149 306,136 297,158" fill="#EF4444" stroke="#FDE047" strokeWidth="1.4" />

                {/* Armored Dragon Torso & Neck */}
                <path
                  d="M112 92 C125 130, 152 152, 185 142 C196 122, 186 92, 158 84 C138 78, 122 82, 112 92 Z"
                  fill="url(#dragonGoldBody)"
                  stroke="#FEF08A"
                  strokeWidth="2.2"
                />

                {/* Royal Horned Dragon Head */}
                <path
                  d="M84 82 L116 66 L132 82 L118 104 L82 98 L68 92 Z"
                  fill="url(#dragonGoldBody)"
                  stroke="#FEF9C3"
                  strokeWidth="2.2"
                />
                {/* Sweeping Crown Horns */}
                <path d="M114 68 L138 40 L124 72 Z" fill="#FEF08A" stroke="#D97706" strokeWidth="1.5" />
                <path d="M104 72 L122 46 L112 76 Z" fill="#FDE047" stroke="#B45309" strokeWidth="1.3" />
                {/* Glowing Fierce Eye */}
                <ellipse cx="101" cy="83" rx="4.2" ry="2.6" fill="#EF4444" />
                <circle cx="100" cy="83" r="1.4" fill="#FEF9C3" />

                {/* Gift Emblem Medallion Orbiting Dragon Chest */}
                <circle
                  cx="155"
                  cy="115"
                  r="22"
                  fill="#0B0F20"
                  fillOpacity="0.88"
                  stroke="#FCE9A6"
                  strokeWidth="2.4"
                />
                <text x="155" y="124" textAnchor="middle" fontSize="26">
                  {event.gift.glyph}
                </text>
              </svg>
            </motion.div>

            {/* Royal Cinema Heraldic Banner */}
            <motion.div
              initial={{ y: 28, opacity: 0, scale: 0.92 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              transition={{ delay: 0.18, duration: 0.45 }}
              className="mt-2 mx-4 max-w-md rounded-3xl border-2 border-[#FCE9A6]/85 bg-gradient-to-r from-[#2D1A06]/95 via-[#0E0B14]/95 to-[#2D1A06]/95 px-5 py-3 shadow-[0_0_45px_rgba(245,158,11,0.7)] text-center"
            >
              <div className="flex items-center justify-center gap-1.5 text-[11px] font-extrabold text-amber-300 mb-1">
                <Flame className="w-3.5 h-3.5 text-orange-400" />
                <span>عرض التنين الإمبراطوري الأسطوري</span>
                <Sparkles className="w-3.5 h-3.5 text-[#FCE9A6]" />
              </div>
              <p className="text-sm sm:text-base font-extrabold text-white">
                أهدى <span className="text-[#FCE9A6]">{event.senderName}</span>{' '}
                <span className="text-amber-300">{event.gift.name}</span>{' '}
                {event.quantity > 1 ? `×${event.quantity}` : ''}{' '}
                {event.comboCount > 1 ? `· Combo ×${event.comboCount}` : ''}
              </p>
              <p className="text-xs font-bold text-amber-200/90 mt-0.5">
                إلى{' '}
                {event.recipientNames.length > 1
                  ? `الجميع على المايكات (${event.recipientNames.length})`
                  : event.recipientNames[0] || hostName}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
