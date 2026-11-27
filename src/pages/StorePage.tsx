import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  Image as ImageIcon,
  Lock,
  Sparkles,
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
import { CoinIcon, CrownIcon, GiftIcon, PartyIcon } from '../components/AppIcons';

export const StorePage: React.FC = () => {
  const { user, updateLocalUser } = useAuth();
  const navigate = useNavigate();

  const [frameTab, setFrameTab] = useState<'coins' | 'gift'>('coins');
  const [coinItems, setCoinItems] = useState<Store3DItem[]>([]);
  const [giftItems, setGiftItems] = useState<Store3DItem[]>([]);
  const [luxuryBackgrounds, setLuxuryBackgrounds] = useState<StoreBackgroundItem[]>([]);
  const [ownedBackgrounds, setOwnedBackgrounds] = useState<string[]>([]);
  const [totalRechargedCoins, setTotalRechargedCoins] = useState(0);
  const [agencyBackgroundPrices, setAgencyBackgroundPrices] = useState({
    classic: 10000,
    gold: 25000,
    royal: 50000,
  });
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
      setAgencyBackgroundPrices(data.agencyBackgroundPrices);
    } catch (error) {
      setFeedback({
        type: 'err',
        text: error instanceof Error ? error.message : 'تعذّر تحميل بيانات المتجر.',
      });
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
    <div className="min-h-full bg-[#080B14] text-white pb-28">
      <div className="max-w-4xl mx-auto px-4 pt-4 space-y-5">
        {/* Hero Store Header with Real Coins Balance */}
        <section className="rounded-3xl bg-gradient-to-br from-[#171522] via-[#111522] to-[#241b0e] border border-amber-300/20 p-5 sm:p-6 text-white shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/20 border border-amber-300/40 px-3 py-1 text-[11px] font-bold text-[#FCE9A6]">
                <PartyIcon className="w-4 h-4" />
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
              <div className="rounded-2xl bg-black/20 border border-white/15 px-4 py-2 text-center">
                <span className="block text-[10px] text-amber-200 font-bold">رصيد الكوينز المتاح</span>
                <span className="text-lg font-black text-[#FCE9A6] font-mono-num">
                  <CoinIcon className="inline h-5 w-5 align-[-3px]" /> {user.coins.toLocaleString('en-US')}
                </span>
              </div>
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
                  className="h-full bg-gradient-to-r from-[#9A6D18] via-[#D4AF37] to-[#FCE9A6] transition-all duration-500"
                  style={{ width: `${overallProgress}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[10px] font-mono-num text-slate-300">
                <span>1,000 🏎️</span>
                <span>5,000 🦅</span>
                <span>20,000 <CrownIcon className="inline h-3 w-3" /></span>
                <span>50,000 🐉</span>
              </div>

              {nextLocked ? (
                <p className="text-xs text-slate-200 font-semibold">
                  المتبقي لفتح «{nextLocked.name}»: {(nextLocked.minRechargeCoins - totalRechargedCoins).toLocaleString('en-US')} كوينز شحن إضافي
                </p>
              ) : (
                <p className="text-xs text-[#FCE9A6] font-extrabold">
                  <CrownIcon className="inline h-4 w-4 align-[-3px]" /> تهانينا! تم فتح جميع إطارات الشحن التراكمي في المتجر!
                </p>
              )}
            </div>
          )}
        </section>

        {feedback && (
          <div
            className={`rounded-2xl px-4 py-3 text-xs font-bold border ${
              feedback.type === 'ok'
                ? 'bg-amber-400/10 border-amber-300/20 text-[#FCE9A6]'
                : 'bg-rose-400/10 border-rose-300/20 text-rose-200'
            }`}
          >
            {feedback.text}
          </div>
        )}

        {/* Two Store Frame Tabs */}
        <div className="grid grid-cols-2 gap-2 p-1.5 rounded-2xl bg-[#141927] border border-white/10 shadow-sm">
          <button
            type="button"
            onClick={() => setFrameTab('coins')}
            className={`min-h-[44px] rounded-xl text-xs sm:text-sm font-extrabold flex items-center justify-center gap-1.5 cursor-pointer transition ${
              frameTab === 'coins' ? 'gold-btn' : 'text-slate-300 hover:bg-white/5'
            }`}
          >
            <CoinIcon className="w-4 h-4" />
            <span>شراء عبر الكوينز</span>
          </button>

          <button
            type="button"
            onClick={() => setFrameTab('gift')}
            className={`min-h-[44px] rounded-xl text-xs sm:text-sm font-extrabold flex items-center justify-center gap-1.5 cursor-pointer transition ${
              frameTab === 'gift' ? 'gold-btn' : 'text-slate-300 hover:bg-white/5'
            }`}
          >
            <GiftIcon className="w-4 h-4" />
            <span>إطار هدية / مكافأة</span>
          </button>
        </div>

        {/* Tab Content: Frames & Entrances */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="rounded-3xl bg-[#141927] border border-white/10 h-56 animate-pulse" />
            ))}
          </div>
        ) : frameTab === 'coins' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {coinItems.length > 0 ? coinItems.map((item) => {
              const owned = user.unlockedFrames.includes(item.id);
              const isActive = user.frameId === item.id;
              const price = item.priceCoins ?? 0;

              return (
                <article
                  key={item.id}
                  className="rounded-3xl overflow-hidden bg-[#141927] flex flex-col justify-between border border-white/10"
                >
                  <div
                    className={`bg-gradient-to-br ${item.previewGradient} p-5 text-white flex items-center gap-4 relative`}
                  >
                    <AvatarWithFrame
                      src={user.avatarUrl}
                      alt={item.name}
                      frameId={item.id}
                      size="xl"
                      customSizeClass="w-28 h-28"
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

                  <div className="p-4 space-y-3 bg-[#141927]">
                    <p className="text-xs text-slate-300 leading-relaxed">{item.subtitle}</p>
                    <div className="flex items-center justify-between text-xs font-mono-num bg-amber-400/5 border border-amber-300/20 rounded-xl px-3 py-2">
                      <span className="font-bold text-[#FCE9A6]">السعر المباشر</span>
                      <span className="font-black text-[#FCE9A6]">
                        {price.toLocaleString('en-US')} كوينز <CoinIcon className="inline h-3.5 w-3.5 align-[-2px]" />
                      </span>
                    </div>

                    <button
                      type="button"
                      disabled={isActive || busyId === item.id}
                      onClick={() => handleBuyCoinItem(item)}
                      className={`w-full min-h-[44px] rounded-2xl text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer transition ${
                        isActive
                          ? 'bg-amber-400/10 border border-amber-300/25 text-[#FCE9A6]'
                          : 'gold-btn'
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
                          <CoinIcon className="w-4 h-4" />
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
            }) : (
              <div className="sm:col-span-2 rounded-3xl bg-[#141927] border border-amber-300/20 p-8 text-center">
                <Sparkles className="w-8 h-8 text-[#D4AF37] mx-auto mb-3" />
                <p className="text-sm font-extrabold text-[#FCE9A6]">قريباً.. تشكيلة ملكية فاخرة قيد التجهيز ✨</p>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {giftItems.length > 0 ? giftItems.map((item) => {
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
                  className="rounded-3xl overflow-hidden bg-[#141927] flex flex-col justify-between border border-white/10"
                >
                  <div
                    className={`bg-gradient-to-br ${item.previewGradient} p-5 text-white flex items-center gap-4 relative`}
                  >
                    <AvatarWithFrame
                      src={user.avatarUrl}
                      alt={item.name}
                      frameId={item.id}
                      size="xl"
                      customSizeClass="w-28 h-28"
                    />
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xl">{item.badgeGlyph}</span>
                        <h2 className="text-base font-extrabold text-white">{item.name}</h2>
                      </div>
                      <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-0.5 text-[10px] font-bold text-[#FCE9A6]">
                        <GiftIcon className="w-3 h-3" />
                        {item.giftHint || 'هدية ومكافأة خاصة'}
                      </span>
                    </div>
                  </div>

                  <div className="p-4 space-y-3 bg-[#141927]">
                    <p className="text-xs text-slate-300 leading-relaxed">{item.subtitle}</p>

                    {!isTaskGift && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px] font-mono-num">
                          <span className="text-slate-400 font-bold">شرط الفتح التراكمي</span>
                          <span className="font-extrabold text-white">
                            {item.minRechargeCoins.toLocaleString('en-US')} كوينز
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                          <div
                            className={`h-full transition-all duration-500 ${
                              unlocked ? 'bg-[#D4AF37]' : 'bg-amber-400/70'
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
                            ? 'bg-amber-400/10 border border-amber-300/25 text-[#FCE9A6]'
                            : 'gold-btn'
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
                        <GiftIcon className="w-4 h-4" />
                        <span>افتحه مجاناً من مهام المضيف (7 أيام متتالية)</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => navigate('/wallet')}
                        className="w-full min-h-[44px] rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer transition"
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
            }) : (
              <div className="sm:col-span-2 rounded-3xl bg-[#141927] border border-amber-300/20 p-8 text-center">
                <GiftIcon className="w-8 h-8 text-[#D4AF37] mx-auto mb-3" />
                <p className="text-sm font-extrabold text-[#FCE9A6]">قريباً.. تشكيلة ملكية فاخرة قيد التجهيز ✨</p>
              </div>
            )}
          </div>
        )}

        {/* Royal agency backgrounds */}
        <section className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-2xl bg-amber-400/10 border border-amber-300/25 flex items-center justify-center text-[#FCE9A6]">
                <ImageIcon className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-black text-white">
                  خلفيات الوكالات الفخمة
                </h2>
                <p className="text-xs text-slate-400">
                  اقتنِ خلفيات القصور الفاخرة للغرفة الصوتية وطبّقها مباشرة على غرفتك من هنا أو من الحقيبة.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {loading ? (
              <div className="sm:col-span-2 lg:col-span-3 h-44 rounded-3xl bg-[#141927] border border-white/10 animate-pulse" />
            ) : luxuryBackgrounds.length > 0 ? luxuryBackgrounds.map((bg) => {
              const isOwned = ownedBackgrounds.includes(bg.id);
              const backgroundPrice = agencyBackgroundPrices[bg.tier];
              const tierLabel =
                bg.tier === 'classic' ? 'كلاسيكية' : bg.tier === 'gold' ? 'ذهبية' : 'ملكية VIP';
              return (
                <article
                  key={bg.id}
                  className="rounded-3xl overflow-hidden bg-[#141927] flex flex-col justify-between border border-white/10"
                >
                  <div className={`${bg.previewClass} h-32 p-4 text-white flex flex-col justify-between relative overflow-hidden`}>
                    <div className="flex items-center justify-between relative z-10">
                      <span className="text-2xl">{bg.badgeGlyph}</span>
                      <div className="flex flex-col items-end gap-1">
                        <span className="rounded-full bg-black/50 border border-amber-300/50 px-2.5 py-0.5 text-[10px] font-extrabold text-[#FCE9A6]">
                          الفئة {tierLabel}
                        </span>
                        <span className="rounded-full bg-black/50 border border-amber-300/50 px-2.5 py-0.5 text-[11px] font-extrabold text-[#FCE9A6] font-mono-num">
                          {backgroundPrice.toLocaleString('en-US')} <CoinIcon className="inline h-3.5 w-3.5 align-[-2px]" />
                        </span>
                      </div>
                    </div>
                    <h3 className="text-sm font-black text-white relative z-10">{bg.name}</h3>
                  </div>

                  <div className="p-4 space-y-3 bg-[#141927]">
                    <p className="text-xs text-slate-300 leading-relaxed min-h-[34px]">
                      {bg.subtitle}
                    </p>

                    {isOwned ? (
                      <div className="space-y-2">
                        <div className="rounded-xl bg-amber-400/10 border border-amber-300/20 px-3 py-1.5 text-[11px] font-extrabold text-[#FCE9A6] text-center">
                          مملوكة في الحقيبة ✓
                        </div>
                        <button
                          type="button"
                          disabled={busyId === `apply_${bg.id}`}
                          onClick={() => handleApplyBackground(bg)}
                          className="gold-btn w-full min-h-[40px] rounded-2xl text-xs font-extrabold cursor-pointer flex items-center justify-center gap-1.5"
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
                        <CoinIcon className="w-4 h-4" />
                        <span>
                          {busyId === bg.id
                            ? 'جارٍ الشراء...'
                            : `شراء بـ ${backgroundPrice.toLocaleString('en-US')} كوينز`}
                        </span>
                      </button>
                    )}
                  </div>
                </article>
              );
            }) : (
              <div className="sm:col-span-2 lg:col-span-3 rounded-3xl bg-[#141927] border border-amber-300/20 p-8 text-center">
                <ImageIcon className="w-8 h-8 text-[#D4AF37] mx-auto mb-3" />
                <p className="text-sm font-extrabold text-[#FCE9A6]">قريباً.. تشكيلة ملكية فاخرة قيد التجهيز ✨</p>
              </div>
            )}
          </div>
        </section>

        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => navigate('/bag')}
            className="rounded-2xl bg-[#141927] border border-white/10 px-5 py-2.5 text-xs font-extrabold text-[#FCE9A6] hover:border-amber-300/40 cursor-pointer flex items-center gap-2 shadow-sm"
          >
            <CrownIcon className="w-4 h-4" />
            <span>الانتقال إلى الحقيبة وممتلكاتي</span>
          </button>
        </div>
      </div>
    </div>
  );
};
