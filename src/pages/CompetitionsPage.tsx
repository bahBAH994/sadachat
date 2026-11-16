import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { apiFetch, getWsUrl } from '../lib/api';
import { resolveAsset } from '../lib/assets';
import type {
  Competition,
  CulturalQuizResult,
  CulturalQuizRound,
  ReferralWheelResult,
  ReferralWheelSegment,
  User,
} from '../types';
import { AvatarWithFrame } from '../components/AvatarWithFrame';

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

export const CompetitionsPage: React.FC = () => {
  const { user, updateLocalUser } = useAuth();
  const [activeTab, setActiveTab] = useState<CompTab>('cultural');

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
  const [appPrizePoolCoins, setAppPrizePoolCoins] = useState<number>(250000);
  const [refSegments, setRefSegments] = useState<ReferralWheelSegment[]>([]);
  const [refSpinning, setRefSpinning] = useState<boolean>(false);
  const [refRotation, setRefRotation] = useState<number>(0);
  const [refWinBanner, setRefWinBanner] = useState<ReferralWheelSegment | null>(null);
  const [copiedRef, setCopiedRef] = useState<boolean>(false);

  const loadCompetitions = useCallback(async () => {
    try {
      const data = await apiFetch<{ competitions: Competition[] }>('/api/competitions');
      setCompetitions(data.competitions);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadReferralOverview = useCallback(async () => {
    try {
      const data = await apiFetch<{
        referralCode: string;
        referralCount: number;
        referralSpins: number;
        appPrizePoolCoins: number;
        segments: ReferralWheelSegment[];
      }>('/api/competitions/referral-wheel/overview');
      setReferralCode(data.referralCode);
      setReferralCount(data.referralCount);
      setReferralSpins(data.referralSpins);
      setAppPrizePoolCoins(data.appPrizePoolCoins);
      setRefSegments(data.segments);
    } catch {
      // handled silently on init
    }
  }, []);

  useEffect(() => {
    loadCompetitions();
    loadReferralOverview();

    const ws = new WebSocket(getWsUrl());
    ws.onopen = () => {
      if (user?.id) {
        ws.send(JSON.stringify({ type: 'user:auth', userId: user.id }));
      }
    };
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data) as { event: string; payload: unknown };
        if (msg.event === 'competition:updated') {
          const updated = msg.payload as Competition;
          setCompetitions((prev) => {
            const exists = prev.some((c) => c.id === updated.id);
            if (!exists) return [updated, ...prev];
            return prev.map((c) => (c.id === updated.id ? updated : c));
          });
        } else if (msg.event === 'referral:spin-earned') {
          loadReferralOverview();
        }
      } catch {
        // ignore
      }
    };
    return () => ws.close();
  }, [loadCompetitions, loadReferralOverview, user?.id]);

  // 8-second live countdown & automatic anti-cheat lock
  useEffect(() => {
    if (!quizRound || quizResult || quizLocked) return;

    const interval = setInterval(() => {
      const remaining = Math.max(0, quizRound.expiresAt - Date.now());
      setQuizTimeLeftMs(remaining);
      if (remaining <= 0) {
        setQuizLocked(true);
        clearInterval(interval);
        if (autoTimeoutSubmittedRef.current !== quizRound.roundId) {
          autoTimeoutSubmittedRef.current = quizRound.roundId;
          apiFetch<CulturalQuizResult>('/api/competitions/quiz/answer', {
            method: 'POST',
            body: JSON.stringify({ roundId: quizRound.roundId }),
          })
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
  }, [quizRound, quizResult, quizLocked, updateLocalUser]);

  const handleStartQuiz = async () => {
    setQuizLoading(true);
    setFeedback(null);
    setQuizResult(null);
    setQuizSelected(null);
    setQuizLocked(false);
    autoTimeoutSubmittedRef.current = null;
    try {
      const round = await apiFetch<CulturalQuizRound>('/api/competitions/quiz/start', {
        method: 'POST',
      });
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
    if (!quizRound || quizLocked || quizResult || quizTimeLeftMs <= 0) return;
    setQuizLocked(true);
    setQuizSelected(idx);
    autoTimeoutSubmittedRef.current = quizRound.roundId;
    try {
      const res = await apiFetch<CulturalQuizResult>('/api/competitions/quiz/answer', {
        method: 'POST',
        body: JSON.stringify({ roundId: quizRound.roundId, selectedIndex: idx }),
      });
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
    if (refSpinning || referralSpins < 1 || refSegments.length === 0) return;
    setRefSpinning(true);
    setRefWinBanner(null);
    setFeedback(null);
    try {
      const res = await apiFetch<ReferralWheelResult>(
        '/api/competitions/referral-wheel/spin',
        { method: 'POST' }
      );
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
        setAppPrizePoolCoins(res.appPrizePoolCoins);
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
    setFeedback(null);
    try {
      const data = await apiFetch<{ competition: Competition; user: User }>(
        `/api/competitions/${compId}/vote`,
        {
          method: 'POST',
          body: JSON.stringify({ contestantId, boost }),
        }
      );
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
    if (!joinTarget) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      const data = await apiFetch<{ competition: Competition }>(
        `/api/competitions/${joinTarget.id}/join`,
        {
          method: 'POST',
          body: JSON.stringify({ performanceTitle }),
        }
      );
      setCompetitions((prev) =>
        prev.map((c) => (c.id === data.competition.id ? data.competition : c))
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
    const r = 140;
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
      const tx = cx + r * 0.65 * Math.cos(midRad);
      const ty = cy + r * 0.65 * Math.sin(midRad);
      return {
        seg,
        d: `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2} Z`,
        tx,
        ty,
        midDeg: midDeg + 90,
        color: WHEEL_COLORS[i % WHEEL_COLORS.length],
      };
    });
  }, [refSegments]);

  const secondsDisplay = Math.ceil(quizTimeLeftMs / 1000);
  const timerPercent = Math.max(0, Math.min(100, (quizTimeLeftMs / 8000) * 100));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-5 pb-28 space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold gold-gradient-text">
            ساحة المسابقات والبطولات الثقافية
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1">
            تحديات ثقافية حية بمؤقت 8 ثوانٍ لرفع مستواك (XP)، دولاب حظ الدعوات، والبطولات الصوتية
          </p>
        </div>

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
                    كل صديق يسجل عبر كودك يمنحك لفة مجانية في دولاب جوائز حتى 100,000 كوينز!
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

            <div className="lg:col-span-5 grid grid-cols-3 gap-3">
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
              <div className="royal-glass rounded-3xl p-4 flex flex-col justify-between border-[#F3D37A]/40">
                <span className="text-[11px] text-slate-400">مخزون جوائز التطبيق</span>
                <p className="text-base sm:text-lg font-extrabold font-mono-num text-emerald-300 mt-2">
                  {appPrizePoolCoins.toLocaleString('en-US')}
                </p>
              </div>
            </div>
          </section>

          {/* Wheel + Prize Pool Breakdown */}
          <section className="royal-glass rounded-3xl p-5 sm:p-7 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            <div className="lg:col-span-6 flex flex-col items-center gap-4">
              <div className="relative w-72 h-72 sm:w-80 sm:h-80 flex items-center justify-center">
                <div
                  className="absolute -top-2.5 left-1/2 -translate-x-1/2 z-20 w-0 h-0 border-l-[12px] border-r-[12px] border-t-[20px] border-l-transparent border-r-transparent border-t-[#FCE9A6] drop-shadow-[0_0_12px_rgba(243,211,122,0.9)]"
                  aria-hidden="true"
                />

                <div
                  className="w-full h-full rounded-full border-4 border-[#D4AF37] shadow-[0_0_45px_rgba(212,175,55,0.38)] overflow-hidden"
                  style={{
                    transform: `rotate(${refRotation}deg)`,
                    transition: refSpinning
                      ? 'transform 4.2s cubic-bezier(0.14, 0.85, 0.22, 1)'
                      : 'none',
                  }}
                >
                  <svg viewBox="0 0 300 300" className="w-full h-full">
                    {wheelPaths.map((p) => (
                      <g key={p.seg.id}>
                        <path
                          d={p.d}
                          fill={p.color}
                          stroke="#D4AF37"
                          strokeWidth="1.3"
                          strokeOpacity="0.55"
                        />
                        <g transform={`translate(${p.tx}, ${p.ty}) rotate(${p.midDeg})`}>
                          <text
                            x="0"
                            y="-7"
                            textAnchor="middle"
                            fontSize="17"
                            fill="#FCE9A6"
                          >
                            {p.seg.glyph}
                          </text>
                          <text
                            x="0"
                            y="9"
                            textAnchor="middle"
                            fontSize="9"
                            fontWeight="700"
                            fill="#F8FAFC"
                          >
                            {p.seg.shortLabel}
                          </text>
                        </g>
                      </g>
                    ))}
                    <circle
                      cx="150"
                      cy="150"
                      r="25"
                      fill="#070913"
                      stroke="#F3D37A"
                      strokeWidth="3"
                    />
                    <text
                      x="150"
                      y="155"
                      textAnchor="middle"
                      fontSize="12"
                      fontWeight="800"
                      fill="#FCE9A6"
                    >
                      صَدَى
                    </text>
                  </svg>
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
                    className="w-full rounded-2xl border border-[#FCE9A6]/70 bg-[#D4AF37]/15 px-4 py-3 text-center text-sm font-extrabold text-[#FCE9A6]"
                  >
                    {refWinBanner.glyph} {refWinBanner.label}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Prize Pool Tiers */}
            <div className="lg:col-span-6 space-y-3">
              <div>
                <h3 className="text-base font-extrabold text-[#F3D37A]">
                  خانات الجوائز المرتبطة بمخزون جوائز التطبيق
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  لا يمكن للدولاب منح أي جائزة تتجاوز رصيد المخزون المتاح ({appPrizePoolCoins.toLocaleString('en-US')} كوينز).
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                {refSegments.map((seg) => {
                  const available = seg.coinsAmount <= appPrizePoolCoins;
                  return (
                    <div
                      key={seg.id}
                      className={`rounded-2xl border p-3 flex items-center justify-between gap-2 text-xs ${
                        available
                          ? 'border-[#D4AF37]/30 bg-[#070913]/75 text-white'
                          : 'border-rose-500/30 bg-[#070913]/40 text-slate-500 opacity-65'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xl">{seg.glyph}</span>
                        <span className="font-bold truncate">{seg.shortLabel}</span>
                      </div>
                      <span
                        className={`text-[10px] font-bold shrink-0 ${
                          available ? 'text-emerald-300' : 'text-rose-300'
                        }`}
                      >
                        {available ? 'متاح ✓' : 'خارج المخزون'}
                      </span>
                    </div>
                  );
                })}
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
                                />

                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-bold text-white truncate">
                                      {c.displayName}
                                    </span>
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
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
