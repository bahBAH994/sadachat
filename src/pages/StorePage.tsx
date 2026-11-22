import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
  Tag,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  applyRoomBackgroundToMyRoomInSupabase,
  equipStoreOrBagItemInSupabase,
  getStoreAndBagOverviewFromSupabase,
  purchaseRoomBackgroundInSupabase,
  purchaseStoreCoinItemInSupabase,
  purchaseVipIdInSupabase,
} from '../lib/sadaWalletService';
import { getPlatformState } from '../lib/sadaMappers';
import { VIP_IDS_CATALOG, type VipIdItem } from '../lib/sadaCatalog';
import type { Store3DItem, StoreBackgroundItem } from '../types';
import { AvatarWithFrame } from '../components/AvatarWithFrame';

const RoyalBackdropPreview: React.FC<{ backgroundId: string }> = ({ backgroundId }) => {
  const isEmerald = backgroundId === 'bg_emerald_palace';
  const isRuby = backgroundId === 'bg_ruby_throne';
  const isSapphire = backgroundId === 'bg_sapphire_crystal';
  const accent = isEmerald ? '#FDE047' : isRuby ? '#FDBA74' : '#BAE6FD';

  return (
    <div
      aria-hidden="true"
      className={`royal-store-preview pointer-events-none absolute inset-0 overflow-hidden ${
        isEmerald
          ? 'royal-store-preview-emerald'
          : isRuby
          ? 'royal-store-preview-ruby'
          : isSapphire
          ? 'royal-store-preview-sapphire'
          : ''
      }`}
    >
      <svg viewBox="0 0 360 128" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full opacity-75">
        {isEmerald ? (
          <>
            <path d="M22 130V72C22 24 68 8 95 8s73 16 73 64v58M192 130V72c0-48 38-64 73-64s73 16 73 64v58" fill="none" stroke={accent} strokeOpacity=".5" strokeWidth="2" />
            <path d="M36 129V76c0-37 27-54 59-54s59 17 59 54v53M207 129V76c0-37 26-54 58-54s58 17 58 54v53" fill="none" stroke="#A7F3D0" strokeOpacity=".45" />
            <path d="M180 11l10 17 20 3-15 14 4 20-19-10-19 10 4-20-15-14 20-3z" fill="#FDE047" fillOpacity=".42" />
            <path d="M145 0v34m70-34v34m-82 0h94" stroke={accent} strokeOpacity=".55" />
          </>
        ) : isRuby ? (
          <>
            <path d="M0 0h74c-31 34-16 80 0 128H0zM360 0h-74c31 34 16 80 0 128h74z" fill="#881337" fillOpacity=".5" />
            <path d="M180 16l28 30-28 43-28-43z" fill="#FB7185" fillOpacity=".25" stroke={accent} strokeOpacity=".7" />
            <path d="M80 21l45 2m109 84 54 2M42 70l35-6" stroke={accent} strokeWidth="1.5" strokeOpacity=".75" className="royal-scene-meteor" />
            <circle cx="180" cy="50" r="44" fill="none" stroke={accent} strokeOpacity=".3" />
          </>
        ) : (
          <>
            <polygon points="180,8 256,54 220,126 140,126 104,54" fill="#38BDF8" fillOpacity=".18" stroke="#BAE6FD" strokeOpacity=".65" />
            <polygon points="180,8 180,126 104,54" fill="#E0F2FE" fillOpacity=".15" />
            <polygon points="180,8 256,54 180,126" fill="#2563EB" fillOpacity=".2" />
            <path d="M34 32l18 25-18 25-18-25zM320 16l15 21-15 21-15-21z" fill="none" stroke="#E0F2FE" strokeOpacity=".8" className="royal-scene-glint" />
            <path d="M62 112c42-34 75-34 118 0s76 34 118 0" fill="none" stroke="#7DD3FC" strokeOpacity=".6" strokeWidth="2" />
          </>
        )}
      </svg>
      <div className="royal-gold-particles absolute inset-0">
        {Array.from({ length: 10 }, (_, index) => (
          <span
            key={index}
            className="royal-gold-particle"
            style={{
              left: `${8 + ((index * 17) % 88)}%`,
              animationDelay: `${(index % 5) * -0.7}s`,
              backgroundColor: accent,
              color: accent,
            }}
          />
        ))}
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/10" />
    </div>
  );
};

