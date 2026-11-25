import React from 'react';
import { createPortal } from 'react-dom';
import { LogOut, Minimize2, X } from 'lucide-react';
import { resolveAsset } from '../lib/assets';

interface RoomExitModalProps {
  roomTitle: string;
  roomAvatar: string;
  isOnMic: boolean;
  isAgency: boolean;
  onCancel: () => void;
}

export const RoomExitModal: React.FC<RoomExitModalProps> = ({
  roomTitle,
  roomAvatar,
  isOnMic,
  isAgency,
  onCancel,
}) => {
  const placeName = isAgency ? 'الوكالة' : 'الغرفة';
  const modalContent = (
    <div
      style={{ zIndex: 999999 }}
      className="fixed inset-0 z-[999999] pointer-events-auto flex items-center justify-center bg-[#0d111e] p-4"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onCancel?.();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={`خيارات الخروج من ${placeName}`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="royal-glass room-modal-panel pointer-events-auto relative z-10 w-full max-w-xs rounded-3xl p-5 text-center space-y-4 border border-[#F3D37A]/50 shadow-[0_18px_50px_rgba(0,0,0,0.7)]"
      >
        <div className="flex justify-end -mb-2">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onCancel?.();
            }}
            className="w-8 h-8 rounded-full bg-white/10 text-slate-300 hover:text-white flex items-center justify-center cursor-pointer pointer-events-auto touch-manipulation"
            aria-label="إلغاء"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-col items-center gap-2">
          <img
            src={resolveAsset(roomAvatar || '')}
            alt={roomTitle || 'الغرفة'}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            className="w-16 h-16 rounded-2xl object-cover border-2 border-[#D4AF37]/70 shadow-[0_0_20px_rgba(212,175,55,0.4)]"
          />
          <h3 className="text-base font-extrabold text-white truncate max-w-full">
            {roomTitle || 'الغرفة'}
          </h3>
          <p className="text-xs text-slate-300 leading-relaxed">
            {isOnMic
              ? `أنت جالس على المايك حالياً. يمكنك تصغير ${placeName} ككرة عائمة مع استمرار صوتك!`
              : `هل تريد تصغير ${placeName} أثناء التصفح أم الخروج نهائياً؟`}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2.5 pt-1">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              window.dispatchEvent(new Event('sada:minimize'));
            }}
            className="min-h-[46px] rounded-2xl bg-gradient-to-r from-[#22E568] to-[#0FA958] text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-[0_6px_18px_rgba(16,185,129,0.45)] cursor-pointer pointer-events-auto touch-manipulation active:scale-95 transition"
          >
            <Minimize2 className="w-4 h-4" />
            <span>تصغير</span>
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              window.dispatchEvent(new Event('sada:leave'));
            }}
            className="min-h-[46px] rounded-2xl bg-rose-600/30 border border-rose-500/60 text-rose-100 hover:bg-rose-600/45 font-extrabold text-xs sm:text-sm flex items-center justify-center gap-1.5 cursor-pointer pointer-events-auto touch-manipulation active:scale-95 transition"
          >
            <LogOut className="w-4 h-4" />
            <span>خروج من {placeName}</span>
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document !== 'undefined') {
    return createPortal(modalContent, document.body);
  }
  return modalContent;
};
