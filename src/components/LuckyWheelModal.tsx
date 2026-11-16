import React, { useState } from 'react';
import { Sparkles, Trophy, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { spinRoomLuckyWheelInSupabase } from '../lib/sadaRoomsService';
import type { LuckyWheelSegment, Room, User } from '../types';

interface LuckyWheelModalProps {
  roomId: string;
  userCoins: number;
  wheelCost: number;
  segments: LuckyWheelSegment[];
  onClose: () => void;
  onSpinComplete: (user: User, room: Room) => void;
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
  const [spinning, setSpinning] = useState(false);
  const [wonSegment, setWonSegment] = useState<LuckyWheelSegment | null>(null);
  const [error, setError] = useState<string | null>(null);

  const count = segments.length || 8;
  const sliceAngle = 360 / count;

  const handleSpin = async () => {
    if (spinning || !user) return;
    setError(null);
    setWonSegment(null);
    setSpinning(true);

    try {
      const result = await spinRoomLuckyWheelInSupabase(roomId, user);

      // Compute exact rotation so segmentIndex lands under top pointer (0 deg)
      const centerAngle = result.segmentIndex * sliceAngle + sliceAngle / 2;
      const targetMod = (360 - centerAngle) % 360;
      const currentMod = ((rotation % 360) + 360) % 360;
      const delta = (targetMod - currentMod + 360) % 360;
      const nextRotation = rotation + 360 * 6 + delta;

      setRotation(nextRotation);

      setTimeout(() => {
        setSpinning(false);
        setWonSegment(result.segment);
        onSpinComplete(result.user, result.room);
      }, 4200);
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
        className="royal-glass w-full max-w-md rounded-3xl p-6 space-y-5 relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-extrabold gold-gradient-text flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#F3D37A]" />
              <span>دولاب الحظ الملكي</span>
            </h3>
            <p className="text-xs text-slate-400 font-mono-num mt-0.5">
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

        {/* Wheel Stage */}
        <div className="relative flex items-center justify-center py-2">
          {/* Golden Top Pointer */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center pointer-events-none">
            <div className="w-0 h-0 border-l-[11px] border-r-[11px] border-t-[20px] border-l-transparent border-r-transparent border-t-[#FCE9A6] drop-shadow-[0_0_10px_rgba(243,211,122,0.9)]" />
          </div>

          <div
            className="relative w-72 h-72 sm:w-80 sm:h-80 rounded-full p-2 bg-gradient-to-br from-[#F3D37A] via-[#D4AF37] to-[#7D5B12] shadow-[0_0_40px_rgba(212,175,55,0.35)]"
          >
            <div
              className="w-full h-full rounded-full overflow-hidden bg-[#070913]"
              style={{
                transform: `rotate(${rotation}deg)`,
                transition: spinning
                  ? 'transform 4.1s cubic-bezier(0.12, 0.85, 0.16, 1)'
                  : 'none',
              }}
            >
              <svg viewBox="0 0 200 200" className="w-full h-full">
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
                  const isEven = i % 2 === 0;

                  return (
                    <g key={seg.id}>
                      <path
                        d={`M 100 100 L ${x1} ${y1} A 100 100 0 0 1 ${x2} ${y2} Z`}
                        fill={isEven ? '#0E1326' : '#181F3D'}
                        stroke="#D4AF37"
                        strokeOpacity="0.45"
                        strokeWidth="0.7"
                      />
                      <g transform={`rotate(${midDeg + 90} 100 100)`}>
                        <text
                          x="100"
                          y="28"
                          textAnchor="middle"
                          fontSize="11"
                        >
                          {seg.glyph}
                        </text>
                        <text
                          x="100"
                          y="43"
                          textAnchor="middle"
                          fill={isEven ? '#FCE9A6' : '#E2E8F0'}
                          fontSize="6.4"
                          fontWeight="700"
                          fontFamily="Cairo, sans-serif"
                        >
                          {seg.shortLabel}
                        </text>
                      </g>
                    </g>
                  );
                })}
                <circle
                  cx="100"
                  cy="100"
                  r="18"
                  fill="#070913"
                  stroke="#F3D37A"
                  strokeWidth="2.5"
                />
                <text
                  x="100"
                  y="103"
                  textAnchor="middle"
                  fill="#FCE9A6"
                  fontSize="8"
                  fontWeight="800"
                  fontFamily="Cairo, sans-serif"
                >
                  صَدَى
                </text>
              </svg>
            </div>
          </div>
        </div>

        {wonSegment && (
          <div className="rounded-2xl border border-[#F3D37A]/60 bg-gradient-to-r from-[#D4AF37]/20 via-[#D4AF37]/10 to-[#D4AF37]/20 px-4 py-3 text-center space-y-1">
            <div className="flex items-center justify-center gap-2 text-sm font-extrabold text-[#FCE9A6]">
              <Trophy className="w-4 h-4 text-[#D4AF37]" />
              <span>مبارك! ربحت {wonSegment.glyph} {wonSegment.label}</span>
            </div>
            <p className="text-[11px] text-slate-300">
              تمت إضافة جائزتك فوراً ونشر إعلان الفوز في دردشة المجلس!
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
