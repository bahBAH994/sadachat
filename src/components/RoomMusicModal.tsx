import React, { useState } from 'react';
import {
  Disc3,
  Mic,
  Music,
  Pause,
  Play,
  Square,
  Upload,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import type { RoomMusicState } from '../types';

interface RoomMusicModalProps {
  isOnMic: boolean;
  musicState: RoomMusicState | null;
  musicVolume: number;
  musicMutedLocally: boolean;
  effectsMuted?: boolean;
  onVolumeChange: (val: number) => void;
  onToggleLocalMute: () => void;
  onToggleEffectsMuted?: () => void;
  onPlayUploaded: (trackName: string, dataUrl: string) => Promise<void>;
  onTogglePlayPause: () => Promise<void>;
  onStopMusic: () => Promise<void>;
  onClimbMic: () => void;
  onClose: () => void;
}

export const RoomMusicModal: React.FC<RoomMusicModalProps> = ({
  isOnMic,
  musicState,
  musicVolume,
  musicMutedLocally,
  effectsMuted = false,
  onVolumeChange,
  onToggleLocalMute,
  onToggleEffectsMuted,
  onPlayUploaded,
  onTogglePlayPause,
  onStopMusic,
  onClimbMic,
  onClose,
}) => {
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const handleAudioFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setMsg(null);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        if (typeof reader.result === 'string') {
          await onPlayUploaded(file.name.replace(/\.[^.]+$/, ''), reader.result);
          setMsg(`تم تشغيل "${file.name}" من جهازك وبثه للمتواجدين!`);
        }
      } catch (err) {
        setMsg(err instanceof Error ? err.message : 'تعذّر تشغيل الملف الصوتي.');
      } finally {
        setUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#0d111e] p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="royal-glass room-modal-panel w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#F3D37A] to-[#B58922] text-[#070913] flex items-center justify-center">
              <Music className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold gold-gradient-text">
                مشغّل موسيقى المايك 🎵
              </h3>
              <p className="text-[11px] text-slate-400">
                تشغيل الملفات الصوتية من جهازك مباشرةً داخل الغرفة
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/5 text-slate-300 hover:text-white flex items-center justify-center cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Now Playing Banner */}
        {musicState && (
          <div className="rounded-2xl border border-[#D4AF37]/40 bg-[#070913]/85 p-3.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <Disc3
                className={`w-8 h-8 text-[#F3D37A] shrink-0 ${
                  musicState.isPlaying ? 'animate-spin-slow' : ''
                }`}
              />
              <div className="min-w-0">
                <p className="text-xs font-extrabold text-white truncate">
                  {musicState.trackName}
                </p>
                <p className="text-[10px] text-emerald-300">
                  {musicState.isPlaying ? 'يُبث الآن' : 'متوقف مؤقتاً'} · DJ: {musicState.djName}
                </p>
              </div>
            </div>
            {isOnMic && (
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => void onTogglePlayPause()}
                  className="w-9 h-9 rounded-xl bg-[#D4AF37] text-[#070913] flex items-center justify-center cursor-pointer"
                >
                  {musicState.isPlaying ? (
                    <Pause className="w-4 h-4" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => void onStopMusic()}
                  className="w-9 h-9 rounded-xl bg-rose-600/30 text-rose-200 flex items-center justify-center cursor-pointer"
                >
                  <Square className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Listener Local Volume Control */}
        <div className="rounded-2xl bg-white/5 border border-white/10 p-3 flex items-center gap-3">
          <button
            type="button"
            onClick={onToggleLocalMute}
            className="w-9 h-9 rounded-xl bg-white/10 text-[#FCE9A6] flex items-center justify-center cursor-pointer shrink-0"
          >
            {musicMutedLocally ? (
              <VolumeX className="w-4 h-4 text-rose-400" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </button>
          <div className="flex-1">
            <div className="flex justify-between text-[11px] text-slate-300 mb-1">
              <span>مستوى صوت الموسيقى لديك</span>
              <span className="font-mono-num">
                {musicMutedLocally ? 'مكتوم' : `${Math.round(musicVolume * 100)}%`}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={musicMutedLocally ? 0 : musicVolume}
              onChange={(e) => onVolumeChange(Number(e.target.value))}
              className="w-full accent-[#D4AF37]"
            />
          </div>
        </div>

        {/* Sound Effects Mute Toggle */}
        {onToggleEffectsMuted && (
          <div className="rounded-2xl bg-white/5 border border-white/10 p-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-extrabold text-white">صوت مؤثرات الهدايا والألعاب</p>
              <p className="text-[10px] text-slate-400">
                {effectsMuted ? 'مكتوم حالياً على جهازك' : 'مُفعّل مع جميع مستويات الهدايا'}
              </p>
            </div>
            <button
              type="button"
              onClick={onToggleEffectsMuted}
              className={`min-h-[36px] px-3 rounded-xl text-xs font-extrabold shrink-0 cursor-pointer transition ${
                effectsMuted
                  ? 'bg-rose-600/80 text-white'
                  : 'bg-emerald-500/25 border border-emerald-400/50 text-emerald-200'
              }`}
            >
              {effectsMuted ? 'مكتوم 🔇' : 'مُفعّل 🔊'}
            </button>
          </div>
        )}

        {!isOnMic ? (
          <div className="rounded-2xl border border-dashed border-[#D4AF37]/40 bg-[#D4AF37]/10 p-4 text-center space-y-2.5">
            <p className="text-xs text-[#FCE9A6] font-bold">
              التحكم في تشغيل مقاطع الصوت من جهازك مخصص للمتحدثين الجالسين على المايك.
            </p>
            <button
              type="button"
              onClick={() => {
                onClimbMic();
                onClose();
              }}
              className="gold-btn rounded-xl px-4 py-2 text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Mic className="w-3.5 h-3.5" />
              <span>صعود للمايك الآن</span>
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <label className="w-full min-h-[54px] rounded-2xl border border-[#22E568]/60 bg-gradient-to-r from-emerald-500/20 to-teal-500/15 hover:from-emerald-500/30 hover:to-teal-500/25 px-4 py-3.5 flex items-center justify-center gap-2 text-xs sm:text-sm font-extrabold text-emerald-100 cursor-pointer transition shadow-[0_6px_18px_rgba(16,185,129,0.2)]">
              <Upload className="w-4 h-4 text-emerald-300" />
              <span>
                {uploading ? 'جارٍ تجهيز الملف الصوتي...' : 'اختيار ملف صوتي من جهازك (MP3 / WAV / M4A)'}
              </span>
              <input
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={handleAudioFile}
              />
            </label>

            {msg && (
              <p className="text-[11px] font-bold text-emerald-300 text-center">{msg}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
