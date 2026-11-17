import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRightLeft,
  Briefcase,
  CheckCircle2,
  Coins,
  Crown,
  Gem,
  Lock,
  Sparkles,
  Store,
  Wallet,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { isFemaleVoiceLocked, STORE_3D_ITEMS } from '../lib/sadaCatalog';
import {
  convertDiamondsToCoinsInSupabase,
  equipStoreOrBagItemInSupabase,
  getStoreAndBagOverviewFromSupabase,
} from '../lib/sadaWalletService';
import type { FrameItem, Transaction } from '../types';
import { AvatarWithFrame } from '../components/AvatarWithFrame';
import { FemaleVoiceVerificationCard } from '../components/FemaleVoiceVerificationCard';

export const BagPage: React.FC = () => {
  const { user, updateLocalUser } = useAuth();
  const navigate = useNavigate();

  const [tab, setTab] = useState<'diamonds' | 'items'>('diamonds');
  const [frames, setFrames] = useState<FrameItem[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [diamondToCoinsRate, setDiamondToCoinsRate] = useState(2);
  const [convertAmount, setConvertAmount] = useState('100');
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
      setTransactions(data.transactions);
      setDiamondToCoinsRate(data.diamondToCoinsRate);
    } finally {
      setLoading(false);
    }
  }, [user?.id, updateLocalUser]);

  useEffect(() => {
    void loadBag();
  }, [loadBag]);

  if (!user) return null;

  const diamondsLocked = isFemaleVoiceLocked(user);
  const unlockedItems = frames.filter((f) => user.unlockedFrames.includes(f.id));
  const diamondTxs = transactions.filter((t) => t.currency === 'diamonds');

  const handleConvert = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFeedback(null);
    try {
      const updated = await convertDiamondsToCoinsInSupabase(
        user,
        Number(convertAmount) || 0
      );
      updateLocalUser(updated);
      await loadBag();
      setFeedback({ type: 'ok', text: 'تم تحويل الألماس إلى كوينز وإضافتها لمحفظتك.' });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'تعذّر تحويل الألماس.',
      });
    } finally {
      setBusy(false);
    }
  };

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

  return (
    <div className="min-h-screen bg-[#F5F6FA] pb-28">
      <div className="max-w-4xl mx-auto px-4 pt-4 space-y-5">
        {/* Header Card */}
        <section className="rounded-3xl bg-gradient-to-br from-[#0F172A] via-[#132238] to-[#064E3B] p-5 sm:p-6 text-white shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-sky-400/20 border border-sky-300/40 px-3 py-1 text-[11px] font-bold text-sky-200">
              <Briefcase className="w-3.5 h-3.5" />
              <span>الحقيبة الملكية ومحفظة الألماس</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold">
              أرباح الألماس وممتلكاتك الفاخرة
            </h1>
            <p className="text-xs text-slate-300">
              إدارة ألماسك المكتسب من الهدايا والرسائل الخاصة، وتفعيل إطاراتك ودخولياتك المفتوحة.
            </p>
          </div>

          <div className="rounded-2xl bg-white/10 border border-white/15 px-4 py-3 text-center shrink-0">
            <span className="block text-[11px] text-sky-200 font-bold">رصيد الألماس</span>
            <div className="flex items-center justify-center gap-1.5 mt-1">
              <Gem className="w-5 h-5 text-sky-400" />
              <span className="text-2xl font-black font-mono-num">
                {diamondsLocked ? 'مقفل' : user.diamonds.toLocaleString('en-US')}
              </span>
            </div>
          </div>
        </section>

        <FemaleVoiceVerificationCard />

        {/* Tabs */}
        <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-white border border-slate-200">
          <button
            type="button"
            onClick={() => setTab('diamonds')}
            className={`min-h-[42px] rounded-xl text-xs sm:text-sm font-extrabold flex items-center justify-center gap-1.5 cursor-pointer transition ${
              tab === 'diamonds'
                ? 'emerald-btn'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Gem className="w-4 h-4" />
            <span>محفظة الألماس</span>
          </button>

          <button
            type="button"
            onClick={() => setTab('items')}
            className={`min-h-[42px] rounded-xl text-xs sm:text-sm font-extrabold flex items-center justify-center gap-1.5 cursor-pointer transition ${
              tab === 'items'
                ? 'emerald-btn'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Crown className="w-4 h-4" />
            <span>ممتلكاتي ({unlockedItems.length})</span>
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

        {tab === 'diamonds' ? (
          <div className="space-y-4">
            {/* Convert Diamonds -> Coins + Withdraw CTA */}
            <div className="light-card rounded-3xl p-5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm sm:text-base font-extrabold text-slate-900 flex items-center gap-2">
                    <ArrowRightLeft className="w-4 h-4 text-emerald-600" />
                    <span>تحويل الألماس إلى كوينز</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    كل 1 ألماسة = {diamondToCoinsRate} كوينز ذهبية
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/wallet')}
                  className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-1.5 text-xs font-extrabold text-amber-800 cursor-pointer flex items-center gap-1"
                >
                  <Wallet className="w-3.5 h-3.5" />
                  <span>سحب USDT</span>
                </button>
              </div>

              {diamondsLocked ? (
                <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 text-xs font-bold text-amber-900 flex items-center gap-2">
                  <Lock className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    تحويل وسحب الألماس مقفل مؤقتاً لحين اعتماد البصمة الصوتية من الإدارة.
                  </span>
                </div>
              ) : (
                <form onSubmit={handleConvert} className="flex flex-col sm:flex-row gap-2.5">
                  <input
                    type="number"
                    min={10}
                    dir="ltr"
                    value={convertAmount}
                    onChange={(e) => setConvertAmount(e.target.value)}
                    className="flex-1 rounded-2xl bg-slate-50 border border-slate-200 px-4 py-2.5 text-sm font-mono-num text-slate-900 focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="submit"
                    disabled={busy}
                    className="emerald-btn rounded-2xl px-6 py-2.5 text-xs font-extrabold cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
                  >
                    <Coins className="w-4 h-4" />
                    <span>تحويل الآن</span>
                  </button>
                </form>
              )}
            </div>

            {/* Diamond Transactions */}
            <div className="light-card rounded-3xl p-5 space-y-3">
              <h3 className="text-sm font-extrabold text-slate-900">
                سجل أرباح ومعاملات الألماس
              </h3>
              {loading ? (
                <p className="text-xs text-slate-400">جارٍ التحميل...</p>
              ) : diamondTxs.length === 0 ? (
                <p className="text-xs text-slate-500">
                  لا توجد معاملات ألماس مسجلة بعد. استلم هدايا أو رُدّ على الرسائل الخاصة لكسب الألماس!
                </p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {diamondTxs.map((tx) => (
                    <div
                      key={tx.id}
                      className="py-2.5 flex items-center justify-between gap-2 text-xs"
                    >
                      <span className="font-semibold text-slate-700">{tx.description}</span>
                      <span
                        className={`font-mono-num font-extrabold shrink-0 ${
                          tx.amount >= 0 ? 'text-emerald-600' : 'text-rose-600'
                        }`}
                      >
                        {tx.amount >= 0 ? `+${tx.amount}` : tx.amount} 💎
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Tab 2: My Owned 3D Frames & VIP Entrances */
          <div className="space-y-4">
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {unlockedItems.map((frame) => {
                const isEquipped = user.frameId === frame.id;
                const storeMeta = STORE_3D_ITEMS.find((s) => s.id === frame.id);
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
                        className={`mt-1 rounded-xl px-3.5 py-1.5 text-[11px] font-extrabold cursor-pointer transition inline-flex items-center gap-1 ${
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

            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => navigate('/store')}
                className="emerald-btn rounded-2xl px-6 py-2.5 text-xs font-extrabold cursor-pointer flex items-center gap-2"
              >
                <Store className="w-4 h-4" />
                <span>تصفح الإطارات والدخوليات 3D في المتجر</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
