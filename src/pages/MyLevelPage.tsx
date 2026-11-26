import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Crown, Gem, Gift, Sparkles, TrendingUp } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { GIFT_LEVEL_STEP_COINS } from '../lib/sadaCatalog';
import { getUserGiftLevelsFromSupabase } from '../lib/sadaSocialService';
import { AvatarWithFrame } from '../components/AvatarWithFrame';

export const MyLevelPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    sentCoins: 0,
    receivedCoins: 0,
    sendLevel: 1,
    sendProgressPct: 0,
    sendRemainingCoins: GIFT_LEVEL_STEP_COINS,
    receiveLevel: 1,
    receiveProgressPct: 0,
    receiveRemainingCoins: GIFT_LEVEL_STEP_COINS,
  });

  const loadLevels = useCallback(async () => {
    if (!user?.id) return;
    try {
      const res = await getUserGiftLevelsFromSupabase(user.id);
      setStats(res);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void loadLevels();
  }, [loadLevels]);

  if (!user) return null;

  return (
    <div className="min-h-full bg-[#080B14] text-white pb-8" dir="rtl">
      <div className="max-w-3xl mx-auto px-4 pt-4 space-y-5">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => navigate('/profile')}
            className="inline-flex items-center gap-1.5 rounded-2xl bg-white/5 border border-white/10 px-3.5 py-2 text-xs font-extrabold text-[#FCE9A6] hover:bg-white/10 cursor-pointer transition"
          >
            <ArrowRight className="w-4 h-4" />
            <span>العودة إلى ملفي</span>
          </button>
          <span className="text-[11px] font-extrabold text-[#FCE9A6] bg-amber-400/10 border border-amber-300/25 rounded-full px-3 py-1">
            نظام المستويين
          </span>
        </div>

        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#171522] via-[#111522] to-[#241b0e] border border-amber-300/20 p-5 sm:p-6 shadow-[0_18px_50px_rgba(0,0,0,0.3)] flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div className="flex items-center gap-5 min-w-0">
            <div className="shrink-0 rounded-full p-1 bg-gradient-to-br from-[#FCE9A6] via-[#D4AF37] to-[#78551A] shadow-[0_0_24px_rgba(212,175,55,0.25)]">
              <AvatarWithFrame
                src={user.avatarUrl}
                alt={user.displayName}
                frameId={user.frameId}
                size="lg"
              />
            </div>
            <div className="space-y-1.5 min-w-0">
              <h1 className="text-xl sm:text-2xl font-extrabold truncate">{user.displayName}</h1>
              <p className="text-xs leading-relaxed text-slate-300">
                يرتفع مستواك درجة مقابل كل{' '}
                <span className="font-mono-num font-extrabold text-[#FCE9A6]">500,000</span>{' '}
                كوينز من الإرسال أو الاستقبال.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="inline-flex items-center gap-1.5 rounded-2xl bg-amber-400/10 border border-amber-300/30 px-3.5 py-2 text-xs font-extrabold text-[#FCE9A6] font-mono-num">
              <Crown className="w-4 h-4" />
              <span>داعم Lv.{stats.sendLevel}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-2xl bg-white/5 border border-white/15 px-3.5 py-2 text-xs font-extrabold text-slate-200 font-mono-num">
              <Gem className="w-4 h-4 text-[#D4AF37]" />
              <span>مضيف Lv.{stats.receiveLevel}</span>
            </span>
          </div>
        </section>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-3xl bg-white/5 border border-white/10 h-56 animate-pulse" />
            <div className="rounded-3xl bg-white/5 border border-white/10 h-56 animate-pulse" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <article className="rounded-3xl bg-[#111522] border border-amber-300/20 p-5 space-y-4 shadow-lg">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-amber-400/10 border border-amber-300/25 flex items-center justify-center text-[#FCE9A6]">
                    <Crown className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-base font-extrabold text-white">مستوى الإرسال (داعم)</h2>
                    <p className="text-[11px] text-slate-400">يُحتسب من قيمة الهدايا المرسلة</p>
                  </div>
                </div>
                <span className="rounded-2xl bg-gradient-to-br from-[#FCE9A6] to-[#B8860B] text-[#17120a] px-3 py-1.5 text-sm font-black font-mono-num">
                  Lv.{stats.sendLevel}
                </span>
              </div>

              <div className="rounded-2xl bg-black/25 border border-white/10 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-bold">إجمالي الهدايا المرسلة</span>
                  <span className="font-mono-num font-black text-white">
                    {stats.sentCoins.toLocaleString('en-US')} 🪙
                  </span>
                </div>
                <div className="h-2.5 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#FCE9A6] to-[#B8860B] transition-all duration-500"
                    style={{ width: `${stats.sendProgressPct}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] font-mono-num">
                  <span className="text-[#FCE9A6] font-bold">{stats.sendProgressPct}% مكتمل</span>
                  <span className="text-slate-400">
                    متبقي {stats.sendRemainingCoins.toLocaleString('en-US')} كوينز للمستوى التالي
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => navigate('/')}
                className="w-full min-h-[42px] rounded-2xl bg-amber-400/10 hover:bg-amber-400/15 border border-amber-300/25 text-xs font-extrabold text-[#FCE9A6] flex items-center justify-center gap-1.5 cursor-pointer transition"
              >
                <Gift className="w-4 h-4" />
                <span>أرسل الهدايا في الغرف</span>
              </button>
            </article>

            <article className="rounded-3xl bg-[#111522] border border-white/15 p-5 space-y-4 shadow-lg">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-white/5 border border-white/15 flex items-center justify-center text-[#FCE9A6]">
                    <Gem className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-base font-extrabold text-white">مستوى الاستقبال (مضيف)</h2>
                    <p className="text-[11px] text-slate-400">يُحتسب من قيمة الهدايا المستلمة</p>
                  </div>
                </div>
                <span className="rounded-2xl bg-white/10 border border-white/15 text-[#FCE9A6] px-3 py-1.5 text-sm font-black font-mono-num">
                  Lv.{stats.receiveLevel}
                </span>
              </div>

              <div className="rounded-2xl bg-black/25 border border-white/10 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-bold">قيمة الهدايا المستلمة</span>
                  <span className="font-mono-num font-black text-white">
                    {stats.receivedCoins.toLocaleString('en-US')} 🪙
                  </span>
                </div>
                <div className="h-2.5 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#D4AF37] to-[#FCE9A6] transition-all duration-500"
                    style={{ width: `${stats.receiveProgressPct}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] font-mono-num">
                  <span className="text-[#FCE9A6] font-bold">{stats.receiveProgressPct}% مكتمل</span>
                  <span className="text-slate-400">
                    متبقي {stats.receiveRemainingCoins.toLocaleString('en-US')} كوينز للمستوى التالي
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => navigate('/agency?tab=host-center')}
                className="w-full min-h-[42px] rounded-2xl bg-white/5 hover:bg-white/10 border border-white/15 text-xs font-extrabold text-slate-100 flex items-center justify-center gap-1.5 cursor-pointer transition"
              >
                <Sparkles className="w-4 h-4 text-[#D4AF37]" />
                <span>طوّر حضورك كمضيف رسمي</span>
              </button>
            </article>
          </div>
        )}

        <section className="rounded-3xl bg-[#111522] border border-white/10 p-5 space-y-3">
          <div className="flex items-center gap-2 text-white">
            <TrendingUp className="w-5 h-5 text-[#D4AF37]" />
            <h3 className="text-sm sm:text-base font-extrabold">كيف يُحتسب المستوى في صدى؟</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-300">
            <div className="rounded-2xl bg-black/20 border border-white/10 p-3.5 space-y-1">
              <p className="font-extrabold text-[#FCE9A6]">1. قاعدة 500,000 كوينز</p>
              <p>كل 500,000 كوينز من الهدايا تمنحك مستوى جديداً.</p>
            </div>
            <div className="rounded-2xl bg-black/20 border border-white/10 p-3.5 space-y-1">
              <p className="font-extrabold text-[#FCE9A6]">2. مستويان منفصلان</p>
              <p>مستوى الإرسال يعكس دعمك للآخرين، والاستقبال يعكس الهدايا التي تلقيتها.</p>
            </div>
            <div className="rounded-2xl bg-black/20 border border-white/10 p-3.5 space-y-1">
              <p className="font-extrabold text-[#FCE9A6]">3. شارات فورية</p>
              <p>تظهر شارتا الداعم والمضيف بجوار اسمك في ملفك الشخصي والغرف.</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
