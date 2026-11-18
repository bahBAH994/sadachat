import React, { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Mic, MicOff, Music2, X } from 'lucide-react';
import { useActiveRoom } from '../context/ActiveRoomContext';
import { resolveAsset } from '../lib/assets';

export const FloatingMinimizedRoom: React.FC = () => {
  const navigate = useNavigate();
  const wasDraggedRef = useRef(false);
  const {
    room,
    isMinimized,
    mySeat,
    musicState,
    restoreRoom,
    leaveActiveRoom,
    handleToggleMute,
  } = useActiveRoom();

  if (!room || !isMinimized) return null;

  const isSomeoneSpeaking = room.seats.some((s) => s.userId && s.isSpeaking && !s.isMuted);
  const isMusicPlaying = Boolean(musicState?.isPlaying);

  const handleOpenRoom = () => {
    if (wasDraggedRef.current) {
      wasDraggedRef.current = false;
      return;
    }
    restoreRoom();
    navigate(`/room/${room.id}`);
  };

  return (
    <motion.div
      drag
      dragMomentum={false}
      dragElastic={0.12}
      onDragStart={() => {
        wasDraggedRef.current = true;
      }}
      onDragEnd={() => {
        window.setTimeout(() => {
          wasDraggedRef.current = false;
        }, 180);
      }}
      initial={{ scale: 0.7, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="fixed bottom-24 left-4 z-[60] flex flex-col items-center select-none touch-none"
    >
      <div className="relative">
        <span
          className={`absolute -inset-2 rounded-full pointer-events-none ${
            isSomeoneSpeaking || isMusicPlaying
              ? 'border-2 border-[#FCE9A6]/90 animate-gold-wave'
              : 'border border-emerald-400/60 animate-ping opacity-45'
          }`}
        />

        {/* Main Floating Spinning Agency Orb */}
        <button
          type="button"
          onClick={handleOpenRoom}
          className="relative w-16 h-16 rounded-full p-0.5 bg-gradient-to-br from-[#FCE9A6] via-[#D4AF37] to-[#78350F] shadow-[0_8px_28px_rgba(212,175,55,0.65)] cursor-pointer active:scale-95 transition-transform"
          title={`العودة إلى ${room.title}`}
        >
          <img
            src={resolveAsset(room.hostAvatar)}
            alt={room.title}
            referrerPolicy="no-referrer"
            className="w-full h-full rounded-full object-cover animate-spin-slow bg-[#0B0906]"
          />
          {isMusicPlaying && (
            <span className="absolute -top-1 left-1/2 -translate-x-1/2 rounded-full bg-emerald-500 text-white p-0.5 shadow">
              <Music2 className="w-2.5 h-2.5" />
            </span>
          )}
        </button>

        {/* Close / Leave Room completely */}
        <button
          type="button"
          onClick={async (e) => {
            e.stopPropagation();
            await leaveActiveRoom();
            if (window.location.hash.includes('/room/')) {
              navigate('/', { replace: true });
            }
          }}
          className="absolute -top-1.5 -left-1.5 w-6 h-6 rounded-full bg-[#111422] border border-[#F3D37A]/70 text-white hover:bg-rose-600 flex items-center justify-center shadow-md cursor-pointer"
          aria-label="خروج من الوكالة"
          title="خروج من الوكالة"
        >
          <X className="w-3.5 h-3.5" />
        </button>

        {/* Quick Mic Mute/Unmute when seated */}
        {mySeat && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              void handleToggleMute();
            }}
            className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full border border-black flex items-center justify-center shadow-md cursor-pointer ${
              mySeat.isMuted
                ? 'bg-rose-600 text-white'
                : 'bg-emerald-500 text-white'
            }`}
            aria-label={mySeat.isMuted ? 'فتح المايك' : 'كتم المايك'}
            title={mySeat.isMuted ? 'فتح المايك' : 'كتم المايك'}
          >
            {mySeat.isMuted ? (
              <MicOff className="w-3 h-3" />
            ) : (
              <Mic className="w-3 h-3" />
            )}
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={handleOpenRoom}
        className="mt-1.5 px-2.5 py-0.5 rounded-full bg-[#11100C]/90 border border-[#D4AF37]/50 text-[10px] font-bold text-[#FCE9A6] max-w-[100px] truncate shadow-md cursor-pointer"
      >
        {room.title}
      </button>
    </motion.div>
  );
};
