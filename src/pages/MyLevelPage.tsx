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
    <div className="min-h-screen bg-[#F5F6FA] pb-32 overflow-y-auto touch-pan-y">
      <div className="max-w-3xl mx-auto px-4 pt-4 space-y-5">
        {/* Top Nav Header */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate('/profile')}
            className="inline-flex items-center gap-1.5 rounded-2xl bg-white border border-slate-200 px-3.5 py-2 text-xs font-extrabold text-slate-700 hover:border-emerald-400 cursor-pointer shadow-sm"
          >
            <ArrowRight className="w-4 h-4" />
            <span>العودة إلى أنا</span>
          </button>
          <span className="text-xs font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1">
            نظام المستويات المزدوج ✦
          </span>
        </div>

        {/* Hero Identity Card */}
        <section className="rounded-3xl bg-gradient-to-br from-[#0F172A] via-[#1B2542] to-[#0E3A2F] p-5 sm:p-6 text-white shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <AvatarWithFrame
              src={user.avatarUrl}
              alt={user.displayName}
              frameId={user.frameId}
              size="lg"
            />
            <div className="space-y-1">
              <h1 className="text-xl sm:text-2xl font-extrabold">{user.displayName}</h1>
              <p className="text-xs text-slate-300">
                يرتفع مستواك درجة واحدة مقابل كل{' '}
                <span className="font-mono-num font-extrabold text-[#FCE9A6]">500,000</span> كوينز
                في الإرسال أو الاستقبال
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="inline-flex items-center gap-1.5 rounded-2xl bg-amber-400/20 border border-amber-300/45 px-3.5 py-2 text-xs font-extrabold text-[#FCE9A6] font-mono-num">
              <Crown className="w-4 h-4" />
              <span>داعم Lv.{stats.sendLevel}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-2xl bg-sky-400/20 border border-sky-300/45 px-3.5 py-2 text-xs font-extrabold text-sky-200 font-mono-num">
              <Gem className="w-4 h-4" />
              <span>مضيف Lv.{stats.receiveLevel}</span>
            </span>
          </div>
        </section>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="light-card rounded-3xl h-56 animate-pulse" />
            <div className="light-card rounded-3xl h-56 animate-pulse" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Send Level Card */}
            <article className="light-card rounded-3xl p-5 space-y-4 border border-amber-200/80">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-100 to-yellow-200 border border-amber-300 flex items-center justify-center text-amber-700">
                    <Crown className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-base font-extrabold text-slate-900">ليڤل الإرسال (داعم)</h2>
                    <p className="text-[11px] text-slate-500">يُحتسب من الهدايا المرسلة في الغرف والخاص</p>
                  </div>
                </div>
                <span className="rounded-2xl bg-amber-500 text-white px-3 py-1.5 text-sm font-black font-mono-num shadow-sm">
                  Lv.{stats.sendLevel}
                </span>
              </div>

              <div className="rounded-2xl bg-slate-50 border border-slate-200/80 p-3.5 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-bold">إجمالي الهدايا المرسلة</span>
                  <span className="font-mono-num font-black text-slate-900">
                    {stats.sentCoins.toLocaleString('en-US')} 🪙
                  </span>
                </div>
                <div className="h-3 rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-500"
                    style={{ width: `${stats.sendProgressPct}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] font-mono-num">
                  <span className="text-amber-700 font-bold">{stats.sendProgressPct}% مكتمل</span>
                  <span className="text-slate-500">
                    متبقي {stats.sendRemainingCoins.toLocaleString('en-US')} كوينز لـ Lv.
                    {stats.sendLevel + 1}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => navigate('/')}
                className="w-full min-h-[42px] rounded-2xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-xs font-extrabold text-amber-900 flex items-center justify-center gap-1.5 cursor-pointer transition"
              >
                <Gift className="w-4 h-4 text-amber-600" />
                <span>ادعم المضيفين في الوكالات</span>
              </button>
            </article>

            {/* Receive Level Card */}
            <article className="light-card rounded-3xl p-5 space-y-4 border border-sky-200/80">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-sky-100 to-indigo-200 border border-sky-300 flex items-center justify-center text-sky-700">
                    <Gem className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-base font-extrabold text-slate-900">ليڤل الاستقبال (مضيف)</h2>
                    <p className="text-[11px] text-slate-500">يُحتسب من قيمة الهدايا المستقبَلة</p>
                  </div>
                </div>
                <span className="rounded-2xl bg-sky-600 text-white px-3 py-1.5 text-sm font-black font-mono-num shadow-sm">
                  Lv.{stats.receiveLevel}
                </span>
              </div>

              <div className="rounded-2xl bg-slate-50 border border-slate-200/80 p-3.5 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-bold">قيمة الهدايا المستقبَلة</span>
                  <span className="font-mono-num font-black text-slate-900">
                    {stats.receivedCoins.toLocaleString('en-US')} 🪙
                  </span>
                </div>
                <div className="h-3 rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-sky-400 to-indigo-600 transition-all duration-500"
                    style={{ width: `${stats.receiveProgressPct}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] font-mono-num">
                  <span className="text-sky-700 font-bold">{stats.receiveProgressPct}% مكتمل</span>
                  <span className="text-slate-500">
                    متبقي {stats.receiveRemainingCoins.toLocaleString('en-US')} كوينز لـ Lv.
                    {stats.receiveLevel + 1}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => navigate('/agency?tab=host-center')}
                className="w-full min-h-[42px] rounded-2xl bg-sky-50 hover:bg-sky-100 border border-sky-200 text-xs font-extrabold text-sky-900 flex items-center justify-center gap-1.5 cursor-pointer transition"
              >
                <Sparkles className="w-4 h-4 text-sky-600" />
                <span>تطوير حضورك كمضيف رسمي</span>
              </button>
            </article>
          </div>
        )}

        {/* Formula & Perks Info Card */}
        <section className="light-card rounded-3xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-slate-900">
            <TrendingUp className="w-5 h-5 text-emerald-600" />
            <h3 className="text-sm sm:text-base font-extrabold">كيف يُحتسب المستوى في صَدَى؟</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-600">
            <div className="rounded-2xl bg-slate-50 border border-slate-200/70 p-3.5 space-y-1">
              <p className="font-extrabold text-slate-900">1. قاعدة الـ 500,000 كوينز</p>
              <p>كل 500,000 كوينز من الهدايا تمنحك مستوى جديداً فورياً يُعرض أمام جميع الأعضاء.</p>
            </div>
            <div className="rounded-2xl bg-slate-50 border border-slate-200/70 p-3.5 space-y-1">
              <p className="font-extrabold text-slate-900">2. مستويان منفصلان بدقة</p>
              <p>ليڤل الإرسال يعكس قوة دعمك للآخرين، وليڤل الاستقبال يعكس نجوميتك على المايك.</p>
            </div>
            <div className="rounded-2xl bg-slate-50 border border-slate-200/70 p-3.5 space-y-1">
              <p className="font-extrabold text-slate-900">3. شارة فورية بالملف والغرفة</p>
              <p>تظهر شارتا الداعم والمضيف أسفل اسمك في صفحتك الشخصية وبطاقة ملفك بالوكالات.</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
