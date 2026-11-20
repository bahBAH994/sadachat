import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import {
  Award,
  BadgeCheck,
  Building2,
  Calendar,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  Crown,
  Gem,
  History,
  MessageCircleHeart,
  Mic2,
  Search,
  Sparkles,
  Users,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useMiniProfile } from '../context/MiniProfileContext';
import { formatShortNumericId, getUserVipTierInfo } from '../lib/sadaCatalog';
import {
  applyAsAgencyInSupabase,
  getAgencyOverviewFromSupabase,
  leaveAgencyInSupabase,
  lookupAgencyByIdOrCodeInSupabase,
  submitHostJoinApplicationInSupabase,
} from '../lib/sadaSocialService';
import { supabase } from '../lib/supabase';
import type {
  Agency,
  AgencyHostSummary,
  HostJoinApplication,
  Transaction,
  User,
} from '../types';
import { AvatarWithFrame, VipTierBadge } from '../components/AvatarWithFrame';

interface AgencyOverviewResponse {
  user: User;
  myAgency: {
    agency: Agency;
    hosts: AgencyHostSummary[];
    weeklyAgencyTotalDiamonds: number;
    pendingApplications: HostJoinApplication[];
    commissionTransactions: Transaction[];
  } | null;
  joinedAgency: Agency | null;
  myApplications: HostJoinApplication[];
  publicAgencies: Array<{
    id: string;
    name: string;
    description: string;
    code: string;
    numericId: string;
    ownerName: string;
    ownerAvatar: string;
    commissionRate: number;
    totalHostDiamonds?: number;
    hostCount: number;
  }>;
}

