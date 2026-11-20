import React, { useMemo, useState } from 'react';
import { Award, CheckCircle2, Crown, Plus, Sparkles, Trash2, Trophy, Users, Vote, X } from 'lucide-react';
import { AvatarWithFrame } from './AvatarWithFrame';
import type { RoomLiveContest } from '../types';

interface RoomContestModalProps {
  contest: RoomLiveContest | null;
  isAgencyOwner: boolean;
  currentUserId?: string;
  onStartContest: (payload: {
    title: string;
    mode: RoomLiveContest['mode'];
    prizeLabel: string;
  }) => Promise<void>;
  onJoinContest: (note?: string) => Promise<void>;
  onVoteContest: (contestantUserId: string) => Promise<void>;
  onFinishContest: (winnerUserId?: string) => Promise<void>;
  onClearContest: () => Promise<void>;
  onClose: () => void;
}

const MODE_LABELS: Record<RoomLiveContest['mode'], { title: string; subtitle: string }> = {
  open: {
    title: 'سباق التفاعل والانضمام',
    subtitle: 'مفتوحة لجميع أعضاء الوكالة مع تصويت فوري',
  },
  mics: {
    title: 'تحدي المتحدثين على المايك',
    subtitle: 'مسابقة مباشرة بين المتواجدين وتصويت الجمهور',
  },
  qa: {
    title: 'سؤال وجائزة سريعة',
    subtitle: 'يكتب كل متسابق إجابته عند الانضمام ويختار الوكيل الفائز',
  },
};

