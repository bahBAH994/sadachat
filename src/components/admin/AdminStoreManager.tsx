import React, { useCallback, useEffect, useState } from 'react';
import { Trash2, Upload } from 'lucide-react';
import {
  addStoreItem,
  deleteStoreItem,
  getStoreItems,
  type StoreCategory,
  type StoreItem,
} from '../../lib/sadaStoreService';

const CATEGORIES: Array<{ value: StoreCategory; label: string }> = [
  { value: 'frames', label: 'إطار' },
  { value: 'entrances', label: 'دخولية' },
  { value: 'backgrounds', label: 'خلفية' },
];

export const AdminStoreManager: React.FC = () => {
  const [items, setItems] = useState<StoreItem[]>([]);
  const [category, setCategory] = useState<StoreCategory>('frames');
  const [name, setName] = useState('');
  const [priceCoins, setPriceCoins] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(
    null
  );

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await getStoreItems());
    } catch (error) {
      setMessage({
        type: 'err',
        text: error instanceof Error ? error.message : 'تعذّر تحميل عناصر المتجر.',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const handleAdd = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsedPrice = Number(priceCoins);
    if (!name.trim()) {
      setMessage({ type: 'err', text: 'أدخل اسم العنصر.' });
      return;
    }
    if (!Number.isSafeInteger(parsedPrice) || parsedPrice < 0) {
      setMessage({ type: 'err', text: 'أدخل سعراً صحيحاً بالكوينز.' });
      return;
    }
    if (!file) {
      setMessage({ type: 'err', text: 'اختر ملف صورة أو ملفاً متحركاً.' });
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      await addStoreItem({ category, name: name.trim(), priceCoins: parsedPrice, file });
      setName('');
      setPriceCoins('');
      setFile(null);
      const input = document.getElementById('admin-store-asset') as HTMLInputElement | null;
      if (input) input.value = '';
      setMessage({ type: 'ok', text: 'تمت إضافة العنصر إلى المتجر.' });
      await loadItems();
    } catch (error) {
      setMessage({
        type: 'err',
        text: error instanceof Error ? error.message : 'تعذّر إضافة العنصر.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: StoreItem) => {
    if (!window.confirm(`هل تريد حذف «${item.name}» من المتجر؟`)) return;
    setBusyId(item.id);
    setMessage(null);
    try {
      await deleteStoreItem(item.id);
      setItems((current) => current.filter((entry) => entry.id !== item.id));
      setMessage({ type: 'ok', text: `تم حذف «${item.name}».` });
    } catch (error) {
      setMessage({
        type: 'err',
        text: error instanceof Error ? error.message : 'تعذّر حذف العنصر.',
      });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="space-y-5">
      <header>
        <h2 className="text-xl font-extrabold text-[#FCE9A6]">
          إدارة المتجر (الإطارات، الدخوليات، الخلفيات)
        </h2>
        <p className="mt-1 text-xs text-slate-400">
          تُحفظ العناصر وملفاتها في Supabase وتظهر مباشرةً في القسم المحدد.
        </p>
      </header>

      {message && (
        <div
          role="status"
          className={`rounded-xl border px-4 py-3 text-sm font-bold ${
            message.type === 'ok'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
              : 'border-rose-500/30 bg-rose-500/10 text-rose-200'
          }`}
        >
          {message.text}
        </div>
      )}

      <form
        onSubmit={(event) => void handleAdd(event)}
        className="grid gap-3 rounded-3xl border border-[#D4AF37]/20 bg-[#0B0F20] p-4 sm:grid-cols-2"
      >
        <label className="space-y-1 text-xs font-bold text-slate-300">
          القسم
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value as StoreCategory)}
            className="min-h-[42px] w-full rounded-xl border border-white/10 bg-[#141927] px-3 text-sm text-white"
          >
            {CATEGORIES.map((entry) => (
              <option key={entry.value} value={entry.value}>
                {entry.label}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1 text-xs font-bold text-slate-300">
          الاسم
          <input
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={100}
            className="min-h-[42px] w-full rounded-xl border border-white/10 bg-[#141927] px-3 text-sm text-white"
          />
        </label>

        <label className="space-y-1 text-xs font-bold text-slate-300">
          السعر بالكوينز
          <input
            required
            type="number"
            min="0"
            step="1"
            value={priceCoins}
            onChange={(event) => setPriceCoins(event.target.value)}
            className="min-h-[42px] w-full rounded-xl border border-white/10 bg-[#141927] px-3 text-sm text-white"
          />
        </label>

        <label className="space-y-1 text-xs font-bold text-slate-300">
          ملف صورة أو ملف متحرك
          <input
            id="admin-store-asset"
            required
            type="file"
            accept="image/*,video/*"
            onChange={(event) => setFile(event.target.files?.[0] || null)}
            className="block min-h-[42px] w-full rounded-xl border border-white/10 bg-[#141927] px-3 py-2 text-xs text-slate-300 file:me-3 file:rounded-lg file:border-0 file:bg-[#D4AF37] file:px-3 file:py-1 file:font-bold file:text-slate-950"
          />
        </label>

        <button
          type="submit"
          disabled={saving}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-[#D4AF37] px-4 text-sm font-extrabold text-slate-950 disabled:opacity-60 sm:col-span-2"
        >
          <Upload className="h-4 w-4" />
          {saving ? 'جارٍ رفع العنصر...' : 'إضافة إلى المتجر'}
        </button>
      </form>

      <div className="space-y-3">
        <h3 className="text-sm font-extrabold text-white">العناصر الحالية</h3>
        {loading ? (
          <div className="h-24 animate-pulse rounded-2xl bg-[#141927]" />
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-[#0B0F20] p-5 text-center text-sm text-slate-400">
            لا توجد عناصر مضافة في المتجر.
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <article
                key={item.id}
                className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#0B0F20] p-3"
              >
                {/\.(mp4|webm|mov|m4v)(?:$|[?#])/i.test(item.assetPath) ? (
                  <video
                    src={item.assetUrl}
                    className="h-14 w-14 rounded-xl bg-black/30 object-cover"
                    muted
                    playsInline
                  />
                ) : (
                  <img
                    src={item.assetUrl}
                    alt=""
                    className="h-14 w-14 rounded-xl bg-black/30 object-cover"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-extrabold text-white">{item.name}</p>
                  <p className="mt-1 text-[11px] text-slate-400">
                    {CATEGORIES.find((entry) => entry.value === item.category)?.label} ·{' '}
                    {item.priceCoins.toLocaleString('en-US')} كوينز
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busyId === item.id}
                  onClick={() => void handleDelete(item)}
                  aria-label={`حذف ${item.name}`}
                  className="inline-flex min-h-[38px] shrink-0 items-center gap-1 rounded-xl border border-rose-500/30 px-3 text-xs font-bold text-rose-200 disabled:opacity-60"
                >
                  <Trash2 className="h-4 w-4" />
                  حذف
                </button>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
