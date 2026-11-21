import React, { useState } from 'react';
import {
  Ban,
  ClipboardList,
  Crown,
  ImagePlus,
  Lock,
  Megaphone,
  Mic,
  MicOff,
  Settings,
  Shield,
  Sparkles,
  Store,
  Trophy,
  Upload,
  UserMinus,
  Users,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { AVATAR_CHOICES, resolveAsset } from '../lib/assets';
import { ROOM_BACKGROUNDS } from '../lib/sadaCatalog';
import type { Room, RoomExtrasConfig, VipTierKey } from '../types';
import type { RoomPresenceMember } from '../context/ActiveRoomContext';
import { AvatarWithFrame, VipTierBadge, VipUserName } from './AvatarWithFrame';

interface RoomSettingsModalProps {
  room: Room;
  extras: RoomExtrasConfig;
  presenceMembers: RoomPresenceMember[];
  isOwnerOrAdmin: boolean;
  isAgencyOwner?: boolean;
  initialTab?: 'agency' | 'members' | 'logs' | 'contests';
  ownedBackgrounds?: string[];
  onOpenStore?: () => void;
  effectsMuted?: boolean;
  onToggleEffectsMuted?: (muted: boolean) => void;
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
  onStartAgencyContest?: (payload: {
    title: string;
    mode: 'open' | 'mics' | 'qa';
    prizeLabel: string;
    agencyQuiz: {
      questions: Array<{
        question: string;
        options: string[];
        correctIndex: number;
        seconds: number;
      }>;
      currentIndex: number;
    };
  }) => Promise<void>;
  onClose: () => void;
}

const SEAT_OPTIONS = [5, 10, 15, 20, 25, 30];

export const RoomSettingsModal: React.FC<RoomSettingsModalProps> = ({
  room,
  extras,
  presenceMembers,
  isOwnerOrAdmin,
  isAgencyOwner = false,
  initialTab = 'agency',
  ownedBackgrounds = [],
  onOpenStore,
  effectsMuted = false,
  onToggleEffectsMuted,
  onUpdateSettings,
  onAdminAction,
  onStartAgencyContest,
  onClose,
}) => {
  const canSeeLogs = Boolean(isAgencyOwner);
  const [tab, setTab] = useState<'agency' | 'members' | 'logs' | 'contests'>(
    initialTab === 'logs' && !canSeeLogs ? 'agency' : initialTab
  );
  const [titleInput, setTitleInput] = useState(room.title);
  const [announcement, setAnnouncement] = useState(room.description || '');
  const [seatCount, setSeatCount] = useState<number>(room.maxSeats || 15);
  const [avatarUrl, setAvatarUrl] = useState(room.hostAvatar);
  const [coverImage, setCoverImage] = useState(room.coverImage || 'dragon_dark');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [agencyContestTitle, setAgencyContestTitle] = useState('مسابقة الوكالة الثقافية');
  const [agencyContestPrize, setAgencyContestPrize] = useState('10,000 كوينز + لقب بطل الوكالة');
  const [agencyQuizQuestions, setAgencyQuizQuestions] = useState<
    Array<{ question: string; options: string[]; correctIndex: number; seconds: number }>
  >([
    { question: 'ما عاصمة المملكة العربية السعودية؟', options: ['الرياض', 'جدة', 'مكة', 'الدمام'], correctIndex: 0, seconds: 8 },
    { question: 'كم عدد أيام شهر رمضان؟', options: ['28', '29 أو 30', '31', '27'], correctIndex: 1, seconds: 8 },
    { question: 'ما هي لغة الضاد؟', options: ['الفرنسية', 'الإنجليزية', 'العربية', 'التركية'], correctIndex: 2, seconds: 8 },
    { question: 'أي بحر يطِل على مصر؟', options: ['البحر الأحمر', 'البحر الميت', 'بحر قزوين', 'بحر البلطيق'], correctIndex: 0, seconds: 8 },
    { question: 'كم عدد قارات العالم؟', options: ['5', '6', '7', '8'], correctIndex: 2, seconds: 8 },
    { question: 'ما اسم أكبر محيط؟', options: ['الهندي', 'الأطلسي', 'القطبي', 'الهادئ'], correctIndex: 3, seconds: 8 },
    { question: 'كم جانباً للمثلث؟', options: ['2', '3', '4', '5'], correctIndex: 1, seconds: 8 },
    { question: 'ما عاصمة مصر؟', options: ['الإسكندرية', 'الأقصر', 'القاهرة', 'الجيزة'], correctIndex: 2, seconds: 8 },
    { question: 'ما اسم مجموعة أقدم قصص عربية شعبية؟', options: ['ألف ليلة وليلة', 'المعلقات', 'السيرة الهلالية', 'كليلة ودمنة'], correctIndex: 0, seconds: 8 },
    { question: 'ما الكوكب الأحمر؟', options: ['المريخ', 'الزهرة', 'المشتري', 'زحل'], correctIndex: 0, seconds: 8 },
  ]);

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
      frameId?: string;
      vipLevel?: VipTierKey;
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
        frameId: s.frameId || 'frame_obsidian',
        vipLevel: s.vipLevel || 'none',
        onSeat: true,
        isMuted: s.isMuted,
      });
    }
  });
  presenceMembers.forEach((p) => {
    const existing = allMembersMap.get(p.userId);
    if (!existing) {
      allMembersMap.set(p.userId, {
        userId: p.userId,
        displayName: p.displayName,
        avatarUrl: p.avatarUrl,
        frameId: p.frameId || 'frame_obsidian',
        vipLevel: p.vipLevel || 'none',
        onSeat: false,
        isMuted: false,
      });
    } else if (p.vipLevel && p.vipLevel !== 'none') {
      existing.vipLevel = p.vipLevel;
    }
  });
  const memberList = Array.from(allMembersMap.values());

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#0d111e] p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="royal-glass room-modal-panel w-full sm:max-w-xl rounded-t-3xl sm:rounded-3xl p-4 sm:p-5 space-y-3 max-h-[85vh] overflow-y-auto touch-pan-y pb-10 no-scrollbar"
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
                إعدادات الغرفة الصوتية
              </h3>
              <p className="text-[11px] text-slate-400">
                إدارة إعدادات الغرفة متزامنة للجميع
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
        <div
          className={`grid ${
            canSeeLogs ? 'grid-cols-4' : 'grid-cols-3'
          } gap-1.5 p-1 rounded-2xl bg-[#070913]/85 border border-[#D4AF37]/20`}
        >
          <button
            type="button"
            onClick={() => setTab('agency')}
            className={`min-h-[44px] rounded-xl text-[11px] sm:text-xs font-bold transition cursor-pointer ${
              tab === 'agency'
                ? 'bg-gradient-to-r from-[#D4AF37] to-[#B58922] text-[#070913]'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            المظهر والمايكات
          </button>
          <button
            type="button"
            onClick={() => setTab('members')}
            className={`min-h-[44px] rounded-xl text-[11px] sm:text-xs font-bold transition cursor-pointer ${
              tab === 'members'
                ? 'bg-gradient-to-r from-[#D4AF37] to-[#B58922] text-[#070913]'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            المشرفين والأعضاء ({memberList.length})
          </button>
          {isAgencyOwner && (
            <button
              type="button"
              onClick={() => setTab('contests')}
              className={`min-h-[44px] rounded-xl text-[11px] sm:text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1 ${
                tab === 'contests'
                  ? 'bg-gradient-to-r from-[#D4AF37] to-[#B58922] text-[#070913]'
                  : 'text-[#FCE9A6] hover:text-white'
              }`}
            >
              <Trophy className="w-3.5 h-3.5" />
              مسابقات الوكالة
            </button>
          )}
          {canSeeLogs && (
            <button
              type="button"
              onClick={() => setTab('logs')}
              className={`min-h-[44px] rounded-xl text-[11px] sm:text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1 ${
                tab === 'logs'
                  ? 'bg-gradient-to-r from-[#D4AF37] to-[#B58922] text-[#070913]'
                  : 'text-amber-200 hover:text-white'
              }`}
            >
              <ClipboardList className="w-3.5 h-3.5 shrink-0" />
              <span>سجل المشرفين</span>
            </button>
          )}
        </div>

        {feedback && (
          <div className="rounded-xl border border-emerald-400/40 bg-emerald-500/15 px-3.5 py-2 text-xs font-bold text-emerald-200">
            {feedback}
          </div>
        )}

        {tab === 'contests' && isAgencyOwner ? (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-[#FCE9A6]">عنوان المسابقة</label>
                <input
                  value={agencyContestTitle}
                  onChange={(e) => setAgencyContestTitle(e.target.value)}
                  className="w-full rounded-xl bg-[#070913]/85 border border-[#D4AF37]/25 px-3 py-2 text-xs text-white"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-[#FCE9A6]">جائزة المسابقة</label>
                <input
                  value={agencyContestPrize}
                  onChange={(e) => setAgencyContestPrize(e.target.value)}
                  className="w-full rounded-xl bg-[#070913]/85 border border-[#D4AF37]/25 px-3 py-2 text-xs text-white"
                />
              </div>
            </div>

            <div className="space-y-2 max-h-[48vh] overflow-y-auto touch-pan-y no-scrollbar pr-1">
              {agencyQuizQuestions.map((item, qIndex) => (
                <div key={qIndex} className="rounded-2xl border border-white/10 bg-[#070913]/75 p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-extrabold text-[#FCE9A6]">السؤال {qIndex + 1}</span>
                    <span className="text-[10px] font-mono-num text-slate-400">8 ثوانٍ</span>
                  </div>
                  <input
                    value={item.question}
                    onChange={(e) => setAgencyQuizQuestions((prev) =>
                      prev.map((q, i) => i === qIndex ? { ...q, question: e.target.value } : q)
                    )}
                    className="w-full rounded-xl bg-black/35 border border-white/10 px-3 py-2 text-xs text-white"
                  />
                  <div className="grid grid-cols-2 gap-1.5">
                    {item.options.map((option, oIndex) => (
                      <button
                        key={oIndex}
                        type="button"
                        onClick={() => setAgencyQuizQuestions((prev) =>
                          prev.map((q, i) => i === qIndex ? { ...q, correctIndex: oIndex } : q)
                        )}
                        className="rounded-xl border border-white/10 bg-white/5 p-1.5 text-right"
                      >
                        <input
                          value={option}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => setAgencyQuizQuestions((prev) =>
                            prev.map((q, i) => i === qIndex
                              ? { ...q, options: q.options.map((opt, oi) => oi === oIndex ? e.target.value : opt) }
                              : q
                            )
                          )}
                          className={`w-full bg-transparent text-[11px] text-white ${item.correctIndex === oIndex ? 'text-emerald-300 font-bold' : ''}`}
                        />
                      </button>
                    ))}
                  </div>
                  {item.correctIndex >= 0 && (
                    <p className="text-[9px] text-emerald-300/80">اضغط احتمالاً لتعيينه إجابة صحيحة</p>
                  )}
                </div>
              ))}
            </div>

            <button
              type="button"
              disabled={saving || !agencyContestTitle.trim() || !onStartAgencyContest}
              onClick={async () => {
                if (!onStartAgencyContest) return;
                setSaving(true);
                try {
                  await onStartAgencyContest({
                    title: agencyContestTitle.trim(),
                    mode: 'qa',
                    prizeLabel: agencyContestPrize.trim(),
                    agencyQuiz: { questions: agencyQuizQuestions, currentIndex: 0 },
                  });
                  setFeedback('تم إطلاق مسابقة الوكالة بـ 10 أسئلة وتوقيت 8 ثوانٍ لكل سؤال.');
                } catch (err) {
                  setFeedback(err instanceof Error ? err.message : 'تعذّر إطلاق المسابقة.');
                } finally {
                  setSaving(false);
                }
              }}
              className="gold-btn w-full min-h-[48px] rounded-2xl text-sm font-extrabold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Trophy className="w-5 h-5" />
              GO — إطلاق المسابقة الآن
            </button>
          </div>
        ) : tab === 'logs' && canSeeLogs ? (
          <div className="space-y-3">
            <div className="rounded-2xl border border-[#D4AF37]/30 bg-[#070913]/85 p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-[#FCE9A6]" />
                <div>
                  <h4 className="text-xs font-extrabold text-[#FCE9A6]">
                    سجل حركة المشرفين (خاص بالوكيل)
                  </h4>
                  <p className="text-[10px] text-slate-400">
                    توثيق فوري لكل طرد، إنزال من المايك، كتم، أو قفل مقعد مع التوقيت
                  </p>
                </div>
              </div>
              <span className="rounded-full bg-[#D4AF37]/20 border border-[#D4AF37]/40 px-2 py-0.5 text-[10px] font-mono-num font-bold text-[#FCE9A6]">
                {(extras.modLogs || []).length}
              </span>
            </div>

            {(extras.modLogs || []).length === 0 ? (
              <div className="rounded-2xl bg-[#070913]/60 border border-white/10 py-10 text-center text-xs text-slate-400">
                لا توجد إجراءات إشرافية مسجلة حتى الآن داخل هذه الوكالة.
              </div>
            ) : (
              <div className="space-y-2 max-h-[52vh] overflow-y-auto touch-pan-y no-scrollbar">
                {(extras.modLogs || []).map((log) => {
                  const badgeStyle =
                    log.actionType === 'kick_room'
                      ? 'bg-rose-500/20 border-rose-400/50 text-rose-200'
                      : log.actionType === 'unban_room'
                      ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200'
                      : log.actionType === 'mute_user' || log.actionType === 'mute_all'
                      ? 'bg-amber-500/20 border-amber-400/50 text-amber-200'
                      : 'bg-sky-500/20 border-sky-400/50 text-sky-200';
                  const timeLabel = new Date(log.timestamp).toLocaleString('ar-EG', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <div
                      key={log.id}
                      className="rounded-2xl bg-[#070913]/80 border border-white/10 p-3 space-y-1"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-xs font-extrabold text-white truncate">
                            {log.actorName}
                          </span>
                          <span className="rounded-md bg-[#D4AF37]/20 border border-[#D4AF37]/40 px-1.5 py-0.5 text-[9px] font-bold text-[#FCE9A6] shrink-0">
                            {log.actorRole}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono-num text-slate-400 shrink-0">
                          {timeLabel}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[11px] font-bold text-slate-200">{log.details}</p>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[9px] font-extrabold shrink-0 ${badgeStyle}`}
                        >
                          {log.actionType === 'kick_room'
                            ? 'طرد'
                            : log.actionType === 'unban_room'
                            ? 'فك طرد'
                            : log.actionType === 'kick_seat'
                            ? 'إنزال مايك'
                            : log.actionType === 'mute_user' || log.actionType === 'mute_all'
                            ? 'كتم'
                            : log.actionType === 'clear_all'
                            ? 'تصفية مايكات'
                            : log.actionType === 'lock_seat'
                            ? 'قفل مقعد'
                            : 'فتح مقعد'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : tab === 'agency' ? (
          <form onSubmit={handleSaveAll} className="space-y-4">
            {/* Local Room Sound Effects Mute Toggle */}
            {onToggleEffectsMuted && (
              <div className="rounded-2xl bg-[#070913]/85 border border-[#D4AF37]/30 p-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      effectsMuted
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-400/40'
                        : 'bg-[#D4AF37]/20 text-[#FCE9A6] border border-[#D4AF37]/40'
                    }`}
                  >
                    {effectsMuted ? (
                      <VolumeX className="w-4 h-4" />
                    ) : (
                      <Volume2 className="w-4 h-4" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-extrabold text-white">
                      كتم صوت مؤثرات الهدايا والألعاب
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {effectsMuted
                        ? 'المؤثرات الصوتية للهدايا والعروض السينمائية مكتومة حالياً'
                        : 'تشغيل المؤثرات الصوتية المتزامنة مع عروض الهدايا'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onToggleEffectsMuted(!effectsMuted)}
                  className={`min-h-[44px] px-3.5 rounded-xl text-xs font-extrabold shrink-0 transition cursor-pointer ${
                    effectsMuted
                      ? 'bg-rose-600 text-white shadow-[0_0_14px_rgba(225,29,72,0.4)]'
                      : 'bg-emerald-500/25 border border-emerald-400/50 text-emerald-200 hover:bg-emerald-500/35'
                  }`}
                >
                  {effectsMuted ? 'مكتوم 🔇' : 'مُفعّل 🔊'}
                </button>
              </div>
            )}

            {/* Active Mic Grid Size Selector */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-[#F3D37A] flex items-center gap-1.5">
                <Mic className="w-3.5 h-3.5" />
                <span>عدد المايكات النشطة (توزيع هندسي متدرج)</span>
              </label>
              <div className="grid grid-cols-6 gap-1.5">
                {SEAT_OPTIONS.map((cnt) => (
                  <button
                    key={cnt}
                    type="button"
                    disabled={saving}
                    onClick={() => handleQuickSeatChange(cnt)}
                    className={`min-h-[44px] rounded-xl text-xs font-mono-num font-extrabold border transition cursor-pointer ${
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
              <div className="flex items-center gap-2.5 overflow-x-auto touch-pan-x no-scrollbar pb-1">
                <img
                  src={resolveAsset(avatarUrl)}
                  alt="معاينة"
                  loading="lazy"
                  decoding="async"
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
                    <img src={ch.src} alt={ch.label} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>

            {/* Change Room Background */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-[#F3D37A] flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>تغيير خلفية الغرفة</span>
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
                {ROOM_BACKGROUNDS.map((bg) => {
                  const locked =
                    bg.id !== 'dragon_dark' &&
                    bg.id !== 'competition_crest' &&
                    !ownedBackgrounds.includes(bg.id);
                  return (
                    <button
                      key={bg.id}
                      type="button"
                      onClick={() => {
                        if (locked) {
                          setFeedback(
                            `الخلفية "${bg.name}" تتطلب شراءها من المتجر مقابل ${bg.priceCoins?.toLocaleString('en-US')} كوينز أولاً.`
                          );
                          return;
                        }
                        setCoverImage(bg.id);
                      }}
                      className={`rounded-xl p-2.5 text-right border transition cursor-pointer relative ${
                        coverImage === bg.id
                          ? 'border-[#FCE9A6] ring-1 ring-[#FCE9A6]/60'
                          : locked
                          ? 'border-white/10 opacity-70'
                          : 'border-white/15 hover:border-[#D4AF37]/50'
                      } ${bg.previewClass}`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <p className="text-xs font-extrabold text-[#FCE9A6] truncate">{bg.name}</p>
                        {locked && <Lock className="w-3 h-3 text-amber-300 shrink-0" />}
                      </div>
                      <p className="text-[10px] text-slate-300 truncate">
                        {locked
                          ? `🔒 ${bg.priceCoins?.toLocaleString('en-US')} كوينز في المتجر`
                          : bg.description}
                      </p>
                    </button>
                  );
                })}
              </div>
              {onOpenStore && (
                <button
                  type="button"
                  onClick={onOpenStore}
                  className="min-h-[44px] w-full rounded-xl border border-amber-300/35 bg-amber-500/10 px-3 text-xs font-extrabold text-[#FCE9A6] cursor-pointer active:scale-95"
                >
                  <Store className="ml-1 inline h-4 w-4" />
                  شراء خلفيات الغرفة من المتجر
                </button>
              )}
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
                className="min-h-[44px] rounded-2xl bg-amber-500/20 border border-amber-400/50 text-[#FCE9A6] text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer hover:bg-amber-500/30"
              >
                <MicOff className="w-4 h-4" />
                <span>كتم المايك للجميع</span>
              </button>
              <button
                type="button"
                onClick={() => onAdminAction({ type: 'clear_all' })}
                className="min-h-[44px] rounded-2xl bg-rose-500/20 border border-rose-400/50 text-rose-200 text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer hover:bg-rose-500/30"
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
                <div className="space-y-2 max-h-[38vh] overflow-y-auto touch-pan-y no-scrollbar">
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
                          <AvatarWithFrame
                            src={m.avatarUrl}
                            alt={m.displayName}
                            frameId={m.frameId}
                            vipTier={m.vipLevel}
                            size="sm"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1 flex-wrap">
                              <VipUserName
                                name={m.displayName}
                                vipTier={m.vipLevel}
                                className="text-xs font-bold text-white truncate"
                              />
                              <VipTierBadge vipTier={m.vipLevel} compact />
                            </div>
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
                      فك الطرد: {extras.kickedUserNames?.[uid] || uid.slice(-5)} ↺
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
