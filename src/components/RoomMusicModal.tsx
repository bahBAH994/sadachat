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
import { ROOM_MUSIC_PRESETS } from '../lib/sadaCatalog';
import type { RoomMusicState } from '../types';

interface RoomMusicModalProps {
  isOnMic: boolean;
  musicState: RoomMusicState | null;
  musicVolume: number;
  musicMutedLocally: boolean;
  onVolumeChange: (val: number) => void;
  onToggleLocalMute: () => void;
  onPlayPreset: (presetId: string) => Promise<void>;
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
  onVolumeChange,
  onToggleLocalMute,
  onPlayPreset,
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
          setMsg(`تم تشغيل "${file.name}" وبث حالة التشغيل لجميع المتواجدين!`);
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
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-md p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="royal-glass w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 space-y-4"
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
                تشغيل وبث الموسيقى في خلفية الوكالة للجميع عبر Realtime
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

        {!isOnMic ? (
          <div className="rounded-2xl border border-dashed border-[#D4AF37]/40 bg-[#D4AF37]/10 p-4 text-center space-y-2.5">
            <p className="text-xs text-[#FCE9A6] font-bold">
              التحكم في بث الأغاني مخصص للمتحدثين الجالسين على المايك.
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
            {/* Upload audio file from phone */}
            <label className="w-full min-h-[48px] rounded-2xl border border-[#22E568]/50 bg-emerald-500/15 hover:bg-emerald-500/25 px-4 py-3 flex items-center justify-center gap-2 text-xs font-extrabold text-emerald-200 cursor-pointer transition">
              <Upload className="w-4 h-4" />
              <span>
                {uploading ? 'جارٍ تجهيز الملف...' : 'اختيار أغنية / ملف صوتي من الهاتف'}
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

            {/* Royal Ambient Presets */}
            <div className="space-y-1.5">
              <p className="text-xs font-bold text-[#F3D37A]">
                مقطوعات ملكية جاهزة (بث مباشر للجميع):
              </p>
              <div className="space-y-1.5">
                {ROOM_MUSIC_PRESETS.map((preset) => {
                  const active =
                    musicState?.isPlaying &&
                    musicState.sourceType === 'preset' &&
                    musicState.presetId === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => void onPlayPreset(preset.id)}
                      className={`w-full rounded-xl px-3.5 py-2.5 flex items-center justify-between text-xs font-bold border transition cursor-pointer ${
                        active
                          ? 'bg-[#D4AF37]/25 border-[#FCE9A6] text-[#FCE9A6]'
                          : 'bg-[#070913]/75 border-white/10 text-slate-200 hover:border-[#D4AF37]/45'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span>🎵</span>
                        <span>{preset.name}</span>
                      </span>
                      <span className="text-[10px] font-mono-num text-emerald-300">
                        {active ? 'يُبث الآن ●' : 'تشغيل ▶'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
