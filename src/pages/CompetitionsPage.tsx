import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import {
  Award,
  Brain,
  Check,
  Coins,
  Copy,
  Crown,
  Gem,
  Gift,
  Lock,
  Plus,
  Sparkles,
  Timer,
  Trophy,
  Vote,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useMiniProfile } from '../context/MiniProfileContext';
import { resolveAsset } from '../lib/assets';
import {
  answerCulturalQuizInSupabase,
  getCompetitionsFromSupabase,
  getReferralWheelOverviewFromSupabase,
  joinCompetitionInSupabase,
  spinReferralWheelInSupabase,
  startCulturalQuizInSupabase,
  voteCompetitionInSupabase,
} from '../lib/sadaSocialService';
import { supabase } from '../lib/supabase';
import type {
  Competition,
  CulturalQuizResult,
  CulturalQuizRound,
  ReferralWheelSegment,
} from '../types';
import { AvatarWithFrame } from '../components/AvatarWithFrame';
import { Fluent3DAsset } from '../components/Fluent3DAsset';

type CompTab = 'cultural' | 'referral' | 'voice';

const WHEEL_COLORS = [
  '#1A2242',
  '#2E2208',
  '#131932',
  '#3A2B0A',
  '#1A2242',
  '#2E2208',
  '#131932',
  '#4B360A',
];

const OPTION_LETTERS = ['أ', 'ب', 'ج', 'د'];

interface CompetitionsPageProps {
  embedded?: boolean;
  initialTab?: CompTab;
}

