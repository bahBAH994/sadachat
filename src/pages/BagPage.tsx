import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Briefcase,
  CheckCircle2,
  Coins,
  Crown,
  Gem,
  Image as ImageIcon,
  Sparkles,
  Store,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { STORE_3D_ITEMS, STORE_COIN_ITEMS, STORE_LUXURY_BACKGROUNDS } from '../lib/sadaCatalog';
import {
  applyRoomBackgroundToMyRoomInSupabase,
  equipStoreOrBagItemInSupabase,
  getStoreAndBagOverviewFromSupabase,
} from '../lib/sadaWalletService';
import type { FrameItem } from '../types';
import { AvatarWithFrame } from '../components/AvatarWithFrame';

export const BagPage: React.FC = () => {
  const { user, updateLocalUser } = useAuth();
  const navigate = useNavigate();

  const [frames, setFrames] = useState<FrameItem[]>([]);
  const [ownedBackgrounds, setOwnedBackgrounds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(
    null
  );

  const loadBag = useCallback(async () => {
    if (!user?.id) return;
    try {
      const data = await getStoreAndBagOverviewFromSupabase(user.id);
      updateLocalUser(data.user);
      setFrames(data.frames);
      setOwnedBackgrounds(data.ownedBackgrounds);
    } finally {
      setLoading(false);
    }
  }, [user?.id, updateLocalUser]);

  useEffect(() => {
    void loadBag();
  }, [loadBag]);

  if (!user) return null;

  const unlockedItems = frames.filter((f) => user.unlockedFrames.includes(f.id));
  const ownedBgItems = STORE_LUXURY_BACKGROUNDS.filter((bg) =>
    ownedBackgrounds.includes(bg.id)
  );
  const allStoreMeta = [...STORE_3D_ITEMS, ...STORE_COIN_ITEMS];

  const handleEquip = async (itemId: string) => {
    setBusy(true);
    setFeedback(null);
    try {
      const updated = await equipStoreOrBagItemInSupabase(user, itemId);
      updateLocalUser(updated);
      setFeedback({
        type: 'ok',
        text: 'تم تفعيل العنصر وتحديث إطلالتك على المايك بنجاح!',
      });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'تعذّر تفعيل العنصر.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleApplyBackground = async (bgId: string, bgName: string) => {
    setBusy(true);
    setFeedback(null);
    try {
      await applyRoomBackgroundToMyRoomInSupabase(user, bgId);
      setFeedback({
        type: 'ok',
        text: `تم تطبيق خلفية "${bgName}" على غرفتك الصوتية بنجاح!`,
      });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'تعذّر تطبيق الخلفية على غرفتك.',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F6FA] pb-28">
      <div className="max-w-4xl mx-auto px-4 pt-4 space-y-5">
        {/* Crisp Bag & Coins Header */}
        <section className="rounded-3xl bg-gradient-to-br from-[#0F172A] via-[#132238] to-[#064E3B] p-5 sm:p-6 text-white shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/20 border border-amber-300/40 px-3 py-1 text-[11px] font-bold text-[#FCE9A6]">
              <Briefcase className="w-3.5 h-3.5" />
              <span>الحقيبة الملكية — ممتلكاتي</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold">
              الإطارات، الدخوليات، وخلفيات الغرف المملوكة
            </h1>
            <p className="text-xs text-slate-300">
              فعّل إطاراتك 3D ودخولياتك وخلفيات القصور الفخمة التي اقتنيتها في صَدَى.
            </p>
          </div>

          <div className="rounded-2xl bg-white/10 border border-white/15 px-5 py-3 text-center shrink-0">
            <span className="block text-[11px] text-amber-200 font-bold">رصيد الكوينز</span>
            <div className="flex items-center justify-center gap-1.5 mt-1">
              <Coins className="w-5 h-5 text-amber-300" />
              <span className="text-2xl font-black font-mono-num text-[#FCE9A6]">
                {user.coins.toLocaleString('en-US')}
              </span>
            </div>
          </div>
        </section>

        {/* Quick Link to Diamond Wallet */}
        <div className="light-card rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
            <Gem className="w-4 h-4 text-sky-500" />
            <span>هل تبحث عن تحويل أرباح الألماس أو سحب USDT؟</span>
          </div>
          <button
            type="button"
            onClick={() => navigate('/diamond-wallet')}
            className="rounded-xl bg-sky-50 hover:bg-sky-100 border border-sky-200 px-3.5 py-1.5 text-xs font-extrabold text-sky-700 cursor-pointer"
          >
            فتح محفظة الألماس المستقلة ←
          </button>
        </div>

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

        {user.activeEntryName && (
          <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Sparkles className="w-5 h-5 text-amber-600 shrink-0" />
              <div>
                <p className="text-xs font-extrabold text-amber-950">
                  الدخولية المفعلة حالياً: {user.activeEntryName}
                </p>
                <p className="text-[11px] text-amber-700">
                  تظهر تلقائياً عند دخولك أي وكالة صوتية!
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Owned 3D Frames & Entrances */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
              <Crown className="w-5 h-5 text-amber-500" />
              <span>إطاراتي ودخولياتي ({unlockedItems.length})</span>
            </h2>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[1, 2].map((i) => (
                <div key={i} className="light-card rounded-3xl h-28 animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {unlockedItems.map((frame) => {
                const isEquipped = user.frameId === frame.id;
                const storeMeta = allStoreMeta.find((s) => s.id === frame.id);
                return (
                  <div
                    key={frame.id}
                    className="light-card rounded-3xl p-4 flex items-center gap-3.5"
                  >
                    <AvatarWithFrame
                      src={user.avatarUrl}
                      alt={frame.name}
                      frameId={frame.id}
                      size="md"
                    />
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-1">
                        {storeMeta && <span>{storeMeta.badgeGlyph}</span>}
                        <h3 className="text-sm font-extrabold text-slate-900 truncate">
                          {frame.name}
                        </h3>
                      </div>
                      <p className="text-[11px] text-slate-500 line-clamp-2">
                        {frame.description}
                      </p>
                      <button
                        type="button"
                        disabled={isEquipped || busy}
                        onClick={() => handleEquip(frame.id)}
                        className={`mt-1 min-h-[36px] rounded-xl px-3.5 py-1.5 text-[11px] font-extrabold cursor-pointer transition inline-flex items-center gap-1 ${
                          isEquipped
                            ? 'bg-emerald-50 border border-emerald-300 text-emerald-700'
                            : 'emerald-btn'
                        }`}
                      >
                        {isEquipped ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>مُفعّل الآن</span>
                          </>
                        ) : (
                          <span>تفعيل وارتداء</span>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Owned Luxury Room Backgrounds */}
        <section className="space-y-3">
          <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-emerald-600" />
            <span>خلفيات الوكالات المملوكة ({ownedBgItems.length})</span>
          </h2>

          {ownedBgItems.length === 0 ? (
            <div className="light-card rounded-3xl p-6 text-center space-y-3">
              <p className="text-xs font-bold text-slate-600">
                لم تشترِ أي خلفية وكالة فخمة بعد. يمكنك اقتناء خلفيات القصور الفاخرة من المتجر بـ 5,000 كوينز!
              </p>
              <button
                type="button"
                onClick={() => navigate('/store')}
                className="emerald-btn rounded-2xl px-5 py-2.5 text-xs font-extrabold cursor-pointer inline-flex items-center gap-2"
              >
                <Store className="w-4 h-4" />
                <span>تصفح المتجر والخلفيات</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {ownedBgItems.map((bg) => (
                <div
                  key={bg.id}
                  className="light-card rounded-3xl overflow-hidden border border-slate-200 flex flex-col justify-between"
                >
                  <div className={`${bg.previewClass} h-24 p-3.5 text-white flex items-end justify-between`}>
                    <span className="text-xs font-black">{bg.name}</span>
                    <span className="text-xl">{bg.badgeGlyph}</span>
                  </div>
                  <div className="p-3.5 bg-white space-y-2.5">
                    <p className="text-[11px] text-slate-500 line-clamp-2">{bg.subtitle}</p>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleApplyBackground(bg.id, bg.name)}
                      className="emerald-btn w-full min-h-[38px] rounded-xl text-xs font-extrabold cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>تطبيق على غرفتي</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="flex justify-center pt-1">
          <button
            type="button"
            onClick={() => navigate('/store')}
            className="emerald-btn rounded-2xl px-6 py-2.5 text-xs font-extrabold cursor-pointer flex items-center gap-2"
          >
            <Store className="w-4 h-4" />
            <span>الانتقال إلى المتجر لاقتناء المزيد</span>
          </button>
        </div>
      </div>
    </div>
  );
};
