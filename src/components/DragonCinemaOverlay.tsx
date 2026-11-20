import React, { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Crown, Flame, Sparkles } from 'lucide-react';
import type { RoomFlyingGiftEvent } from '../context/ActiveRoomContext';
import {
  fireRoyalGiftConfettiBurst,
  playRoyalGiftCinematicSound,
} from '../lib/sadaAudio';
import { Fluent3DAsset } from './Fluent3DAsset';

interface DragonCinemaOverlayProps {
  event: RoomFlyingGiftEvent | null;
  hostName: string;
}

interface GoldParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rotation: number;
  rotSpeed: number;
  kind: 'coin' | 'spark' | 'shard';
  alpha: number;
  color: string;
}

const GOLD_PALETTE = ['#FEF08A', '#FDE047', '#F59E0B', '#D4AF37', '#FFFBEB'];

const GoldRainCanvas: React.FC<{ active: boolean }> = ({ active }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const particles: GoldParticle[] = [];
    const totalParticles = Math.min(85, Math.max(48, Math.floor(window.innerWidth / 9)));

    const spawnParticle = (startTop = false): GoldParticle => {
      const r = Math.random();
      const kind: GoldParticle['kind'] = r < 0.36 ? 'coin' : r < 0.72 ? 'spark' : 'shard';
      return {
        x: Math.random() * window.innerWidth,
        y: startTop
          ? -20 - Math.random() * 140
          : Math.random() * window.innerHeight * 0.85 - 60,
        vx: (Math.random() - 0.5) * 1.6,
        vy: kind === 'coin' ? 2.4 + Math.random() * 2.6 : 1.6 + Math.random() * 3.1,
        size: kind === 'coin' ? 6 + Math.random() * 5 : 3 + Math.random() * 4,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.14,
        kind,
        alpha: 0.65 + Math.random() * 0.35,
        color: GOLD_PALETTE[Math.floor(Math.random() * GOLD_PALETTE.length)],
      };
    };

    for (let i = 0; i < totalParticles; i++) {
      particles.push(spawnParticle(false));
    }

    let rafId = 0;
    const tick = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      ctx.clearRect(0, 0, w, h);

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx + Math.sin(p.y * 0.02 + i) * 0.35;
        p.y += p.vy;
        p.rotation += p.rotSpeed;

        if (p.y > h + 30) {
          particles[i] = spawnParticle(true);
          continue;
        }

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.globalAlpha = p.alpha;

        if (p.kind === 'coin') {
          const tilt = Math.cos(p.rotation);
          ctx.scale(Math.max(0.24, Math.abs(tilt)), 1);
          const grad = ctx.createRadialGradient(-2, -2, 1, 0, 0, p.size);
          grad.addColorStop(0, '#FFFBEB');
          grad.addColorStop(0.55, '#FACC15');
          grad.addColorStop(1, '#B45309');
          ctx.fillStyle = grad;
          ctx.shadowColor = 'rgba(250, 204, 21, 0.85)';
          ctx.shadowBlur = 10;
          ctx.beginPath();
          ctx.arc(0, 0, p.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#FEF9C3';
          ctx.lineWidth = 1;
          ctx.stroke();
        } else if (p.kind === 'spark') {
          ctx.fillStyle = p.color;
          ctx.shadowColor = p.color;
          ctx.shadowBlur = 14;
          ctx.beginPath();
          ctx.arc(0, 0, p.size * 0.65, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.rotate(p.rotation);
          ctx.fillStyle = p.color;
          ctx.shadowColor = 'rgba(251, 191, 36, 0.8)';
          ctx.shadowBlur = 8;
          ctx.fillRect(-p.size * 0.6, -p.size * 0.25, p.size * 1.2, p.size * 0.5);
        }

        ctx.restore();
      }

      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
    };
  }, [active]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-[56]"
      aria-hidden="true"
    />
  );
};

/**
 * Tier 3 Full-Screen 4.5-Second Luxury & Royal Gift Cinema Overlay (>= 1000 coins).
 * Non-blocking (pointer-events-none) so users can continue interacting with Combo, Chat, and Mic.
 */