export const CompetitionsPage: React.FC<CompetitionsPageProps> = ({
  embedded = false,
  initialTab = 'cultural',
}) => {
  const { user, updateLocalUser } = useAuth();
  const { openMiniProfile } = useMiniProfile();
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const resolvedInitialTab: CompTab =
    !embedded && (tabParam === 'referral' || tabParam === 'voice' || tabParam === 'cultural')
      ? tabParam
      : initialTab;
  const [activeTab, setActiveTab] = useState<CompTab>(resolvedInitialTab);

  useEffect(() => {
    if (!embedded && (tabParam === 'referral' || tabParam === 'voice' || tabParam === 'cultural')) {
      setActiveTab(tabParam);
    }
  }, [embedded, tabParam]);

  // Voice competitions state
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(
    null
  );
  const [joinTarget, setJoinTarget] = useState<Competition | null>(null);
  const [performanceTitle, setPerformanceTitle] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Cultural Quiz Championship state (8-second anti-cheat timer)
  const [quizRound, setQuizRound] = useState<CulturalQuizRound | null>(null);
  const [quizTimeLeftMs, setQuizTimeLeftMs] = useState<number>(8000);
  const [quizLocked, setQuizLocked] = useState<boolean>(false);
  const [quizSelected, setQuizSelected] = useState<number | null>(null);
  const [quizResult, setQuizResult] = useState<CulturalQuizResult | null>(null);
  const [quizLoading, setQuizLoading] = useState<boolean>(false);
  const [quizStreak, setQuizStreak] = useState<number>(0);
  const autoTimeoutSubmittedRef = useRef<string | null>(null);

  // Referral Wheel state
  const [referralCode, setReferralCode] = useState<string>('');
  const [referralCount, setReferralCount] = useState<number>(0);
  const [referralSpins, setReferralSpins] = useState<number>(0);
  const [refSegments, setRefSegments] = useState<ReferralWheelSegment[]>([]);
  const [refSpinning, setRefSpinning] = useState<boolean>(false);
  const [refRotation, setRefRotation] = useState<number>(0);
  const [refWinBanner, setRefWinBanner] = useState<ReferralWheelSegment | null>(null);
  const [copiedRef, setCopiedRef] = useState<boolean>(false);

  const loadCompetitions = useCallback(async () => {
    try {
      const list = await getCompetitionsFromSupabase();
      setCompetitions(list);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadReferralOverview = useCallback(async () => {
    if (!user) return;
    try {
      const data = await getReferralWheelOverviewFromSupabase(user);
      setReferralCode(data.referralCode);
      setReferralCount(data.referralCount);
      setReferralSpins(data.referralSpins);
      setRefSegments(data.segments);
    } catch {
      // handled silently on init
    }
  }, [user]);

  useEffect(() => {
    void loadCompetitions();
    void loadReferralOverview();

    const channel = supabase
      .channel(`sada-competitions-${user?.id || 'guest'}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sada_competitions' },
        () => {
          void loadCompetitions();
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'sada_platform_state' },
        () => {
          void loadReferralOverview();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadCompetitions, loadReferralOverview, user?.id]);

  // 8-second live countdown & automatic anti-cheat lock
  useEffect(() => {
    if (!quizRound || quizResult || quizLocked || !user) return;

    const interval = setInterval(() => {
      const remaining = Math.max(0, quizRound.expiresAt - Date.now());
      setQuizTimeLeftMs(remaining);
      if (remaining <= 0) {
        setQuizLocked(true);
        clearInterval(interval);
        if (autoTimeoutSubmittedRef.current !== quizRound.roundId) {
          autoTimeoutSubmittedRef.current = quizRound.roundId;
          answerCulturalQuizInSupabase(user, quizRound.roundId)
            .then((res) => {
              setQuizResult(res);
              setQuizStreak(0);
              updateLocalUser(res.user);
            })
            .catch(() => {});
        }
      }
    }, 80);

    return () => clearInterval(interval);
  }, [quizRound, quizResult, quizLocked, updateLocalUser, user]);

  const handleStartQuiz = async () => {
    if (!user) return;
    setQuizLoading(true);
    setFeedback(null);
    setQuizResult(null);
    setQuizSelected(null);
    setQuizLocked(false);
    autoTimeoutSubmittedRef.current = null;
    try {
      const round = await startCulturalQuizInSupabase(user);
      setQuizRound(round);
      setQuizTimeLeftMs(round.timeLimitSeconds * 1000);
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'تعذّر بدء السؤال الثقافي.',
      });
    } finally {
      setQuizLoading(false);
    }
  };

  const handleAnswerQuiz = async (idx: number) => {
    if (!user || !quizRound || quizLocked || quizResult || quizTimeLeftMs <= 0) return;
    setQuizLocked(true);
    setQuizSelected(idx);
    autoTimeoutSubmittedRef.current = quizRound.roundId;
    try {
      const res = await answerCulturalQuizInSupabase(user, quizRound.roundId, idx);
      setQuizResult(res);
      updateLocalUser(res.user);
      setQuizStreak((prev) => (res.isCorrect ? prev + 1 : 0));
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'تعذّر تسجيل الإجابة.',
      });
    }
  };

  const handleSpinReferralWheel = async () => {
    if (!user || refSpinning || referralSpins < 1 || refSegments.length === 0) return;
    setRefSpinning(true);
    setRefWinBanner(null);
    setFeedback(null);
    try {
      const res = await spinReferralWheelInSupabase(user);
      const count = refSegments.length;
      const sliceDeg = 360 / count;
      const targetCenter = res.segmentIndex * sliceDeg + sliceDeg / 2;
      const extraSpins = 360 * 6;
      const normalized = refRotation % 360;
      const nextAngle =
        refRotation - normalized + extraSpins + (360 - targetCenter);
      setRefRotation(nextAngle);

      setTimeout(() => {
        setRefSpinning(false);
        setRefWinBanner(res.segment);
        updateLocalUser(res.user);
        setReferralSpins(res.user.referralSpins ?? 0);
      }, 4200);
    } catch (err) {
      setRefSpinning(false);
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'تعذّر تدوير دولاب حظ الدعوات.',
      });
    }
  };

  const handleCopyReferral = () => {
    const shareUrl = `${window.location.origin}/#/login?ref=${referralCode}`;
    navigator.clipboard?.writeText(shareUrl).catch(() => {});
    setCopiedRef(true);
    setTimeout(() => setCopiedRef(false), 2000);
  };

  const handleVote = async (
    compId: string,
    contestantId: string,
    boost: boolean
  ) => {
    if (!user) return;
    setFeedback(null);
    try {
      const data = await voteCompetitionInSupabase(user, compId, contestantId, boost);
      updateLocalUser(data.user);
      setCompetitions((prev) =>
        prev.map((c) => (c.id === data.competition.id ? data.competition : c))
      );
      setFeedback({
        type: 'ok',
        text: boost
          ? 'تم إرسال التصويت الملكي بنجاح (+10 أصوات)!'
          : 'تم احتساب صوتك المجاني بنجاح!',
      });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'تعذّر إرسال التصويت.',
      });
    }
  };

  const handleJoinCompetition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !joinTarget) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      const updated = await joinCompetitionInSupabase(
        user,
        joinTarget.id,
        performanceTitle
      );
      setCompetitions((prev) =>
        prev.map((c) => (c.id === updated.id ? updated : c))
      );
      setJoinTarget(null);
      setPerformanceTitle('');
      setFeedback({
        type: 'ok',
        text: 'تم تسجيلك كمتسابق في البطولة! يمكنك الآن استقبال تصويت الجمهور.',
      });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'تعذّر التسجيل.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const xpNextLevel = Math.pow(user?.level || 1, 2) * 120;
  const xpProgress = Math.min(
    100,
    Math.round(((user?.xp || 0) / Math.max(1, xpNextLevel)) * 100)
  );

  const wheelPaths = useMemo(() => {
    if (refSegments.length === 0) return [];
    const total = refSegments.length;
    const slice = 360 / total;
    const r = 148;
    const cx = 150;
    const cy = 150;
    return refSegments.map((seg, i) => {
      const startDeg = i * slice - 90;
      const endDeg = (i + 1) * slice - 90;
      const midDeg = (startDeg + endDeg) / 2;
      const startRad = (startDeg * Math.PI) / 180;
      const endRad = (endDeg * Math.PI) / 180;
      const midRad = (midDeg * Math.PI) / 180;
      const x1 = cx + r * Math.cos(startRad);
      const y1 = cy + r * Math.sin(startRad);
      const x2 = cx + r * Math.cos(endRad);
      const y2 = cy + r * Math.sin(endRad);
      const tx = cx + r * 0.49 * Math.cos(midRad);
      const ty = cy + r * 0.49 * Math.sin(midRad);
      const iconLeftPct = 50 + 34.5 * Math.cos(midRad);
      const iconTopPct = 50 + 34.5 * Math.sin(midRad);
      const studX = cx + 141 * Math.cos(startRad);
      const studY = cy + 141 * Math.sin(startRad);
      return {
        seg,
        d: `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2} Z`,
        tx,
        ty,
        iconLeftPct,
        iconTopPct,
        studX,
        studY,
        midDeg: midDeg + 90,
        isGold: i % 2 === 0,
        color: WHEEL_COLORS[i % WHEEL_COLORS.length],
      };
    });
  }, [refSegments]);

  const secondsDisplay = Math.ceil(quizTimeLeftMs / 1000);
  const timerPercent = Math.max(0, Math.min(100, (quizTimeLeftMs / 8000) * 100));

  return (
    <div
      className={
        embedded
          ? 'space-y-4 sm:space-y-5'
          : 'max-w-7xl mx-auto px-4 sm:px-6 pt-5 pb-28 space-y-6 overflow-y-auto overscroll-y-contain'
      }
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {!embedded && (
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold gold-gradient-text">
              ساحة المسابقات والبطولات الثقافية
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1">
              تحديات ثقافية حية بمؤقت 8 ثوانٍ لرفع مستواك (XP)، دولاب حظ الدعوات، والبطولات الصوتية
            </p>
          </div>
        )}

        {/* Section Tabs */}
        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-[#070913]/85 border border-[#D4AF37]/25 overflow-x-auto no-scrollbar shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('cultural')}
            className={`min-h-[40px] rounded-xl px-3.5 py-2 text-xs sm:text-sm font-bold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'cultural'
                ? 'bg-gradient-to-r from-[#D4AF37] to-[#B58922] text-[#070913]'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Brain className="w-4 h-4" />
            <span>البطولات الثقافية الحية</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('referral')}
            className={`min-h-[40px] rounded-xl px-3.5 py-2 text-xs sm:text-sm font-bold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'referral'
                ? 'bg-gradient-to-r from-[#D4AF37] to-[#B58922] text-[#070913]'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Gift className="w-4 h-4" />
            <span>دولاب حظ الدعوات ({referralSpins})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('voice')}
            className={`min-h-[40px] rounded-xl px-3.5 py-2 text-xs sm:text-sm font-bold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'voice'
                ? 'bg-gradient-to-r from-[#D4AF37] to-[#B58922] text-[#070913]'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Trophy className="w-4 h-4" />
            <span>البطولات الصوتية</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`rounded-2xl px-4 py-3 text-xs sm:text-sm border ${
            feedback.type === 'ok'
              ? 'border-emerald-500/40 bg-emerald-950/50 text-emerald-200'
              : 'border-rose-500/40 bg-rose-950/50 text-rose-200'
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* TAB 1: LIVE CULTURAL CHAMPIONSHIPS (4 OPTIONS + 8s AUTO-LOCK + XP) */}
      {activeTab === 'cultural' && (
        <div className="space-y-5">
          {/* XP & Level Strip */}
          <section className="royal-glass rounded-3xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex-1 space-y-2">
              <div className="flex items-center justify-between text-xs sm:text-sm">
                <span className="font-extrabold text-[#FCE9A6] flex items-center gap-1.5">
                  <Crown className="w-4 h-4 text-[#D4AF37]" />
                  المستوى الحالي: Lv.{user?.level ?? 1}
                </span>
                <span className="font-mono-num text-slate-300">
                  {(user?.xp ?? 0).toLocaleString('en-US')} /{' '}
                  {xpNextLevel.toLocaleString('en-US')} XP
                </span>
              </div>
              <div className="h-2.5 rounded-full bg-[#070913] border border-[#D4AF37]/25 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#D4AF37] to-[#FCE9A6] transition-all duration-500"
                  style={{ width: `${xpProgress}%` }}
                />
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0 font-mono-num text-xs">
              <div className="royal-capsule rounded-xl px-3.5 py-2 text-[#FCE9A6] font-bold">
                🔥 سلسلة الفوز: {quizStreak}
              </div>
              <div className="royal-capsule rounded-xl px-3.5 py-2 text-emerald-300 font-bold">
                ⏱️ مؤقت 8 ثوانٍ
              </div>
            </div>
          </section>

          {/* Quiz Arena */}
          <section className="royal-glass rounded-3xl p-6 sm:p-8 space-y-6">
            {!quizRound ? (
              <div className="text-center py-8 space-y-4 max-w-lg mx-auto">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-[#D4AF37]/15 border border-[#D4AF37]/45 flex items-center justify-center text-[#FCE9A6] shadow-[0_0_25px_rgba(212,175,55,0.28)]">
                  <Brain className="w-8 h-8" />
                </div>
                <h2 className="text-xl sm:text-2xl font-extrabold text-white">
                  تحدّي المعرفة والبيان العربي
                </h2>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  لكل سؤال 4 خيارات ومؤقت تنازلي صارم مدته 8 ثوانٍ فقط — عند انتهاء الوقت تُقفل الخيارات تلقائياً لمنع الغش! أجب بسرعة لتكسب نقاط XP وكوينز ذهبية.
                </p>
                <button
                  type="button"
                  disabled={quizLoading}
                  onClick={handleStartQuiz}
                  className="gold-btn min-h-[48px] rounded-2xl px-8 py-3 text-sm font-extrabold cursor-pointer disabled:opacity-60"
                >
                  {quizLoading ? 'جارٍ تجهيز السؤال...' : 'ابدأ الجولة الثقافية الآن'}
                </button>
              </div>
            ) : (
              <div className="space-y-5">
                {/* Category + 8s Countdown */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[#F3D37A]">
                      {quizRound.category}
                    </span>
                    <span className="text-slate-600">·</span>
                    <span className="text-xs font-mono-num text-emerald-300 font-bold">
                      +{quizRound.xpReward} XP · +{quizRound.coinsReward} كوينز
                    </span>
                  </div>

                  <div
                    className={`rounded-2xl px-4 py-2 border flex items-center gap-2 font-mono-num text-sm font-extrabold ${
                      quizLocked && !quizResult?.isCorrect
                        ? 'border-rose-500/50 bg-rose-950/60 text-rose-200'
                        : secondsDisplay <= 3
                        ? 'border-rose-400/70 bg-rose-950/70 text-rose-200 animate-pulse'
                        : 'border-[#FCE9A6]/50 bg-[#070913]/85 text-[#FCE9A6]'
                    }`}
                  >
                    {quizLocked && quizTimeLeftMs <= 0 ? (
                      <>
                        <Lock className="w-4 h-4" />
                        <span>مغلق (انتهت الـ 8 ثوانٍ)</span>
                      </>
                    ) : (
                      <>
                        <Timer className="w-4 h-4" />
                        <span>{secondsDisplay} ثوانٍ</span>
                      </>
                    )}
                  </div>
                </div>

                {/* 8-Second Progress Bar */}
                <div className="h-2 rounded-full bg-[#070913] overflow-hidden border border-[#D4AF37]/20">
                  <div
                    className={`h-full transition-all duration-100 ${
                      secondsDisplay <= 3
                        ? 'bg-gradient-to-r from-rose-500 to-amber-400'
                        : 'bg-gradient-to-r from-[#D4AF37] to-[#FCE9A6]'
                    }`}
                    style={{ width: `${timerPercent}%` }}
                  />
                </div>

                {/* Question */}
                <h3 className="text-lg sm:text-xl font-extrabold text-white leading-relaxed">
                  {quizRound.question}
                </h3>

                {/* 4 Options Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {quizRound.options.map((opt, idx) => {
                    const isSelected = quizSelected === idx;
                    const isCorrectOpt = quizResult?.correctIndex === idx;
                    let cardStyle =
                      'bg-[#070913]/75 border-[#D4AF37]/25 hover:border-[#F3D37A]/70 text-white';

                    if (quizResult) {
                      if (isCorrectOpt) {
                        cardStyle =
                          'bg-emerald-500/20 border-emerald-400 text-emerald-100 shadow-[0_0_20px_rgba(16,185,129,0.3)]';
                      } else if (isSelected && !quizResult.isCorrect) {
                        cardStyle = 'bg-rose-500/20 border-rose-400 text-rose-200';
                      } else {
                        cardStyle = 'bg-[#070913]/50 border-white/10 text-slate-400 opacity-70';
                      }
                    } else if (quizLocked) {
                      cardStyle =
                        'bg-[#070913]/50 border-rose-500/25 text-slate-400 opacity-65 cursor-not-allowed';
                    }

                    return (
                      <button
                        key={idx}
                        type="button"
                        disabled={quizLocked || Boolean(quizResult)}
                        onClick={() => handleAnswerQuiz(idx)}
                        className={`rounded-2xl border p-4 text-right flex items-center gap-3 transition cursor-pointer disabled:cursor-not-allowed ${cardStyle}`}
                      >
                        <span className="w-8 h-8 rounded-xl bg-[#D4AF37]/15 border border-[#D4AF37]/40 flex items-center justify-center text-xs font-extrabold text-[#FCE9A6] shrink-0">
                          {OPTION_LETTERS[idx]}
                        </span>
                        <span className="text-sm font-bold flex-1">{opt}</span>
                        {quizLocked && !quizResult && (
                          <Lock className="w-4 h-4 text-rose-400 shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Result Banner & Next Question */}
                {quizResult && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`rounded-2xl border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      quizResult.isCorrect
                        ? 'border-emerald-400/50 bg-emerald-500/15 text-emerald-100'
                        : quizResult.timedOut
                        ? 'border-rose-400/50 bg-rose-950/60 text-rose-200'
                        : 'border-amber-400/50 bg-amber-950/50 text-amber-100'
                    }`}
                  >
                    <div>
                      <p className="text-sm font-extrabold">
                        {quizResult.isCorrect
                          ? `إجابة صحيحة! +${quizResult.xpGained} XP و +${quizResult.coinsGained} كوينز 🎉`
                          : quizResult.timedOut
                          ? 'انتهى مؤقت الـ 8 ثوانٍ — تم قفل الخيارات تلقائياً لمنع الغش!'
                          : `إجابة غير موفقة! حصلت على +${quizResult.xpGained} XP للمشاركة`}
                      </p>
                      <p className="text-xs opacity-85 mt-0.5">
                        الإجابة الصحيحة هي: {quizRound.options[quizResult.correctIndex]}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleStartQuiz}
                      disabled={quizLoading}
                      className="gold-btn min-h-[42px] rounded-xl px-5 text-xs font-extrabold cursor-pointer shrink-0"
                    >
                      السؤال التالي
                    </button>
                  </motion.div>
                )}
              </div>
            )}
          </section>
        </div>
      )}

      {/* TAB 2: REFERRAL WHEEL TIED TO APP PRIZE POOL */}
      {activeTab === 'referral' && (
        <div className="space-y-6">
          {/* KPIs + Referral Link */}
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-7 royal-glass rounded-3xl p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-lg sm:text-xl font-extrabold text-white">
                    كود ورابط الدعوة الملكي
                  </h2>
                  <p className="text-xs text-slate-300 mt-0.5">
                    كل صديق يسجل عبر كودك يمنحك لفة مجانية في دولاب جوائز حتى 50,000 كوينز!
                  </p>
                </div>
                <Gift className="w-6 h-6 text-[#F3D37A] shrink-0" />
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                <div
                  dir="ltr"
                  className="flex-1 rounded-xl border border-[#FCE9A6]/50 bg-[#070913]/90 px-4 py-3 font-mono-num text-sm font-extrabold text-[#FCE9A6] text-center tracking-wider"
                >
                  {referralCode || 'REF-LOADING'}
                </div>
                <button
                  type="button"
                  onClick={handleCopyReferral}
                  className="gold-btn min-h-[44px] rounded-xl px-5 text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                >
                  {copiedRef ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>تم نسخ رابط الدعوة</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>نسخ رابط الدعوة</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="lg:col-span-5 grid grid-cols-2 gap-3">
              <div className="royal-glass rounded-3xl p-4 flex flex-col justify-between">
                <span className="text-[11px] text-slate-400">لفاتك المجانية</span>
                <p className="text-2xl font-extrabold font-mono-num text-[#FCE9A6] mt-2">
                  {referralSpins}
                </p>
              </div>
              <div className="royal-glass rounded-3xl p-4 flex flex-col justify-between">
                <span className="text-[11px] text-slate-400">الدعوات الناجحة</span>
                <p className="text-2xl font-extrabold font-mono-num text-white mt-2">
                  {referralCount}
                </p>
              </div>
            </div>
          </section>

          {/* Wheel + Prize Pool Breakdown */}
          <section className="royal-glass rounded-3xl p-5 sm:p-7 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            <div className="lg:col-span-6 flex flex-col items-center gap-4">
              <div className="relative w-72 h-72 sm:w-80 sm:h-80 flex items-center justify-center">
                {/* Sculpted 3D Metallic Pointer with Ruby Jewel */}
                <div
                  className="absolute -top-3 left-1/2 -translate-x-1/2 z-30 pointer-events-none drop-shadow-[0_6px_12px_rgba(0,0,0,0.85)]"
                  aria-hidden="true"
                >
                  <svg viewBox="0 0 44 50" className="w-10 h-11">
                    <defs>
                      <linearGradient id="refPtrGold" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#FFFBEB" />
                        <stop offset="45%" stopColor="#FACC15" />
                        <stop offset="100%" stopColor="#92400E" />
                      </linearGradient>
                      <radialGradient id="refPtrGem" cx="35%" cy="35%" r="65%">
                        <stop offset="0%" stopColor="#FECDD3" />
                        <stop offset="45%" stopColor="#E11D48" />
                        <stop offset="100%" stopColor="#881337" />
                      </radialGradient>
                    </defs>
                    <path
                      d="M22 48 L6 16 C4 9, 11 2, 22 2 C33 2, 40 9, 38 16 Z"
                      fill="url(#refPtrGold)"
                      stroke="#FEF9C3"
                      strokeWidth="2"
                    />
                    <circle cx="22" cy="14" r="6" fill="url(#refPtrGem)" stroke="#FEF08A" strokeWidth="1.5" />
                  </svg>
                </div>

                {/* Brushed Gold Metallic 3D Wheel Rim */}
                <div className="w-full h-full rounded-full p-2.5 bg-gradient-to-br from-[#FFF7CC] via-[#D4AF37] to-[#6D4C0B] shadow-[0_22px_50px_rgba(0,0,0,0.85),0_0_45px_rgba(212,175,55,0.45),inset_0_3px_6px_rgba(255,255,255,0.65)]">
                  <div className="w-full h-full rounded-full p-1 bg-gradient-to-b from-[#1E293B] via-[#0F172A] to-[#020617] shadow-[inset_0_4px_12px_rgba(0,0,0,0.9)]">
                    <div
                      className="relative w-full h-full rounded-full overflow-hidden bg-[#070913]"
                      style={{
                        transform: `rotate(${refRotation}deg)`,
                        transition: refSpinning
                          ? 'transform 4.2s cubic-bezier(0.14, 0.85, 0.22, 1)'
                          : 'none',
                      }}
                    >
                      <svg viewBox="0 0 300 300" className="w-full h-full">
                        <defs>
                          <linearGradient id="refGoldSlice" x1="0" y1="0" x2="1" y2="1">
                            <stop offset="0%" stopColor="#FEF08A" />
                            <stop offset="48%" stopColor="#D4AF37" />
                            <stop offset="100%" stopColor="#854D0E" />
                          </linearGradient>
                          <linearGradient id="refSilverSlice" x1="0" y1="0" x2="1" y2="1">
                            <stop offset="0%" stopColor="#F8FAFC" />
                            <stop offset="50%" stopColor="#CBD5E1" />
                            <stop offset="100%" stopColor="#475569" />
                          </linearGradient>
                          <radialGradient id="refHubGrad" cx="35%" cy="30%" r="70%">
                            <stop offset="0%" stopColor="#FFFBEB" />
                            <stop offset="45%" stopColor="#D4AF37" />
                            <stop offset="100%" stopColor="#451A03" />
                          </radialGradient>
                        </defs>
                        {wheelPaths.map((p) => (
                          <g key={p.seg.id}>
                            <path
                              d={p.d}
                              fill={p.isGold ? 'url(#refGoldSlice)' : 'url(#refSilverSlice)'}
                              stroke="#1E1B18"
                              strokeWidth="1.6"
                              strokeOpacity="0.65"
                            />
                            <g transform={`translate(${p.tx}, ${p.ty}) rotate(${p.midDeg})`}>
                              <text
                                x="0"
                                y="4"
                                textAnchor="middle"
                                fontSize="9.5"
                                fontWeight="900"
                                fill="#0B0F20"
                              >
                                {p.seg.shortLabel}
                              </text>
                            </g>
                            <circle
                              cx={p.studX}
                              cy={p.studY}
                              r="3.2"
                              fill="#FFFBEB"
                              stroke="#78350F"
                              strokeWidth="1"
                            />
                          </g>
                        ))}
                        <circle
                          cx="150"
                          cy="150"
                          r="29"
                          fill="url(#refHubGrad)"
                          stroke="#FFFBEB"
                          strokeWidth="2.5"
                        />
                        <circle
                          cx="150"
                          cy="150"
                          r="22"
                          fill="#070913"
                          stroke="#FDE047"
                          strokeWidth="1.8"
                        />
                        <text
                          x="150"
                          y="155"
                          textAnchor="middle"
                          fontSize="12"
                          fontWeight="900"
                          fill="#FCE9A6"
                        >
                          صَدَى
                        </text>
                      </svg>

                      {/* 3D Fluent Assets overlaid on each slice */}
                      {wheelPaths.map((p) => (
                        <div
                          key={`icon_${p.seg.id}`}
                          className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
                          style={{
                            left: `${p.iconLeftPct}%`,
                            top: `${p.iconTopPct}%`,
                            transform: `translate(-50%, -50%) rotate(${p.midDeg}deg)`,
                          }}
                        >
                          <Fluent3DAsset
                            glyph={p.seg.glyph}
                            alt={p.seg.shortLabel}
                            priority
                            sizeClass="w-7 h-7 sm:w-8 sm:h-8"
                            fallbackTextClass="text-base"
                            className="drop-shadow-[0_3px_5px_rgba(0,0,0,0.65)]"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <button
                type="button"
                disabled={refSpinning || referralSpins < 1}
                onClick={handleSpinReferralWheel}
                className="gold-btn min-h-[48px] rounded-2xl px-8 py-3 text-sm font-extrabold flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4" />
                <span>
                  {refSpinning
                    ? 'جارٍ تدوير دولاب الدعوات...'
                    : referralSpins > 0
                    ? `استخدم لفة مجانية الآن (${referralSpins})`
                    : 'ادعُ صديقاً لفتح لفة مجانية'}
                </span>
              </button>

              <AnimatePresence>
                {refWinBanner && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.94 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    className="w-full rounded-2xl border border-[#FCE9A6]/70 bg-[#D4AF37]/15 px-4 py-3 flex items-center justify-center gap-2 text-sm font-extrabold text-[#FCE9A6]"
                  >
                    <Fluent3DAsset
                      glyph={refWinBanner.glyph}
                      alt={refWinBanner.label}
                      priority
                      sizeClass="w-7 h-7"
                      fallbackTextClass="text-xl"
                    />
                    <span>{refWinBanner.label}</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Prize Pool Tiers */}
            <div className="lg:col-span-6 space-y-3">
              <div>
                <h3 className="text-base font-extrabold text-[#F3D37A]">
                  جوائز دولاب الدعوات الملكي
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  احصل على لفة مجانية مقابل كل صديق ينضم عبر رابط دعوتك الخاص.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                {refSegments.map((seg) => (
                  <div
                    key={seg.id}
                    className="rounded-2xl border border-[#D4AF37]/30 bg-[#070913]/75 text-white p-3 flex items-center gap-2.5 text-xs"
                  >
                    <Fluent3DAsset
                      glyph={seg.glyph}
                      alt={seg.shortLabel}
                      sizeClass="w-7 h-7"
                      fallbackTextClass="text-xl"
                    />
                    <span className="font-bold truncate">{seg.shortLabel}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      )}

      {/* TAB 3: LIVE VOICE COMPETITIONS */}
      {activeTab === 'voice' && (
        <>
          {loading ? (
            <div className="space-y-4">
              {[1, 2].map((n) => (
                <div key={n} className="royal-glass rounded-3xl h-72 animate-pulse opacity-60" />
              ))}
            </div>
          ) : (
            <div className="space-y-8">
              {competitions.map((comp) => {
                const sorted = [...comp.contestants].sort(
                  (a, b) => b.votes * 100 + b.giftScore - (a.votes * 100 + a.giftScore)
                );
                const isJoined = comp.contestants.some((c) => c.userId === user?.id);

                return (
                  <motion.section
                    key={comp.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="royal-glass rounded-3xl overflow-hidden"
                  >
                    <div className="relative h-44 sm:h-52">
                      <img
                        src={resolveAsset(comp.bannerImage)}
                        alt={comp.title}
                        loading="lazy"
                        decoding="async"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#0B0F20] via-[#0B0F20]/70 to-transparent" />
                      <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2 text-xs text-[#F3D37A] font-semibold">
                            <span>{comp.category}</span>
                            <span aria-hidden="true">·</span>
                            <span>{comp.status === 'live' ? 'مفتوحة للتصويت' : 'منتهية'}</span>
                          </div>
                          <h2 className="text-xl sm:text-2xl font-extrabold text-white mt-0.5">
                            {comp.title}
                          </h2>
                          <p className="text-xs text-slate-300 mt-1">{comp.subtitle}</p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                          <div className="royal-capsule rounded-xl px-3 py-2 flex items-center gap-2 text-xs font-mono-num">
                            <Coins className="w-4 h-4 text-[#D4AF37]" />
                            <span className="text-[#FCE9A6] font-bold">
                              {comp.prizeCoins.toLocaleString('en-US')}
                            </span>
                            <span className="text-slate-600">|</span>
                            <Gem className="w-4 h-4 text-sky-400" />
                            <span className="text-sky-200 font-bold">
                              {comp.prizeDiamonds.toLocaleString('en-US')}
                            </span>
                          </div>

                          {comp.status === 'live' && !isJoined && (
                            <button
                              type="button"
                              onClick={() => setJoinTarget(comp)}
                              className="gold-btn min-h-[40px] rounded-xl px-4 py-2 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                            >
                              <Plus className="w-4 h-4" />
                              <span>شارك كمتسابق</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="p-5 sm:p-6 space-y-3">
                      {sorted.length === 0 ? (
                        <p className="text-sm text-slate-400 text-center py-6">
                          لم ينضم متسابقون بعد — كن أول المشاركين في هذه البطولة!
                        </p>
                      ) : (
                        sorted.map((c, idx) => {
                          const isWinner = comp.winnerId === c.userId;
                          return (
                            <div
                              key={c.id}
                              className={`rounded-2xl p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border transition ${
                                isWinner
                                  ? 'bg-[#D4AF37]/15 border-[#F3D37A]/60'
                                  : 'bg-[#070913]/65 border-[#D4AF37]/15'
                              }`}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <span
                                  className={`w-8 h-8 rounded-xl flex items-center justify-center font-mono-num text-sm font-extrabold shrink-0 ${
                                    idx === 0
                                      ? 'bg-[#D4AF37] text-[#070913]'
                                      : idx === 1
                                      ? 'bg-slate-300 text-[#070913]'
                                      : idx === 2
                                      ? 'bg-amber-700 text-white'
                                      : 'bg-white/5 text-slate-300'
                                  }`}
                                >
                                  {idx + 1}
                                </span>

                                <AvatarWithFrame
                                  src={c.avatarUrl}
                                  alt={c.displayName}
                                  size="md"
                                  frameId={idx === 0 ? 'frame_imperial' : 'frame_obsidian'}
                                  onClick={() =>
                                    openMiniProfile(c.userId, {
                                      displayName: c.displayName,
                                      avatarUrl: c.avatarUrl,
                                      level: c.level,
                                    })
                                  }
                                />

                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        openMiniProfile(c.userId, {
                                          displayName: c.displayName,
                                          avatarUrl: c.avatarUrl,
                                          level: c.level,
                                        })
                                      }
                                      className="text-sm font-bold text-white hover:text-[#FCE9A6] truncate cursor-pointer text-right"
                                    >
                                      {c.displayName}
                                    </button>
                                    {isWinner && (
                                      <span className="inline-flex items-center gap-1 text-xs font-bold text-[#FCE9A6]">
                                        <Crown className="w-3.5 h-3.5" />
                                        بطل المسابقة
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-slate-400 truncate">
                                    {c.performanceTitle} · Lv.{c.level}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                                <div className="text-left sm:text-right font-mono-num">
                                  <div className="text-sm font-extrabold text-[#F3D37A]">
                                    {c.votes.toLocaleString('en-US')} صوت
                                  </div>
                                  <div className="text-[11px] text-slate-400">
                                    دعم: {c.giftScore.toLocaleString('en-US')}
                                  </div>
                                </div>

                                {comp.status === 'live' && (
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => handleVote(comp.id, c.id, false)}
                                      className="min-h-[40px] rounded-xl px-3 py-1.5 text-xs font-bold bg-white/5 hover:bg-white/10 border border-[#D4AF37]/30 text-white flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                                    >
                                      <Vote className="w-3.5 h-3.5 text-[#D4AF37]" />
                                      <span>تصويت</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleVote(comp.id, c.id, true)}
                                      className="gold-btn min-h-[40px] rounded-xl px-3 py-1.5 text-xs font-bold flex items-center gap-1 cursor-pointer whitespace-nowrap"
                                      title="تصويت ملكي بـ 100 كوينز (+10 أصوات)"
                                    >
                                      <Sparkles className="w-3.5 h-3.5" />
                                      <span>+10 (100)</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </motion.section>
                );
              })}
            </div>
          )}
        </>
      )}

      {joinTarget && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
          onClick={() => setJoinTarget(null)}
        >
          <div
            className="royal-glass w-full max-w-md rounded-3xl p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[#F3D37A]">
                <Trophy className="w-5 h-5" />
                <h3 className="text-lg font-extrabold">التسجيل في المسابقة</h3>
              </div>
              <button
                type="button"
                onClick={() => setJoinTarget(null)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-full text-slate-400 hover:text-white cursor-pointer"
                aria-label="إغلاق"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-300">{joinTarget.title}</p>

            <form onSubmit={handleJoinCompetition} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  عنوان مشاركتك / فقرتك الصوتية
                </label>
                <input
                  type="text"
                  required
                  minLength={3}
                  value={performanceTitle}
                  onChange={(e) => setPerformanceTitle(e.target.value)}
                  placeholder="مثال: قصيدة في مدح الأصالة"
                  className="w-full rounded-xl bg-[#070913]/85 border border-[#D4AF37]/25 px-3.5 py-3 text-sm text-white focus:outline-none focus:border-[#D4AF37]"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="gold-btn w-full min-h-[46px] rounded-xl py-2.5 text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                <Award className="w-4 h-4" />
                <span>{submitting ? 'جارٍ التسجيل...' : 'تأكيد المشاركة الآن'}</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
