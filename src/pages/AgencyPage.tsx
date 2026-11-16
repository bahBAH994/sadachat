import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import {
  Award,
  BadgeCheck,
  Building2,
  Check,
  Copy,
  Crown,
  Gem,
  History,
  MessageCircleHeart,
  Sparkles,
  Users,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  applyAsAgencyInSupabase,
  getAgencyOverviewFromSupabase,
  joinAgencyByCodeInSupabase,
  leaveAgencyInSupabase,
} from '../lib/sadaSocialService';
import { supabase } from '../lib/supabase';
import type { Agency, AgencyHostSummary, Transaction, User } from '../types';
import { AvatarWithFrame } from '../components/AvatarWithFrame';

interface AgencyOverviewResponse {
  user: User;
  myAgency: {
    agency: Agency;
    hosts: AgencyHostSummary[];
    commissionTransactions: Transaction[];
  } | null;
  joinedAgency: Agency | null;
  publicAgencies: Array<{
    id: string;
    name: string;
    description: string;
    ownerName: string;
    ownerAvatar: string;
    commissionRate: number;
    hostCount: number;
    sampleCode?: string;
  }>;
}

export const AgencyPage: React.FC = () => {
  const { user, updateLocalUser } = useAuth();
  const navigate = useNavigate();

  const [data, setData] = useState<AgencyOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Apply as Agent state
  const [agencyName, setAgencyName] = useState('');
  const [agencyDesc, setAgencyDesc] = useState('');
  const [commissionRate, setCommissionRate] = useState('0.15');
  const [applying, setApplying] = useState(false);

  // Join as Host state
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const loadOverview = useCallback(async () => {
    if (!user) return;
    try {
      const res = await getAgencyOverviewFromSupabase(user);
      setData(res);
      updateLocalUser(res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر تحميل بيانات الوكالات.');
    } finally {
      setLoading(false);
    }
  }, [user, updateLocalUser]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`sada-agency-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sada_agencies' },
        () => {
          void loadOverview();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'sada_transactions',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          void loadOverview();
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.id, loadOverview]);

  const handleApplyAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setApplying(true);
    setError(null);
    setFeedback(null);
    try {
      const res = await applyAsAgencyInSupabase(user, {
        name: agencyName,
        description: agencyDesc,
        commissionRate: Number(commissionRate),
      });
      updateLocalUser(res.user);
      setAgencyName('');
      setAgencyDesc('');
      await loadOverview();
      setFeedback(
        `تم اعتماد وكالتك "${res.agency.name}" بنجاح! كود دعوة المضيفين الخاص بك هو ${res.agency.code}`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر تقديم طلب الوكالة.');
    } finally {
      setApplying(false);
    }
  };

  const handleJoinHost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setJoining(true);
    setError(null);
    setFeedback(null);
    try {
      const res = await joinAgencyByCodeInSupabase(user, joinCode);
      updateLocalUser(res.user);
      setJoinCode('');
      await loadOverview();
      setFeedback(
        `مبارك! انضممت كمضيف رسمي في "${res.agency.name}" وتم منحك شارة (${res.user.hostBadge}).`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر الانضمام بالكود.');
    } finally {
      setJoining(false);
    }
  };

  const handleLeaveAgency = async () => {
    if (!user) return;
    setError(null);
    setFeedback(null);
    try {
      const nextUser = await leaveAgencyInSupabase(user);
      updateLocalUser(nextUser);
      await loadOverview();
      setFeedback('تمت مغادرة الوكالة بنجاح.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر مغادرة الوكالة.');
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard?.writeText(code).catch(() => {});
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  if (loading || !data) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 text-center text-sm text-[#F3D37A]">
        جارٍ تحميل منظومة الوكالات والمضيفين...
      </div>
    );
  }

  const { myAgency, joinedAgency, publicAgencies } = data;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-5 pb-28 space-y-6">
      {/* Top Banner */}
      <section className="royal-glass rounded-3xl p-5 sm:p-7 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-[#F3D37A] mb-1.5">
            <Building2 className="w-4 h-4" />
            <span>منظومة الوكالات والمضيفين المعتمدين</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold gold-gradient-text">
            الوكالات الملكية والشارات الرسمية
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1">
            أسّس وكالتك الخاصة واستقبل نسبة عمولة تلقائية في محفظتك من أرباح مضيفيك، أو انضم كمضيف رسمي عبر كود الوكيل.
          </p>
        </div>

        {user?.hostBadge && (
          <div className="royal-capsule rounded-2xl px-4 py-2.5 flex items-center gap-2 text-xs sm:text-sm font-extrabold text-[#FCE9A6] shrink-0 shadow-[0_0_22px_rgba(212,175,55,0.3)]">
            <BadgeCheck className="w-5 h-5 text-[#F3D37A]" />
            <span>{user.hostBadge}</span>
          </div>
        )}
      </section>

      <AnimatePresence>
        {feedback && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-2xl border border-[#FCE9A6]/50 bg-[#D4AF37]/15 px-4 py-3 text-xs sm:text-sm font-bold text-[#FCE9A6]"
          >
            {feedback}
          </motion.div>
        )}
      </AnimatePresence>

      {error && (
        <div className="rounded-2xl border border-rose-500/40 bg-rose-950/60 px-4 py-3 text-xs sm:text-sm text-rose-200">
          {error}
        </div>
      )}

      {/* AGENT CONTROL DASHBOARD */}
      {myAgency && (
        <div className="space-y-6">
          <section className="royal-glass rounded-3xl p-5 sm:p-6 border-[#F3D37A]/40 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#D4AF37]/15">
              <div>
                <span className="text-xs font-bold text-[#F3D37A]">
                  لوحة تحكم الوكيل المعتمدة
                </span>
                <h2 className="text-xl sm:text-2xl font-extrabold text-white mt-0.5">
                  {myAgency.agency.name}
                </h2>
                <p className="text-xs text-slate-300 mt-1">{myAgency.agency.description}</p>
              </div>

              <div className="flex flex-col sm:items-end gap-2">
                <span className="text-[11px] text-slate-400">كود دعوة المضيفين</span>
                <div className="flex items-center gap-2">
                  <span
                    dir="ltr"
                    className="rounded-xl border border-[#FCE9A6]/60 bg-[#070913]/90 px-4 py-2 font-mono-num text-sm font-extrabold text-[#FCE9A6] tracking-wider"
                  >
                    {myAgency.agency.code}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopyCode(myAgency.agency.code)}
                    className="gold-btn min-h-[38px] rounded-xl px-3.5 py-1.5 text-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    {copiedCode ? (
                      <>
                        <Check className="w-4 h-4" />
                        <span>تم النسخ</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>نسخ الكود</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* KPI Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-2xl bg-[#070913]/75 border border-[#D4AF37]/25 p-4">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>المضيفون التابعون للوكالة</span>
                  <Users className="w-4 h-4 text-[#F3D37A]" />
                </div>
                <p className="mt-2 text-2xl font-extrabold font-mono-num text-white">
                  {myAgency.hosts.length}
                </p>
              </div>

              <div className="rounded-2xl bg-[#070913]/75 border border-[#D4AF37]/25 p-4">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>إجمالي ألماس المضيفين</span>
                  <Gem className="w-4 h-4 text-sky-400" />
                </div>
                <p className="mt-2 text-2xl font-extrabold font-mono-num text-sky-200">
                  {myAgency.agency.totalHostDiamonds.toLocaleString('en-US')} 💎
                </p>
              </div>

              <div className="rounded-2xl bg-[#070913]/75 border border-[#FCE9A6]/40 p-4">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>
                    عمولة الوكيل التلقائية ({Math.round(myAgency.agency.commissionRate * 100)}%)
                  </span>
                  <Sparkles className="w-4 h-4 text-[#FCE9A6]" />
                </div>
                <p className="mt-2 text-2xl font-extrabold font-mono-num text-[#FCE9A6]">
                  {myAgency.agency.totalCommissionDiamonds.toLocaleString('en-US')} 💎
                </p>
              </div>
            </div>
          </section>

          {/* Hosts List & Automatic Commission Ledger */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <section className="lg:col-span-7 royal-glass rounded-3xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-extrabold text-[#F3D37A] flex items-center gap-2">
                  <Award className="w-5 h-5" />
                  <span>قائمة المضيفين وإحصائيات ألماسهم</span>
                </h3>
                <span className="text-xs text-slate-400 font-mono-num">
                  {myAgency.hosts.length} مضيف
                </span>
              </div>

              {myAgency.hosts.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#D4AF37]/30 bg-[#070913]/60 p-6 text-center text-xs sm:text-sm text-slate-300 space-y-2">
                  <p>لم ينضم مضيفون بكود وكالتك بعد.</p>
                  <p className="text-[#FCE9A6] font-mono-num">
                    شارك الكود ({myAgency.agency.code}) مع المضيفين ليحصلوا على شارة مضيف رسمي وتنزل عمولتك تلقائياً!
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {myAgency.hosts.map((host) => (
                    <div
                      key={host.id}
                      className="rounded-2xl border border-[#D4AF37]/20 bg-[#070913]/75 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <AvatarWithFrame
                          src={host.avatarUrl}
                          alt={host.displayName}
                          frameId={host.frameId}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-sm font-bold text-white truncate">
                              {host.displayName}
                            </span>
                            <span className="inline-flex items-center gap-1 rounded-full border border-[#F3D37A]/50 bg-[#D4AF37]/15 px-2 py-0.5 text-[10px] font-bold text-[#FCE9A6]">
                              <BadgeCheck className="w-3 h-3" />
                              {host.hostBadge}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-[11px] text-slate-400 font-mono-num mt-0.5">
                            <span>Lv.{host.level}</span>
                            <span>{host.gender === 'female' ? 'حساب نسائي' : 'مضيف'}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                        <div className="text-left font-mono-num">
                          <p className="text-[11px] text-slate-400">أرباح الألماس</p>
                          <p className="text-sm font-extrabold text-sky-300">
                            {host.hostDiamondsEarned.toLocaleString('en-US')} 💎
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => navigate(`/messages?to=${host.id}`)}
                          className="min-h-[36px] rounded-xl border border-[#D4AF37]/30 bg-white/5 hover:bg-[#D4AF37]/15 px-3 text-xs font-bold text-[#FCE9A6] flex items-center gap-1 cursor-pointer"
                        >
                          <MessageCircleHeart className="w-3.5 h-3.5" />
                          <span>مراسلة</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="lg:col-span-5 royal-glass rounded-3xl p-5 space-y-4">
              <h3 className="text-base font-extrabold text-[#F3D37A] flex items-center gap-2">
                <History className="w-5 h-5" />
                <span>سجل عمولات الوكيل التلقائية</span>
              </h3>

              {myAgency.commissionTransactions.length === 0 ? (
                <p className="text-xs text-slate-400 py-8 text-center">
                  ستظهر هنا كل عمولة ألماس تنزل في محفظتك تلقائياً بمجرد استلام مضيفيك هدايا أو ردوداً مدفوعة.
                </p>
              ) : (
                <div className="space-y-2.5 max-h-[360px] overflow-y-auto no-scrollbar">
                  {myAgency.commissionTransactions.map((tx) => (
                    <div
                      key={tx.id}
                      className="rounded-2xl border border-[#D4AF37]/15 bg-[#070913]/75 px-3.5 py-2.5 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-white truncate">{tx.description}</p>
                        <p className="text-[10px] text-slate-400 font-mono-num mt-0.5">
                          {new Date(tx.timestamp).toLocaleString('ar-EG')}
                        </p>
                      </div>
                      <span className="font-mono-num font-extrabold text-emerald-300 shrink-0">
                        +{tx.amount.toLocaleString('en-US')} 💎
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      )}

      {/* JOINED AS OFFICIAL HOST VIEW */}
      {!myAgency && joinedAgency && (
        <section className="royal-glass rounded-3xl p-6 space-y-5 border-[#F3D37A]/45">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-[#FCE9A6]/60 bg-[#D4AF37]/20 px-3 py-1 text-xs font-extrabold text-[#FCE9A6]">
                <BadgeCheck className="w-4 h-4" />
                <span>{user?.hostBadge || 'مضيف رسمي ✦'}</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-white">
                أنت مضيف معتمد لدى {joinedAgency.name}
              </h2>
              <p className="text-xs sm:text-sm text-slate-300">
                الوكيل المسؤول: <span className="text-[#F3D37A] font-bold">{joinedAgency.ownerName}</span> · نسبة دعم الوكالة{' '}
                <span className="font-mono-num text-white">
                  {Math.round(joinedAgency.commissionRate * 100)}%
                </span>
              </p>
            </div>

            <div className="rounded-2xl bg-[#070913]/80 border border-[#D4AF37]/25 px-5 py-3 text-center">
              <p className="text-[11px] text-slate-400">مجموع ألماس المضيف</p>
              <p className="text-xl font-extrabold font-mono-num text-sky-300 mt-0.5">
                {(user?.hostDiamondsEarned ?? 0).toLocaleString('en-US')} 💎
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#D4AF37]/15">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => navigate('/')}
                className="gold-btn min-h-[42px] rounded-xl px-4 text-xs font-bold cursor-pointer"
              >
                افتح غرفة صوتية الآن
              </button>
              <button
                type="button"
                onClick={() => navigate('/messages')}
                className="min-h-[42px] rounded-xl px-4 text-xs font-bold border border-[#D4AF37]/40 bg-[#D4AF37]/12 text-[#FCE9A6] cursor-pointer"
              >
                رسائل الألماس الخاصة
              </button>
            </div>

            <button
              type="button"
              onClick={handleLeaveAgency}
              className="min-h-[40px] rounded-xl px-3.5 text-xs font-bold border border-rose-500/35 bg-rose-950/40 text-rose-200 hover:bg-rose-900/50 cursor-pointer"
            >
              مغادرة الوكالة
            </button>
          </div>
        </section>
      )}

      {/* APPLY AS AGENT OR JOIN WITH CODE */}
      {!myAgency && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Apply as Agent */}
          <form
            onSubmit={handleApplyAgent}
            className="royal-glass rounded-3xl p-6 space-y-4 flex flex-col justify-between"
          >
            <div className="space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-[#D4AF37]/20 border border-[#D4AF37]/40 flex items-center justify-center text-[#FCE9A6]">
                  <Crown className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-extrabold text-white">التقديم كـ "وكيل" معتمد</h2>
                  <p className="text-xs text-slate-400">
                    أنشئ وكالتك واحصل على كود دعوة ولوحة متابعة وعمولة تلقائية من ألماس مضيفيك.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  اسم الوكالة الملكية
                </label>
                <input
                  type="text"
                  required
                  minLength={3}
                  value={agencyName}
                  onChange={(e) => setAgencyName(e.target.value)}
                  placeholder="مثال: وكالة نجوم الخليج"
                  className="w-full rounded-xl bg-[#070913]/85 border border-[#D4AF37]/25 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  نسبة العمولة التلقائية للوكيل (من أرباح المضيفين)
                </label>
                <select
                  value={commissionRate}
                  onChange={(e) => setCommissionRate(e.target.value)}
                  className="w-full rounded-xl bg-[#070913]/90 border border-[#D4AF37]/25 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#D4AF37]"
                >
                  <option value="0.10">10% عمولة تلقائية</option>
                  <option value="0.15">15% عمولة تلقائية (موصى به)</option>
                  <option value="0.20">20% عمولة تلقائية</option>
                  <option value="0.25">25% عمولة تلقائية</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  نبذة الوكالة
                </label>
                <textarea
                  rows={2}
                  value={agencyDesc}
                  onChange={(e) => setAgencyDesc(e.target.value)}
                  placeholder="وصف مختصر لأهداف وكالتك ورعاية المضيفين..."
                  className="w-full rounded-xl bg-[#070913]/85 border border-[#D4AF37]/25 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-[#D4AF37]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={applying}
              className="gold-btn w-full min-h-[46px] rounded-xl text-sm cursor-pointer disabled:opacity-60"
            >
              {applying ? 'جارٍ اعتماد الوكالة...' : 'اعتماد الوكالة وفتح لوحة الوكيل'}
            </button>
          </form>

          {/* Join as Host via Agency Code */}
          <form
            onSubmit={handleJoinHost}
            className="royal-glass rounded-3xl p-6 space-y-4 flex flex-col justify-between"
          >
            <div className="space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-300">
                  <BadgeCheck className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-extrabold text-white">الانضمام كـ "مضيف" عبر كود الوكيل</h2>
                  <p className="text-xs text-slate-400">
                    أدخل كود الوكالة لتحصل فوراً على شارة مضيف رسمي وتستقبل رسائل وهدايا الألماس.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  كود الوكالة
                </label>
                <input
                  type="text"
                  required
                  dir="ltr"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="SADA-1000"
                  className="w-full rounded-xl bg-[#070913]/85 border border-[#D4AF37]/25 px-3.5 py-3 text-sm font-mono-num text-center text-[#FCE9A6] placeholder:text-slate-500 focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-300">
                  وكالات معتمدة نشطة في صَدَى:
                </p>
                <div className="space-y-2 max-h-40 overflow-y-auto no-scrollbar">
                  {publicAgencies.map((ag) => (
                    <div
                      key={ag.id}
                      className="rounded-2xl border border-[#D4AF37]/20 bg-[#070913]/70 px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0">
                        <p className="font-bold text-white truncate">{ag.name}</p>
                        <p className="text-[11px] text-slate-400">
                          الوكيل: {ag.ownerName} · {ag.hostCount} مضيفين
                        </p>
                      </div>
                      {ag.sampleCode && (
                        <button
                          type="button"
                          onClick={() => setJoinCode(ag.sampleCode || '')}
                          className="rounded-lg border border-[#D4AF37]/40 bg-[#D4AF37]/12 px-2.5 py-1 font-mono-num text-[11px] font-bold text-[#FCE9A6] hover:bg-[#D4AF37]/25 cursor-pointer shrink-0"
                        >
                          {ag.sampleCode}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={joining}
              className="gold-btn w-full min-h-[46px] rounded-xl text-sm cursor-pointer disabled:opacity-60"
            >
              {joining ? 'جارٍ التفعيل...' : 'انضمام والحصول على شارة المضيف الرسمي'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
