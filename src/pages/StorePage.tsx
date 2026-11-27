import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Coins, Image, ShoppingBag, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  getMyStoreItems,
  getStoreItems,
  purchaseStoreItem,
  type StoreCategory,
  type StoreItem,
} from '../lib/sadaStoreService';

const STORE_TABS: Array<{ id: StoreCategory; label: string }> = [
  { id: 'frames', label: 'إطارات' },
  { id: 'entrances', label: 'دخوليات' },
  { id: 'backgrounds', label: 'خلفيات' },
];

export const StorePage: React.FC = () => {
  const { user, updateLocalUser } = useAuth();
  const [activeTab, setActiveTab] = useState<StoreCategory>('frames');
  const [items, setItems] = useState<StoreItem[]>([]);
  const [ownedIds, setOwnedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(
    null
  );

  const loadStore = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setItems([]);
    setOwnedIds([]);
    setFeedback(null);
    try {
      const [storeItems, inventory] = await Promise.all([
        getStoreItems(activeTab),
        getMyStoreItems(user.id, activeTab),
      ]);
      setItems(storeItems);
      setOwnedIds(inventory.map((item) => item.id));
    } catch (error) {
      setFeedback({
        type: 'err',
        text: error instanceof Error ? error.message : 'تعذّر تحميل بيانات المتجر.',
      });
    } finally {
      setLoading(false);
    }
  }, [user?.id, activeTab]);

  useEffect(() => {
    void loadStore();
  }, [loadStore]);

  if (!user) return null;

  const handlePurchase = async (item: StoreItem) => {
    setBusyId(item.id);
    setFeedback(null);
    try {
      const coins = await purchaseStoreItem(user.id, item.id);
      updateLocalUser({ ...user, coins });
      setOwnedIds((current) => [...current, item.id]);
      setFeedback({ type: 'ok', text: `تمت إضافة «${item.name}» إلى حقيبتك.` });
    } catch (error) {
      setFeedback({
        type: 'err',
        text: error instanceof Error ? error.message : 'تعذّر إتمام الشراء.',
      });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="min-h-full bg-[#080B14] text-white pb-28">
      <div className="max-w-4xl mx-auto px-4 pt-4 space-y-4">
        <div className="flex items-center justify-between rounded-2xl border border-[#D4AF37]/25 bg-[#141927] px-4 py-3">
          <span className="text-sm font-extrabold text-slate-200">رصيد الكوينز المتاح</span>
          <span className="inline-flex items-center gap-2 text-lg font-black text-[#FCE9A6]">
            <Coins className="h-5 w-5 text-[#D4AF37]" />
            {user.coins.toLocaleString('en-US')}
          </span>
        </div>

        <nav
          aria-label="أقسام المتجر"
          className="grid grid-cols-3 gap-2 rounded-2xl border border-white/10 bg-[#141927] p-1.5"
        >
          {STORE_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              aria-pressed={activeTab === tab.id}
              className={`min-h-[44px] rounded-xl px-2 text-sm font-extrabold transition ${
                activeTab === tab.id
                  ? 'bg-[#D4AF37] text-[#111318]'
                  : 'text-slate-300 hover:bg-white/5'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {feedback && (
          <div
            role="status"
            className={`rounded-xl border px-4 py-3 text-sm font-bold ${
              feedback.type === 'ok'
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                : 'border-rose-500/30 bg-rose-500/10 text-rose-200'
            }`}
          >
            {feedback.text}
          </div>
        )}

        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {[1, 2].map((key) => (
              <div
                key={key}
                className="h-56 animate-pulse rounded-3xl border border-white/10 bg-[#141927]"
              />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-[#141927] px-5 py-12 text-center text-sm font-bold text-slate-300">
            لا توجد عناصر مضافة في هذا القسم حالياً
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {items.map((item) => {
              const isOwned = ownedIds.includes(item.id);
              const isVideo = /\.(mp4|webm|mov|m4v)$/i.test(item.assetPath);
              const isFrameOrEntrance = item.category !== 'backgrounds';
              const artworkClass = `h-full w-full object-contain ${
                isFrameOrEntrance ? 'mix-blend-screen brightness-110 contrast-125' : ''
              }`;
              return (
                <article
                  key={item.id}
                  className="overflow-hidden rounded-3xl border border-white/10 bg-[#141927]"
                >
                  <div className="flex h-48 items-center justify-center bg-black/25">
                    {isVideo ? (
                      <video
                        src={item.assetUrl}
                        className={artworkClass}
                        autoPlay
                        muted
                        loop
                        playsInline
                      />
                    ) : (
                      <img
                        src={item.assetUrl}
                        alt={item.name}
                        className={artworkClass}
                        loading="lazy"
                      />
                    )}
                  </div>
                  <div className="space-y-3 p-4">
                    <h2 className="truncate text-base font-extrabold">{item.name}</h2>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-400">السعر</span>
                      <span className="inline-flex items-center gap-1 font-black text-[#FCE9A6]">
                        {item.priceCoins.toLocaleString('en-US')}
                        <Coins className="h-4 w-4 text-[#D4AF37]" />
                      </span>
                    </div>
                    <button
                      type="button"
                      disabled={isOwned || busyId === item.id}
                      onClick={() => void handlePurchase(item)}
                      className={`flex min-h-[42px] w-full items-center justify-center gap-2 rounded-xl text-sm font-extrabold ${
                        isOwned
                          ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                          : 'bg-[#D4AF37] text-[#111318] disabled:opacity-60'
                      }`}
                    >
                      {isOwned ? (
                        <>
                          <CheckCircle2 className="h-4 w-4" />
                          مملوك في الحقيبة
                        </>
                      ) : (
                        <>
                          <ShoppingBag className="h-4 w-4" />
                          {busyId === item.id ? 'جارٍ الشراء...' : 'شراء'}
                        </>
                      )}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <div className="flex justify-center text-xs text-slate-500">
          <span className="inline-flex items-center gap-1">
            <Image className="h-3.5 w-3.5" />
            عناصر المتجر المضافة من الإدارة
          </span>
          <Sparkles className="ms-1 h-3.5 w-3.5 text-[#D4AF37]" />
        </div>
      </div>
    </div>
  );
};
