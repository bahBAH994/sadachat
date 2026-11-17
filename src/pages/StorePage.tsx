import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  Coins,
  Crown,
  Lock,
  Sparkles,
  Store,
  Zap,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  equipStoreOrBagItemInSupabase,
  getStoreAndBagOverviewFromSupabase,
} from '../lib/sadaWalletService';
import type { Store3DItem } from '../types';
import { AvatarWithFrame } from '../components/AvatarWithFrame';

export const StorePage: React.FC = () => {
  const { user, updateLocalUser } = useAuth();
  const navigate = useNavigate();

  const [storeItems, setStoreItems] = useState<Store3DItem[]>([]);
  const [totalRechargedCoins, setTotalRechargedCoins] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(
    null
  );

  const loadStore = useCallback(async () => {
    if (!user?.id) return;
    try {
      const data = await getStoreAndBagOverviewFromSupabase(user.id);
      updateLocalUser(data.user);
      setStoreItems(data.storeItems);
      setTotalRechargedCoins(data.totalRechargedCoins);
    } finally {
      setLoading(false);
    }
  }, [user?.id, updateLocalUser]);

  useEffect(() => {
    void loadStore();
  }, [loadStore]);

  if (!user) return null;

  const maxTierCoins = 50000;
  const overallProgress = Math.min(
    100,
    Math.round((totalRechargedCoins / maxTierCoins) * 100)
  );
  const nextLocked = storeItems.find((item) => totalRechargedCoins < item.minRechargeCoins);

  const handleEquip = async (item: Store3DItem) => {
    setBusyId(item.id);
    setFeedback(null);
    try {
      const updated = await equipStoreOrBagItemInSupabase(user, item.id);
      updateLocalUser(updated);
      setFeedback({
        type: 'ok',
        text: item.entryName
          ? `تم تفعيل "${item.name}" و "${item.entryName}" بنجاح وسيظهران فوراً في الوكالات!`
          : `تم ارتداء إطار "${item.name}" ثلاثي الأبعاد بنجاح!`,
      });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'تعذّر تفعيل العنصر.',
      });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F6FA] pb-28">
      <div className="max-w-4xl mx-auto px-4 pt-4 space-y-5">
        {/* Hero Cumulative Recharge Progress Banner */}
        <section className="rounded-3xl bg-gradient-to-br from-[#0F172A] via-[#1B2542] to-[#0E3A2F] p-5 sm:p-6 text-white shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/20 border border-amber-300/40 px-3 py-1 text-[11px] font-bold text-[#FCE9A6]">
                <Store className="w-3.5 h-3.5" />
                <span>المتجر الملكي للإطارات والدخوليات 3D</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-extrabold mt-2">
                تأثيرات ثلاثية الأبعاد تُفتح بالشحن التراكمي
              </h1>
              <p className="text-xs text-slate-300 mt-1">
                تُفتح الإطارات والدخوليات الفاخرة تلقائياً عند بلوغ إجمالي شحن حسابك المستويات المطلوبة.
              </p>
            </div>

            <button
              type="button"
              onClick={() => navigate('/wallet')}
              className="emerald-btn rounded-2xl px-4 py-2.5 text-xs sm:text-sm font-extrabold flex items-center gap-1.5 shrink-0 cursor-pointer"
            >
              <Coins className="w-4 h-4" />
              <span>شحن الكوينز لرفع المستوى</span>
              <ArrowLeft className="w-4 h-4" />
            </button>
          </div>

          {/* Cumulative Progress Bar */}
          <div className="rounded-2xl bg-black/35 border border-white/10 p-4 space-y-2.5">
            <div className="flex items-center justify-between text-xs font-mono-num">
              <span className="text-slate-300 font-bold">إجمالي الشحن التراكمي</span>
              <span className="text-[#FCE9A6] font-extrabold text-sm">
                {totalRechargedCoins.toLocaleString('en-US')} / 50,000 كوينز
              </span>
            </div>

            <div className="h-3 rounded-full bg-slate-900 overflow-hidden border border-white/10">
              <div
                className="h-full bg-gradient-to-r from-emerald-400 via-amber-300 to-rose-400 transition-all duration-500"
                style={{ width: `${overallProgress}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[10px] font-mono-num text-slate-300">
              <span>1,000 🏎️</span>
              <span>5,000 🦅</span>
              <span>20,000 👑</span>
              <span>50,000 🐉</span>
            </div>

            {nextLocked ? (
              <p className="text-xs text-emerald-200 font-semibold">
                المتبقي لفتح «{nextLocked.name}»: {(nextLocked.minRechargeCoins - totalRechargedCoins).toLocaleString('en-US')} كوينز شحن إضافي
              </p>
            ) : (
              <p className="text-xs text-[#FCE9A6] font-extrabold">
                👑 تهانينا! تم فتح جميع الإطارات والدخوليات الأسطورية في المتجر!
              </p>
            )}
          </div>
        </section>

        {feedback && (
          <div
            className={`rounded-2xl px-4 py-3 text-xs font-bold border ${
              feedback.type === 'ok'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-700'
            }`}
          >
            {feedback.text}
          </div>
        )}

        {/* 3D Animated Store Items Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="light-card rounded-3xl h-56 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {storeItems.map((item) => {
              const unlocked =
                totalRechargedCoins >= item.minRechargeCoins ||
                user.unlockedFrames.includes(item.id);
              const isActive = user.frameId === item.id;
              const tierPct = Math.min(
                100,
                Math.round((totalRechargedCoins / item.minRechargeCoins) * 100)
              );

              return (
                <article
                  key={item.id}
                  className="light-card rounded-3xl overflow-hidden flex flex-col justify-between border border-slate-200"
                >
                  {/* 3D Visual Stage */}
                  <div
                    className={`bg-gradient-to-br ${item.previewGradient} p-5 text-white flex items-center gap-4 relative`}
                  >
                    <AvatarWithFrame
                      src={user.avatarUrl}
                      alt={item.name}
                      frameId={item.id}
                      size="lg"
                    />
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xl">{item.badgeGlyph}</span>
                        <h2 className="text-base font-extrabold text-white">{item.name}</h2>
                      </div>
                      <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-0.5 text-[10px] font-bold text-[#FCE9A6]">
                        <Sparkles className="w-3 h-3" />
                        {item.kind === 'frame_and_entry'
                          ? 'إطار 3D متحرك + دخولية ملكية'
                          : 'إطار 3D متحرك'}
                      </span>
                    </div>
                  </div>

                  {/* Details + Progress + Action */}
                  <div className="p-4 space-y-3 bg-white">
                    <p className="text-xs text-slate-600 leading-relaxed">{item.subtitle}</p>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] font-mono-num">
                        <span className="text-slate-500 font-bold">شرط الفتح التراكمي</span>
                        <span className="font-extrabold text-slate-900">
                          {item.minRechargeCoins.toLocaleString('en-US')} كوينز
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className={`h-full transition-all duration-500 ${
                            unlocked ? 'bg-emerald-500' : 'bg-amber-400'
                          }`}
                          style={{ width: `${tierPct}%` }}
                        />
                      </div>
                    </div>

                    {unlocked ? (
                      <button
                        type="button"
                        disabled={isActive || busyId === item.id}
                        onClick={() => handleEquip(item)}
                        className={`w-full min-h-[42px] rounded-2xl text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer transition ${
                          isActive
                            ? 'bg-emerald-50 border border-emerald-300 text-emerald-700'
                            : 'emerald-btn'
                        }`}
                      >
                        {isActive ? (
                          <>
                            <CheckCircle2 className="w-4 h-4" />
                            <span>مفعّل على حسابك الآن</span>
                          </>
                        ) : (
                          <>
                            <Zap className="w-4 h-4" />
                            <span>
                              {busyId === item.id ? 'جارٍ التفعيل...' : 'تفعيل وارتداء الآن'}
                            </span>
                          </>
                        )}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => navigate('/wallet')}
                        className="w-full min-h-[42px] rounded-2xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer transition"
                      >
                        <Lock className="w-3.5 h-3.5 text-amber-600" />
                        <span>
                          متبقي {(item.minRechargeCoins - totalRechargedCoins).toLocaleString('en-US')} كوينز شحن
                        </span>
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => navigate('/bag')}
            className="rounded-2xl bg-white border border-slate-200 px-5 py-2.5 text-xs font-extrabold text-slate-700 hover:border-emerald-400 cursor-pointer flex items-center gap-2 shadow-sm"
          >
            <Crown className="w-4 h-4 text-amber-500" />
            <span>الانتقال إلى الحقيبة وممتلكاتي</span>
          </button>
        </div>
      </div>
    </div>
  );
};
