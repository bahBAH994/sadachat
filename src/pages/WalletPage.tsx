import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeftRight,
  Award,
  Check,
  Copy,
  ImagePlus,
  QrCode,
  Send,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { CoinIcon, DiamondIcon, WalletIcon } from '../components/AppIcons';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '../context/AuthContext';
import { genId } from '../lib/sadaCatalog';
import {
  convertDiamondsToCoinsInSupabase,
  getWalletOverviewFromSupabase,
  submitUsdtDepositInSupabase,
  submitUsdtWithdrawalInSupabase,
} from '../lib/sadaWalletService';
import {
  getCachedPlatformSettingsSync,
  getPlatformState,
  savePlatformState,
} from '../lib/sadaMappers';
import type { PlatformSettings } from '../types';

interface RewardTierInfo {
  id: string;
  minUsdt: number;
  days: number;
  frameId: string;
  frameName: string;
  entryId: string | null;
  entryName: string | null;
  bonusRate: number;
  label: string;
}

function compressReceiptImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('تعذّر قراءة ملف الصورة.'));
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxSide = 960;
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(String(reader.result));
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = () => resolve(String(reader.result));
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

type WalletTab =
  | 'usdt_deposit'
  | 'usdt_withdraw'
  | 'sham_cash_deposit'
  | 'sham_cash_withdraw';

interface ShamCashRequest {
  id: string;
  type: 'deposit' | 'withdrawal';
  userId: string;
  userEmail: string;
  userDisplayName: string;
  amount: number;
  currency: 'USD' | 'SYP';
  accountAddress: string;
  transferReference: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  reviewedAt: string | null;
}

interface ShamCashSettings {
  adminShamCashAddress?: unknown;
  adminShamCashBarcode?: unknown;
  shamCashRequests?: unknown;
}

type ShamCashRequestInput = Pick<
  ShamCashRequest,
  'type' | 'amount' | 'currency' | 'accountAddress' | 'transferReference'
>;