export const RoomContestModal: React.FC<RoomContestModalProps> = ({
  contest,
  isAgencyOwner,
  currentUserId,
  onStartContest,
  onJoinContest,
  onVoteContest,
  onFinishContest,
  onClearContest,
  onClose,
}) => {
  const [title, setTitle] = useState('');
  const [mode, setMode] = useState<RoomLiveContest['mode']>('open');
  const [prizeLabel, setPrizeLabel] = useState('لقب الفائز الملكي 🏆');
  const [joinNote, setJoinNote] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(!contest);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const sortedEntries = useMemo(() => {
    if (!contest) return [];
    return [...contest.entries].sort((a, b) => (b.votes || 0) - (a.votes || 0));
  }, [contest]);

  const hasJoined = Boolean(
    contest && currentUserId && contest.entries.some((e) => e.userId === currentUserId)
  );
  const hasVoted = Boolean(
    contest && currentUserId && contest.voterIds.includes(currentUserId)
  );

  const handleLaunch = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFeedback(null);
    try {
      await onStartContest({ title, mode, prizeLabel });
      setTitle('');
      setShowCreateForm(false);
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'تعذّر إطلاق المسابقة.');
    } finally {
      setBusy(false);
    }
  };

  const handleJoin = async () => {
    setBusy(true);
    setFeedback(null);
    try {
      await onJoinContest(joinNote);
      setJoinNote('');
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'تعذّر الانضمام للمسابقة.');
    } finally {
      setBusy(false);
    }
  };

  const handleVote = async (uid: string) => {
    setBusy(true);
    setFeedback(null);
    try {
      await onVoteContest(uid);
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'تعذّر احتساب التصويت.');
    } finally {
      setBusy(false);
    }
  };

  const handleFinish = async (winnerUserId?: string) => {
    setBusy(true);
    setFeedback(null);
    try {
      await onFinishContest(winnerUserId);
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'تعذّر إنهاء المسابقة.');
    } finally {
      setBusy(false);
    }
  };

  const handleClear = async () => {
    setBusy(true);
    setFeedback(null);
    try {
      await onClearContest();
      setShowCreateForm(true);
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'تعذّر حذف المسابقة.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="royal-glass w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl p-5 space-y-4 max-h-[88vh] overflow-y-auto no-scrollbar border border-[#F3D37A]/40"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FCE9A6] to-[#B45309] text-[#070913] flex items-center justify-center shadow">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold gold-gradient-text">
                مسابقة الوكالة المباشرة
              </h3>
              <p className="text-[11px] text-slate-400">
                {isAgencyOwner
                  ? 'إدارة وإطلاق المسابقات الحية داخل وكالتك'
                  : 'شارك وصوّت للمتسابقين مباشرة'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 text-slate-300 flex items-center justify-center cursor-pointer"
            aria-label="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {feedback && (
          <div className="rounded-xl border border-rose-400/50 bg-rose-950/60 px-3.5 py-2 text-xs font-bold text-rose-200">
            {feedback}
          </div>
        )}

        {/* Create Form (Agency Owner Only) */}
        {(showCreateForm || !contest) && isAgencyOwner ? (
          <form onSubmit={handleLaunch} className="space-y-3.5">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-[#FCE9A6]">
                عنوان المسابقة
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="مثال: تحدي أجمل صوت في الوكالة"
                className="w-full rounded-xl bg-[#070913]/85 border border-[#D4AF37]/30 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-[#FCE9A6]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-[#FCE9A6]">
                نوع المسابقة
              </label>
              <div className="grid grid-cols-1 gap-2">
                {(['open', 'mics', 'qa'] as RoomLiveContest['mode'][]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    className={`rounded-2xl border p-3 text-right transition cursor-pointer ${
                      mode === m
                        ? 'bg-[#D4AF37]/20 border-[#FCE9A6] text-white'
                        : 'bg-[#070913]/75 border-white/10 text-slate-300 hover:border-[#D4AF37]/40'
                    }`}
                  >
                    <p className="text-xs font-extrabold text-[#FCE9A6]">
                      {MODE_LABELS[m].title}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {MODE_LABELS[m].subtitle}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-[#FCE9A6]">
                الجائزة المعلنة
              </label>
              <input
                type="text"
                value={prizeLabel}
                onChange={(e) => setPrizeLabel(e.target.value)}
                placeholder="مثال: إطار ملكي أو جائزة من الوكيل"
                className="w-full rounded-xl bg-[#070913]/85 border border-[#D4AF37]/30 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-[#FCE9A6]"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="submit"
                disabled={busy}
                className="flex-1 gold-btn min-h-[44px] rounded-2xl text-sm font-extrabold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4" />
                <span>{busy ? 'جارٍ الإطلاق...' : 'إطلاق المسابقة الآن'}</span>
              </button>
              {contest && (
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="min-h-[44px] rounded-2xl bg-white/10 px-4 text-xs font-bold text-slate-200 cursor-pointer"
                >
                  عودة
                </button>
              )}
            </div>
          </form>
        ) : !contest ? (
          <div className="rounded-2xl bg-[#070913]/70 border border-white/10 py-10 px-4 text-center space-y-2">
            <Trophy className="w-10 h-10 text-[#D4AF37]/60 mx-auto" />
            <p className="text-sm font-bold text-slate-200">
              لا توجد مسابقة جارية حالياً داخل الوكالة
            </p>
            <p className="text-xs text-slate-400">
              سيظهر إشعار فوري للجميع عند قيام صاحب الوكالة بإطلاق مسابقة جديدة.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Active / Ended Contest Card */}
            <div className="rounded-2xl border border-[#F3D37A]/50 bg-gradient-to-br from-[#2B1F09]/90 to-[#0C0F1C]/95 p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold ${
                    contest.status === 'active'
                      ? 'bg-emerald-500/20 border border-emerald-400/50 text-emerald-200'
                      : 'bg-amber-500/20 border border-amber-400/50 text-[#FCE9A6]'
                  }`}
                >
                  {contest.status === 'active' ? '🟢 جارية الآن' : '🏁 منتهية'}
                </span>
                <span className="text-[11px] text-slate-300 font-semibold">
                  {MODE_LABELS[contest.mode]?.title}
                </span>
              </div>

              <h4 className="text-base font-extrabold text-white">{contest.title}</h4>
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <span className="inline-flex items-center gap-1 text-[#FCE9A6] font-bold">
                  <Award className="w-3.5 h-3.5" />
                  <span>الجائزة: {contest.prizeLabel}</span>
                </span>
                <span className="inline-flex items-center gap-1 text-slate-300 font-mono-num">
                  <Users className="w-3.5 h-3.5" />
                  <span>{contest.entries.length} مشارك</span>
                </span>
              </div>
            </div>

            {/* Winner Banner if Ended */}
            {contest.status === 'ended' && contest.winnerName && (
              <div className="rounded-2xl border border-[#FCE9A6]/75 bg-gradient-to-r from-[#D4AF37]/25 to-amber-500/15 p-3.5 flex items-center gap-3">
                <Crown className="w-7 h-7 text-[#FCE9A6] shrink-0" />
                <div>
                  <p className="text-[11px] font-bold text-amber-200">الفائز المعلن في المسابقة</p>
                  <p className="text-sm font-black text-white">🏆 {contest.winnerName}</p>
                </div>
              </div>
            )}

            {/* Join Section for Active Contest */}
            {contest.status === 'active' && !hasJoined && (
              <div className="rounded-2xl bg-[#070913]/80 border border-white/10 p-3 space-y-2">
                {contest.mode === 'qa' && (
                  <input
                    type="text"
                    value={joinNote}
                    onChange={(e) => setJoinNote(e.target.value)}
                    placeholder="اكتب إجابتك أو مشاركتك هنا..."
                    className="w-full rounded-xl bg-black/50 border border-[#D4AF37]/30 px-3 py-2 text-xs text-white focus:outline-none focus:border-[#FCE9A6]"
                  />
                )}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleJoin()}
                  className="w-full emerald-btn min-h-[42px] rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" />
                  <span>انضم كمتسابق الآن</span>
                </button>
              </div>
            )}

            {contest.status === 'active' && hasJoined && (
              <div className="rounded-xl bg-emerald-500/15 border border-emerald-400/40 px-3 py-2 text-xs font-bold text-emerald-200 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                <span>أنت مسجل كمتسابق في هذه المسابقة</span>
              </div>
            )}

            {/* Contestants List */}
            <div className="space-y-2 max-h-[38vh] overflow-y-auto no-scrollbar">
              {sortedEntries.length === 0 ? (
                <p className="text-xs text-center text-slate-400 py-6">
                  لم ينضم متسابقون بعد — بانتظار المشاركين!
                </p>
              ) : (
                sortedEntries.map((entry, idx) => {
                  const isWinner = contest.winnerUserId === entry.userId;
                  return (
                    <div
                      key={entry.userId}
                      className={`rounded-2xl border p-3 flex items-center justify-between gap-2 ${
                        isWinner
                          ? 'bg-[#D4AF37]/20 border-[#FCE9A6]'
                          : 'bg-[#070913]/80 border-white/10'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-6 h-6 rounded-full bg-white/10 text-[11px] font-mono-num font-black text-[#FCE9A6] flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <AvatarWithFrame
                          src={entry.avatarUrl}
                          alt={entry.displayName}
                          frameId={entry.frameId}
                          vipTier={entry.vipLevel || 'none'}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-extrabold text-white truncate">
                            {entry.displayName} {isWinner ? '🏆' : ''}
                          </p>
                          {entry.note && (
                            <p className="text-[10px] text-amber-200/90 truncate">
                              "{entry.note}"
                            </p>
                          )}
                          <p className="text-[10px] font-mono-num text-slate-400">
                            {entry.votes} صوت
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {contest.status === 'active' && (
                          <button
                            type="button"
                            disabled={busy || hasVoted}
                            onClick={() => void handleVote(entry.userId)}
                            className={`min-h-[34px] rounded-xl px-2.5 text-[11px] font-extrabold flex items-center gap-1 cursor-pointer transition ${
                              hasVoted
                                ? 'bg-white/5 text-slate-400 cursor-not-allowed'
                                : 'bg-[#D4AF37]/20 hover:bg-[#D4AF37]/35 border border-[#D4AF37]/50 text-[#FCE9A6]'
                            }`}
                          >
                            <Vote className="w-3.5 h-3.5" />
                            <span>تصويت</span>
                          </button>
                        )}
                        {isAgencyOwner && contest.status === 'active' && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void handleFinish(entry.userId)}
                            className="min-h-[34px] rounded-xl bg-emerald-600/30 hover:bg-emerald-600/50 border border-emerald-400/50 px-2.5 text-[11px] font-extrabold text-emerald-100 cursor-pointer"
                            title="تتويج كفائز وإنهاء المسابقة"
                          >
                            تتويج 🏆
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Agency Owner Actions */}
            {isAgencyOwner && (
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/10">
                {contest.status === 'active' ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleFinish()}
                    className="gold-btn min-h-[42px] rounded-2xl text-xs font-extrabold cursor-pointer"
                  >
                    إنهاء وإعلان الفائز
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(true)}
                    className="gold-btn min-h-[42px] rounded-2xl text-xs font-extrabold cursor-pointer"
                  >
                    مسابقة جديدة
                  </button>
                )}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleClear()}
                  className="min-h-[42px] rounded-2xl bg-rose-600/25 border border-rose-500/45 text-rose-200 hover:bg-rose-600/40 text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>حذف / إغلاق</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