export const DragonCinemaOverlay: React.FC<DragonCinemaOverlayProps> = ({
  event,
  hostName,
}) => {
  useEffect(() => {
    if (!event) return;
    playRoyalGiftCinematicSound(event.gift.glyph);
    const cancelBurst = fireRoyalGiftConfettiBurst();
    return () => {
      cancelBurst();
    };
  }, [event?.id, event?.gift?.glyph]);

  const isVehicle = Boolean(
    event && ['🏎️', '🚘', '🚗', '🚀', '🚁'].includes(event.gift.glyph.trim())
  );
  const isDragon = Boolean(event && event.gift.glyph.trim() === '🐉');

  return (
    <div className="fixed inset-0 z-[55] pointer-events-none overflow-hidden flex flex-col items-center justify-center">
      <GoldRainCanvas active={Boolean(event)} />

      <AnimatePresence>
        {event && (
          <motion.div
            key={event.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 1, 0.96, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 4.5, times: [0, 0.08, 0.8, 0.92, 1] }}
            className="relative z-[57] w-full h-full flex flex-col items-center justify-center px-4"
          >
            {/* Dark Royal Glowing Spotlight Backdrop */}
            <div
              className="absolute inset-0"
              style={{
                background: isVehicle
                  ? 'radial-gradient(circle at 50% 44%, rgba(251, 191, 36, 0.36) 0%, rgba(180, 83, 9, 0.38) 34%, rgba(4, 6, 15, 0.86) 82%)'
                  : 'radial-gradient(circle at 50% 44%, rgba(245, 158, 11, 0.38) 0%, rgba(127, 29, 29, 0.36) 36%, rgba(5, 7, 15, 0.86) 84%)',
              }}
            />

            {/* Rotating Volumetric Golden Sunburst Rays */}
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 14, repeat: Infinity, ease: 'linear' }}
              className="absolute w-[340px] h-[340px] sm:w-[480px] sm:h-[480px] rounded-full opacity-45 pointer-events-none"
              style={{
                background:
                  'repeating-conic-gradient(from 0deg, rgba(253, 224, 71, 0.28) 0deg 10deg, transparent 10deg 26deg)',
                maskImage: 'radial-gradient(circle, black 12%, transparent 68%)',
                WebkitMaskImage: 'radial-gradient(circle, black 12%, transparent 68%)',
              }}
            />

            {/* Huge 3D Gift Model with Dynamic Zoom & Glow Entrance */}
            <motion.div
              initial={{ scale: 0.16, y: 45, opacity: 0, rotate: isVehicle ? -8 : 0 }}
              animate={{
                scale: [0.16, 1.24, 1.0, 1.08, 0.94],
                y: [45, -10, 0, -6, -12],
                opacity: [0, 1, 1, 1, 0.92],
                rotate: isVehicle ? [-8, 3, 0, -2, 0] : [0, -3, 2, 0, 0],
              }}
              transition={{
                duration: 4.3,
                times: [0, 0.22, 0.48, 0.78, 1],
                ease: 'easeOut',
              }}
              className="relative flex flex-col items-center justify-center"
            >
              {/* Multi-layered Golden Glow Orbs */}
              <span
                aria-hidden="true"
                className="absolute -inset-12 rounded-full bg-gradient-to-tr from-amber-400/55 via-yellow-200/35 to-rose-500/45 blur-3xl animate-pulse"
              />
              <motion.span
                aria-hidden="true"
                animate={{ scale: [0.92, 1.12, 0.92], opacity: [0.55, 0.95, 0.55] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute -inset-5 rounded-full border-2 border-[#FCE9A6]/70 shadow-[0_0_42px_rgba(251,191,36,0.9)]"
              />
              <motion.span
                aria-hidden="true"
                animate={{ rotate: -360 }}
                transition={{ duration: 9, repeat: Infinity, ease: 'linear' }}
                className="absolute -inset-9 rounded-full border border-dashed border-amber-300/60"
              />

              {/* Speed / Flame Streaks for Vehicle or Dragon Gifts */}
              {(isVehicle || isDragon) && (
                <motion.div
                  animate={{
                    scaleX: [0.85, 1.28, 0.95],
                    opacity: [0.55, 0.95, 0.65],
                  }}
                  transition={{ duration: 0.65, repeat: Infinity }}
                  className="absolute -right-24 sm:-right-36 top-1/2 -translate-y-1/2 w-36 sm:w-52 h-16 sm:h-24 origin-left pointer-events-none"
                  style={{
                    background:
                      'radial-gradient(ellipse at left, rgba(254, 240, 138, 0.9) 0%, rgba(249, 115, 22, 0.65) 45%, transparent 100%)',
                    filter: 'blur(8px)',
                  }}
                />
              )}

              <Fluent3DAsset
                glyph={event.gift.glyph}
                imageUrl={event.gift.imageUrl}
                alt={event.gift.name}
                priority
                sizeClass="w-36 h-36 sm:w-48 sm:h-48"
                fallbackTextClass="text-8xl"
                className="relative z-10 drop-shadow-[0_18px_38px_rgba(251,191,36,0.85)]"
              />

              {(event.quantity > 1 || event.comboCount > 1) && (
                <motion.div
                  initial={{ scale: 0.4, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.25 }}
                  className="relative z-20 -mt-3 inline-flex items-center gap-1.5 rounded-full border border-[#FFF8DC] bg-gradient-to-r from-[#FEF08A] via-[#D4AF37] to-[#B45309] px-3.5 py-1 text-xs sm:text-sm font-mono-num font-black text-[#070913] shadow-[0_0_24px_rgba(251,191,36,0.95)]"
                >
                  {event.quantity > 1 && <span>×{event.quantity}</span>}
                  {event.comboCount > 1 && <span>Combo ×{event.comboCount}</span>}
                </motion.div>
              )}
            </motion.div>

            {/* Prominent Royal Heraldic Banner */}
            <motion.div
              initial={{ y: 34, opacity: 0, scale: 0.9 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              transition={{ delay: 0.16, duration: 0.42, ease: 'easeOut' }}
              className="mt-5 w-full max-w-md rounded-3xl border-2 border-[#FCE9A6]/85 bg-gradient-to-r from-[#2D1A06]/95 via-[#0E0B14]/95 to-[#2D1A06]/95 px-5 py-3.5 shadow-[0_0_52px_rgba(245,158,11,0.75)] text-center relative overflow-hidden"
            >
              <div className="flex items-center justify-center gap-1.5 text-[11px] font-extrabold text-amber-300 mb-1">
                {isDragon ? (
                  <Flame className="w-3.5 h-3.5 text-orange-400" />
                ) : (
                  <Crown className="w-3.5 h-3.5 text-[#FCE9A6]" />
                )}
                <span>عرض الهدايا الملكية الفاخرة</span>
                <Sparkles className="w-3.5 h-3.5 text-[#FCE9A6]" />
              </div>

              <p className="text-sm sm:text-base font-extrabold text-white leading-snug">
                أهدى <span className="text-[#FCE9A6]">{event.senderName}</span>{' '}
                <span className="text-amber-300">{event.gift.name}</span>
              </p>

              <p className="text-xs sm:text-sm font-bold text-amber-100/95 mt-1">
                إلى{' '}
                <span className="text-[#FCE9A6]">
                  {event.recipientNames.length > 1
                    ? `الجميع على المايكات (${event.recipientNames.length})`
                    : event.recipientNames[0] || hostName}
                </span>
              </p>

              {event.luckyMultiplier ? (
                <p className="mt-1.5 text-[11px] font-mono-num font-extrabold text-emerald-300">
                  مضاعف الحظ ×{event.luckyMultiplier} · +{event.luckyBonusCoins?.toLocaleString('en-US') || 0} كوينز
                </p>
              ) : null}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
