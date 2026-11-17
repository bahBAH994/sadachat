import React, { useState } from 'react';
import {
  Ban,
  Crown,
  ImagePlus,
  Megaphone,
  Mic,
  MicOff,
  Settings,
  Shield,
  Sparkles,
  Upload,
  UserMinus,
  Users,
  X,
} from 'lucide-react';
import { AVATAR_CHOICES, resolveAsset } from '../lib/assets';
import { ROOM_BACKGROUNDS } from '../lib/sadaCatalog';
import type { Room, RoomExtrasConfig } from '../types';
import type { RoomPresenceMember } from '../context/ActiveRoomContext';

interface RoomSettingsModalProps {
  room: Room;
  extras: RoomExtrasConfig;
  presenceMembers: RoomPresenceMember[];
  isOwnerOrAdmin: boolean;
  onUpdateSettings: (patch: {
    maxSeats?: number;
    hostAvatar?: string;
    coverImage?: string;
    description?: string;
    title?: string;
  }) => Promise<void>;
  onAdminAction: (
    action:
      | { type: 'mute_all' }
      | { type: 'clear_all' }
      | { type: 'mute_user'; targetUserId: string; isMuted: boolean }
      | { type: 'kick_seat'; targetUserId: string }
      | { type: 'kick_room'; targetUserId: string; targetName?: string }
      | { type: 'unban_room'; targetUserId: string }
      | { type: 'toggle_deputy'; targetUserId: string; targetName?: string }
      | { type: 'toggle_moderator'; targetUserId: string; targetName?: string }
  ) => Promise<void>;
  onClose: () => void;
}

const SEAT_OPTIONS = [5, 10, 15, 20, 25, 30];

