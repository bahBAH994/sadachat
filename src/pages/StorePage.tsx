import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  Coins,
  Crown,
  Gift,
  Image as ImageIcon,
  Lock,
  Sparkles,
  Store,
  Zap,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  applyRoomBackgroundToMyRoomInSupabase,
  equipStoreOrBagItemInSupabase,
  getStoreAndBagOverviewFromSupabase,
  purchaseRoomBackgroundInSupabase,
  purchaseStoreCoinItemInSupabase,
} from '../lib/sadaWalletService';
import type { Store3DItem, StoreBackgroundItem } from '../types';
import { AvatarWithFrame } from '../components/AvatarWithFrame';

export const StorePage: React.FC = () => {
  const { user, updateLocalUser } = useAuth();
  const navigate = useNavigate();

  const [frameTab, setFrameTab] = useState<'coins' | 'gift'>('coins');
  const [coinItems, setCoinItems] = useState<Store3DItem[]>([]);
  const [giftItems, setGiftItems] = useState<Store3DItem[]>([]);
  const [luxuryBackgrounds, setLuxuryBackgrounds] = useState<StoreBackgroundItem[]>([]);
  const [ownedBackgrounds, setOwnedBackgrounds] = useState<string[]>([]);
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
      setCoinItems(data.coinStoreItems);
      setGiftItems(data.storeItems);
      setLuxuryBackgrounds(data.luxuryBackgrounds);
      setOwnedBackgrounds(data.ownedBackgrounds);
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
  const nextLocked = giftItems.find(
    (item) =>
      item.purchaseMode !== 'gift' && totalRechargedCoins < item.minRechargeCoins
  );

  const handleBuyCoinItem = async (item: Store3DItem) => {
    setBusyId(item.id);
    setFeedback(null);
    try {
      const updated = await purchaseStoreCoinItemInSupabase(user, item.id);
      updateLocalUser(updated);
      setFeedback({
        type: 'ok',
        text: item.entryName
          ? `تم اقتناء وتفعيل "${item.name}" و "${item.entryName}" بنجاح!`
          : `تم اقتناء وارتداء "${item.name}" ثلاثي الأبعاد بنجاح!`,
      });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'تعذّر إتمام الشراء.',
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleEquipGiftItem = async (item: Store3DItem) => {
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

  const handleBuyBackground = async (bg: StoreBackgroundItem) => {
    setBusyId(bg.id);
    setFeedback(null);
    try {
      const res = await purchaseRoomBackgroundInSupabase(user, bg.id);
      updateLocalUser(res.user);
      setOwnedBackgrounds(res.ownedBackgrounds);
      setFeedback({
        type: 'ok',
        text: `تم شراء خلفية "${bg.name}" وإضافتها إلى حقيبتك بنجاح! يمكنك الآن تطبيقها على غرفتك.`,
      });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'تعذّر شراء الخلفية.',
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleApplyBackground = async (bg: StoreBackgroundItem) => {
    setBusyId(`apply_${bg.id}`);
    setFeedback(null);
    try {
      await applyRoomBackgroundToMyRoomInSupabase(user, bg.id);
      setFeedback({
        type: 'ok',
        text: `تم تطبيق خلفية "${bg.name}" على غرفتك الصوتية فوراً!`,
      });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'تعذّر تطبيق الخلفية على الغرفة.',
      });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F6FA] pb-28">
      <div className="max-w-4xl mx-auto px-4 pt-4 space-y-5">
        {/* Hero Store Header with Real Coins Balance */}
        <section className="rounded-3xl bg-gradient-to-br from-[#0F172A] via-[#1B2542] to-[#0E3A2F] p-5 sm:p-6 text-white shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/20 border border-amber-300/40 px-3 py-1 text-[11px] font-bold text-[#FCE9A6]">
                <Store className="w-3.5 h-3.5" />
                <span>المتجر الملكي — صَدَى</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-extrabold mt-2">
                الإطارات 3D، الدخوليات، وخلفيات الوكالات الفخمة
              </h1>
              <p className="text-xs text-slate-300 mt-1">
                اشترِ الإطارات والخلفيات بالكوينز مباشرة أو افتح الإطارات المهداة بالشحن التراكمي ومهام المضيف.
              </p>
            </div>

            <div className="flex flex-col items-stretch sm:items-end gap-2 shrink-0">
              <div className="rounded-2xl bg-white/10 border border-white/15 px-4 py-2 text-center">
                <span className="block text-[10px] text-amber-200 font-bold">رصيد الكوينز المتاح</span>
                <span className="text-lg font-black text-[#FCE9A6] font-mono-num">
                  {user.coins.toLocaleString('en-US')} 🪙
                </span>
              </div>
              <button
                type="button"
                onClick={() => navigate('/wallet')}
                className="emerald-btn rounded-2xl px-4 py-2 text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Coins className="w-4 h-4" />
                <span>شحن الكوينز</span>
                <ArrowLeft className="w-4 h-4" />
              </button>
            </div>
          </div>

          {frameTab === 'gift' && (
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
                  👑 تهانينا! تم فتح جميع إطارات الشحن التراكمي في المتجر!
                </p>
              )}
            </div>
          )}
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

        {/* Two Store Frame Tabs */}
        <div className="grid grid-cols-2 gap-2 p-1.5 rounded-2xl bg-white border border-slate-200 shadow-sm">
          <button
            type="button"
            onClick={() => setFrameTab('coins')}
            className={`min-h-[44px] rounded-xl text-xs sm:text-sm font-extrabold flex items-center justify-center gap-1.5 cursor-pointer transition ${
              frameTab === 'coins' ? 'emerald-btn' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Coins className="w-4 h-4" />
            <span>شراء عبر الكوينز</span>
          </button>

          <button
            type="button"
            onClick={() => setFrameTab('gift')}
            className={`min-h-[44px] rounded-xl text-xs sm:text-sm font-extrabold flex items-center justify-center gap-1.5 cursor-pointer transition ${
              frameTab === 'gift' ? 'emerald-btn' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Gift className="w-4 h-4" />
            <span>إطار هدية / مكافأة</span>
          </button>
        </div>

        {/* Tab Content: Frames & Entrances */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="light-card rounded-3xl h-56 animate-pulse" />
            ))}
          </div>
        ) : frameTab === 'coins' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {coinItems.map((item) => {
              const owned = user.unlockedFrames.includes(item.id);
              const isActive = user.frameId === item.id;
              const price = item.priceCoins ?? 0;

              return (
                <article
                  key={item.id}
                  className="light-card rounded-3xl overflow-hidden flex flex-col justify-between border border-slate-200"
                >
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
                          ? 'إطار 3D + دخولية سيارة 3D'
                          : 'إطار 3D ثلاثي الأبعاد'}
                      </span>
                    </div>
                  </div>

                  <div className="p-4 space-y-3 bg-white">
                    <p className="text-xs text-slate-600 leading-relaxed">{item.subtitle}</p>
                    <div className="flex items-center justify-between text-xs font-mono-num bg-amber-50/70 border border-amber-200/80 rounded-xl px-3 py-2">
                      <span className="font-bold text-amber-900">السعر المباشر</span>
                      <span className="font-black text-amber-700">
                        {price.toLocaleString('en-US')} كوينز 🪙
                      </span>
                    </div>

                    <button
                      type="button"
                      disabled={isActive || busyId === item.id}
                      onClick={() => handleBuyCoinItem(item)}
                      className={`w-full min-h-[44px] rounded-2xl text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer transition ${
                        isActive
                          ? 'bg-emerald-50 border border-emerald-300 text-emerald-700'
                          : 'emerald-btn'
                      }`}
                    >
                      {isActive ? (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>مُفعّل على حسابك الآن</span>
                        </>
                      ) : owned ? (
                        <>
                          <Zap className="w-4 h-4" />
                          <span>{busyId === item.id ? 'جارٍ التفعيل...' : 'مملوك — ارتداء الآن'}</span>
                        </>
                      ) : (
                        <>
                          <Coins className="w-4 h-4" />
                          <span>
                            {busyId === item.id
                              ? 'جارٍ الشراء...'
                              : `شراء الآن بـ ${price.toLocaleString('en-US')} كوينز`}
                          </span>
                        </>
                      )}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {giftItems.map((item) => {
              const isTaskGift = item.purchaseMode === 'gift';
              const unlocked = isTaskGift
                ? user.unlockedFrames.includes(item.id)
                : totalRechargedCoins >= item.minRechargeCoins ||
                  user.unlockedFrames.includes(item.id);
              const isActive = user.frameId === item.id;
              const tierPct = isTaskGift
                ? unlocked
                  ? 100
                  : 0
                : Math.min(
                    100,
                    Math.round(
                      (totalRechargedCoins / Math.max(1, item.minRechargeCoins)) * 100
                    )
                  );

              return (
                <article
                  key={item.id}
                  className="light-card rounded-3xl overflow-hidden flex flex-col justify-between border border-slate-200"
                >
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
                        <Gift className="w-3 h-3" />
                        {item.giftHint || 'هدية ومكافأة خاصة'}
                      </span>
                    </div>
                  </div>

                  <div className="p-4 space-y-3 bg-white">
                    <p className="text-xs text-slate-600 leading-relaxed">{item.subtitle}</p>

                    {!isTaskGift && (
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
                    )}

                    {unlocked ? (
                      <button
                        type="button"
                        disabled={isActive || busyId === item.id}
                        onClick={() => handleEquipGiftItem(item)}
                        className={`w-full min-h-[44px] rounded-2xl text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer transition ${
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
                    ) : isTaskGift ? (
                      <button
                        type="button"
                        onClick={() => navigate('/profile')}
                        className="w-full min-h-[44px] rounded-2xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer transition"
                      >
                        <Gift className="w-4 h-4" />
                        <span>افتحه مجاناً من مهام المضيف (7 أيام متتالية)</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => navigate('/wallet')}
                        className="w-full min-h-[44px] rounded-2xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer transition"
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

        {/* Luxury Agency Room Backgrounds Section (5,000 Coins each) */}
        <section className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-2xl bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-700">
                <ImageIcon className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-black text-slate-900">
                  خلفيات الوكالات الفخمة (5,000 كوينز)
                </h2>
                <p className="text-xs text-slate-500">
                  اقتنِ خلفيات القصور الفاخرة للغرفة الصوتية وطبّقها مباشرة على غرفتك من هنا أو من الحقيبة.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {luxuryBackgrounds.map((bg) => {
              const isOwned = ownedBackgrounds.includes(bg.id);
              return (
                <article
                  key={bg.id}
                  className="light-card rounded-3xl overflow-hidden flex flex-col justify-between border border-slate-200"
                >
                  <div className={`${bg.previewClass} h-32 p-4 text-white flex flex-col justify-between relative overflow-hidden`}>
                    <div className="flex items-center justify-between relative z-10">
                      <span className="text-2xl">{bg.badgeGlyph}</span>
                      <span className="rounded-full bg-black/50 border border-amber-300/50 px-2.5 py-0.5 text-[11px] font-extrabold text-[#FCE9A6] font-mono-num">
                        {bg.priceCoins.toLocaleString('en-US')} 🪙
                      </span>
                    </div>
                    <h3 className="text-sm font-black text-white relative z-10">{bg.name}</h3>
                  </div>

                  <div className="p-4 space-y-3 bg-white">
                    <p className="text-xs text-slate-600 leading-relaxed min-h-[34px]">
                      {bg.subtitle}
                    </p>

                    {isOwned ? (
                      <div className="space-y-2">
                        <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-[11px] font-extrabold text-emerald-700 text-center">
                          مملوكة في الحقيبة ✓
                        </div>
                        <button
                          type="button"
                          disabled={busyId === `apply_${bg.id}`}
                          onClick={() => handleApplyBackground(bg)}
                          className="emerald-btn w-full min-h-[40px] rounded-2xl text-xs font-extrabold cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>
                            {busyId === `apply_${bg.id}` ? 'جارٍ التطبيق...' : 'تطبيق على غرفتي'}
                          </span>
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={busyId === bg.id}
                        onClick={() => handleBuyBackground(bg)}
                        className="gold-btn w-full min-h-[42px] rounded-2xl text-xs font-extrabold cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <Coins className="w-4 h-4" />
                        <span>
                          {busyId === bg.id
                            ? 'جارٍ الشراء...'
                            : `شراء بـ ${bg.priceCoins.toLocaleString('en-US')} كوينز`}
                        </span>
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>

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
