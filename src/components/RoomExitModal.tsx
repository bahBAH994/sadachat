import React from 'react';
import { motion } from 'motion/react';
import { LogOut, Minimize2, X } from 'lucide-react';
import { resolveAsset } from '../lib/assets';

interface RoomExitModalProps {
  roomTitle: string;
  roomAvatar: string;
  isOnMic: boolean;
  onKeepMinimized: () => void;
  onLeaveRoom: () => void;
  onCancel: () => void;
}

export const RoomExitModal: React.FC<RoomExitModalProps> = ({
  roomTitle,
  roomAvatar,
  isOnMic,
  onKeepMinimized,
  onLeaveRoom,
  onCancel,
}) => {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
      onClick={onCancel}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.92, opacity: 0 }}
        transition={{ duration: 0.16 }}
        onClick={(e) => e.stopPropagation()}
        className="royal-glass w-full max-w-xs rounded-3xl p-5 text-center space-y-4 border border-[#F3D37A]/50 shadow-[0_18px_50px_rgba(0,0,0,0.7)]"
      >
        <div className="flex justify-end -mb-2">
          <button
            type="button"
            onClick={onCancel}
            className="w-8 h-8 rounded-full bg-white/10 text-slate-300 hover:text-white flex items-center justify-center cursor-pointer"
            aria-label="إلغاء"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-col items-center gap-2">
          <img
            src={resolveAsset(roomAvatar)}
            alt={roomTitle}
            referrerPolicy="no-referrer"
            className="w-16 h-16 rounded-2xl object-cover border-2 border-[#D4AF37]/70 shadow-[0_0_20px_rgba(212,175,55,0.4)]"
          />
          <h3 className="text-base font-extrabold text-white truncate max-w-full">
            {roomTitle}
          </h3>
          <p className="text-xs text-slate-300 leading-relaxed">
            {isOnMic
              ? 'أنت جالس على المايك حالياً. يمكنك الاحتفاظ بالغرفة ككرة عائمة مع استمرار صوتك!'
              : 'هل تريد الاحتفاظ بالوكالة مصغّرة أثناء التصفح أم الخروج نهائياً؟'}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2.5 pt-1">
          <button
            type="button"
            onClick={onKeepMinimized}
            className="min-h-[44px] rounded-2xl bg-gradient-to-r from-[#22E568] to-[#0FA958] text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-[0_6px_18px_rgba(16,185,129,0.45)] cursor-pointer active:scale-95 transition"
          >
            <Minimize2 className="w-4 h-4" />
            <span>احتفظ</span>
          </button>
          <button
            type="button"
            onClick={onLeaveRoom}
            className="min-h-[44px] rounded-2xl bg-rose-600/25 border border-rose-500/50 text-rose-200 hover:bg-rose-600/40 font-extrabold text-xs sm:text-sm flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition"
          >
            <LogOut className="w-4 h-4" />
            <span>خروج من الوكالة</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
};