export const StorePage: React.FC = () => {
  const { user, updateLocalUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [frameTab, setFrameTab] = useState<'coins' | 'gift'>('coins');
  const [storeTab, setStoreTab] = useState<'frames' | 'ids'>(
    searchParams.get('tab') === 'ids' ? 'ids' : 'frames'
  );
  const [idTab, setIdTab] = useState<'triple' | 'quad' | 'quint'>('triple');
  const [customVipIds, setCustomVipIds] = useState<Record<string, string>>({});
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
      const state = await getPlatformState();
      updateLocalUser(data.user);
      setCoinItems(data.coinStoreItems);
      setGiftItems(data.storeItems);
      setLuxuryBackgrounds(data.luxuryBackgrounds);
      setOwnedBackgrounds(data.ownedBackgrounds);
      setTotalRechargedCoins(data.totalRechargedCoins);
      setCustomVipIds(state.settings.customVipIds || {});
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

  const handleBuyVipId = async (vipId: VipIdItem) => {
    setBusyId(vipId.id);
    setFeedback(null);
    try {
      const result = await purchaseVipIdInSupabase(user, vipId);
      updateLocalUser(result.user);
      setCustomVipIds(result.customVipIds);
      setFeedback({ type: 'ok', text: `تم شراء ID ${vipId.number} وتفعيله على حسابك.` });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'تعذّر شراء رقم ID.',
      });
    } finally {
      setBusyId(null);
    }
  };

  const visibleVipIds = useMemo(() => {
    const length = idTab === 'triple' ? 3 : idTab === 'quad' ? 4 : 5;
    return VIP_IDS_CATALOG.filter((item) => item.number.length === length);
  }, [idTab]);

  return (
    <div className="min-h-full bg-[#F5F6FA] pb-28">
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

          {storeTab === 'frames' && frameTab === 'gift' && (
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

        <div className="grid grid-cols-2 gap-2 p-1.5 rounded-2xl bg-white border border-slate-200 shadow-sm">
          <button
            type="button"
            onClick={() => setStoreTab('frames')}
            className={`min-h-[44px] rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer ${
              storeTab === 'frames' ? 'emerald-btn' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Crown className="w-4 h-4" />
            <span>الإطارات والخلفيات</span>
          </button>
          <button
            type="button"
            onClick={() => setStoreTab('ids')}
            className={`min-h-[44px] rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer ${
              storeTab === 'ids' ? 'emerald-btn' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Tag className="w-4 h-4" />
            <span>متجر الـ ID المميز</span>
          </button>
        </div>

        {storeTab === 'frames' && (
          <>
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
                  className="light-card rounded-3xl flex flex-col justify-between border border-slate-200"
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
                  className="light-card rounded-3xl flex flex-col justify-between border border-slate-200"
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
                    <RoyalBackdropPreview backgroundId={bg.id} />
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
          </>
        )}

        {storeTab === 'ids' && (
          <section className="space-y-4">
            <div className="rounded-3xl bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-5 text-white border border-indigo-300/20 shadow-xl">
              <div className="flex items-center gap-2 text-amber-200">
                <Tag className="w-5 h-5" />
                <h2 className="text-lg font-black">متجر الأرقام المميزة</h2>
              </div>
              <p className="mt-1 text-xs text-slate-300">
                اختر ID حصرياً؛ بعد الشراء يُربط بحسابك ويظهر مباشرة في الملف الشخصي.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-1.5 rounded-2xl bg-white p-1.5 border border-slate-200">
              {([
                ['triple', 'ثلاثية نادرة'],
                ['quad', 'رباعية ملكية'],
                ['quint', 'خماسية مميزة'],
              ] as const).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setIdTab(id)}
                  className={`min-h-[42px] rounded-xl px-2 text-[11px] sm:text-xs font-extrabold cursor-pointer ${
                    idTab === id ? 'emerald-btn' : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {visibleVipIds.map((vipId) => {
                const owner = Object.entries(customVipIds).find(
                  ([, number]) => number === vipId.number
                );
                const isMine = owner?.[0] === user.id;
                const isOwned = Boolean(owner);
                return (
                  <article
                    key={vipId.id}
                    className="rounded-2xl border border-slate-200 bg-white p-4 flex items-center justify-between gap-3 shadow-sm"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`rounded-lg bg-gradient-to-r ${vipId.highlightClass} px-2 py-1 text-white text-xs`}>
                          {vipId.badge}
                        </span>
                        <strong className="font-mono-num text-xl text-slate-900">{vipId.number}</strong>
                      </div>
                      <p className="mt-1 text-[11px] font-bold text-slate-500">{vipId.title}</p>
                      <p className="mt-1 text-xs font-extrabold text-amber-700">
                        {vipId.priceCoins.toLocaleString('en-US')} كوينز
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={isOwned || busyId === vipId.id}
                      onClick={() => void handleBuyVipId(vipId)}
                      className={`min-h-[44px] shrink-0 rounded-xl px-3 text-xs font-extrabold cursor-pointer ${
                        isMine
                          ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                          : isOwned
                          ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                          : 'gold-btn'
                      }`}
                    >
                      {isMine ? 'مملوك لك' : isOwned ? 'مملوك' : busyId === vipId.id ? 'جارٍ الشراء...' : 'شراء الآن'}
                    </button>
                  </article>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
};