export const WalletPage: React.FC = () => {
  const { user, updateLocalUser } = useAuth();
  const [tab, setTab] = useState<WalletTab>('usdt_deposit');
  const [adminTrc20Address, setAdminTrc20Address] = useState(
    'TFXPytN94bSAUzD893hjpSwp6DGWqGkGSa'
  );
  const [adminShamCashAddress, setAdminShamCashAddress] = useState('');
  const [adminShamCashBarcode, setAdminShamCashBarcode] = useState('');
  const [usdtToCoinsRate, setUsdtToCoinsRate] = useState(10000);
  const [usdtToSypRate, setUsdtToSypRate] = useState(15200);
  const [diamondToCoinsRate, setDiamondToCoinsRate] = useState(0.5);
  const [rewardTiers, setRewardTiers] = useState<RewardTierInfo[]>([]);
  const [eligibility, setEligibility] = useState({
    eligible: false,
    roleLabel: 'عضو',
    minUsdt: 10,
    diamondsPerUsdt: 10000,
    coinsPerUsdt: 10000,
  });

  const [convertAmount, setConvertAmount] = useState('1');
  const [depositUsdt, setDepositUsdt] = useState('1');
  const [txId, setTxId] = useState('');
  const [proofImage, setProofImage] = useState('');
  const [copiedAddr, setCopiedAddr] = useState(false);
  const [copiedShamCashAddress, setCopiedShamCashAddress] = useState(false);

  const [withdrawCurrency, setWithdrawCurrency] = useState<'diamonds' | 'coins'>('diamonds');
  const [withdrawAmount, setWithdrawAmount] = useState('100000');
  const [withdrawAddress, setWithdrawAddress] = useState('');
  const [shamCashDepositAmount, setShamCashDepositAmount] = useState('');
  const [shamCashCurrency, setShamCashCurrency] = useState<'USD' | 'SYP'>('SYP');
  const [shamCashTransferReference, setShamCashTransferReference] = useState('');
  const [shamCashWithdrawalAmount, setShamCashWithdrawalAmount] = useState('');
  const [shamCashWithdrawalAddress, setShamCashWithdrawalAddress] = useState('');

  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(
    null
  );
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const contentScrollRef = useRef<HTMLDivElement | null>(null);

  const handleTabChange = (nextTab: WalletTab) => {
    setTab(nextTab);
    if (contentScrollRef.current) contentScrollRef.current.scrollTop = 0;
  };

  const loadWallet = useCallback(async () => {
    if (!user?.id) return;
    const data = await getWalletOverviewFromSupabase(user.id);
    const settings = getCachedPlatformSettingsSync() as PlatformSettings & ShamCashSettings;
    updateLocalUser(data.user);
    setAdminTrc20Address(data.adminTrc20Address);
    setAdminShamCashAddress(
      typeof settings.adminShamCashAddress === 'string'
        ? settings.adminShamCashAddress
        : ''
    );
    setAdminShamCashBarcode(
      typeof settings.adminShamCashBarcode === 'string'
        ? settings.adminShamCashBarcode
        : ''
    );
    setUsdtToCoinsRate(data.usdtToCoinsRate);
    setUsdtToSypRate(data.usdtToSypRate);
    setDiamondToCoinsRate(data.diamondToCoinsRate || 0.5);
    setRewardTiers(data.rewardTiers);
    setEligibility(data.withdrawalEligibility);
    setWithdrawAmount(
      String(data.withdrawalEligibility.minUsdt * data.withdrawalEligibility.diamondsPerUsdt)
    );
  }, [user?.id, updateLocalUser]);

  useEffect(() => {
    void loadWallet();
  }, [loadWallet]);

  const depositNumeric = Math.max(0, Number(depositUsdt) || 0);
  const matchedTier = useMemo(() => {
    const sorted = [...rewardTiers].sort((a, b) => b.minUsdt - a.minUsdt);
    return sorted.find((t) => depositNumeric >= t.minUsdt) || null;
  }, [depositNumeric, rewardTiers]);

  const expectedCoins = useMemo(() => {
    const base = Math.round(depositNumeric * usdtToCoinsRate);
    const bonus = matchedTier ? Math.round(base * matchedTier.bonusRate) : 0;
    return { base, bonus, total: base + bonus };
  }, [depositNumeric, usdtToCoinsRate, matchedTier]);

  const shamCashDepositUsdt =
    Math.max(0, Number(shamCashDepositAmount) || 0) /
    (shamCashCurrency === 'SYP' ? usdtToSypRate : 1);
  const shamCashDepositSyp = shamCashDepositUsdt * usdtToSypRate;
  const shamCashDepositCoins = Math.round(shamCashDepositUsdt * usdtToCoinsRate);
  const shamCashWithdrawalUsdt =
    Math.max(0, Number(shamCashWithdrawalAmount) || 0) /
    (shamCashCurrency === 'SYP' ? usdtToSypRate : 1);
  const shamCashWithdrawalSyp = shamCashWithdrawalUsdt * usdtToSypRate;

  const expectedWithdrawUsdt = useMemo(() => {
    const raw = Math.max(0, Number(withdrawAmount) || 0);
    const rate =
      withdrawCurrency === 'diamonds'
        ? eligibility.diamondsPerUsdt
        : eligibility.coinsPerUsdt;
    return Math.round((raw / Math.max(1, rate)) * 100) / 100;
  }, [withdrawAmount, withdrawCurrency, eligibility]);

  const handleCopyAddress = async () => {
    try {
      await navigator.clipboard.writeText(adminTrc20Address);
      setCopiedAddr(true);
      setTimeout(() => setCopiedAddr(false), 2200);
    } catch {
      setFeedback({ type: 'err', text: 'تعذّر النسخ التلقائي، يرجى نسخ العنوان يدوياً.' });
    }
  };

  const handleCopyShamCashAddress = async () => {
    try {
      await navigator.clipboard.writeText(adminShamCashAddress);
      setCopiedShamCashAddress(true);
      setTimeout(() => setCopiedShamCashAddress(false), 2200);
    } catch {
      setFeedback({ type: 'err', text: 'تعذّر النسخ التلقائي، يرجى نسخ رقم شام كاش يدوياً.' });
    }
  };

  const submitShamCashRequest = async (request: ShamCashRequestInput) => {
    if (!user) return;
    if (!Number.isFinite(request.amount) || request.amount <= 0) {
      throw new Error('يرجى إدخال مبلغ صحيح أكبر من صفر.');
    }
    if (request.type === 'deposit' && request.transferReference.trim().length < 3) {
      throw new Error('يرجى إدخال رقم عملية التحويل بشكل صحيح.');
    }
    if (request.type === 'withdrawal' && request.accountAddress.trim().length < 3) {
      throw new Error('يرجى إدخال رقم حساب شام كاش صحيح.');
    }
    const state = await getPlatformState({ forceRefresh: true });
    const settings = state.settings as typeof state.settings & ShamCashSettings;
    const existingRequests = Array.isArray(settings.shamCashRequests)
      ? settings.shamCashRequests
      : [];
    const nextRequest: ShamCashRequest = {
      ...request,
      id: genId('sham'),
      userId: user.id,
      userEmail: user.email,
      userDisplayName: user.displayName,
      status: 'pending',
      createdAt: new Date().toISOString(),
      reviewedAt: null,
    };
    const nextSettings = {
      ...state.settings,
      shamCashRequests: [...existingRequests, nextRequest],
    };
    await savePlatformState({ settings: nextSettings });
  };

  const handleSubmitShamCashDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setBusyId('sham_cash_deposit');
    setFeedback(null);
    try {
      await submitShamCashRequest({
        type: 'deposit',
        amount: Number(shamCashDepositAmount),
        currency: shamCashCurrency,
        accountAddress: adminShamCashAddress,
        transferReference: shamCashTransferReference.trim(),
      });
      setShamCashDepositAmount('');
      setShamCashTransferReference('');
      setFeedback({
        type: 'ok',
        text: 'تم إرسال طلب شحن شام كاش للإدارة للمراجعة.',
      });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'تعذّر إرسال طلب الشحن عبر شام كاش.',
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleSubmitShamCashWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setBusyId('sham_cash_withdraw');
    setFeedback(null);
    try {
      await submitShamCashRequest({
        type: 'withdrawal',
        amount: Number(shamCashWithdrawalAmount),
        currency: shamCashCurrency,
        accountAddress: shamCashWithdrawalAddress.trim(),
        transferReference: '',
      });
      setShamCashWithdrawalAmount('');
      setShamCashWithdrawalAddress('');
      setFeedback({
        type: 'ok',
        text: 'تم إرسال طلب سحب شام كاش للإدارة للمراجعة.',
      });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'تعذّر إرسال طلب السحب عبر شام كاش.',
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleProofChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await compressReceiptImage(file);
      setProofImage(dataUrl);
      setFeedback(null);
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'تعذّر رفع صورة الإثبات.',
      });
    }
  };

  const handleSubmitDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setBusyId('usdt_deposit');
    setFeedback(null);
    try {
      await submitUsdtDepositInSupabase(user, {
        amountUsdt: Number(depositUsdt),
        txId: txId.trim(),
        proofImage,
      });
      setTxId('');
      setProofImage('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      await loadWallet();
      setFeedback({
        type: 'ok',
        text: 'تم استلام طلب إيداع USDT (TRC20) بنجاح! ستُضاف الكوينز ومكافآت الإطار والدخولية تلقائياً فور تأكيد الإدارة.',
      });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'تعذّر إرسال طلب الإيداع.',
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleSubmitWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setBusyId('usdt_withdraw');
    setFeedback(null);
    try {
      const res = await submitUsdtWithdrawalInSupabase(user, {
        sourceCurrency: withdrawCurrency,
        sourceAmount: Number(withdrawAmount),
        trc20Address: withdrawAddress.trim(),
      });
      updateLocalUser(res.user);
      setWithdrawAddress('');
      await loadWallet();
      setFeedback({
        type: 'ok',
        text: `تم تسجيل طلب سحب ${res.withdrawal.amountUsdt} USDT (TRC20) وهو قيد المعالجة من الإدارة.`,
      });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'تعذّر إرسال طلب السحب.',
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleConvert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setBusyId('convert');
    setFeedback(null);
    try {
      const updatedUser = await convertDiamondsToCoinsInSupabase(
        user,
        Number(convertAmount)
      );
      updateLocalUser(updatedUser);
      await loadWallet();
      setFeedback({ type: 'ok', text: 'تم تحويل الألماس إلى كوينز بنجاح!' });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'تعذّر التحويل.',
      });
    } finally {
      setBusyId(null);
    }
  };

  if (!user) return null;

  return (
    <div className="h-full min-h-0 flex flex-col overflow-hidden bg-[#070913]">
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 pt-3 space-y-4 shrink-0">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl sm:text-3xl font-extrabold gold-gradient-text">
            <WalletIcon className="h-7 w-7" />
            الشحن VIP
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1">
            اختر وسيلة الدفع المناسبة: USDT أو شام كاش
          </p>
        </div>

        <div className="w-full sm:w-[420px] grid grid-cols-2 gap-2.5 p-1 rounded-2xl bg-[#070913]/85 border border-[#D4AF37]/25">
          {[
            { id: 'usdt_deposit', label: 'إيداع USDT' },
            { id: 'usdt_withdraw', label: 'سحب USDT' },
            { id: 'sham_cash_deposit', label: 'شحن شام كاش' },
            { id: 'sham_cash_withdraw', label: 'سحب شام كاش' },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleTabChange(item.id as WalletTab)}
              className={`w-full min-h-[44px] rounded-xl px-2 py-2 text-xs font-bold cursor-pointer transition ${
                tab === item.id
                  ? 'bg-gradient-to-r from-[#D4AF37] to-[#B58922] text-[#070913]'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {feedback && (
        <div
          className={`rounded-2xl px-4 py-3 text-xs sm:text-sm border ${
            feedback.type === 'ok'
              ? 'border-emerald-500/40 bg-emerald-950/50 text-emerald-200'
              : 'border-rose-500/40 bg-rose-950/50 text-rose-200'
          }`}
        >
          {feedback.text}
        </div>
      )}

      </div>

      <div ref={contentScrollRef} className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain touch-pan-y">
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 pt-3 pb-28 space-y-4">
      <form
        onSubmit={handleConvert}
        className="royal-glass rounded-3xl p-5 flex flex-col sm:flex-row sm:items-end gap-3"
      >
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2 text-[#F3D37A]">
            <ArrowLeftRight className="w-5 h-5" />
            <h2 className="text-sm font-bold">تحويل الألماس إلى كوينز</h2>
          </div>
          <label className="block text-xs text-slate-300">
            كمية الألماس المراد تحويلها
          </label>
          <input
            type="number"
            min={1}
            max={user.diamonds}
            value={convertAmount}
            onChange={(e) => setConvertAmount(e.target.value)}
            dir="ltr"
            className="w-full rounded-xl bg-[#070913]/85 border border-[#D4AF37]/25 px-3.5 py-2.5 text-sm text-white font-mono-num text-left focus:outline-none focus:border-[#D4AF37]"
          />
        </div>
        <button
          type="submit"
          disabled={
            busyId === 'convert' ||
            user.diamonds < 1 ||
            (user.gender === 'female' && !user.is_admin && user.femaleVoiceStatus !== 'verified')
          }
          className="gold-btn min-h-[44px] rounded-xl px-5 py-2.5 text-xs sm:text-sm cursor-pointer disabled:opacity-50"
        >
          {user.gender === 'female' && !user.is_admin && user.femaleVoiceStatus !== 'verified'
            ? 'الألماس مقفل لحين التوثيق الصوتي'
            : `تحويل إلى ${Math.round(Number(convertAmount || 0) * diamondToCoinsRate).toLocaleString('en-US')} كوينز`}
        </button>
      </form>
      {/* TAB 1: USDT TRC20 DEPOSIT */}
      {tab === 'usdt_deposit' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
            {/* Permanent Admin TRC20 Wallet + QR + Reward Tiers */}
            <section className="lg:col-span-5 royal-glass rounded-3xl p-5 sm:p-6 flex flex-col justify-between gap-5">
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-[#FCE9A6]">
                    <QrCode className="w-5 h-5 text-[#D4AF37]" />
                    <h2 className="text-base font-extrabold">محفظة الإدارة الدائمة (TRC20)</h2>
                  </div>
                  <span className="text-[11px] font-bold text-emerald-300 font-mono-num">
                    USDT · TRC20 حصراً
                  </span>
                </div>

                <div className="flex flex-col items-center gap-3 rounded-2xl bg-[#070913]/85 border border-[#D4AF37]/30 p-4">
                  <div className="rounded-2xl bg-white p-3 shadow-[0_0_24px_rgba(243,211,122,0.28)]">
                    <QRCodeSVG
                      value={adminTrc20Address}
                      size={164}
                      level="M"
                      bgColor="#FFFFFF"
                      fgColor="#070913"
                    />
                  </div>
                  <p className="text-[11px] text-amber-200 text-center">
                    امسح الباركود أو انسخ العنوان أدناه — تأكد من اختيار شبكة{' '}
                    <span className="font-bold text-white">TRON (TRC20)</span> حصراً
                  </p>
                  <div className="w-full flex items-center gap-2 rounded-xl bg-[#0D1226] border border-[#D4AF37]/30 p-2.5">
                    <code
                      dir="ltr"
                      className="flex-1 text-xs font-mono-num text-[#FCE9A6] break-all select-all text-left"
                    >
                      {adminTrc20Address}
                    </code>
                    <button
                      type="button"
                      onClick={handleCopyAddress}
                      className="gold-btn min-h-[38px] rounded-lg px-3 text-xs font-bold flex items-center gap-1.5 shrink-0 cursor-pointer"
                    >
                      {copiedAddr ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>تم النسخ</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>نسخ</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Temporary Visual Rewards Tiers */}
              <div className="space-y-2.5 pt-2 border-t border-[#D4AF37]/15">
                <h3 className="text-xs font-extrabold text-[#F3D37A] flex items-center gap-1.5">
                  <Award className="w-4 h-4" />
                  <span>مكافآت الإطارات والدخوليات التلقائية حسب الشحن</span>
                </h3>
                <div className="space-y-2 text-xs">
                  {[...rewardTiers]
                    .sort((a, b) => a.minUsdt - b.minUsdt)
                    .map((tier, idx) => {
                      const rowStyle =
                        idx >= 2
                          ? 'bg-gradient-to-r from-amber-500/20 to-[#D4AF37]/20 border border-amber-300/60'
                          : idx === 1
                          ? 'bg-[#D4AF37]/12 border border-[#D4AF37]/40'
                          : 'bg-white/5 border border-slate-300/25';
                      return (
                        <div
                          key={tier.id}
                          className={`rounded-xl px-3.5 py-2.5 flex items-center justify-between gap-2 ${rowStyle}`}
                        >
                          <span className="font-bold text-white font-mono-num">
                            شحن من {tier.minUsdt}$
                          </span>
                          <span className="text-[#FCE9A6] font-semibold text-left">
                            {tier.label}
                            {tier.bonusRate > 0 ? ` (+${Math.round(tier.bonusRate * 100)}% بونص)` : ''}
                          </span>
                        </div>
                      );
                    })}
                </div>
              </div>
            </section>

            {/* Deposit Submission Form */}
            <form
              onSubmit={handleSubmitDeposit}
              className="lg:col-span-7 royal-glass rounded-3xl p-5 sm:p-6 flex flex-col justify-between gap-4"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-[#FCE9A6]">
                    <WalletIcon className="w-5 h-5" />
                    <h2 className="text-base font-extrabold">توثيق حوالة الشحن (USDT TRC20)</h2>
                  </div>
                  <span className="text-xs font-mono-num text-slate-300">
                    1 USDT = {usdtToCoinsRate.toLocaleString('en-US')} Coins
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-2">
                    اختر مبلغ الشحن بالدولار (USDT) أو أدخل المبلغ يدوياً
                  </label>
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-3">
                    {Array.from(new Set(rewardTiers.map((tier) => tier.minUsdt)))
                      .sort((a, b) => a - b)
                      .map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setDepositUsdt(String(val))}
                        className={`min-h-[42px] rounded-xl text-xs font-mono-num font-bold border transition cursor-pointer ${
                          Number(depositUsdt) === val
                            ? 'bg-[#D4AF37] text-[#070913] border-[#FCE9A6]'
                            : 'bg-[#070913]/80 border-[#D4AF37]/25 text-[#FCE9A6] hover:border-[#D4AF37]'
                        }`}
                      >
                        {val} USDT
                        <span className="block text-[9px] text-slate-400">
                          {(val * usdtToSypRate).toLocaleString('en-US')} ل.س
                        </span>
                      </button>
                    ))}
                  </div>
                  <input
                    type="number"
                    min={1}
                    step="0.01"
                    required
                    value={depositUsdt}
                    onChange={(e) => setDepositUsdt(e.target.value)}
                    dir="ltr"
                    className="w-full rounded-xl bg-[#070913]/85 border border-[#D4AF37]/25 px-3.5 py-2.5 text-sm text-white font-mono-num text-left focus:outline-none focus:border-[#D4AF37]"
                  />
                  <p className="mt-2 text-[11px] text-[#FCE9A6]">
                    القيمة التقريبية: {(depositNumeric * usdtToSypRate).toLocaleString('en-US')} ل.س
                    (1 USDT = {usdtToSypRate.toLocaleString('en-US')} ل.س)
                  </p>
                </div>

                {/* Live Reward & Coins Preview */}
                <div className="rounded-2xl border border-[#D4AF37]/30 bg-[#070913]/75 p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400">إجمالي الكوينز المستحقة:</span>
                    <p className="text-base font-extrabold font-mono-num text-[#FCE9A6] mt-0.5">
                      {expectedCoins.total.toLocaleString('en-US')} كوينز
                      {expectedCoins.bonus > 0 && (
                        <span className="text-emerald-300 text-xs mr-1.5">
                          (تشمل +{expectedCoins.bonus.toLocaleString('en-US')} بونص)
                        </span>
                      )}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400">الهدية البصرية التلقائية:</span>
                    <p className="text-sm font-bold text-amber-200 mt-0.5">
                      {matchedTier
                        ? matchedTier.label
                        : 'لم تصل بعد إلى شريحة المكافأة التالية'}
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    كود الحوالة / معرّف المعاملة (TxID / Hash)
                  </label>
                  <input
                    type="text"
                    required
                    minLength={8}
                    value={txId}
                    onChange={(e) => setTxId(e.target.value)}
                    dir="ltr"
                    placeholder="أدخل TxID الخاص بحوالة TRC20..."
                    className="w-full rounded-xl bg-[#070913]/85 border border-[#D4AF37]/25 px-3.5 py-2.5 text-sm text-white font-mono-num text-left placeholder:text-right placeholder:text-slate-500 focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    صورة إثبات التحويل (لقطة شاشة لإيصال TRC20)
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleProofChange}
                    className="hidden"
                    id="usdt-proof-upload"
                  />
                  {!proofImage ? (
                    <label
                      htmlFor="usdt-proof-upload"
                      className="min-h-[92px] rounded-2xl border border-dashed border-[#D4AF37]/40 bg-[#070913]/65 hover:bg-[#D4AF37]/5 flex flex-col items-center justify-center gap-1.5 cursor-pointer p-4 text-center transition"
                    >
                      <ImagePlus className="w-6 h-6 text-[#D4AF37]" />
                      <span className="text-xs font-bold text-[#FCE9A6]">
                        اضغط لرفع صورة إثبات الحوالة
                      </span>
                      <span className="text-[11px] text-slate-400">
                        PNG أو JPG — تُرفق مع الطلب لمطابقة الإدارة
                      </span>
                    </label>
                  ) : (
                    <div className="rounded-2xl border border-[#D4AF37]/40 bg-[#070913]/80 p-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={proofImage}
                          alt="صورة إثبات التحويل"
                          loading="lazy"
                          decoding="async"
                          className="w-16 h-16 rounded-xl object-cover border border-white/15 shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-emerald-300">
                            تم إرفاق صورة الإثبات بنجاح ✓
                          </p>
                          <p className="text-[11px] text-slate-400 truncate">
                            جاهزة للإرسال مع كود الحوالة
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setProofImage('');
                          if (fileInputRef.current) fileInputRef.current.value = '';
                        }}
                        className="min-h-[40px] min-w-[40px] rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-200 flex items-center justify-center cursor-pointer"
                        aria-label="حذف الصورة"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={busyId === 'usdt_deposit'}
                className="gold-btn w-full min-h-[46px] rounded-xl py-2.5 text-sm font-extrabold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                <span>
                  {busyId === 'usdt_deposit'
                    ? 'جارٍ إرسال الطلب...'
                    : 'إرسال طلب الشحن للتأكيد الفوري'}
                </span>
              </button>
            </form>
          </div>

        </div>
      )}

      {/* TAB 2: USDT TRC20 WITHDRAWAL (WINNERS, AGENTS, HOSTS) */}
      {tab === 'usdt_withdraw' && (
        <div className="space-y-6">
          <section className="royal-glass rounded-3xl p-5 sm:p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-[#D4AF37]" />
                  <span>سحب الأرباح إلى USDT (TRC20 حصراً)</span>
                </h2>
                <p className="text-xs sm:text-sm text-slate-300 mt-1">
                  متاح للفائزين بالمسابقات والوكلاء والمضيفين المعتمدين لتحويل الألماس والكوينز إلى USDT
                </p>
              </div>
              <span
                className={`text-xs font-bold px-3.5 py-2 rounded-xl border whitespace-nowrap ${
                  eligibility.eligible
                    ? 'border-emerald-500/40 bg-emerald-950/50 text-emerald-200'
                    : 'border-amber-500/40 bg-amber-950/40 text-amber-200'
                }`}
              >
                {eligibility.eligible
                  ? `مؤهل للسحب بصفة: ${eligibility.roleLabel} ✓`
                  : 'يتطلب فوزاً بمسابقة أو اعتماد مضيف/وكيل'}
              </span>
            </div>

            {!eligibility.eligible && (
              <div className="rounded-2xl border border-amber-500/35 bg-amber-950/35 p-4 text-xs sm:text-sm text-amber-100 leading-relaxed">
                بوابة سحب الأرباح مخصصة حصراً للفائزين في البطولات الثقافية أو الصوتية أو دولاب الدعوات،
                أو المضيفين والوكلاء المعتمدين في نظام الوكالات. يمكنك التأهل فوراً بالمشاركة في
                المسابقات الحية أو الانضمام كمضيف عبر كود وكالة.
              </div>
            )}

            <form onSubmit={handleSubmitWithdraw} className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              <div className="lg:col-span-6 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-2">
                    الرصيد المراد تحويله وسحبه
                  </label>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        setWithdrawCurrency('diamonds');
                        setWithdrawAmount(
                          String(eligibility.minUsdt * eligibility.diamondsPerUsdt)
                        );
                      }}
                      className={`min-h-[46px] rounded-xl text-xs font-bold border transition cursor-pointer flex items-center justify-center gap-2 ${
                        withdrawCurrency === 'diamonds'
                          ? 'bg-sky-500/20 border-sky-400 text-sky-100'
                          : 'bg-[#070913]/80 border-white/10 text-slate-300'
                      }`}
                    >
                      <DiamondIcon className="w-4 h-4 text-sky-400" />
                      <span>الألماس ({user.diamonds.toLocaleString('en-US')})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setWithdrawCurrency('coins');
                        setWithdrawAmount(
                          String(eligibility.minUsdt * eligibility.coinsPerUsdt)
                        );
                      }}
                      className={`min-h-[46px] rounded-xl text-xs font-bold border transition cursor-pointer flex items-center justify-center gap-2 ${
                        withdrawCurrency === 'coins'
                          ? 'bg-[#D4AF37]/20 border-[#D4AF37] text-[#FCE9A6]'
                          : 'bg-[#070913]/80 border-white/10 text-slate-300'
                      }`}
                    >
                      <CoinIcon className="w-4 h-4 text-[#D4AF37]" />
                      <span>الكوينز ({user.coins.toLocaleString('en-US')})</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    الكمية المطلوب سحبها (الحد الأدنى {eligibility.minUsdt} USDT ={' '}
                    {withdrawCurrency === 'diamonds'
                      ? `${eligibility.minUsdt * eligibility.diamondsPerUsdt} ألماسة`
                      : `${(eligibility.minUsdt * eligibility.coinsPerUsdt).toLocaleString('en-US')} كوينز`}
                    )
                  </label>
                  <input
                    type="number"
                    required
                    min={
                      withdrawCurrency === 'diamonds'
                        ? eligibility.minUsdt * eligibility.diamondsPerUsdt
                        : eligibility.minUsdt * eligibility.coinsPerUsdt
                    }
                    max={withdrawCurrency === 'diamonds' ? user.diamonds : user.coins}
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    dir="ltr"
                    className="w-full rounded-xl bg-[#070913]/85 border border-[#D4AF37]/25 px-3.5 py-2.5 text-sm text-white font-mono-num text-left focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>
              </div>

              <div className="lg:col-span-6 space-y-4 flex flex-col justify-between">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    عنوان محفظتك المستلمة على شبكة USDT (TRC20)
                  </label>
                  <input
                    type="text"
                    required
                    value={withdrawAddress}
                    onChange={(e) => setWithdrawAddress(e.target.value)}
                    dir="ltr"
                    placeholder="T..."
                    className="w-full rounded-xl bg-[#070913]/85 border border-[#D4AF37]/25 px-3.5 py-2.5 text-sm text-white font-mono-num text-left focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>

                <div className="rounded-2xl border border-[#D4AF37]/30 bg-[#070913]/75 px-4 py-3 flex items-center justify-between text-xs sm:text-sm">
                  <span className="text-slate-300">المبلغ الصافي المُرسل إليك:</span>
                  <span className="text-lg font-extrabold font-mono-num text-emerald-300">
                    {expectedWithdrawUsdt.toFixed(2)} USDT
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={!eligibility.eligible || busyId === 'usdt_withdraw'}
                  className="gold-btn w-full min-h-[46px] rounded-xl py-2.5 text-sm font-extrabold cursor-pointer disabled:opacity-50"
                >
                  {busyId === 'usdt_withdraw'
                    ? 'جارٍ تسجيل الطلب...'
                    : `طلب سحب ${expectedWithdrawUsdt.toFixed(2)} USDT (TRC20)`}
                </button>
              </div>
            </form>
          </section>

        </div>
      )}
      {tab === 'sham_cash_deposit' && (
        <section className="royal-glass rounded-3xl p-5 sm:p-6 space-y-5">
          <div className="flex items-center gap-2 text-[#FCE9A6]">
            <QrCode className="w-5 h-5 text-[#D4AF37]" />
            <h2 className="text-base font-extrabold">شحن عبر شام كاش</h2>
          </div>
          {adminShamCashAddress ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl bg-[#070913]/85 border border-[#D4AF37]/30 p-4">
              <div className="rounded-2xl bg-white p-3 shadow-[0_0_24px_rgba(243,211,122,0.28)]">
                <QRCodeSVG
                  value={adminShamCashBarcode || adminShamCashAddress}
                  size={164}
                  level="M"
                  bgColor="#FFFFFF"
                  fgColor="#070913"
                />
              </div>
              <p className="text-[11px] text-amber-200 text-center">
                امسح الباركود أو حوّل إلى حساب شام كاش للإدارة
              </p>
              <div className="w-full flex items-center gap-2 rounded-xl bg-[#0D1226] border border-[#D4AF37]/30 p-2.5">
                <code
                  dir="ltr"
                  className="flex-1 text-xs font-mono-num text-[#FCE9A6] break-all select-all text-left"
                >
                  {adminShamCashAddress}
                </code>
                <button
                  type="button"
                  onClick={() => void handleCopyShamCashAddress()}
                  className="gold-btn min-h-[38px] rounded-lg px-3 text-xs font-bold flex items-center gap-1.5 shrink-0 cursor-pointer"
                >
                  {copiedShamCashAddress ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>تم النسخ</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>نسخ</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <p className="rounded-2xl border border-amber-500/35 bg-amber-950/35 p-4 text-sm text-amber-100">
              لم تُضف الإدارة حساب شام كاش بعد.
            </p>
          )}

          <form onSubmit={handleSubmitShamCashDeposit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                المبلغ المحوّل عبر شام كاش
              </label>
              <input
                type="number"
                min={1}
                step="any"
                required
                value={shamCashDepositAmount}
                onChange={(e) => setShamCashDepositAmount(e.target.value)}
                dir="ltr"
                className="w-full rounded-xl bg-[#070913]/85 border border-[#D4AF37]/25 px-3.5 py-2.5 text-sm text-white font-mono-num text-left focus:outline-none focus:border-[#D4AF37]"
              />
              <select
                value={shamCashCurrency}
                onChange={(e) => setShamCashCurrency(e.target.value as 'USD' | 'SYP')}
                className="mt-2 w-full rounded-xl bg-[#070913]/85 border border-[#D4AF37]/25 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#D4AF37]"
              >
                <option value="SYP">ليرة سورية (SYP)</option>
                <option value="USD">دولار (USD)</option>
              </select>
              <p className="mt-2 text-[11px] text-[#FCE9A6]">
                يعادل {shamCashDepositUsdt.toFixed(2)} USDT ({shamCashDepositSyp.toLocaleString('en-US')} ل.س) · الشحن المتوقع{' '}
                {shamCashDepositCoins.toLocaleString('en-US')} كوينز
                {shamCashCurrency === 'SYP' &&
                  ` (سعر الصرف ${usdtToSypRate.toLocaleString('en-US')} ل.س لكل USDT)`}
              </p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                رقم عملية التحويل
              </label>
              <input
                type="text"
                required
                minLength={3}
                value={shamCashTransferReference}
                onChange={(e) => setShamCashTransferReference(e.target.value)}
                className="w-full rounded-xl bg-[#070913]/85 border border-[#D4AF37]/25 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#D4AF37]"
              />
            </div>
            <button
              type="submit"
              disabled={busyId === 'sham_cash_deposit' || !adminShamCashAddress}
              className="gold-btn w-full min-h-[46px] rounded-xl py-2.5 text-sm font-extrabold cursor-pointer disabled:opacity-50"
            >
              {busyId === 'sham_cash_deposit' ? 'جارٍ إرسال الطلب...' : 'إرسال طلب الشحن للإدارة'}
            </button>
          </form>
        </section>
      )}
      {tab === 'sham_cash_withdraw' && (
        <section className="royal-glass rounded-3xl p-5 sm:p-6 space-y-5">
          <div>
            <h2 className="text-base font-extrabold text-[#FCE9A6]">سحب عبر شام كاش</h2>
            <p className="text-xs text-slate-300 mt-1">
              أرسل المبلغ المطلوب ورقم حساب شام كاش لاستلامه، وسيُراجع الطلب من الإدارة.
            </p>
          </div>
          <form onSubmit={handleSubmitShamCashWithdrawal} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                المبلغ المطلوب سحبه
              </label>
              <input
                type="number"
                min={1}
                step="any"
                required
                value={shamCashWithdrawalAmount}
                onChange={(e) => setShamCashWithdrawalAmount(e.target.value)}
                dir="ltr"
                className="w-full rounded-xl bg-[#070913]/85 border border-[#D4AF37]/25 px-3.5 py-2.5 text-sm text-white font-mono-num text-left focus:outline-none focus:border-[#D4AF37]"
              />
              <select
                value={shamCashCurrency}
                onChange={(e) => setShamCashCurrency(e.target.value as 'USD' | 'SYP')}
                className="mt-2 w-full rounded-xl bg-[#070913]/85 border border-[#D4AF37]/25 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#D4AF37]"
              >
                <option value="SYP">ليرة سورية (SYP)</option>
                <option value="USD">دولار (USD)</option>
              </select>
              <p className="mt-2 text-[11px] text-[#FCE9A6]">
                يعادل {shamCashWithdrawalUsdt.toFixed(2)} USDT · المبلغ بالليرة السورية{' '}
                {shamCashWithdrawalSyp.toLocaleString('en-US')} ل.س
                {shamCashCurrency === 'SYP' &&
                  ` (سعر الصرف ${usdtToSypRate.toLocaleString('en-US')} ل.س لكل USDT)`}
              </p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                رقم / عنوان حساب شام كاش الخاص بك
              </label>
              <input
                type="text"
                required
                minLength={3}
                value={shamCashWithdrawalAddress}
                onChange={(e) => setShamCashWithdrawalAddress(e.target.value)}
                dir="ltr"
                className="w-full rounded-xl bg-[#070913]/85 border border-[#D4AF37]/25 px-3.5 py-2.5 text-sm text-white font-mono-num text-left focus:outline-none focus:border-[#D4AF37]"
              />
            </div>
            <button
              type="submit"
              disabled={busyId === 'sham_cash_withdraw'}
              className="gold-btn w-full min-h-[46px] rounded-xl py-2.5 text-sm font-extrabold cursor-pointer disabled:opacity-50"
            >
              {busyId === 'sham_cash_withdraw' ? 'جارٍ إرسال الطلب...' : 'إرسال طلب السحب للإدارة'}
            </button>
          </form>
        </section>
      )}
        </div>
      </div>
    </div>
  );
};
