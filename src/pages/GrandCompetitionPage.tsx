import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  CalendarDays,
  LoaderCircle,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  getGrandCompetitionSettings,
  getGrandCompetitionShare,
  GRAND_COMPETITION_PACKAGES,
} from '../lib/sadaGrandCompetitionService';
import { supabase } from '../lib/supabase';
import type { GrandCompetitionSettings } from '../types';
import { CoinIcon, CrownIcon, TrophyIcon } from '../components/AppIcons';

const CompetitionInfoCard: React.FC<{
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  tone: string;
}> = ({ icon, title, children, tone }) => (
  <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="mb-3 flex items-center gap-2.5">
      <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${tone}`}>
        {icon}
      </div>
      <h2 className="text-sm font-extrabold text-slate-900">{title}</h2>
    </div>
    {children}
  </section>
);

export const GrandCompetitionPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, updateLocalUser } = useAuth();
  const [competition, setCompetition] = useState<GrandCompetitionSettings | null>(null);
  const [userShare, setUserShare] = useState({ participantWeight: 0, sharePercent: 0 });
  const [selectedPackage, setSelectedPackage] = useState<number>(20_000);
  const [purchasing, setPurchasing] = useState(false);
  const [notice, setNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const userId = user?.id;

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const settings = await getGrandCompetitionSettings();
        if (active) setCompetition(settings);
        if (userId) {
          const share = await getGrandCompetitionShare();
          if (active) setUserShare(share);
        } else if (active) {
          setUserShare({ participantWeight: 0, sharePercent: 0 });
        }
      } catch (error) {
        if (active) {
          setNotice({
            type: 'err',
            text: error instanceof Error ? error.message : 'تعذّر تحميل بيانات المسابقة.',
          });
        }
      }
    };

    void load();
    const channel = supabase
      .channel('grand-competition-state')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sada_platform_state', filter: 'id=eq.global' },
        () => void load()
      )
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  const handleSubscribe = async () => {
    if (!user || purchasing) return;
    setPurchasing(true);
    setNotice(null);
    let deductedBalance: { before: number; after: number } | null = null;
    try {
      if (!competition) throw new Error('إعدادات المسابقة غير جاهزة.');
      if (!GRAND_COMPETITION_PACKAGES.some((item) => item.coins === selectedPackage)) {
        throw new Error('باقة الاشتراك غير صالحة.');
      }

      for (let attempt = 0; attempt < 3 && !deductedBalance; attempt += 1) {
        const { data: profile, error: profileError } = await supabase
          .from('sada_users')
          .select('coins')
          .eq('id', user.id)
          .maybeSingle();
        if (profileError) throw new Error(profileError.message);
        if (!profile) throw new Error('تعذّر العثور على حسابك.');

        const currentCoins = Number(profile.coins);
        if (!Number.isFinite(currentCoins)) throw new Error('رصيد الكوينز غير صالح.');
        if (currentCoins < selectedPackage) throw new Error('رصيد الكوينز غير كافٍ.');

        const nextCoins = currentCoins - selectedPackage;
        const { data: updatedProfile, error: updateProfileError } = await supabase
          .from('sada_users')
          .update({ coins: nextCoins })
          .eq('id', user.id)
          .eq('coins', currentCoins)
          .select('coins')
          .maybeSingle();
        if (updateProfileError) throw new Error(updateProfileError.message);
        if (updatedProfile) {
          deductedBalance = { before: currentCoins, after: Number(updatedProfile.coins) };
        }
      }
      if (!deductedBalance) throw new Error('تغيّر رصيدك أثناء الاشتراك. حاول مرة أخرى.');

      let updatedCompetition: GrandCompetitionSettings | null = null;
      for (let attempt = 0; attempt < 5 && !updatedCompetition; attempt += 1) {
        const { data: state, error: stateError } = await supabase
          .from('sada_platform_state')
          .select('settings')
          .eq('id', 'global')
          .maybeSingle();
        if (stateError) throw new Error(stateError.message);
        if (!state) throw new Error('تعذّر العثور على إعدادات مخزون الجوائز.');

        const settings =
          state.settings && typeof state.settings === 'object'
            ? (state.settings as Record<string, unknown>)
            : {};
        const rawCompetition =
          settings.grandCompetition && typeof settings.grandCompetition === 'object'
            ? (settings.grandCompetition as Record<string, unknown>)
            : {};
        const getCounter = (key: string) => {
          const value = Number(rawCompetition[key] || 0);
          if (!Number.isFinite(value) || value < 0) {
            throw new Error('بيانات مخزون الجوائز غير صالحة.');
          }
          return value;
        };
        const nextTotalSubscriptions = getCounter('totalSubscriptionsCoins') + selectedPackage;
        const nextPrizePool = getCounter('prizePoolCoins') + Math.floor(selectedPackage * 0.8);
        const nextCommission =
          getCounter('platformCommissionCoins') +
          selectedPackage -
          Math.floor(selectedPackage * 0.8);
        const nextCompetition = {
          ...rawCompetition,
          totalSubscriptionsCoins: nextTotalSubscriptions,
          prizePoolCoins: nextPrizePool,
          platformCommissionCoins: nextCommission,
        };
        const nextSettings = { ...settings, grandCompetition: nextCompetition };
        const { data: savedState, error: saveError } = await supabase
          .from('sada_platform_state')
          .update({ settings: nextSettings, updated_at: new Date().toISOString() })
          .eq('id', 'global')
          .eq('settings', JSON.stringify(settings))
          .select('id')
          .maybeSingle();
        if (saveError) throw new Error(saveError.message);
        if (savedState) {
          updatedCompetition = {
            ...competition,
            totalSubscriptionsCoins: nextTotalSubscriptions,
            prizePoolCoins: nextPrizePool,
            platformCommissionCoins: nextCommission,
          };
        }
      }
      if (!updatedCompetition) throw new Error('تعذّر تحديث مخزون الجوائز. حاول مرة أخرى.');

      updateLocalUser({ ...user, coins: deductedBalance.after });
      setCompetition(updatedCompetition);
      setNotice({ type: 'ok', text: 'تم الاشتراك في المسابقة الكبرى بنجاح!' });
    } catch (error) {
      if (deductedBalance) {
        try {
          const { data: refundedProfile, error: refundError } = await supabase
            .from('sada_users')
            .update({ coins: deductedBalance.before })
            .eq('id', user.id)
            .eq('coins', deductedBalance.after)
            .select('coins')
            .maybeSingle();
          if (refundError || !refundedProfile) {
            throw new Error('تعذّر إعادة الكوينز بعد فشل الاشتراك.');
          }
        } catch {
          setNotice({
            type: 'err',
            text: 'تعذّر إكمال الاشتراك ولم نتمكن من إعادة الكوينز تلقائياً. يرجى التواصل مع الدعم.',
          });
          return;
        }
      }
      setNotice({
        type: 'err',
        text: error instanceof Error ? error.message : 'تعذّر إتمام الاشتراك.',
      });
    } finally {
      setPurchasing(false);
    }
  };

  return (
    <div className="min-h-full bg-gradient-to-b from-emerald-50 via-slate-50 to-slate-50 px-4 pb-8 pt-5">
      <div className="mx-auto max-w-3xl space-y-4">
        <button
          type="button"
          onClick={() => navigate('/', { replace: true })}
          className="inline-flex min-h-10 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700"
        >
          <ArrowRight className="h-4 w-4" />
          رجوع
        </button>

        <header className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#082B23] via-[#0F513D] to-[#172554] p-5 text-white shadow-xl">
          <div className="pointer-events-none absolute -left-8 -top-10 h-40 w-40 rounded-full bg-emerald-300/15 blur-2xl" />
          <div className="relative flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-amber-200/50 bg-amber-300/15 text-amber-200 shadow-lg">
              <TrophyIcon className="h-8 w-8" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-emerald-100">التحدي الأسبوعي والختام الشهري</p>
              <h1 className="mt-1 text-xl font-black sm:text-2xl">مسابقة صدى الكبرى</h1>
              <p className="mt-2 text-xs leading-6 text-slate-200">
                مساحة تنافسية لمجتمع صدى، تجمع المشاركات والتحديات في دورات أسبوعية وختامية شهرية.
                تابع إعلانات المسابقة لمعرفة تفاصيل كل دورة قبل التسجيل.
              </p>
            </div>
          </div>
        </header>

        <CompetitionInfoCard
          icon={<TrophyIcon className="h-5 w-5" />}
          title="نبذة عن المسابقة"
          tone="bg-emerald-50 text-emerald-700"
        >
          <p className="text-xs leading-6 text-slate-600">
            تُنظَّم المنافسة على مراحل أسبوعية، مع دورة شهرية ختامية وفق إعلان المنظمين. تعرض صفحة
            المسابقات التحديات المتاحة، أما تفاصيل الجولة وطريقة احتساب نتيجتها فتُوضح في إعلانها
            الرسمي.
          </p>
        </CompetitionInfoCard>

        <section className="grid gap-3 sm:grid-cols-2">
          <CompetitionInfoCard
            icon={<CoinIcon className="h-5 w-5" />}
            title="جوائز الدورة الأسبوعية"
            tone="bg-amber-50 text-amber-700"
          >
            <p className="text-xs leading-6 text-slate-600">
              تشمل الجوائز كوينز وأوسمة بحسب إعلان الدورة. لم تُضبط قيمة موثقة للجوائز الأسبوعية في
              إعدادات التطبيق؛ راجع الإعلان الرسمي قبل المشاركة.
            </p>
          </CompetitionInfoCard>
          <CompetitionInfoCard
            icon={<CrownIcon className="h-5 w-5" />}
            title="جوائز الختام الشهري"
            tone="bg-violet-50 text-violet-700"
          >
            <p className="whitespace-pre-line text-xs leading-6 text-slate-600">
              {competition?.monthlyClosingPrizes || 'جارٍ تحميل إعدادات المسابقة...'}
            </p>
          </CompetitionInfoCard>
        </section>

        <CompetitionInfoCard
          icon={<ShieldCheck className="h-5 w-5" />}
          title="شروط التأهل والمشاركة"
          tone="bg-sky-50 text-sky-700"
        >
          <p className="whitespace-pre-line text-xs leading-6 text-slate-600">
            {competition?.participationTerms || 'جارٍ تحميل إعدادات المسابقة...'}
          </p>
        </CompetitionInfoCard>

        <CompetitionInfoCard
          icon={<CalendarDays className="h-5 w-5" />}
          title="جدول المواعيد"
          tone="bg-rose-50 text-rose-700"
        >
          <p className="whitespace-pre-line text-xs leading-6 text-slate-600">
            {competition?.schedule || 'جارٍ تحميل إعدادات المسابقة...'}
          </p>
        </CompetitionInfoCard>

        <section className="rounded-3xl border border-emerald-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-black text-slate-900">الاشتراك في المسابقة</h2>
              <p className="mt-1 text-xs leading-5 text-slate-600">
                اختر باقتك لدعم مخزون الجوائز، وتمنحك الباقات الأعلى حصة أكبر عند توزيع الجوائز.
              </p>
            </div>
            <CoinIcon className="mt-1 h-5 w-5 shrink-0" />
          </div>

          <div className="mt-4 rounded-2xl bg-emerald-50 p-4 text-center">
            <p className="text-xs font-bold text-emerald-800">مخزون الجوائز الحالي</p>
            <p className="mt-1 text-2xl font-black text-emerald-900">
              {(competition?.prizePoolCoins || 0).toLocaleString('en-US')} كوينز
            </p>
            <p className="mt-1 text-[11px] text-emerald-700">
              إجمالي الاشتراكات: {(competition?.totalSubscriptionsCoins || 0).toLocaleString('en-US')} كوينز
              {userShare.participantWeight > 0 &&
                ` · حصتك الحالية من مخزون الجوائز: ${
                  userShare.sharePercent < 0.01
                    ? userShare.sharePercent.toFixed(4)
                    : userShare.sharePercent.toFixed(2)
                }٪`}
            </p>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {GRAND_COMPETITION_PACKAGES.map((subscription) => (
              <button
                key={subscription.coins}
                type="button"
                onClick={() => setSelectedPackage(subscription.coins)}
                aria-pressed={selectedPackage === subscription.coins}
                className={`min-h-[76px] rounded-2xl border px-2 py-3 text-center transition ${
                  selectedPackage === subscription.coins
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-900'
                    : 'border-slate-200 bg-white text-slate-700'
                }`}
              >
                <span className="block text-sm font-black">
                  {subscription.coins.toLocaleString('en-US')}
                </span>
                <span className="mt-1 block text-[10px]">
                  {Math.floor(subscription.coins * 0.8).toLocaleString('en-US')} للجائزة
                </span>
                <span className="mt-1 block text-[10px] font-bold">
                  {subscription.weight === 1
                    ? 'حصة أساسية'
                    : subscription.weight === 3
                    ? 'حصة مضاعفة ×3'
                    : subscription.weight === 7
                    ? 'حصة ذهبية ×7'
                    : 'حصة ملكية ×16'}
                </span>
              </button>
            ))}
          </div>

          {notice && (
            <p
              role="status"
              className={`mt-3 rounded-xl px-3 py-2 text-xs ${
                notice.type === 'ok'
                  ? 'bg-emerald-50 text-emerald-800'
                  : 'bg-rose-50 text-rose-700'
              }`}
            >
              {notice.text}
            </p>
          )}

          <button
            type="button"
            disabled={!user || purchasing || !competition}
            onClick={() => void handleSubscribe()}
            className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-700 text-sm font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {purchasing && <LoaderCircle className="h-4 w-4 animate-spin" />}
            {user ? 'اشتراك الآن' : 'سجّل الدخول للاشتراك'}
            {user && ` · ${selectedPackage.toLocaleString('en-US')} كوينز`}
          </button>
          {user && (
            <p className="mt-2 text-center text-[11px] text-slate-500">
              رصيدك: {user.coins.toLocaleString('en-US')} كوينز
            </p>
          )}
        </section>

      </div>
    </div>
  );
};
