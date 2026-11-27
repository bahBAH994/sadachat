import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Coins, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  getMyStoreItems,
  removeStoreItemFromBag,
  setStoreItemEquipped,
  type OwnedStoreItem,
  type StoreCategory,
} from '../lib/sadaStoreService';

const BAG_TABS: Array<{ id: StoreCategory; label: string }> = [
  { id: 'frames', label: 'إطارات' },
  { id: 'entrances', label: 'دخوليات' },
  { id: 'backgrounds', label: 'خلفيات' },
];

export const BagPage: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<StoreCategory>('frames');
  const [items, setItems] = useState<OwnedStoreItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(
    null
  );

  const loadBag = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setItems([]);
    setFeedback(null);
    try {
      setItems(await getMyStoreItems(user.id, activeTab));
    } catch (error) {
      setFeedback({
        type: 'err',
        text: error instanceof Error ? error.message : 'تعذّر تحميل الحقيبة.',
      });
    } finally {
      setLoading(false);
    }
  }, [user?.id, activeTab]);

  useEffect(() => {
    void loadBag();
  }, [loadBag]);

  if (!user) return null;

  const handleEquip = async (item: OwnedStoreItem) => {
    setBusyId(item.id);
    setFeedback(null);
    try {
      await setStoreItemEquipped(user.id, item.id, !item.equipped);
      setItems((current) =>
        current.map((owned) =>
          owned.category === item.category
            ? { ...owned, equipped: owned.id === item.id ? !item.equipped : false }
            : owned
        )
      );
      setFeedback({
        type: 'ok',
        text: item.equipped
          ? `تم إلغاء ارتداء «${item.name}».`
          : `تم ارتداء «${item.name}».`,
      });
    } catch (error) {
      setFeedback({
        type: 'err',
        text: error instanceof Error ? error.message : 'تعذّر تحديث العنصر.',
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (item: OwnedStoreItem) => {
    if (!window.confirm(`هل تريد حذف «${item.name}» نهائياً من حقيبتك؟`)) return;
    setBusyId(item.id);
    setFeedback(null);
    try {
      await removeStoreItemFromBag(user.id, item.id);
      setItems((current) => current.filter((owned) => owned.id !== item.id));
      setFeedback({ type: 'ok', text: `تم حذف «${item.name}» من حقيبتك.` });
    } catch (error) {
      setFeedback({
        type: 'err',
        text: error instanceof Error ? error.message : 'تعذّر حذف العنصر.',
      });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="min-h-full bg-[#F5F6FA] pb-28">
      <div className="mx-auto max-w-4xl space-y-4 px-4 pt-4">
        <div className="flex items-center justify-between rounded-2xl border border-[#D4AF37]/25 bg-white px-4 py-3 shadow-sm">
          <span className="text-sm font-extrabold text-slate-700">رصيد الكوينز</span>
          <span className="inline-flex items-center gap-2 text-lg font-black text-amber-700">
            <Coins className="h-5 w-5 text-[#D4AF37]" />
            {user.coins.toLocaleString('en-US')}
          </span>
        </div>

        <nav
          aria-label="أقسام الحقيبة"
          className="grid grid-cols-3 gap-2 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm"
        >
          {BAG_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              aria-pressed={activeTab === tab.id}
              className={`min-h-[44px] rounded-xl px-2 text-sm font-extrabold transition ${
                activeTab === tab.id
                  ? 'bg-[#D4AF37] text-slate-950'
                  : 'text-slate-600 hover:bg-slate-50'
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
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-rose-200 bg-rose-50 text-rose-700'
            }`}
          >
            {feedback.text}
          </div>
        )}

        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {[1, 2].map((key) => (
              <div key={key} className="h-56 animate-pulse rounded-3xl bg-white" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-3xl border border-slate-200 bg-white px-5 py-12 text-center text-sm font-bold text-slate-600">
            لا توجد عناصر مضافة في هذا القسم حالياً
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {items.map((item) => {
              const isVideo = /\.(mp4|webm|mov|m4v)$/i.test(item.assetPath);
              return (
                <article
                  key={item.id}
                  className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
                >
                  <div className="flex h-48 items-center justify-center bg-slate-100">
                    {isVideo ? (
                      <video
                        src={item.assetUrl}
                        className="h-full w-full object-contain"
                        autoPlay
                        muted
                        loop
                        playsInline
                      />
                    ) : (
                      <img
                        src={item.assetUrl}
                        alt={item.name}
                        className="h-full w-full object-contain"
                        loading="lazy"
                      />
                    )}
                  </div>
                  <div className="space-y-3 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="truncate text-base font-extrabold text-slate-900">
                        {item.name}
                      </h2>
                      {item.equipped && (
                        <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700">
                          مرتدى
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>{item.source === 'reward' ? 'مكافأة' : 'شراء من المتجر'}</span>
                      <span>{item.priceCoins.toLocaleString('en-US')} كوينز</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        disabled={busyId === item.id}
                        onClick={() => void handleEquip(item)}
                        className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl bg-[#D4AF37] px-2 text-xs font-extrabold text-slate-950 disabled:opacity-60"
                      >
                        {item.equipped ? (
                          <>
                            <CheckCircle2 className="h-4 w-4" />
                            إلغاء الارتداء
                          </>
                        ) : (
                          'ارتداء'
                        )}
                      </button>
                      <button
                        type="button"
                        disabled={busyId === item.id}
                        onClick={() => void handleDelete(item)}
                        className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-2 text-xs font-extrabold text-rose-700 disabled:opacity-60"
                      >
                        <Trash2 className="h-4 w-4" />
                        حذف
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
