import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeftRight,
  Award,
  CarFront,
  Check,
  Clock,
  Coins,
  Copy,
  Crown,
  Gem,
  History,
  ImagePlus,
  Lock,
  QrCode,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  Wallet,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '../context/AuthContext';
import { getUserVipTierInfo } from '../lib/sadaCatalog';
import {
  convertDiamondsToCoinsInSupabase,
  getWalletOverviewFromSupabase,
  purchaseOrEquipFrameInSupabase,
  submitUsdtDepositInSupabase,
  submitUsdtWithdrawalInSupabase,
} from '../lib/sadaWalletService';
import type {
  FrameItem,
  Transaction,
  UsdtDepositRequest,
  UsdtWithdrawalRequest,
} from '../types';
import { AvatarWithFrame } from '../components/AvatarWithFrame';

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

function formatCountdown(targetIso: string | null | undefined, nowMs: number) {
  if (!targetIso) return null;
  const diff = new Date(targetIso).getTime() - nowMs;
  if (diff <= 0) return null;
  const totalSec = Math.floor(diff / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  return { days, hours, minutes, seconds };
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

type WalletTab = 'deposit' | 'withdraw' | 'frames';

export const WalletPage: React.FC = () => {
  const { user, updateLocalUser } = useAuth();
  const [tab, setTab] = useState<WalletTab>('deposit');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [frames, setFrames] = useState<FrameItem[]>([]);
  const [adminTrc20Address, setAdminTrc20Address] = useState(
    'TFXPytN94bSAUzD893hjpSwp6DGWqGkGSa'
  );
  const [usdtToCoinsRate, setUsdtToCoinsRate] = useState(1000);
  const [diamondToCoinsRate, setDiamondToCoinsRate] = useState(2);
  const [rewardTiers, setRewardTiers] = useState<RewardTierInfo[]>([]);
  const [usdtDeposits, setUsdtDeposits] = useState<UsdtDepositRequest[]>([]);
  const [usdtWithdrawals, setUsdtWithdrawals] = useState<UsdtWithdrawalRequest[]>([]);
  const [eligibility, setEligibility] = useState({
    eligible: false,
    roleLabel: 'عضو',
    minUsdt: 5,
    diamondsPerUsdt: 100,
    coinsPerUsdt: 1000,
  });

  const [convertAmount, setConvertAmount] = useState('50');
  const [depositUsdt, setDepositUsdt] = useState('50');
  const [txId, setTxId] = useState('');
  const [proofImage, setProofImage] = useState('');
  const [copiedAddr, setCopiedAddr] = useState(false);

  const [withdrawCurrency, setWithdrawCurrency] = useState<'diamonds' | 'coins'>('diamonds');
  const [withdrawAmount, setWithdrawAmount] = useState('500');
  const [withdrawAddress, setWithdrawAddress] = useState('');

  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(
    null
  );
  const [nowMs, setNowMs] = useState(() => Date.now());
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadWallet = useCallback(async () => {
    if (!user?.id) return;
    const data = await getWalletOverviewFromSupabase(user.id);
    updateLocalUser(data.user);
    setTransactions(data.transactions);
    setFrames(data.frames);
    setAdminTrc20Address(data.adminTrc20Address);
    setUsdtToCoinsRate(data.usdtToCoinsRate);
    setDiamondToCoinsRate(data.diamondToCoinsRate || 2);
    setRewardTiers(data.rewardTiers);
    setUsdtDeposits(data.usdtDeposits);
    setUsdtWithdrawals(data.usdtWithdrawals);
    setEligibility(data.withdrawalEligibility);
  }, [user?.id, updateLocalUser]);

  useEffect(() => {
    void loadWallet();
  }, [loadWallet]);

  // Live 1s countdown clock & auto-refresh when temporary visual rewards expire
  useEffect(() => {
    const id = setInterval(() => {
      const current = Date.now();
      setNowMs(current);
      const frameExp = user?.tempFrameExpiresAt
        ? new Date(user.tempFrameExpiresAt).getTime()
        : null;
      const entryExp = user?.tempEntryExpiresAt
        ? new Date(user.tempEntryExpiresAt).getTime()
        : null;
      if ((frameExp && current >= frameExp) || (entryExp && current >= entryExp)) {
        loadWallet().catch(() => {});
      }
    }, 1000);
    return () => clearInterval(id);
  }, [user?.tempFrameExpiresAt, user?.tempEntryExpiresAt, loadWallet]);

  const activeFrameCountdown = useMemo(
    () => formatCountdown(user?.tempFrameExpiresAt, nowMs),
    [user?.tempFrameExpiresAt, nowMs]
  );

  const activeEntryCountdown = useMemo(
    () => formatCountdown(user?.tempEntryExpiresAt, nowMs),
    [user?.tempEntryExpiresAt, nowMs]
  );

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

  const handleFrameAction = async (frameId: string) => {
    if (!user) return;
    setBusyId(frameId);
    setFeedback(null);
    try {
      const updatedUser = await purchaseOrEquipFrameInSupabase(user, frameId);
      updateLocalUser(updatedUser);
      await loadWallet();
      setFeedback({ type: 'ok', text: 'تم تفعيل الإطار الملكي على حسابك!' });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'تعذّر تفعيل الإطار.',
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
          <h1 className="text-2xl sm:text-3xl font-extrabold gold-gradient-text">
            محفظة الشحن والسحب USDT (TRC20)
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1">
            شحن فوري عبر USDT TRC20 حصراً مع إطارات ودخوليات مؤقتة وسحب أرباح الفائزين والوكلاء والمضيفين
          </p>
        </div>

        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-[#070913]/85 border border-[#D4AF37]/25 overflow-x-auto touch-pan-x no-scrollbar">
          {[
            { id: 'deposit', label: 'إيداع USDT (TRC20)' },
            { id: 'withdraw', label: 'سحب الأرباح USDT' },
            { id: 'frames', label: 'الإطارات والسجل' },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id as WalletTab)}
              className={`min-h-[40px] rounded-xl px-4 py-2 text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer transition ${
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

      {/* Active Temporary Visual Rewards Countdown */}
      {(activeFrameCountdown || activeEntryCountdown) && (
        <section className="rounded-3xl border border-[#FCE9A6]/50 bg-gradient-to-r from-[#2D2007]/85 via-[#131830]/95 to-[#2D2007]/85 p-5 shadow-[0_0_32px_rgba(212,175,55,0.22)] flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <AvatarWithFrame
              src={user.avatarUrl}
              alt={user.displayName}
              frameId={user.frameId}
              vipTier={getUserVipTierInfo(user).key}
              size="lg"
            />
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold text-[#F3D37A]">
                <Sparkles className="w-4 h-4" />
                <span>المكافآت البصرية المؤقتة المفعّلة الآن</span>
              </div>
              <p className="text-sm sm:text-base font-extrabold text-white">
                {frames.find((f) => f.id === user.frameId)?.name || 'إطار شحن ملكي'}
                {user.activeEntryName ? ` + ${user.activeEntryName}` : ''}
              </p>
              <p className="text-xs text-slate-300">
                تظهر دخوليتك لجميع الأعضاء عند دخول أي غرفة صوتية وتُزال تلقائياً عند انتهاء العداد
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {activeFrameCountdown && (
              <div className="rounded-2xl border border-[#D4AF37]/40 bg-[#070913]/85 px-4 py-2.5 text-center">
                <div className="text-[11px] text-slate-400 flex items-center justify-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-[#F3D37A]" />
                  <span>الوقت المتبقي</span>
                </div>
                <div
                  className="mt-1 text-sm sm:text-base font-extrabold font-mono-num text-[#FCE9A6]"
                  dir="ltr"
                >
                  {activeFrameCountdown.days}d : {String(activeFrameCountdown.hours).padStart(2, '0')}h :{' '}
                  {String(activeFrameCountdown.minutes).padStart(2, '0')}m :{' '}
                  {String(activeFrameCountdown.seconds).padStart(2, '0')}s
                </div>
              </div>
            )}
            {activeEntryCountdown && user.activeEntryName && (
              <div className="rounded-2xl border border-amber-400/40 bg-amber-500/10 px-4 py-2.5 text-center">
                <div className="text-[11px] text-amber-200 flex items-center justify-center gap-1">
                  {user.activeEntryId === 'entry_car_15d' ? (
                    <CarFront className="w-3.5 h-3.5" />
                  ) : (
                    <Crown className="w-3.5 h-3.5" />
                  )}
                  <span>{user.activeEntryName}</span>
                </div>
                <div className="mt-1 text-xs font-bold font-mono-num text-white">
                  مفعّلة في الغرف ({activeEntryCountdown.days} يوم متبقٍ)
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Fixed balance cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="royal-glass rounded-3xl p-6 flex flex-col justify-between gap-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300">رصيد الكوينز الذهبي</span>
              <Coins className="w-6 h-6 text-[#D4AF37]" />
            </div>
            <div className="text-3xl sm:text-4xl font-extrabold font-mono-num text-[#FCE9A6]">
              {user.coins.toLocaleString('en-US')}
            </div>
            <p className="text-xs text-slate-400">
              يُستخدم لإرسال الهدايا الملكية ودولاب الحظ والرسائل الخاصة
            </p>
          </div>

          <div className="royal-glass rounded-3xl p-6 flex flex-col justify-between gap-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300">رصيد الألماس المكتسب</span>
              {user.gender === 'female' && !user.is_admin && user.femaleVoiceStatus !== 'verified' ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/50 bg-amber-500/15 px-2.5 py-0.5 text-[10px] font-bold text-[#FCE9A6]">
                  <Lock className="w-3 h-3" />
                  مقفل للتوثيق الصوتي
                </span>
              ) : (
                <Gem className="w-6 h-6 text-sky-400" />
              )}
            </div>
            <div className="text-3xl sm:text-4xl font-extrabold font-mono-num text-sky-200">
              {user.diamonds.toLocaleString('en-US')}
            </div>
            <p className="text-xs text-slate-400">
              {user.gender === 'female' && !user.is_admin && user.femaleVoiceStatus !== 'verified'
                ? 'سيُفعّل رصيد الألماس واستقبال الرسائل المدفوعة فور اعتماد البصمة الصوتية من الإدارة.'
                : `يُكتسب من الهدايا والرسائل الخاصة والعمولات (${eligibility.diamondsPerUsdt} 💎 = 1 USDT أو 1 💎 = ${diamondToCoinsRate} كوينز)`}
            </p>
          </div>
      </section>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain touch-pan-y">
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 pt-4 pb-8 space-y-6">
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
            عدد الألماسات المراد تحويلها (الحد الأدنى 10)
          </label>
          <input
            type="number"
            min={10}
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
            user.diamonds < 10 ||
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
      {tab === 'deposit' && (
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
                    <Wallet className="w-5 h-5 text-[#D4AF37]" />
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
                    {[10, 25, 50, 100, 250].map((val) => (
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
                        ${val}
                      </button>
                    ))}
                  </div>
                  <input
                    type="number"
                    min={10}
                    step="0.01"
                    required
                    value={depositUsdt}
                    onChange={(e) => setDepositUsdt(e.target.value)}
                    dir="ltr"
                    className="w-full rounded-xl bg-[#070913]/85 border border-[#D4AF37]/25 px-3.5 py-2.5 text-sm text-white font-mono-num text-left focus:outline-none focus:border-[#D4AF37]"
                  />
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
                        : 'اشحن 10$ على الأقل للحصول على إطار مؤقت'}
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

          {/* Deposit Requests History */}
          <section className="royal-glass rounded-3xl p-5 sm:p-6 space-y-4">
            <h3 className="text-base font-bold text-[#F3D37A]">سجل طلبات الإيداع (USDT TRC20)</h3>
            {usdtDeposits.length === 0 ? (
              <p className="text-xs sm:text-sm text-slate-400 text-center py-4">
                لا توجد طلبات إيداع مسجلة بعد.
              </p>
            ) : (
              <div className="divide-y divide-[#D4AF37]/15">
                {usdtDeposits.map((dep) => (
                  <div
                    key={dep.id}
                    className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs sm:text-sm"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-extrabold font-mono-num text-[#FCE9A6]">
                          ${dep.amountUsdt} USDT
                        </span>
                        <span className="text-slate-400">·</span>
                        <span className="font-mono-num text-white font-bold">
                          +{dep.coinsCredited.toLocaleString('en-US')} كوينز
                        </span>
                        {dep.rewardTierLabel && (
                          <>
                            <span className="text-slate-400">·</span>
                            <span className="text-amber-200 font-semibold">
                              {dep.rewardTierLabel}
                            </span>
                          </>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 font-mono-num truncate" dir="ltr">
                        TxID: {dep.txId} · {new Date(dep.createdAt).toLocaleString('ar-EG')}
                      </p>
                    </div>
                    <span
                      className={`text-xs font-bold whitespace-nowrap shrink-0 ${
                        dep.status === 'approved'
                          ? 'text-emerald-300'
                          : dep.status === 'rejected'
                          ? 'text-rose-300'
                          : 'text-amber-300'
                      }`}
                    >
                      {dep.status === 'approved'
                        ? 'مؤكد وممنوح ✓'
                        : dep.status === 'rejected'
                        ? 'مرفوض'
                        : 'بانتظار تأكيد الإدارة'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* TAB 2: USDT TRC20 WITHDRAWAL (WINNERS, AGENTS, HOSTS) */}
      {tab === 'withdraw' && (
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
                        setWithdrawAmount('500');
                      }}
                      className={`min-h-[46px] rounded-xl text-xs font-bold border transition cursor-pointer flex items-center justify-center gap-2 ${
                        withdrawCurrency === 'diamonds'
                          ? 'bg-sky-500/20 border-sky-400 text-sky-100'
                          : 'bg-[#070913]/80 border-white/10 text-slate-300'
                      }`}
                    >
                      <Gem className="w-4 h-4 text-sky-400" />
                      <span>الألماس ({user.diamonds.toLocaleString('en-US')})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setWithdrawCurrency('coins');
                        setWithdrawAmount('5000');
                      }}
                      className={`min-h-[46px] rounded-xl text-xs font-bold border transition cursor-pointer flex items-center justify-center gap-2 ${
                        withdrawCurrency === 'coins'
                          ? 'bg-[#D4AF37]/20 border-[#D4AF37] text-[#FCE9A6]'
                          : 'bg-[#070913]/80 border-white/10 text-slate-300'
                      }`}
                    >
                      <Coins className="w-4 h-4 text-[#D4AF37]" />
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

          <section className="royal-glass rounded-3xl p-5 sm:p-6 space-y-4">
            <h3 className="text-base font-bold text-[#F3D37A]">سجل طلبات السحب (USDT TRC20)</h3>
            {usdtWithdrawals.length === 0 ? (
              <p className="text-xs sm:text-sm text-slate-400 text-center py-4">
                لا توجد طلبات سحب مسجلة بعد.
              </p>
            ) : (
              <div className="divide-y divide-[#D4AF37]/15">
                {usdtWithdrawals.map((wd) => (
                  <div
                    key={wd.id}
                    className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs sm:text-sm"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-extrabold font-mono-num text-emerald-300">
                          {wd.amountUsdt} USDT
                        </span>
                        <span className="text-slate-400">·</span>
                        <span className="text-white font-mono-num">
                          {wd.sourceAmount.toLocaleString('en-US')}{' '}
                          {wd.sourceCurrency === 'diamonds' ? 'ألماسة 💎' : 'كوينز'}
                        </span>
                        <span className="text-slate-400">·</span>
                        <span className="text-[#F3D37A]">{wd.userRoleLabel}</span>
                      </div>
                      <p className="text-[11px] text-slate-400 font-mono-num truncate" dir="ltr">
                        TRC20: {wd.trc20Address} · {new Date(wd.createdAt).toLocaleString('ar-EG')}
                      </p>
                    </div>
                    <span
                      className={`text-xs font-bold whitespace-nowrap shrink-0 ${
                        wd.status === 'approved'
                          ? 'text-emerald-300'
                          : wd.status === 'rejected'
                          ? 'text-rose-300'
                          : 'text-amber-300'
                      }`}
                    >
                      {wd.status === 'approved'
                        ? 'تم التحويل ✓'
                        : wd.status === 'rejected'
                        ? 'مرفوض (تم الاسترداد)'
                        : 'قيد المراجعة'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* TAB 3: FRAMES & LEDGER */}
      {tab === 'frames' && (
        <div className="space-y-6">
          <section className="space-y-3">
            <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
              <Crown className="w-5 h-5 text-[#D4AF37]" />
              <span>الإطارات الملكية والمكافآت البصرية</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {frames.map((frame) => {
                const unlocked = user.unlockedFrames.includes(frame.id);
                const equipped = user.frameId === frame.id;
                return (
                  <div
                    key={frame.id}
                    className="royal-glass rounded-3xl p-5 flex flex-col items-center text-center justify-between gap-4"
                  >
                    <div className="space-y-3 flex flex-col items-center">
                      <AvatarWithFrame
                        src={user.avatarUrl}
                        alt={user.displayName}
                        frameId={frame.id}
                        vipTier={getUserVipTierInfo(user).key}
                        size="lg"
                      />
                      <div>
                        <h3 className="text-sm font-bold text-white">{frame.name}</h3>
                        <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                          {frame.description}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={equipped || busyId === frame.id}
                      onClick={() => handleFrameAction(frame.id)}
                      className={`w-full min-h-[42px] rounded-xl py-2 text-xs font-bold cursor-pointer transition ${
                        equipped
                          ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 cursor-default'
                          : unlocked
                          ? 'bg-white/10 hover:bg-white/15 border border-[#D4AF37]/40 text-white'
                          : 'gold-btn'
                      }`}
                    >
                      {equipped ? (
                        <span className="inline-flex items-center gap-1">
                          <Check className="w-4 h-4" />
                          مُفعّل حالياً
                        </span>
                      ) : unlocked ? (
                        'تفعيل الإطار'
                      ) : (
                        `اقتناء (${frame.priceCoins.toLocaleString('en-US')} كوينز)`
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="royal-glass rounded-3xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center gap-2 text-[#F3D37A]">
              <History className="w-5 h-5" />
              <h2 className="text-base font-bold">سجل العمليات المالية</h2>
            </div>
            {transactions.length === 0 ? (
              <p className="text-xs sm:text-sm text-slate-400 py-4 text-center">
                لا توجد عمليات مسجلة بعد.
              </p>
            ) : (
              <div className="divide-y divide-[#D4AF37]/10">
                {transactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="py-3 flex items-center justify-between gap-4 text-xs sm:text-sm"
                  >
                    <div>
                      <p className="font-semibold text-white">{tx.description}</p>
                      <p className="text-[11px] text-slate-400 font-mono-num">
                        {new Date(tx.timestamp).toLocaleString('ar-EG')}
                      </p>
                    </div>
                    <span
                      className={`font-mono-num font-bold whitespace-nowrap ${
                        tx.amount >= 0 ? 'text-emerald-300' : 'text-rose-300'
                      }`}
                      dir="ltr"
                    >
                      {tx.amount >= 0 ? `+${tx.amount}` : tx.amount}{' '}
                      {tx.currency === 'coins' ? 'Coins' : '💎'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
        </div>
      </div>
    </div>
  );
};