export const RoomSettingsModal: React.FC<RoomSettingsModalProps> = ({
  room,
  extras,
  presenceMembers,
  isOwnerOrAdmin,
  onUpdateSettings,
  onAdminAction,
  onClose,
}) => {
  const [tab, setTab] = useState<'agency' | 'members'>('agency');
  const [titleInput, setTitleInput] = useState(room.title);
  const [announcement, setAnnouncement] = useState(room.description || '');
  const [seatCount, setSeatCount] = useState<number>(room.maxSeats || 15);
  const [avatarUrl, setAvatarUrl] = useState(room.hostAvatar);
  const [coverImage, setCoverImage] = useState(room.coverImage || 'dragon_dark');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const readImageFile = (
    file: File,
    onLoaded: (dataUrl: string) => void
  ) => {
    const isAnimated =
      file.type === 'image/gif' ||
      file.type === 'image/webp' ||
      file.name.toLowerCase().endsWith('.gif') ||
      file.name.toLowerCase().endsWith('.webp');

    if (isAnimated || file.size <= 700_000) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') onLoaded(reader.result);
      };
      reader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 900;
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          onLoaded(canvas.toDataURL('image/jpeg', 0.82));
        }
      };
      if (typeof reader.result === 'string') img.src = reader.result;
    };
    reader.readAsDataURL(file);
  };

  const handleSaveAll = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      await onUpdateSettings({
        title: titleInput,
        description: announcement,
        maxSeats: seatCount,
        hostAvatar: avatarUrl,
        coverImage,
      });
      setFeedback('تم حفظ إعدادات الوكالة وتحديثها فوراً للجميع!');
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'تعذّر حفظ الإعدادات.');
    } finally {
      setSaving(false);
    }
  };

  const handleQuickSeatChange = async (count: number) => {
    setSeatCount(count);
    setSaving(true);
    try {
      await onUpdateSettings({ maxSeats: count });
      setFeedback(`تم تحديث عدد المايكات إلى ${count} مايك فوراً.`);
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'تعذّر تحديث المايكات.');
    } finally {
      setSaving(false);
    }
  };

  // Merge seated speakers + present listeners into unified member directory
  const allMembersMap = new Map<
    string,
    {
      userId: string;
      displayName: string;
      avatarUrl: string;
      onSeat: boolean;
      isMuted: boolean;
    }
  >();
  room.seats.forEach((s) => {
    if (s.userId) {
      allMembersMap.set(s.userId, {
        userId: s.userId,
        displayName: s.displayName || 'متحدث',
        avatarUrl: s.avatarUrl || 'host_male',
        onSeat: true,
        isMuted: s.isMuted,
      });
    }
  });
  presenceMembers.forEach((p) => {
    if (!allMembersMap.has(p.userId)) {
      allMembersMap.set(p.userId, {
        userId: p.userId,
        displayName: p.displayName,
        avatarUrl: p.avatarUrl,
        onSeat: false,
        isMuted: false,
      });
    }
  });
  const memberList = Array.from(allMembersMap.values());

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="royal-glass w-full sm:max-w-xl rounded-t-3xl sm:rounded-3xl p-5 space-y-4 max-h-[88vh] overflow-y-auto no-scrollbar"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-[#D4AF37]/20 border border-[#D4AF37]/50 flex items-center justify-center text-[#FCE9A6]">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold gold-gradient-text">
                إعدادات وإدارة الوكالة
              </h3>
              <p className="text-[11px] text-slate-400">
                تحكم كامل للوكيل ونائب الوكيل والمشرفين · متزامن للجميع
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 text-slate-300 flex items-center justify-center cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="grid grid-cols-2 gap-1.5 p-1 rounded-2xl bg-[#070913]/85 border border-[#D4AF37]/20">
          <button
            type="button"
            onClick={() => setTab('agency')}
            className={`min-h-[40px] rounded-xl text-xs font-bold transition cursor-pointer ${
              tab === 'agency'
                ? 'bg-gradient-to-r from-[#D4AF37] to-[#B58922] text-[#070913]'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            المقاعد والمظهر والإعلان
          </button>
          <button
            type="button"
            onClick={() => setTab('members')}
            className={`min-h-[40px] rounded-xl text-xs font-bold transition cursor-pointer ${
              tab === 'members'
                ? 'bg-gradient-to-r from-[#D4AF37] to-[#B58922] text-[#070913]'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            المايكات والمشرفين ({memberList.length})
          </button>
        </div>

        {feedback && (
          <div className="rounded-xl border border-emerald-400/40 bg-emerald-500/15 px-3.5 py-2 text-xs font-bold text-emerald-200">
            {feedback}
          </div>
        )}

        {tab === 'agency' ? (
          <form onSubmit={handleSaveAll} className="space-y-4">
            {/* Active Mic Grid Size Selector */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-[#F3D37A] flex items-center gap-1.5">
                <Mic className="w-3.5 h-3.5" />
                <span>عدد المايكات النشطة (شبكة 5 أعمدة)</span>
              </label>
              <div className="grid grid-cols-6 gap-1.5">
                {SEAT_OPTIONS.map((cnt) => (
                  <button
                    key={cnt}
                    type="button"
                    disabled={saving}
                    onClick={() => handleQuickSeatChange(cnt)}
                    className={`min-h-[40px] rounded-xl text-xs font-mono-num font-extrabold border transition cursor-pointer ${
                      seatCount === cnt
                        ? 'bg-[#D4AF37] text-[#070913] border-[#FCE9A6]'
                        : 'bg-[#070913]/80 text-slate-300 border-[#D4AF37]/25 hover:border-[#D4AF37]/60'
                    }`}
                  >
                    {cnt}
                  </button>
                ))}
              </div>
            </div>

            {/* Agency Title */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300">اسم الوكالة</label>
              <input
                type="text"
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
                className="w-full rounded-xl bg-[#070913]/85 border border-[#D4AF37]/25 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#D4AF37]"
              />
            </div>

            {/* Welcome Announcement */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#F3D37A] flex items-center gap-1.5">
                <Megaphone className="w-3.5 h-3.5" />
                <span>إعلان الوكالة الترحيبي (يظهر أعلى الدردشة)</span>
              </label>
              <textarea
                rows={3}
                value={announcement}
                onChange={(e) => setAnnouncement(e.target.value)}
                placeholder="مثال: شحن + سحب تارجت + شراء دعم · للتواصل..."
                className="w-full rounded-xl bg-[#070913]/85 border border-[#D4AF37]/25 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#D4AF37]"
              />
            </div>

            {/* Change Agency Avatar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-[#F3D37A] flex items-center gap-1.5">
                  <ImagePlus className="w-3.5 h-3.5" />
                  <span>تغيير صورة الوكالة</span>
                </label>
                <label className="inline-flex items-center gap-1.5 rounded-lg bg-[#D4AF37]/20 border border-[#D4AF37]/50 px-2.5 py-1 text-[11px] font-bold text-[#FCE9A6] cursor-pointer hover:bg-[#D4AF37]/30">
                  <Upload className="w-3 h-3" />
                  <span>رفع من الهاتف</span>
                  <input
                    type="file"
                    accept="image/*,.gif,.webp"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) readImageFile(f, (url) => setAvatarUrl(url));
                    }}
                  />
                </label>
              </div>
              <div className="flex items-center gap-2.5 overflow-x-auto no-scrollbar pb-1">
                <img
                  src={resolveAsset(avatarUrl)}
                  alt="معاينة"
                  className="w-12 h-12 rounded-xl object-cover border-2 border-[#FCE9A6] shrink-0"
                />
                {AVATAR_CHOICES.map((ch) => (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => setAvatarUrl(ch.id)}
                    className={`w-11 h-11 rounded-xl overflow-hidden border-2 shrink-0 cursor-pointer ${
                      avatarUrl === ch.id ? 'border-emerald-400' : 'border-white/15'
                    }`}
                  >
                    <img src={ch.src} alt={ch.label} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>

            {/* Change Room Background */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-[#F3D37A] flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>تغيير خلفية الروم (ملكية أو من الهاتف)</span>
                </label>
                <label className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/20 border border-emerald-400/40 px-2.5 py-1 text-[11px] font-bold text-emerald-200 cursor-pointer hover:bg-emerald-500/30">
                  <Upload className="w-3 h-3" />
                  <span>خلفية من الهاتف</span>
                  <input
                    type="file"
                    accept="image/*,.gif,.webp"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) readImageFile(f, (url) => setCoverImage(url));
                    }}
                  />
                </label>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {ROOM_BACKGROUNDS.map((bg) => (
                  <button
                    key={bg.id}
                    type="button"
                    onClick={() => setCoverImage(bg.id)}
                    className={`rounded-xl p-2.5 text-right border transition cursor-pointer ${
                      coverImage === bg.id
                        ? 'border-[#FCE9A6] ring-1 ring-[#FCE9A6]/60'
                        : 'border-white/15 hover:border-[#D4AF37]/50'
                    } ${bg.previewClass}`}
                  >
                    <p className="text-xs font-extrabold text-[#FCE9A6] truncate">{bg.name}</p>
                    <p className="text-[10px] text-slate-300 truncate">{bg.description}</p>
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full gold-btn min-h-[44px] rounded-2xl text-sm font-extrabold cursor-pointer disabled:opacity-50"
            >
              {saving ? 'جارٍ الحفظ...' : 'حفظ وتطبيق الإعدادات للجميع'}
            </button>
          </form>
        ) : (
          <div className="space-y-4">
            {/* Global Quick Mic Controls */}
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => onAdminAction({ type: 'mute_all' })}
                className="min-h-[42px] rounded-2xl bg-amber-500/20 border border-amber-400/50 text-[#FCE9A6] text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer hover:bg-amber-500/30"
              >
                <MicOff className="w-4 h-4" />
                <span>كتم المايك للجميع</span>
              </button>
              <button
                type="button"
                onClick={() => onAdminAction({ type: 'clear_all' })}
                className="min-h-[42px] rounded-2xl bg-rose-500/20 border border-rose-400/50 text-rose-200 text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer hover:bg-rose-500/30"
              >
                <UserMinus className="w-4 h-4" />
                <span>إنزال الجميع من المايكات</span>
              </button>
            </div>

            {/* Members & Speakers Management */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#F3D37A]">
                <Users className="w-3.5 h-3.5" />
                <span>الأعضاء المتواجدون داخل الوكالة</span>
              </div>
              {memberList.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">
                  لا يوجد أعضاء آخرون حالياً.
                </p>
              ) : (
                <div className="space-y-2 max-h-[38vh] overflow-y-auto no-scrollbar">
                  {memberList.map((m) => {
                    const isHost = m.userId === room.hostId;
                    const isDeputy = extras.deputyIds.includes(m.userId);
                    const isMod = extras.moderatorIds.includes(m.userId);
                    return (
                      <div
                        key={m.userId}
                        className="rounded-2xl bg-[#070913]/75 border border-white/10 p-2.5 flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <img
                            src={resolveAsset(m.avatarUrl)}
                            alt={m.displayName}
                            className="w-9 h-9 rounded-full object-cover border border-[#D4AF37]/40 shrink-0"
                          />
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-white truncate">
                              {m.displayName}
                            </p>
                            <p className="text-[10px] text-slate-400">
                              {isHost
                                ? '👑 مالك الوكالة'
                                : isDeputy
                                ? '⚜️ نائب الوكيل'
                                : isMod
                                ? '🛡️ مشرف'
                                : m.onSeat
                                ? '🎙️ على المايك'
                                : '🎧 مستمع'}
                            </p>
                          </div>
                        </div>

                        {!isHost && (
                          <div className="flex flex-wrap items-center gap-1 shrink-0">
                            {m.onSeat && (
                              <>
                                <button
                                  type="button"
                                  onClick={() =>
                                    onAdminAction({
                                      type: 'mute_user',
                                      targetUserId: m.userId,
                                      isMuted: !m.isMuted,
                                    })
                                  }
                                  className="px-2 py-1 rounded-lg bg-white/10 hover:bg-amber-500/30 text-[10px] font-bold text-[#FCE9A6] cursor-pointer"
                                  title={m.isMuted ? 'فك الكتم' : 'كتم'}
                                >
                                  {m.isMuted ? 'فك كتم' : 'كتم'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    onAdminAction({
                                      type: 'kick_seat',
                                      targetUserId: m.userId,
                                    })
                                  }
                                  className="px-2 py-1 rounded-lg bg-white/10 hover:bg-rose-500/30 text-[10px] font-bold text-slate-200 cursor-pointer"
                                >
                                  إنزال
                                </button>
                              </>
                            )}
                            {isOwnerOrAdmin && (
                              <button
                                type="button"
                                onClick={() =>
                                  onAdminAction({
                                    type: 'toggle_deputy',
                                    targetUserId: m.userId,
                                    targetName: m.displayName,
                                  })
                                }
                                className={`px-2 py-1 rounded-lg text-[10px] font-bold cursor-pointer flex items-center gap-0.5 ${
                                  isDeputy
                                    ? 'bg-[#D4AF37] text-[#070913]'
                                    : 'bg-white/10 text-amber-200'
                                }`}
                              >
                                <Crown className="w-3 h-3" />
                                <span>{isDeputy ? 'إزالة نائب' : 'نائب'}</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() =>
                                onAdminAction({
                                  type: 'toggle_moderator',
                                  targetUserId: m.userId,
                                  targetName: m.displayName,
                                })
                              }
                              className={`px-2 py-1 rounded-lg text-[10px] font-bold cursor-pointer flex items-center gap-0.5 ${
                                isMod
                                  ? 'bg-emerald-500 text-white'
                                  : 'bg-white/10 text-emerald-200'
                              }`}
                            >
                              <Shield className="w-3 h-3" />
                              <span>{isMod ? 'إزالة مشرف' : 'مشرف'}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                onAdminAction({
                                  type: 'kick_room',
                                  targetUserId: m.userId,
                                  targetName: m.displayName,
                                })
                              }
                              className="px-2 py-1 rounded-lg bg-rose-600/30 hover:bg-rose-600/50 text-[10px] font-bold text-rose-200 cursor-pointer flex items-center gap-0.5"
                            >
                              <Ban className="w-3 h-3" />
                              <span>طرد</span>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {extras.kickedUserIds.length > 0 && (
              <div className="pt-2 border-t border-white/10 space-y-1.5">
                <p className="text-[11px] font-bold text-rose-300">
                  المطرودون ({extras.kickedUserIds.length})
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {extras.kickedUserIds.map((uid) => (
                    <button
                      key={uid}
                      type="button"
                      onClick={() =>
                        onAdminAction({ type: 'unban_room', targetUserId: uid })
                      }
                      className="rounded-xl bg-rose-950/60 border border-rose-500/40 px-2.5 py-1 text-[10px] font-bold text-rose-200 hover:bg-emerald-900/50 hover:text-emerald-200 cursor-pointer"
                    >
                      فك الطرد ({uid.slice(-5)}) ↺
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
