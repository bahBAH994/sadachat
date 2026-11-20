import React, { useRef, useState } from 'react';
import {
  Gift,
  ImagePlus,
  Megaphone,
  Send,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { getGiftEffectTier } from '../../lib/sadaCatalog';
import { Fluent3DAsset } from '../Fluent3DAsset';
import type { GiftItem, GlobalAdminAnnouncement } from '../../types';

interface AdminGiftsAnnouncementsTabProps {
  customGifts: GiftItem[];
  latestAnnouncement: GlobalAdminAnnouncement | null | undefined;
  onCreateGift: (payload: {
    name: string;
    coinsCost: number;
    glyph?: string;
    imageUrl?: string;
    category: 'fixed' | 'lucky';
  }) => Promise<void>;
  onDeleteGift: (giftId: string) => Promise<void>;
  onSendAnnouncement: (payload: { title?: string; message: string }) => Promise<void>;
}

async function compressGiftImageFile(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('يرجى اختيار ملف صورة صالح (PNG / WebP / JPG).');
  }
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('تعذّر قراءة ملف الصورة.'));
      el.src = objectUrl;
    });

    const maxSize = 256;
    const scale = Math.min(1, maxSize / Math.max(img.width || maxSize, img.height || maxSize));
    const targetW = Math.max(48, Math.round((img.width || maxSize) * scale));
    const targetH = Math.max(48, Math.round((img.height || maxSize) * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('تعذّر معالجة الصورة في المتصفح.');
    }
    ctx.clearRect(0, 0, targetW, targetH);
    ctx.drawImage(img, 0, 0, targetW, targetH);

    // Keep transparency for 3D renders
    return canvas.toDataURL('image/png', 0.92);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export const AdminGiftsAnnouncementsTab: React.FC<AdminGiftsAnnouncementsTabProps> = ({
  customGifts,
  latestAnnouncement,
  onCreateGift,
  onDeleteGift,
  onSendAnnouncement,
}) => {
  // Global Announcement state
  const [annTitle, setAnnTitle] = useState('إعلان إداري عاجل');
  const [annMessage, setAnnMessage] = useState('');
  const [sendingAnn, setSendingAnn] = useState(false);

  // Add Gift state
  const [giftName, setGiftName] = useState('');
  const [giftCoins, setGiftCoins] = useState('500');
  const [giftCategory, setGiftCategory] = useState<'fixed' | 'lucky'>('fixed');
  const [giftGlyph, setGiftGlyph] = useState('🎁');
  const [giftImageUrl, setGiftImageUrl] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [creatingGift, setCreatingGift] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const parsedCoins = Math.max(1, Math.floor(Number(giftCoins) || 0));
  const effectTier = getGiftEffectTier(parsedCoins);

  const handleGiftImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLocalError(null);
    setUploadingImage(true);
    try {
      const dataUrl = await compressGiftImageFile(file);
      setGiftImageUrl(dataUrl);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'تعذّر رفع الصورة.');
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleGiftSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setCreatingGift(true);
    try {
      await onCreateGift({
        name: giftName,
        coinsCost: parsedCoins,
        glyph: giftGlyph,
        imageUrl: giftImageUrl.trim() || undefined,
        category: giftCategory,
      });
      setGiftName('');
      setGiftCoins('500');
      setGiftImageUrl('');
      setGiftGlyph('🎁');
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'تعذّر إضافة الهدية.');
    } finally {
      setCreatingGift(false);
    }
  };

  const handleAnnouncementSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!annMessage.trim()) return;
    setLocalError(null);
    setSendingAnn(true);
    try {
      await onSendAnnouncement({
        title: annTitle.trim() || 'إعلان إداري هام',
        message: annMessage.trim(),
      });
      setAnnMessage('');
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'تعذّر إرسال الإعلان.');
    } finally {
      setSendingAnn(false);
    }
  };

  return (
    <div className="space-y-5">
      {localError && (
        <div className="rounded-2xl border border-rose-500/45 bg-rose-950/60 px-4 py-3 text-xs sm:text-sm text-rose-200">
          {localError}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Global Announcement Top Banner Sender */}
        <section className="lg:col-span-5 royal-glass rounded-3xl p-5 sm:p-6 space-y-4 border border-amber-400/35">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#FDE047] to-[#B45309] text-[#070913] flex items-center justify-center shrink-0">
              <Megaphone className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-[#FCE9A6]">
                إرسال إعلان عام لجميع المستخدمين
              </h2>
              <p className="text-xs text-slate-300">
                يظهر فوراً كشريط علوي بارز فوق شاشات جميع الأعضاء في التطبيق
              </p>
            </div>
          </div>

          <form onSubmit={handleAnnouncementSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                عنوان الإعلان (اختياري)
              </label>
              <input
                type="text"
                maxLength={48}
                value={annTitle}
                onChange={(e) => setAnnTitle(e.target.value)}
                placeholder="مثال: مسابقة الليلة الملكية أو تحديث هام"
                className="w-full min-h-[42px] rounded-xl bg-[#070913]/90 border border-[#D4AF37]/30 px-3.5 text-sm text-white focus:outline-none focus:border-[#D4AF37]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                نص الإعلان العام
              </label>
              <textarea
                rows={4}
                required
                maxLength={260}
                value={annMessage}
                onChange={(e) => setAnnMessage(e.target.value)}
                placeholder="اكتب رسالتك لجميع مستخدمي صَدَى لتظهر في الشريط العلوي..."
                className="w-full rounded-xl bg-[#070913]/90 border border-[#D4AF37]/30 p-3.5 text-sm text-white focus:outline-none focus:border-[#D4AF37]"
              />
              <div className="flex justify-end text-[10px] text-slate-400 font-mono-num mt-1">
                {annMessage.length} / 260
              </div>
            </div>

            <button
              type="submit"
              disabled={sendingAnn || !annMessage.trim()}
              className="gold-btn w-full min-h-[46px] rounded-2xl text-sm font-extrabold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              <span>{sendingAnn ? 'جارٍ البث لجميع المستخدمين...' : 'بث الإعلان العام الآن'}</span>
            </button>
          </form>

          {latestAnnouncement && (
            <div className="rounded-2xl bg-[#070913]/85 border border-amber-400/30 p-3.5 space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-extrabold text-[#FCE9A6]">آخر إعلان منشور:</span>
                <span className="font-mono-num text-slate-400">
                  {new Date(latestAnnouncement.timestamp).toLocaleString('ar-EG')}
                </span>
              </div>
              {latestAnnouncement.title && (
                <p className="text-xs font-extrabold text-amber-200">
                  {latestAnnouncement.title}
                </p>
              )}
              <p className="text-xs text-slate-200 leading-relaxed">
                {latestAnnouncement.message}
              </p>
            </div>
          )}
        </section>

        {/* Add New Gift Form */}
        <section className="lg:col-span-7 royal-glass rounded-3xl p-5 sm:p-6 space-y-4 border border-[#D4AF37]/30">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 flex items-center justify-center shrink-0">
              <Gift className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-[#FCE9A6]">
                إضافة هدية جديدة للغرف والرسائل
              </h2>
              <p className="text-xs text-slate-300">
                أضف الاسم والسعر ورابط صورة 3D أو ارفع صورة شفافة — تدخل الهدية المتجر فوراً
              </p>
            </div>
          </div>

          <form onSubmit={handleGiftSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  اسم الهدية
                </label>
                <input
                  type="text"
                  required
                  value={giftName}
                  onChange={(e) => setGiftName(e.target.value)}
                  placeholder="مثال: صقر الذهب الملكي"
                  className="w-full min-h-[42px] rounded-xl bg-[#070913]/90 border border-[#D4AF37]/30 px-3.5 text-sm text-white focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  السعر (كوينز)
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  value={giftCoins}
                  onChange={(e) => setGiftCoins(e.target.value)}
                  dir="ltr"
                  className="w-full min-h-[42px] rounded-xl bg-[#070913]/90 border border-[#D4AF37]/30 px-3.5 text-sm font-mono-num text-white text-left focus:outline-none focus:border-[#D4AF37]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  تصنيف الهدية
                </label>
                <select
                  value={giftCategory}
                  onChange={(e) => setGiftCategory(e.target.value as 'fixed' | 'lucky')}
                  className="w-full min-h-[42px] rounded-xl bg-[#070913]/90 border border-[#D4AF37]/30 px-3.5 text-xs sm:text-sm font-bold text-white focus:outline-none focus:border-[#D4AF37]"
                >
                  <option value="fixed">هدية فاخرة ثابتة</option>
                  <option value="lucky">هدية حظ مضاعفة 🍀</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  رمز احتياطي (Glyph)
                </label>
                <input
                  type="text"
                  value={giftGlyph}
                  onChange={(e) => setGiftGlyph(e.target.value)}
                  placeholder="🎁"
                  className="w-full min-h-[42px] rounded-xl bg-[#070913]/90 border border-[#D4AF37]/30 px-3.5 text-sm text-white focus:outline-none focus:border-[#D4AF37]"
                />
              </div>
            </div>

            {/* 3D Image URL OR Image Upload */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-300">
                رابط صورة 3D أو رفع صورة من الجهاز
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={giftImageUrl.startsWith('data:') ? '' : giftImageUrl}
                  onChange={(e) => setGiftImageUrl(e.target.value)}
                  dir="ltr"
                  placeholder="https://...png / .webp"
                  className="flex-1 min-h-[44px] rounded-xl bg-[#070913]/90 border border-[#D4AF37]/30 px-3.5 text-xs text-white text-left focus:outline-none focus:border-[#D4AF37]"
                />
                <input
                  ref={fileInputRef}
                  id="admin-gift-image-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleGiftImageUpload}
                  className="hidden"
                />
                <label
                  htmlFor="admin-gift-image-upload"
                  className="min-h-[44px] rounded-xl bg-[#D4AF37]/20 hover:bg-[#D4AF37]/30 border border-[#D4AF37]/45 px-4 text-xs font-extrabold text-[#FCE9A6] flex items-center justify-center gap-2 cursor-pointer shrink-0"
                >
                  <ImagePlus className="w-4 h-4" />
                  <span>{uploadingImage ? 'جارٍ الرفع...' : 'رفع صورة'}</span>
                </label>
              </div>
              {giftImageUrl.startsWith('data:') && (
                <div className="flex items-center justify-between text-[11px] text-emerald-300">
                  <span>تم تجهيز الصورة المرفوعة بنجاح ✓</span>
                  <button
                    type="button"
                    onClick={() => setGiftImageUrl('')}
                    className="text-rose-300 hover:underline cursor-pointer"
                  >
                    إزالة الصورة
                  </button>
                </div>
              )}
            </div>

            {/* Live Gift Preview & Tier Indicator */}
            <div className="rounded-2xl bg-[#070913]/85 border border-[#D4AF37]/25 p-3.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                  <Fluent3DAsset
                    glyph={giftGlyph || '🎁'}
                    imageUrl={giftImageUrl.trim() || undefined}
                    alt={giftName || 'معاينة الهدية'}
                    sizeClass="w-11 h-11"
                    fallbackTextClass="text-3xl"
                    priority
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-extrabold text-white">
                    {giftName.trim() || 'معاينة الهدية الجديدة'}
                  </p>
                  <p className="text-xs font-mono-num font-bold text-[#FCE9A6]">
                    {parsedCoins.toLocaleString('en-US')} كوينز
                  </p>
                </div>
              </div>

              <span
                className={`rounded-xl border px-3 py-1.5 text-[11px] font-extrabold shrink-0 ${
                  effectTier === 3
                    ? 'bg-amber-500/20 border-amber-300/60 text-amber-200'
                    : effectTier === 2
                    ? 'bg-sky-500/20 border-sky-300/60 text-sky-200'
                    : 'bg-emerald-500/20 border-emerald-300/60 text-emerald-200'
                }`}
              >
                {effectTier === 3
                  ? 'عرض سينمائي كامل (1000+)'
                  : effectTier === 2
                  ? 'بطاقة متوهجة (100-999)'
                  : 'هدية خفيفة + Combo (<100)'}
              </span>
            </div>

            <button
              type="submit"
              disabled={creatingGift || uploadingImage || !giftName.trim()}
              className="gold-btn w-full min-h-[46px] rounded-2xl text-sm font-extrabold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              <span>{creatingGift ? 'جارٍ الحفظ...' : 'إضافة الهدية إلى المتجر والغرف'}</span>
            </button>
          </form>
        </section>
      </div>

      {/* Custom Added Gifts List */}
      <section className="royal-glass rounded-3xl p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-extrabold text-[#FCE9A6]">
            الهدايا المضافة من الإدارة ({customGifts.length})
          </h3>
          <span className="text-xs text-slate-400">
            تظهر هذه الهدايا فوراً في صندوق الهدايا داخل الغرف والرسائل الخاصة
          </span>
        </div>

        {customGifts.length === 0 ? (
          <p className="text-xs text-slate-400 py-6 text-center">
            لم تتم إضافة هدايا مخصصة بعد — استخدم النموذج أعلاه لإضافة هدية جديدة.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {customGifts.map((g) => (
              <div
                key={g.id}
                className="rounded-2xl bg-[#070913]/85 border border-[#D4AF37]/25 p-3.5 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                    <Fluent3DAsset
                      glyph={g.glyph}
                      imageUrl={g.imageUrl}
                      alt={g.name}
                      sizeClass="w-10 h-10"
                      fallbackTextClass="text-2xl"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-extrabold text-white truncate">{g.name}</p>
                    <p className="text-xs font-mono-num text-[#FCE9A6]">
                      {g.coinsCost.toLocaleString('en-US')} كوينز ·{' '}
                      <span className="text-slate-400">
                        {g.category === 'lucky' ? 'هدية حظ' : 'ثابتة'}
                      </span>
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => void onDeleteGift(g.id)}
                  className="min-h-[38px] min-w-[38px] rounded-xl bg-rose-950/65 hover:bg-rose-900/75 border border-rose-500/45 text-rose-200 flex items-center justify-center shrink-0 cursor-pointer"
                  aria-label={`حذف هدية ${g.name}`}
                  title="حذف الهدية"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
