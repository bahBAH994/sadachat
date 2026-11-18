import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Radio, X } from 'lucide-react';
import { useActiveRoom } from '../context/ActiveRoomContext';

export const FloatingMinimizedRoom: React.FC = () => {
  const navigate = useNavigate();
  const {
    activeRoomId,
    room,
    isMinimized,
    restoreRoom,
    leaveActiveRoom,
  } = useActiveRoom();

  try {
    const targetRoomId = room?.id || activeRoomId || '';
    if (!isMinimized || !targetRoomId) {
      return null;
    }

    const safeTitle = room?.title || 'الغرفة';

    const handleOpenRoom = () => {
      try {
        restoreRoom?.();
        if (targetRoomId) {
          navigate(`/room/${targetRoomId}`);
        }
      } catch {
        // ignore navigation errors
      }
    };

    const handleExitRoom = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      try {
        if (window.exitCurrentRoom) {
          void window.exitCurrentRoom();
        } else {
          void leaveActiveRoom?.();
          if (window.location.hash.includes('/room/')) {
            navigate('/', { replace: true });
          }
        }
      } catch {
        // ignore exit errors
      }
    };

    return (
      <div className="fixed bottom-24 left-4 z-[60] flex flex-col items-center select-none pointer-events-auto">
        <div className="relative">
          <button
            type="button"
            onClick={handleOpenRoom}
            className="relative w-14 h-14 rounded-full bg-gradient-to-br from-[#FCE9A6] via-[#D4AF37] to-[#78350F] p-0.5 shadow-[0_8px_24px_rgba(212,175,55,0.55)] cursor-pointer active:scale-95 transition-transform flex items-center justify-center"
            title={`العودة إلى ${safeTitle}`}
            aria-label={`العودة إلى ${safeTitle}`}
          >
            <div className="w-full h-full rounded-full bg-[#11100C] flex items-center justify-center text-[#FCE9A6]">
              <Radio className="w-6 h-6 animate-pulse" />
            </div>
          </button>

          <button
            type="button"
            onClick={handleExitRoom}
            className="absolute -top-1.5 -left-1.5 w-6 h-6 rounded-full bg-[#111422] border border-[#F3D37A]/70 text-white hover:bg-rose-600 flex items-center justify-center shadow-md cursor-pointer"
            aria-label="خروج من الوكالة"
            title="خروج من الوكالة"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <button
          type="button"
          onClick={handleOpenRoom}
          className="mt-1.5 px-2.5 py-0.5 rounded-full bg-[#11100C]/90 border border-[#D4AF37]/50 text-[10px] font-bold text-[#FCE9A6] max-w-[110px] truncate shadow-md cursor-pointer"
        >
          {safeTitle}
        </button>
      </div>
    );
  } catch {
    return null;
  }
};