export const AgencyPage: React.FC = () => {
  const { user, updateLocalUser } = useAuth();
  const { openMiniProfile } = useMiniProfile();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [data, setData] = useState<AgencyOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Host Center ("مركز المضيف") join application state
  const [agencyInput, setAgencyInput] = useState('');
  const [lookedUpAgency, setLookedUpAgency] = useState<Agency | null>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [hostBio, setHostBio] = useState('');
  const [submittingApp, setSubmittingApp] = useState(false);

  // Create Agency state (collapsible secondary option)
  const [showCreateAgency, setShowCreateAgency] = useState(false);
  const [agencyName, setAgencyName] = useState('');
  const [agencyDesc, setAgencyDesc] = useState('');
  const [applying, setApplying] = useState(false);
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
        { event: '*', schema: 'public', table: 'sada_platform_state' },
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

  // Live debounced agency lookup by ID or Code
  useEffect(() => {
    const clean = agencyInput.trim();
    if (!clean) {
      setLookedUpAgency(null);
      setLookingUp(false);
      return;
    }
    setLookingUp(true);
    const timer = window.setTimeout(() => {
      lookupAgencyByIdOrCodeInSupabase(clean)
        .then((ag) => setLookedUpAgency(ag))
        .catch(() => setLookedUpAgency(null))
        .finally(() => setLookingUp(false));
    }, 260);
    return () => window.clearTimeout(timer);
  }, [agencyInput]);

  const handleSubmitJoinApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSubmittingApp(true);
    setError(null);
    setFeedback(null);
    try {
      const app = await submitHostJoinApplicationInSupabase(user, {
        agencyInput,
        bio: hostBio,
      });
      setHostBio('');
      await loadOverview();
      setFeedback(
        `تم إرسال طلب انضمامك إلى وكالة "${app.agencyName}" بنجاح — حالتك الآن: بانتظار موافقة الإدارة.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر إرسال طلب الانضمام.');
    } finally {
      setSubmittingApp(false);
    }
  };

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
      });
      updateLocalUser(res.user);
      setAgencyName('');
      setAgencyDesc('');
      setShowCreateAgency(false);
      await loadOverview();
      setSearchParams({ tab: 'my-agency' });
      setFeedback(
        `تم اعتماد وكالتك "${res.agency.name}" بنجاح! كود دعوة المضيفين: ${res.agency.code}`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر تقديم طلب الوكالة.');
    } finally {
      setApplying(false);
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
    window.setTimeout(() => setCopiedCode(false), 2000);
  };

  if (loading || !data) {
    return (
      <div className="min-h-screen bg-[#F5F6FA] pt-10 px-4 text-center text-sm font-bold text-slate-600">
        جارٍ تحميل منظومة الوكالات والمضيفين...
      </div>
    );
  }

  const { myAgency, joinedAgency, myApplications, publicAgencies } = data;
  const canAccessMyAgency = Boolean(myAgency || user?.isAgent || user?.is_admin);
  const requestedTab = searchParams.get('tab');
  const activeTab: 'my-agency' | 'host-center' =
    requestedTab === 'my-agency' && canAccessMyAgency
      ? 'my-agency'
      : requestedTab === 'host-center'
      ? 'host-center'
      : myAgency
      ? 'my-agency'
      : 'host-center';

  const setActiveTab = (next: 'my-agency' | 'host-center') => {
    setSearchParams({ tab: next });
  };

  return (
    <div className="min-h-screen bg-[#F5F6FA] pb-28 overflow-y-auto overscroll-y-contain">
      <div className="max-w-5xl mx-auto px-4 pt-4 space-y-5">
        {/* Crisp Dark Royal Top Banner */}
        <section className="rounded-3xl bg-gradient-to-br from-[#0F172A] via-[#17253D] to-[#064E3B] p-5 sm:p-6 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/20 border border-emerald-300/40 px-3 py-1 text-[11px] font-bold text-emerald-200">
              <Building2 className="w-3.5 h-3.5" />
              <span>منظومة الوكالات والمضيفين — صَدَى</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black">
              {activeTab === 'my-agency'
                ? 'وكالتي — متابعة المضيفين والتارجت الأسبوعي'
                : 'مركز المضيف — الانضمام للوكالات المعتمدة'}
            </h1>
            <p className="text-xs text-slate-300">
              {activeTab === 'my-agency'
                ? 'تتبّع التارجت الأسبوعي الإجمالي لوكالتك، وأداء المضيفين، والطلبات المعلّقة.'
                : 'ابحث عن أي وكالة برقمها أو كودها وتقدّم بطلب انضمام رسمي كمضيف معتمد.'}
            </p>
          </div>

          {user?.hostBadge && (
            <div className="rounded-2xl bg-amber-400/20 border border-amber-300/40 px-4 py-2.5 flex items-center gap-2 text-xs font-extrabold text-[#FCE9A6] shrink-0">
              <BadgeCheck className="w-4 h-4 text-amber-300" />
              <span>{user.hostBadge}</span>
            </div>
          )}
        </section>

        {/* Tab Switcher (Only shows وكالتي if user is Agent/Admin) */}
        {canAccessMyAgency && (
          <div className="grid grid-cols-2 gap-2 p-1.5 rounded-2xl bg-white border border-slate-200 shadow-sm">
            <button
              type="button"
              onClick={() => setActiveTab('my-agency')}
              className={`min-h-[42px] rounded-xl text-xs sm:text-sm font-extrabold flex items-center justify-center gap-1.5 cursor-pointer transition ${
                activeTab === 'my-agency' ? 'emerald-btn' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span>وكالتي</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('host-center')}
              className={`min-h-[42px] rounded-xl text-xs sm:text-sm font-extrabold flex items-center justify-center gap-1.5 cursor-pointer transition ${
                activeTab === 'host-center' ? 'emerald-btn' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Mic2 className="w-4 h-4" />
              <span>مركز المضيف</span>
            </button>
          </div>
        )}

        <AnimatePresence>
          {feedback && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs sm:text-sm font-bold text-emerald-800"
            >
              {feedback}
            </motion.div>
          )}
        </AnimatePresence>

        {error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs sm:text-sm font-bold text-rose-700">
            {error}
          </div>
        )}

        {/* ==================== TAB 1: MY AGENCY ("وكالتي") ==================== */}
        {activeTab === 'my-agency' && myAgency && (
          <div className="space-y-5">
            {/* Agency Summary + Code + Weekly Target */}
            <section className="light-card rounded-3xl p-5 sm:p-6 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <div>
                  <span className="text-[11px] font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-0.5">
                    وكالة معتمدة · ID: {formatShortNumericId(myAgency.agency.id).slice(0, 6)}
                  </span>
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900 mt-1.5">
                    {myAgency.agency.name}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">{myAgency.agency.description}</p>
                </div>

                <div className="flex flex-col sm:items-end gap-1.5">
                  <span className="text-[11px] font-bold text-slate-500">كود الوكالة الرسمي</span>
                  <div className="flex items-center gap-2">
                    <span
                      dir="ltr"
                      className="rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2 font-mono-num text-sm font-black text-amber-900 tracking-wider"
                    >
                      {myAgency.agency.code}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyCode(myAgency.agency.code)}
                      className="emerald-btn min-h-[38px] rounded-xl px-3.5 py-1.5 text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
                    >
                      {copiedCode ? (
                        <>
                          <Check className="w-4 h-4" />
                          <span>تم النسخ</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          <span>نسخ</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* KPI Stats Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-bold">
                    <span>عدد المضيفين</span>
                    <Users className="w-4 h-4 text-emerald-600" />
                  </div>
                  <p className="mt-2 text-2xl font-black font-mono-num text-slate-900">
                    {myAgency.hosts.length}
                  </p>
                </div>

                <div className="rounded-2xl bg-sky-50 border border-sky-200 p-4">
                  <div className="flex items-center justify-between text-xs text-sky-800 font-bold">
                    <span>إجمالي التارجت الأسبوعي</span>
                    <Calendar className="w-4 h-4 text-sky-600" />
                  </div>
                  <p className="mt-2 text-2xl font-black font-mono-num text-sky-900">
                    {myAgency.weeklyAgencyTotalDiamonds.toLocaleString('en-US')} 💎
                  </p>
                </div>

                <div className="rounded-2xl bg-indigo-50 border border-indigo-200 p-4">
                  <div className="flex items-center justify-between text-xs text-indigo-800 font-bold">
                    <span>تراكمي ألماس الوكالة</span>
                    <Gem className="w-4 h-4 text-indigo-600" />
                  </div>
                  <p className="mt-2 text-2xl font-black font-mono-num text-indigo-900">
                    {myAgency.agency.totalHostDiamonds.toLocaleString('en-US')} 💎
                  </p>
                </div>

                <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4">
                  <div className="flex items-center justify-between text-xs text-amber-800 font-bold">
                    <span>
                      عمولة الوكيل المعتمدة ({Math.round(myAgency.agency.commissionRate * 100)}%)
                    </span>
                    <Sparkles className="w-4 h-4 text-amber-600" />
                  </div>
                  <p className="mt-2 text-2xl font-black font-mono-num text-amber-900">
                    {myAgency.agency.totalCommissionDiamonds.toLocaleString('en-US')} 💎
                  </p>
                  <span className="block text-[10px] text-amber-700 mt-0.5">
                    تُحدد وتُصرف حصرياً من الإدارة العليا
                  </span>
                </div>
              </div>
            </section>

            {/* Pending Host Applications for this Agency ("بانتظار موافقة الإدارة") */}
            {myAgency.pendingApplications.length > 0 && (
              <section className="light-card rounded-3xl p-5 space-y-3 border border-amber-200 bg-amber-50/40">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm sm:text-base font-black text-amber-950 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-600" />
                    <span>طلبات انضمام مضيفين جدد ({myAgency.pendingApplications.length})</span>
                  </h3>
                  <span className="rounded-full bg-amber-100 border border-amber-300 px-3 py-0.5 text-[11px] font-extrabold text-amber-800">
                    بانتظار موافقة الإدارة
                  </span>
                </div>

                <div className="space-y-2.5">
                  {myAgency.pendingApplications.map((app) => (
                    <div
                      key={app.id}
                      className="rounded-2xl bg-white border border-amber-200/80 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <AvatarWithFrame
                          src={app.avatarUrl}
                          alt={app.displayName}
                          frameId={app.frameId}
                          vipTier={getUserVipTierInfo(app as Partial<User>).key}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <p className="text-xs sm:text-sm font-extrabold text-slate-900 truncate">
                            {app.displayName}
                          </p>
                          <p className="text-[11px] text-slate-500 line-clamp-1">{app.bio}</p>
                        </div>
                      </div>
                      <span className="rounded-full bg-amber-50 border border-amber-200 px-3 py-1 text-[11px] font-bold text-amber-800 shrink-0 self-start sm:self-center">
                        بانتظار موافقة الإدارة ⏳
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Hosts Directory & Weekly Targets + Commission Ledger */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              <section className="lg:col-span-7 light-card rounded-3xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                    <Award className="w-5 h-5 text-emerald-600" />
                    <span>المضيفون والتارجت الأسبوعي المحقق</span>
                  </h3>
                  <span className="text-xs font-bold text-slate-500 font-mono-num">
                    {myAgency.hosts.length} مضيف
                  </span>
                </div>

                {myAgency.hosts.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-500 space-y-1.5">
                    <p>لا يوجد مضيفون معتمدون في وكالتك حتى الآن.</p>
                    <p className="font-bold text-emerald-700 font-mono-num">
                      شارك كود ({myAgency.agency.code}) أو رقم الوكالة ليقدّم المضيفون عبر مركز المضيف!
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {myAgency.hosts.map((host) => (
                      <div
                        key={host.id}
                        className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <AvatarWithFrame
                            src={host.avatarUrl}
                            alt={host.displayName}
                            frameId={host.frameId}
                            vipTier={getUserVipTierInfo(host as Partial<User>).key}
                            size="sm"
                            onClick={() => openMiniProfile(host.id, host)}
                          />
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => openMiniProfile(host.id, host)}
                                className="text-sm font-extrabold text-slate-900 hover:text-emerald-700 truncate cursor-pointer text-right"
                              >
                                {host.displayName}
                              </button>
                              <VipTierBadge vipTier={getUserVipTierInfo(host as Partial<User>).key} compact />
                              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                                <BadgeCheck className="w-3 h-3" />
                                {host.hostBadge}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-[11px] text-slate-500 font-mono-num mt-0.5">
                              <span>Lv.{host.level}</span>
                              <span>
                                التراكمي: {host.hostDiamondsEarned.toLocaleString('en-US')} 💎
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                          <div className="rounded-xl bg-sky-50 border border-sky-200 px-3 py-1.5 text-center font-mono-num">
                            <span className="block text-[10px] font-bold text-sky-700">
                              التارجت الأسبوعي
                            </span>
                            <span className="text-sm font-black text-sky-900">
                              {host.weeklyDiamonds.toLocaleString('en-US')} 💎
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => navigate(`/messages?to=${host.id}`)}
                            className="min-h-[38px] rounded-xl border border-slate-200 bg-white hover:border-emerald-400 px-3 text-xs font-bold text-slate-700 flex items-center gap-1 cursor-pointer"
                          >
                            <MessageCircleHeart className="w-3.5 h-3.5 text-emerald-600" />
                            <span>مراسلة</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="lg:col-span-5 light-card rounded-3xl p-5 space-y-4">
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <History className="w-5 h-5 text-amber-600" />
                  <span>سجل عمولات الوكيل</span>
                </h3>

                {myAgency.commissionTransactions.length === 0 ? (
                  <p className="text-xs text-slate-500 py-8 text-center">
                    ستظهر هنا عمولات الوكالة المعتمدة فور صرفها من لوحة الإدارة العليا.
                  </p>
                ) : (
                  <div className="space-y-2.5 max-h-[360px] overflow-y-auto no-scrollbar">
                    {myAgency.commissionTransactions.map((tx) => (
                      <div
                        key={tx.id}
                        className="rounded-2xl border border-slate-100 bg-slate-50 px-3.5 py-2.5 flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="min-w-0">
                          <p className="font-bold text-slate-800 truncate">{tx.description}</p>
                          <p className="text-[10px] text-slate-400 font-mono-num mt-0.5">
                            {new Date(tx.timestamp).toLocaleString('ar-EG')}
                          </p>
                        </div>
                        <span className="font-mono-num font-black text-emerald-700 shrink-0">
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

        {/* Notice if user is Admin without personal agency and opened my-agency tab */}
        {activeTab === 'my-agency' && !myAgency && (
          <div className="light-card rounded-3xl p-6 text-center space-y-3">
            <p className="text-sm font-bold text-slate-700">
              لا تملك وكالة شخصية باسمك حالياً. يمكنك تأسيس وكالة جديدة من قسم "مركز المضيف" أو إدارة جميع الوكالات من لوحة الإدارة.
            </p>
            <button
              type="button"
              onClick={() => setActiveTab('host-center')}
              className="emerald-btn rounded-2xl px-5 py-2.5 text-xs font-extrabold cursor-pointer"
            >
              الانتقال إلى مركز المضيف
            </button>
          </div>
        )}

        {/* ==================== TAB 2: HOST CENTER ("مركز المضيف") ==================== */}
        {activeTab === 'host-center' && (
          <div className="space-y-5">
            {/* Joined Agency Status Card */}
            {joinedAgency && (
              <section className="light-card rounded-3xl p-5 sm:p-6 border border-emerald-200 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-extrabold text-emerald-800">
                      <BadgeCheck className="w-4 h-4 text-emerald-600" />
                      <span>{user?.hostBadge || 'مضيف رسمي معتمد'}</span>
                    </div>
                    <h2 className="text-lg sm:text-xl font-black text-slate-900">
                      أنت مضيف معتمد في وكالة: {joinedAgency.name}
                    </h2>
                    <p className="text-xs text-slate-600">
                      مدير الوكالة: <span className="font-bold text-slate-900">{joinedAgency.ownerName}</span> · الكود:{' '}
                      <span className="font-mono-num font-bold text-emerald-700">{joinedAgency.code}</span>
                    </p>
                  </div>

                  <div className="rounded-2xl bg-sky-50 border border-sky-200 px-5 py-3 text-center">
                    <span className="block text-[11px] font-bold text-sky-700">أرباحي كمضيف</span>
                    <span className="text-xl font-black font-mono-num text-sky-900">
                      {(user?.hostDiamondsEarned ?? 0).toLocaleString('en-US')} 💎
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => navigate('/')}
                    className="emerald-btn min-h-[40px] rounded-xl px-4 text-xs font-extrabold cursor-pointer"
                  >
                    الدخول للغرف الصوتية
                  </button>
                  <button
                    type="button"
                    onClick={handleLeaveAgency}
                    className="min-h-[40px] rounded-xl px-4 text-xs font-bold border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 cursor-pointer"
                  >
                    مغادرة الوكالة
                  </button>
                </div>
              </section>
            )}

            {/* Host Join Application Form */}
            {!myAgency && (
              <form
                onSubmit={handleSubmitJoinApplication}
                className="light-card rounded-3xl p-5 sm:p-6 space-y-4"
              >
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-violet-100 border border-violet-200 flex items-center justify-center text-violet-700 shrink-0">
                    <Mic2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-black text-slate-900">
                      طلب الانضمام إلى وكالة كمضيف رسمي
                    </h2>
                    <p className="text-xs text-slate-500">
                      أدخل رقم الوكالة (ID) أو كودها لعرض اسمها والتحقق منه فوراً، ثم أرسل نبذتك لموافقة الإدارة.
                    </p>
                  </div>
                </div>

                {/* Agency ID / Code Input + Live Lookup */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-700">
                    رقم الوكالة أو الكود (مثال: SADA-1000)
                  </label>
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      required
                      dir="ltr"
                      value={agencyInput}
                      onChange={(e) => setAgencyInput(e.target.value)}
                      placeholder="SADA-1000 أو رقم الوكالة..."
                      className="w-full rounded-2xl bg-slate-50 border border-slate-200 pr-10 pl-4 py-3 text-sm font-mono-num text-slate-900 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  {/* Live Verified Agency Preview */}
                  {agencyInput.trim() && (
                    <div
                      className={`rounded-2xl p-3.5 border text-xs ${
                        lookingUp
                          ? 'bg-slate-50 border-slate-200 text-slate-500'
                          : lookedUpAgency
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                          : 'bg-rose-50 border-rose-200 text-rose-700'
                      }`}
                    >
                      {lookingUp ? (
                        <span>جارٍ البحث عن الوكالة...</span>
                      ) : lookedUpAgency ? (
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <p className="font-black text-sm text-emerald-900">
                              ✓ تم العثور على الوكالة: {lookedUpAgency.name}
                            </p>
                            <p className="text-[11px] text-emerald-700 mt-0.5">
                              الوكيل المسؤول: {lookedUpAgency.ownerName} · الكود:{' '}
                              <span className="font-mono-num font-bold">{lookedUpAgency.code}</span>
                            </p>
                          </div>
                          <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-extrabold text-emerald-700 border border-emerald-200">
                            {lookedUpAgency.hostIds.length} مضيف
                          </span>
                        </div>
                      ) : (
                        <span>لم يتم العثور على وكالة مسجلة بهذا الرقم أو الكود.</span>
                      )}
                    </div>
                  )}

                  {/* Quick-pick from real registered agencies */}
                  {publicAgencies.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <span className="block text-[11px] font-bold text-slate-500">
                        الوكالات المعتمدة في صَدَى (اضغط للاختيار السريع):
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {publicAgencies.map((ag) => (
                          <button
                            key={ag.id}
                            type="button"
                            onClick={() => setAgencyInput(ag.code)}
                            className={`rounded-xl px-3 py-1.5 text-xs font-bold border cursor-pointer transition ${
                              agencyInput.trim().toUpperCase() === ag.code.toUpperCase()
                                ? 'bg-emerald-50 border-emerald-400 text-emerald-800'
                                : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-emerald-300'
                            }`}
                          >
                            {ag.name} ({ag.code})
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    نبذة المضيف وخبرتك الصوتية
                  </label>
                  <textarea
                    rows={3}
                    required
                    minLength={5}
                    value={hostBio}
                    onChange={(e) => setHostBio(e.target.value)}
                    placeholder="اكتب نبذة مختصرة عن مواهبك الصوتية وأوقات تواجدك للانضمام للوكالة..."
                    className="w-full rounded-2xl bg-slate-50 border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submittingApp || !lookedUpAgency}
                  className="emerald-btn w-full min-h-[46px] rounded-2xl text-sm font-extrabold cursor-pointer disabled:opacity-50"
                >
                  {submittingApp ? 'جارٍ إرسال الطلب...' : 'انضمام للوكالة'}
                </button>
              </form>
            )}

            {/* User's Submitted Applications History */}
            {myApplications.length > 0 && (
              <section className="light-card rounded-3xl p-5 space-y-3">
                <h3 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-600" />
                  <span>حالة طلبات الانضمام للوكالات</span>
                </h3>
                <div className="space-y-2.5">
                  {myApplications.map((app) => (
                    <div
                      key={app.id}
                      className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-extrabold text-slate-900">
                          وكالة: {app.agencyName}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{app.bio}</p>
                        <p className="text-[10px] text-slate-400 font-mono-num mt-1">
                          {new Date(app.createdAt).toLocaleString('ar-EG')}
                        </p>
                      </div>

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-extrabold shrink-0 self-start sm:self-center border ${
                          app.status === 'approved'
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                            : app.status === 'rejected'
                            ? 'bg-rose-50 border-rose-200 text-rose-700'
                            : 'bg-amber-50 border-amber-200 text-amber-800'
                        }`}
                      >
                        {app.status === 'approved'
                          ? 'مقبول ومعتمد ✓'
                          : app.status === 'rejected'
                          ? 'مرفوض'
                          : 'بانتظار موافقة الإدارة'}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Secondary Collapsible Section: Apply to Open a New Agency */}
            {!myAgency && (
              <section className="light-card rounded-3xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowCreateAgency((prev) => !prev)}
                  className="w-full p-5 flex items-center justify-between text-right cursor-pointer hover:bg-slate-50 transition"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-700">
                      <Crown className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm sm:text-base font-black text-slate-900">
                        تأسيس وكالة جديدة كـ "وكيل" معتمد
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        افتح لوحة "وكالتي" وأدر مضيفيك وتابع التارجت الأسبوعي (العمولة تُحدد وتُصرف من الإدارة).
                      </p>
                    </div>
                  </div>
                  {showCreateAgency ? (
                    <ChevronUp className="w-5 h-5 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-slate-400" />
                  )}
                </button>

                {showCreateAgency && (
                  <form onSubmit={handleApplyAgent} className="px-5 pb-5 pt-2 border-t border-slate-100 space-y-3.5">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        اسم الوكالة الملكية
                      </label>
                      <input
                        type="text"
                        required
                        minLength={3}
                        value={agencyName}
                        onChange={(e) => setAgencyName(e.target.value)}
                        placeholder="مثال: وكالة نجوم الخليج"
                        className="w-full rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        نبذة الوكالة
                      </label>
                      <textarea
                        rows={2}
                        value={agencyDesc}
                        onChange={(e) => setAgencyDesc(e.target.value)}
                        placeholder="وصف مختصر لأهداف وكالتك ورعاية المضيفين..."
                        className="w-full rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={applying}
                      className="gold-btn w-full min-h-[44px] rounded-2xl text-xs sm:text-sm font-extrabold cursor-pointer disabled:opacity-60"
                    >
                      {applying ? 'جارٍ اعتماد الوكالة...' : 'إنشاء الوكالة وفتح قسم "وكالتي"'}
                    </button>
                  </form>
                )}
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
