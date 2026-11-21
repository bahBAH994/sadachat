import React, { useState } from 'react';
import { ArrowRight, Check, Clock3, Crown, EyeOff, MessageSquareText, Shield, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { activateSvipMembershipInSupabase } from '../lib/sadaWalletService';
import { SVIP_MEMBERSHIP_LEVELS } from '../lib/sadaCatalog';

const SVIP_FEATURES = [
  { icon: Sparkles, title: 'دخولية ملكية متحركة', detail: 'ظهور مميز عند دخول الغرف الصوتية' },
  { icon: Crown, title: 'شارة وإطار SVIP متوهج', detail: 'مظهر ملكي في الملف الشخصي والمايك' },
  { icon: EyeOff, title: 'ميزة التخفي', detail: 'خصوصية إضافية أثناء استخدام التطبيق' },
  { icon: Shield, title: 'حماية في الغرف العادية', detail: 'مقاومة الطرد والكتم من غير الإدارة' },
  { icon: MessageSquareText, title: 'رسائل ذهبية', detail: 'تمييز الرسائل الخاصة بمظهر SVIP' },
];

export const SvipPage: React.FC = () => {
  const { user, updateLocalUser } = useAuth();
  const navigate = useNavigate();
  const [selectedLevel, setSelectedLevel] = useState<1 | 2 | 3 | 4>(1);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);

  const selectedTier =
    SVIP_MEMBERSHIP_LEVELS.find((item) => item.level === selectedLevel) ||
    SVIP_MEMBERSHIP_LEVELS[0];
  const activeMembership = Boolean(
    user?.svipExpiresAt && new Date(user.svipExpiresAt).getTime() > Date.now()
  );

  if (!user) return null;

  const handleActivate = async () => {
    setBusy(true);
    setFeedback(null);
    try {
      const updatedUser = await activateSvipMembershipInSupabase(user, selectedLevel);
      updateLocalUser(updatedUser);
      setFeedback({ ok: true, message: 'تم تفعيل عضوية SVIP لمدة 30 يوماً.' });
    } catch (error) {
      setFeedback({
        ok: false,
        message: error instanceof Error ? error.message : 'تعذّر تفعيل العضوية.',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="h-full min-h-0 flex flex-col overflow-hidden bg-[#08090D] text-white">
      <header className="shrink-0 border-b border-amber-300/15 bg-gradient-to-r from-[#08090D] via-[#201707] to-[#08090D] px-4 py-4">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Crown className="h-6 w-6 text-amber-300" />
            <div>
              <h1 className="text-lg font-black text-amber-100">نادي SVIP الملكي</h1>
              <p className="text-[11px] text-amber-100/65">عضوية مميزة لمدة 30 يوماً</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate('/profile')}
            className="inline-flex min-h-[40px] items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-3 text-xs font-bold text-slate-200"
          >
            <ArrowRight className="h-4 w-4" />
            <span>العودة</span>
          </button>
        </div>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain touch-pan-y">
        <main className="mx-auto w-full max-w-4xl space-y-5 px-4 py-5 pb-8">
          <section className="rounded-3xl border border-amber-300/25 bg-[radial-gradient(ellipse_at_top,rgba(212,175,55,0.2),transparent_65%),linear-gradient(145deg,#16120A,#08090D_65%)] p-5 shadow-[0_12px_42px_rgba(212,175,55,0.08)]">
            <p className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/30 bg-amber-200/10 px-3 py-1 text-[11px] font-bold text-amber-200">
              <Sparkles className="h-3.5 w-3.5" />
              امتيازات ملكية حصرية
            </p>
            <h2 className="mt-3 text-xl font-black text-white">ارتقِ بتجربتك إلى القمة</h2>
            <p className="mt-1 max-w-2xl text-xs leading-6 text-slate-300">
              اختر مستواك واستمتع بمزايا SVIP طوال مدة العضوية. يمكن تمديد المدة عند تفعيل مستوى جديد.
            </p>
            {activeMembership && (
              <div className="mt-4 inline-flex items-center gap-2 rounded-xl border border-emerald-300/25 bg-emerald-400/10 px-3 py-2 text-xs font-bold text-emerald-200">
                <Clock3 className="h-4 w-4" />
                عضويتك الحالية تنتهي في {new Date(user.svipExpiresAt!).toLocaleDateString('ar')}
              </div>
            )}
          </section>

          {feedback && (
            <div
              role="status"
              className={`rounded-2xl border px-4 py-3 text-xs font-bold ${
                feedback.ok
                  ? 'border-emerald-300/30 bg-emerald-950/60 text-emerald-200'
                  : 'border-rose-300/30 bg-rose-950/60 text-rose-200'
              }`}
            >
              {feedback.message}
            </div>
          )}

          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {SVIP_MEMBERSHIP_LEVELS.map((tier) => (
              <button
                key={tier.level}
                type="button"
                onClick={() => setSelectedLevel(tier.level)}
                aria-pressed={selectedLevel === tier.level}
                className={`rounded-2xl border p-4 text-right transition ${
                  selectedLevel === tier.level
                    ? 'border-amber-300/80 bg-amber-200/10 shadow-[0_0_22px_rgba(212,175,55,0.12)]'
                    : 'border-white/10 bg-white/[0.03] hover:border-amber-200/40'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className={`grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br ${tier.color} text-xl`}>
                    {tier.glyph}
                  </span>
                  {selectedLevel === tier.level && (
                    <Check className="h-5 w-5 text-amber-300" />
                  )}
                </div>
                <h3 className="mt-3 font-black text-amber-100">{tier.label}</h3>
                <p className="mt-1 font-mono-num text-sm font-bold text-white">
                  {tier.priceCoins.toLocaleString('en-US')} كوينز
                  <span className="text-[10px] font-semibold text-slate-400"> / 30 يوماً</span>
                </p>
              </button>
            ))}
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
            <h2 className="mb-3 text-sm font-black text-amber-100">مميزات العضوية الحصرية</h2>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {SVIP_FEATURES.map(({ icon: Icon, title, detail }) => (
                <div key={title} className="flex items-center gap-3 rounded-xl bg-black/20 p-3">
                  <Icon className="h-5 w-5 shrink-0 text-amber-300" />
                  <div>
                    <p className="text-xs font-extrabold text-white">{title}</p>
                    <p className="mt-0.5 text-[10px] text-slate-400">{detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <button
            type="button"
            disabled={busy}
            onClick={() => void handleActivate()}
            className="gold-btn min-h-[48px] w-full rounded-2xl text-sm font-black disabled:opacity-50"
          >
            {busy
              ? 'جارٍ التفعيل...'
              : `تفعيل SVIP الآن · ${selectedTier.priceCoins.toLocaleString('en-US')} كوينز`}
          </button>
          <p className="text-center text-[10px] text-slate-500">
            رصيدك الحالي: {user.coins.toLocaleString('en-US')} كوينز
          </p>
        </main>
      </div>
    </div>
  );
};
