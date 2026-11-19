import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeftRight,
  ArrowRight,
  Coins,
  Gem,
  Lock,
  Send,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { isFemaleVoiceLocked } from '../lib/sadaCatalog';
import {
  convertDiamondsToCoinsInSupabase,
  getWalletOverviewFromSupabase,
  submitUsdtWithdrawalInSupabase,
} from '../lib/sadaWalletService';
import type { Transaction, UsdtWithdrawalRequest } from '../types';

export const DiamondWalletPage: React.FC = () => {
  const { user, updateLocalUser } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [diamondToCoinsRate, setDiamondToCoinsRate] = useState(2);
  const [convertAmount, setConvertAmount] = useState('100');
  const [withdrawAmount, setWithdrawAmount] = useState('500');
  const [withdrawAddress, setWithdrawAddress] = useState('');
  const [eligibility, setEligibility] = useState({
    eligible: false,
    roleLabel: 'عضو',
    minUsdt: 5,
    diamondsPerUsdt: 100,
    coinsPerUsdt: 1000,
  });
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [withdrawals, setWithdrawals] = useState<UsdtWithdrawalRequest[]>([]);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(
    null
  );

  const loadData = useCallback(async () => {
    if (!user?.id) return;
    try {
      const data = await getWalletOverviewFromSupabase(user.id);
      updateLocalUser(data.user);
      setDiamondToCoinsRate(data.diamondToCoinsRate || 2);
      setEligibility(data.withdrawalEligibility);
      setTransactions(data.transactions.filter((t) => t.currency === 'diamonds'));
      setWithdrawals(data.usdtWithdrawals.filter((w) => w.sourceCurrency === 'diamonds'));
    } finally {
      setLoading(false);
    }
  }, [user?.id, updateLocalUser]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const expectedUsdt = useMemo(() => {
    const raw = Math.max(0, Number(withdrawAmount) || 0);
    return Math.round((raw / Math.max(1, eligibility.diamondsPerUsdt)) * 100) / 100;
  }, [withdrawAmount, eligibility.diamondsPerUsdt]);

  if (!user) return null;

  const diamondsLocked = isFemaleVoiceLocked(user);
  const minDiamondsWithdraw = eligibility.minUsdt * eligibility.diamondsPerUsdt;

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
      await loadData();
      setFeedback({ type: 'ok', text: 'تم تحويل الألماس إلى كوينز وإضافته لمحفظتك فوراً.' });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'تعذّر تحويل الألماس.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFeedback(null);
    try {
      const res = await submitUsdtWithdrawalInSupabase(user, {
        sourceCurrency: 'diamonds',
        sourceAmount: Number(withdrawAmount) || 0,
        trc20Address: withdrawAddress.trim(),
      });
      updateLocalUser(res.user);
      setWithdrawAddress('');
      await loadData();
      setFeedback({
        type: 'ok',
        text: `تم تسجيل طلب سحب ${res.withdrawal.amountUsdt} USDT (TRC20) بنجاح وهو قيد مراجعة الإدارة.`,
      });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'تعذّر إرسال طلب السحب.',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F6FA] pb-28 overflow-y-auto overscroll-y-contain">
      <div className="max-w-3xl mx-auto px-4 pt-4 space-y-5">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate('/profile')}
            className="inline-flex items-center gap-1.5 rounded-2xl bg-white border border-slate-200 px-3.5 py-2 text-xs font-extrabold text-slate-700 hover:border-sky-400 cursor-pointer shadow-sm"
          >
            <ArrowRight className="w-4 h-4" />
            <span>العودة إلى أنا</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/wallet')}
            className="inline-flex items-center gap-1.5 rounded-2xl bg-white border border-slate-200 px-3.5 py-2 text-xs font-extrabold text-emerald-700 hover:border-emerald-400 cursor-pointer shadow-sm"
          >
            <Wallet className="w-4 h-4" />
            <span>شحن الكوينز USDT</span>
          </button>
        </div>

        {/* Hero Diamond Wallet Banner */}
        <section className="rounded-3xl bg-gradient-to-br from-[#0F172A] via-[#122645] to-[#064E3B] p-5 sm:p-6 text-white shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-sky-400/20 border border-sky-300/40 px-3 py-1 text-[11px] font-bold text-sky-200">
              <Gem className="w-3.5 h-3.5" />
              <span>محفظة الألماس المستقلة · أرباحك المباشرة</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold">إدارة وسحب الألماس</h1>
            <p className="text-xs text-slate-300">
              حوّل الألماس المستلم من الهدايا والرسائل الخاصة إلى كوينز أو اسحبه مباشرة عبر شبكة USDT (TRC20).
            </p>
          </div>

          <div className="rounded-2xl bg-white/10 border border-white/15 px-5 py-3.5 text-center shrink-0">
            <span className="block text-[11px] text-sky-200 font-bold">رصيد الألماس الفعلي</span>
            <div className="flex items-center justify-center gap-2 mt-1">
              <Gem className="w-6 h-6 text-sky-300" />
              <span className="text-2xl sm:text-3xl font-black font-mono-num">
                {diamondsLocked ? 'مقفل' : user.diamonds.toLocaleString('en-US')}
              </span>
            </div>
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

        {/* Convert Diamonds -> Coins */}
        <section className="light-card rounded-3xl p-5 space-y-4">
          <div>
            <h2 className="text-sm sm:text-base font-extrabold text-slate-900 flex items-center gap-2">
              <ArrowLeftRight className="w-4 h-4 text-emerald-600" />
              <span>تحويل الألماس إلى كوينز</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              كل 1 ألماسة = {diamondToCoinsRate} كوينز ذهبية (الحد الأدنى للتحويل 10 ألماسات)
            </p>
          </div>

          {diamondsLocked ? (
            <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 text-xs font-bold text-amber-900 flex items-center gap-2">
              <Lock className="w-4 h-4 text-amber-600 shrink-0" />
              <span>تحويل وسحب الألماس مقفل مؤقتاً لحين اعتماد البصمة الصوتية من الإدارة.</span>
            </div>
          ) : (
            <form onSubmit={handleConvert} className="flex flex-col sm:flex-row gap-2.5">
              <input
                type="number"
                min={10}
                max={user.diamonds}
                dir="ltr"
                value={convertAmount}
                onChange={(e) => setConvertAmount(e.target.value)}
                className="flex-1 rounded-2xl bg-slate-50 border border-slate-200 px-4 py-2.5 text-sm font-mono-num text-slate-900 focus:outline-none focus:border-emerald-500"
              />
              <button
                type="submit"
                disabled={busy || user.diamonds < 10}
                className="emerald-btn rounded-2xl px-6 py-2.5 text-xs font-extrabold cursor-pointer flex items-center justify-center gap-1.5 shrink-0 disabled:opacity-50"
              >
                <Coins className="w-4 h-4" />
                <span>
                  تحويل إلى{' '}
                  {Math.round((Number(convertAmount) || 0) * diamondToCoinsRate).toLocaleString('en-US')}{' '}
                  كوينز
                </span>
              </button>
            </form>
          )}
        </section>

        {/* Withdraw Diamonds -> USDT TRC20 */}
        <section className="light-card rounded-3xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-sm sm:text-base font-extrabold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-sky-600" />
                <span>سحب الألماس إلى USDT (TRC20)</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5 font-mono-num">
                كل {eligibility.diamondsPerUsdt} 💎 = 1 USDT · الحد الأدنى {eligibility.minUsdt} USDT (
                {minDiamondsWithdraw.toLocaleString('en-US')} ألماسة)
              </p>
            </div>
            <span
              className={`rounded-xl border px-3 py-1.5 text-[11px] font-extrabold ${
                eligibility.eligible
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  : 'bg-amber-50 border-amber-200 text-amber-800'
              }`}
            >
              {eligibility.eligible
                ? `مؤهل للسحب (${eligibility.roleLabel}) ✓`
                : 'متاح للمضيفين والوكلاء والفائزين'}
            </span>
          </div>

          {!diamondsLocked && (
            <form onSubmit={handleWithdraw} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    كمية الألماس للسحب
                  </label>
                  <input
                    type="number"
                    min={minDiamondsWithdraw}
                    max={user.diamonds}
                    required
                    dir="ltr"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    className="w-full rounded-2xl bg-slate-50 border border-slate-200 px-3.5 py-2.5 text-sm font-mono-num text-slate-900 focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    عنوان محفظتك (TRC20)
                  </label>
                  <input
                    type="text"
                    required
                    dir="ltr"
                    placeholder="T..."
                    value={withdrawAddress}
                    onChange={(e) => setWithdrawAddress(e.target.value)}
                    className="w-full rounded-2xl bg-slate-50 border border-slate-200 px-3.5 py-2.5 text-sm font-mono-num text-slate-900 focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl bg-slate-50 border border-slate-200 px-4 py-3">
                <span className="text-xs font-bold text-slate-600">
                  المبلغ الصافي المستحق:{' '}
                  <strong className="text-emerald-700 font-mono-num text-sm">
                    {expectedUsdt.toFixed(2)} USDT
                  </strong>
                </span>
                <button
                  type="submit"
                  disabled={busy || !eligibility.eligible || user.diamonds < minDiamondsWithdraw}
                  className="emerald-btn rounded-2xl px-5 py-2.5 text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>تقديم طلب سحب الألماس</span>
                </button>
              </div>
            </form>
          )}
        </section>

        {/* Diamond Withdrawal & Earnings Ledger */}
        <section className="light-card rounded-3xl p-5 space-y-4">
          <h3 className="text-sm font-extrabold text-slate-900">سجل أرباح وسحوبات الألماس</h3>

          {withdrawals.length > 0 && (
            <div className="space-y-2">
              {withdrawals.map((wd) => (
                <div
                  key={wd.id}
                  className="rounded-2xl bg-slate-50 border border-slate-200/80 px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs"
                >
                  <div>
                    <p className="font-extrabold text-slate-900 font-mono-num">
                      سحب {wd.amountUsdt} USDT ({wd.sourceAmount.toLocaleString('en-US')} 💎)
                    </p>
                    <p className="text-[10px] text-slate-500 font-mono-num" dir="ltr">
                      {wd.trc20Address}
                    </p>
                  </div>
                  <span
                    className={`font-bold ${
                      wd.status === 'approved'
                        ? 'text-emerald-600'
                        : wd.status === 'rejected'
                        ? 'text-rose-600'
                        : 'text-amber-600'
                    }`}
                  >
                    {wd.status === 'approved'
                      ? 'تم التحويل ✓'
                      : wd.status === 'rejected'
                      ? 'مرفوض (مُسترد)'
                      : 'قيد المراجعة'}
                  </span>
                </div>
              ))}
            </div>
          )}

          {loading ? (
            <p className="text-xs text-slate-400">جارٍ التحميل...</p>
          ) : transactions.length === 0 ? (
            <p className="text-xs text-slate-500">
              لا توجد معاملات ألماس مسجلة بعد. استلم هدايا أو رُدّ على الرسائل الخاصة لكسب الألماس!
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {transactions.map((tx) => (
                <div key={tx.id} className="py-2.5 flex items-center justify-between gap-2 text-xs">
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
        </section>
      </div>
    </div>
  );
};
