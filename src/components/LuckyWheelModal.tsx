import React, { useEffect, useRef, useState } from 'react';
import { Sparkles, Trophy, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { spinRoomLuckyWheelInSupabase } from '../lib/sadaRoomsService';
import {
  fireGoldCoinConfetti,
  playCoinWinSound,
  playWheelPegTick,
} from '../lib/sadaAudio';
import { Fluent3DAsset } from './Fluent3DAsset';
import type { LuckyWheelSegment, Room, User } from '../types';

interface LuckyWheelModalProps {
  roomId: string;
  userCoins: number;
  wheelCost: number;
  segments: LuckyWheelSegment[];
  onClose: () => void;
  onSpinComplete: (user: User, room: Room) => void;
}

const SPIN_DURATION_MS = 4400;

// Smooth progressive deceleration curve matching physical wheel friction
function easeOutQuint(t: number): number {
  return 1 - Math.pow(1 - t, 5);
}

export const LuckyWheelModal: React.FC<LuckyWheelModalProps> = ({
  roomId,
  userCoins,
  wheelCost,
  segments,
  onClose,
  onSpinComplete,
}) => {
  const { user } = useAuth();
  const [rotation, setRotation] = useState(0);
  const [pointerAngle, setPointerAngle] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [wonSegment, setWonSegment] = useState<LuckyWheelSegment | null>(null);
  const [error, setError] = useState<string | null>(null);

  const rafRef = useRef<number | null>(null);
  const rotationRef = useRef(0);

  const count = segments.length || 8;
  const sliceAngle = 360 / count;

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  const animatePhysicsSpin = (
    fromDeg: number,
    toDeg: number,
    onDone: () => void
  ) => {
    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current);
    }

    const startTime = performance.now();
    let lastPegIndex = Math.floor(fromDeg / sliceAngle);
    let ptrAngle = 0;
    let ptrVel = 0;
    let lastFrameTime = startTime;

    const step = (now: number) => {
      const elapsed = now - startTime;
      const dt = Math.min(0.05, Math.max(0.001, (now - lastFrameTime) / 1000));
      lastFrameTime = now;

      const t = Math.min(1, elapsed / SPIN_DURATION_MS);
      const eased = easeOutQuint(t);
      const currentDeg = fromDeg + (toDeg - fromDeg) * eased;

      // Angular velocity estimate (0..1) for peg-deflection kick scaling
      const velocityRatio = Math.pow(1 - t, 4);

      const pegIndex = Math.floor(currentDeg / sliceAngle);
      if (pegIndex > lastPegIndex) {
        lastPegIndex = pegIndex;
        playWheelPegTick(velocityRatio);
        // Kick pointer backwards realistically when peg strikes it
        ptrAngle = -Math.min(34, 15 + velocityRatio * 20);
        ptrVel = 90;
      }

      // Spring-damper physics pulling pointer back to upright (0 deg)
      const springK = 220;
      const damping = 16;
      const accel = -springK * ptrAngle - damping * ptrVel;
      ptrVel += accel * dt;
      ptrAngle += ptrVel * dt;

      rotationRef.current = currentDeg;
      setRotation(currentDeg);
      setPointerAngle(Math.abs(ptrAngle) < 0.15 && t >= 1 ? 0 : ptrAngle);

      if (t < 1) {
        rafRef.current = window.requestAnimationFrame(step);
      } else {
        rafRef.current = null;
        rotationRef.current = toDeg;
        setRotation(toDeg);
        setPointerAngle(0);
        onDone();
      }
    };

    rafRef.current = window.requestAnimationFrame(step);
  };

  const handleSpin = async () => {
    if (spinning || !user) return;
    setError(null);
    setWonSegment(null);
    setSpinning(true);

    try {
      const result = await spinRoomLuckyWheelInSupabase(roomId, user);

      // Compute exact rotation so segmentIndex lands directly under the top pointer (0 deg)
      const centerAngle = result.segmentIndex * sliceAngle + sliceAngle / 2;
      const targetMod = (360 - centerAngle) % 360;
      const baseRot = rotationRef.current;
      const currentMod = ((baseRot % 360) + 360) % 360;
      const delta = (targetMod - currentMod + 360) % 360;
      const nextRotation = baseRot + 360 * 7 + delta;

      animatePhysicsSpin(baseRot, nextRotation, () => {
        setSpinning(false);
        setWonSegment(result.segment);
        const isJackpot =
          (result.segment.coinsAmount ?? 0) >= 1000 ||
          result.segment.rewardType === 'frame';
        playCoinWinSound(isJackpot);
        fireGoldCoinConfetti(isJackpot ? 'jackpot' : 'normal');
        onSpinComplete(result.user, result.room);
      });
    } catch (err) {
      setSpinning(false);
      setError(err instanceof Error ? err.message : 'تعذّر تدوير دولاب الحظ.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
      onClick={() => !spinning && onClose()}
    >
      <div
        className="royal-glass w-full max-w-md rounded-3xl p-5 sm:p-6 space-y-4 relative overflow-hidden border-2 border-[#F3D37A]/55 shadow-[0_24px_60px_rgba(0,0,0,0.85),0_0_40px_rgba(212,175,55,0.22)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-extrabold gold-gradient-text flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#F3D37A]" />
              <span>دولاب الحظ الملكي 3D</span>
            </h3>
            <p className="text-xs text-slate-300 font-mono-num mt-0.5">
              رصيدك: {userCoins.toLocaleString('en-US')} كوينز · التكلفة {wheelCost} كوينز
            </p>
          </div>
          <button
            type="button"
            disabled={spinning}
            onClick={onClose}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-full text-slate-400 hover:text-white disabled:opacity-40 cursor-pointer"
            aria-label="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-500/40 bg-rose-950/60 px-3.5 py-2.5 text-xs text-rose-200">
            {error}
          </div>
        )}

        {/* Royal 3D Wheel Stage */}
        <div className="relative flex items-center justify-center py-4">
          {/* Ambient radial golden aura behind the wheel */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-4 rounded-full bg-amber-400/15 blur-2xl"
          />

          {/* Physics-Driven 3D Metallic Top Pointer with Pivot Hinge */}
          <div
            className="absolute -top-0.5 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center pointer-events-none drop-shadow-[0_8px_14px_rgba(0,0,0,0.9)]"
            style={{
              transformOrigin: '50% 10px',
              transform: `translateX(-50%) rotate(${pointerAngle.toFixed(2)}deg)`,
            }}
            aria-hidden="true"
          >
            <svg width={44} height={48} viewBox="0 0 46 54" className="w-11 h-12">
              <defs>
                <linearGradient id="modalPtrGold" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#FFFBEB" />
                  <stop offset="45%" stopColor="#FACC15" />
                  <stop offset="100%" stopColor="#92400E" />
                </linearGradient>
                <radialGradient id="modalPtrGem" cx="35%" cy="35%" r="65%">
                  <stop offset="0%" stopColor="#FECDD3" />
                  <stop offset="45%" stopColor="#E11D48" />
                  <stop offset="100%" stopColor="#881337" />
                </radialGradient>
              </defs>
              <path
                d="M23 51 L6 17 C4 9, 12 2, 23 2 C34 2, 42 9, 40 17 Z"
                fill="url(#modalPtrGold)"
                stroke="#FEF9C3"
                strokeWidth="2.2"
              />
              <circle
                cx="23"
                cy="14"
                r="6.2"
                fill="url(#modalPtrGem)"
                stroke="#FEF08A"
                strokeWidth="1.6"
              />
            </svg>
          </div>

          {/* 3D Brushed Gold Metallic Outer Cabinet Bezel + 24 Glowing Marquee Lights */}
          <div className="relative w-72 h-72 sm:w-80 sm:h-80 rounded-full p-3.5 bg-gradient-to-br from-[#FFFBEB] via-[#D4AF37] to-[#5C3A06] shadow-[0_24px_55px_rgba(0,0,0,0.9),0_0_48px_rgba(212,175,55,0.48),inset_0_4px_8px_rgba(255,255,255,0.75),inset_0_-6px_12px_rgba(0,0,0,0.6)]">
            {/* Perimeter Glowing Marquee Studs on the Gold Frame */}
            {Array.from({ length: 24 }).map((_, i) => {
              const deg = (i * 360) / 24;
              const rad = ((deg - 90) * Math.PI) / 180;
              const leftPct = 50 + 47.4 * Math.cos(rad);
              const topPct = 50 + 47.4 * Math.sin(rad);
              return (
                <span
                  key={`bulb_${i}`}
                  aria-hidden="true"
                  className={`pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full animate-marquee-bulb ${
                    i % 2 === 0 ? 'bg-[#FFFBEB]' : 'bg-[#FDE047]'
                  }`}
                  style={{
                    left: `${leftPct}%`,
                    top: `${topPct}%`,
                    animationDelay: `${(i % 4) * (spinning ? 90 : 250)}ms`,
                    animationDuration: spinning ? '0.4s' : '1.3s',
                  }}
                />
              );
            })}

            {/* Deep Inner Metallic Shadow Channel */}
            <div className="relative w-full h-full rounded-full p-1.5 bg-gradient-to-b from-[#1E293B] via-[#0B1120] to-[#020617] shadow-[inset_0_5px_14px_rgba(0,0,0,0.95)]">
              <div
                className="relative w-full h-full rounded-full overflow-hidden bg-[#070913] shadow-[inset_0_0_26px_rgba(0,0,0,0.78)]"
                style={{
                  transform: `rotate(${rotation}deg)`,
                  willChange: 'transform',
                }}
              >
                <svg width={200} height={200} viewBox="0 0 200 200" className="w-full h-full">
                  <defs>
                    <linearGradient id="wheelGoldSlice" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#FEF08A" />
                      <stop offset="48%" stopColor="#D4AF37" />
                      <stop offset="100%" stopColor="#854D0E" />
                    </linearGradient>
                    <linearGradient id="wheelRoyalNavySlice" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#334155" />
                      <stop offset="50%" stopColor="#1E293B" />
                      <stop offset="100%" stopColor="#090D1F" />
                    </linearGradient>
                    <radialGradient id="wheelHubGrad" cx="35%" cy="30%" r="70%">
                      <stop offset="0%" stopColor="#FFFBEB" />
                      <stop offset="45%" stopColor="#D4AF37" />
                      <stop offset="100%" stopColor="#451A03" />
                    </radialGradient>
                  </defs>

                  {segments.map((seg, i) => {
                    const startDeg = i * sliceAngle - 90;
                    const endDeg = startDeg + sliceAngle;
                    const startRad = (startDeg * Math.PI) / 180;
                    const endRad = (endDeg * Math.PI) / 180;
                    const x1 = 100 + 100 * Math.cos(startRad);
                    const y1 = 100 + 100 * Math.sin(startRad);
                    const x2 = 100 + 100 * Math.cos(endRad);
                    const y2 = 100 + 100 * Math.sin(endRad);
                    const midDeg = startDeg + sliceAngle / 2;
                    const isGold = i % 2 === 0;

                    return (
                      <g key={seg.id}>
                        <path
                          d={`M 100 100 L ${x1} ${y1} A 100 100 0 0 1 ${x2} ${y2} Z`}
                          fill={isGold ? 'url(#wheelGoldSlice)' : 'url(#wheelRoyalNavySlice)'}
                          stroke="#FDE047"
                          strokeOpacity="0.45"
                          strokeWidth="1.2"
                        />
                        <g transform={`rotate(${midDeg + 90} 100 100)`}>
                          <text
                            x="100"
                            y="55"
                            textAnchor="middle"
                            fill={isGold ? '#0B0F20' : '#FEF08A'}
                            fontSize="6.6"
                            fontWeight="900"
                            fontFamily="Cairo, sans-serif"
                          >
                            {seg.shortLabel}
                          </text>
                        </g>
                      </g>
                    );
                  })}

                  {/* Physical Slice Divider Pegs That Strike the Top Pointer */}
                  {segments.map((_, i) => {
                    const deg = i * sliceAngle - 90;
                    const rad = (deg * Math.PI) / 180;
                    const px = 100 + 94.5 * Math.cos(rad);
                    const py = 100 + 94.5 * Math.sin(rad);
                    return (
                      <circle
                        key={`stud_${i}`}
                        cx={px}
                        cy={py}
                        r="2.8"
                        fill="#FFFBEB"
                        stroke="#78350F"
                        strokeWidth="1"
                      />
                    );
                  })}

                  {/* 3D Metallic Center Hub */}
                  <circle
                    cx="100"
                    cy="100"
                    r="21"
                    fill="url(#wheelHubGrad)"
                    stroke="#FFFBEB"
                    strokeWidth="2.4"
                  />
                  <circle
                    cx="100"
                    cy="100"
                    r="15"
                    fill="#070913"
                    stroke="#FDE047"
                    strokeWidth="1.5"
                  />
                  <text
                    x="100"
                    y="103"
                    textAnchor="middle"
                    fill="#FCE9A6"
                    fontSize="7.5"
                    fontWeight="900"
                    fontFamily="Cairo, sans-serif"
                  >
                    صَدَى
                  </text>
                </svg>

                {/* Crisp Fluent 3D PNG Icons Overlaid on Each Slice */}
                {segments.map((seg, i) => {
                  const startDeg = i * sliceAngle - 90;
                  const midDeg = startDeg + sliceAngle / 2;
                  const midRad = (midDeg * Math.PI) / 180;
                  const leftPct = 50 + 34.5 * Math.cos(midRad);
                  const topPct = 50 + 34.5 * Math.sin(midRad);
                  return (
                    <div
                      key={`icon_${seg.id}`}
                      className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
                      style={{
                        left: `${leftPct}%`,
                        top: `${topPct}%`,
                        transform: `translate(-50%, -50%) rotate(${midDeg + 90}deg)`,
                      }}
                    >
                      <Fluent3DAsset
                        glyph={seg.glyph}
                        alt={seg.shortLabel}
                        priority
                        sizeClass="w-7 h-7 sm:w-8 sm:h-8"
                        fallbackTextClass="text-base"
                        className="drop-shadow-[0_4px_6px_rgba(0,0,0,0.75)]"
                      />
                    </div>
                  );
                })}
              </div>

              {/* 3D Glassy Specular Dome Reflection Overlay */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-b from-white/15 via-transparent to-black/25"
              />
            </div>
          </div>
        </div>

        {wonSegment && (
          <div className="rounded-2xl border border-[#F3D37A]/75 bg-gradient-to-r from-[#D4AF37]/25 via-[#D4AF37]/15 to-[#D4AF37]/25 px-4 py-3 text-center space-y-1 shadow-[0_0_24px_rgba(212,175,55,0.3)]">
            <div className="flex items-center justify-center gap-2 text-sm font-extrabold text-[#FCE9A6]">
              <Trophy className="w-4 h-4 text-[#D4AF37] shrink-0" />
              <Fluent3DAsset
                glyph={wonSegment.glyph}
                alt={wonSegment.label}
                priority
                sizeClass="w-7 h-7"
                fallbackTextClass="text-lg"
              />
              <span>مبروك! ربحت {wonSegment.label}</span>
            </div>
            <p className="text-[11px] text-slate-200">
              تمت إضافة جائزتك وإرسال تهنئة الفوز في شات الغرفة!
            </p>
          </div>
        )}

        <button
          type="button"
          disabled={spinning || userCoins < wheelCost}
          onClick={handleSpin}
          className="gold-btn w-full min-h-[48px] rounded-2xl py-3 text-sm sm:text-base cursor-pointer disabled:opacity-50"
        >
          {spinning
            ? 'يدور الدولاب الآن...'
            : `تدوير دولاب الحظ (${wheelCost} كوينز)`}
        </button>
      </div>
    </div>
  );
};
