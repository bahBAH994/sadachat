import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  Crown,
  Eye,
  EyeOff,
  Gift,
  Globe2,
  Lock,
  Mail,
  ShieldCheck,
  User as UserIcon,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { resolveAsset } from '../lib/assets';
import { ARAB_COUNTRIES } from '../lib/sadaCatalog';

export const LoginPage: React.FC = () => {
  const { loginOrRegister, deviceUuid } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [mode, setMode] = useState<'register' | 'login'>('register');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [age, setAge] = useState<string>('24');
  const [country, setCountry] = useState<string>('SA');
  const [referralCode, setReferralCode] = useState(() => searchParams.get('ref') || '');
  const [showPassword, setShowPassword] = useState(false);
  const [emblemFailed, setEmblemFailed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const parsedAge = Math.max(18, Math.min(80, Math.floor(Number(age) || 24)));
      const { redirectTo } = await loginOrRegister({
        email,
        password,
        displayName,
        gender,
        age: parsedAge,
        country,
        referralCode,
        mode,
      });
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر إتمام العملية.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative w-full min-h-[100dvh] bg-[#0b0e17] text-white flex items-start justify-center pt-7 pb-10 px-4 sm:px-6 overflow-y-auto">
      <div
        className="absolute inset-0 bg-cover bg-center opacity-20 pointer-events-none"
        style={{ backgroundImage: `url(${resolveAsset('royal_stage')})` }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/80 via-slate-950/90 to-slate-950 pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-md mx-auto"
      >
        <div className="bg-slate-900/90 backdrop-blur-xl rounded-3xl p-6 sm:p-7 max-w-md mx-auto border border-amber-500/30 shadow-2xl shadow-black/70">
          <div className="flex flex-col items-center text-center mb-6">
            {!emblemFailed ? (
              <img
                src={resolveAsset('emblem')}
                alt="شعار منصة صَدَى"
                width={64}
                height={64}
                loading="eager"
                decoding="async"
                referrerPolicy="no-referrer"
                onError={() => setEmblemFailed(true)}
                className="w-16 h-16 mx-auto rounded-2xl object-cover border border-amber-500/40 shadow-[0_0_24px_rgba(245,158,11,0.35)] mb-3"
              />
            ) : (
              <div className="w-16 h-16 mx-auto rounded-2xl bg-slate-950 border border-amber-500/40 shadow-[0_0_24px_rgba(245,158,11,0.35)] flex items-center justify-center mb-3">
                <Crown
                  width={64}
                  height={64}
                  className="w-10 h-10 mx-auto text-amber-400"
                  aria-hidden="true"
                />
              </div>
            )}
            <h1 className="text-2xl sm:text-3xl font-extrabold gold-gradient-text tracking-tight">
              صَدَى - SADA
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1">
              الوكالات الصوتية الفاخرة وساحة المسابقات الملكية
            </p>
          </div>

          <div className="grid grid-cols-2 gap-1.5 p-1 rounded-2xl bg-slate-950/90 border border-amber-500/20 mb-5">
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError(null);
              }}
              className={`min-h-[44px] rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
                mode === 'register'
                  ? 'bg-gradient-to-r from-amber-300 via-amber-400 to-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              إنشاء حساب جديد
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
              }}
              className={`min-h-[44px] rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
                mode === 'login'
                  ? 'bg-gradient-to-r from-amber-300 via-amber-400 to-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              تسجيل الدخول
            </button>
          </div>

          {error && (
            <div
              role="alert"
              className="mb-4 rounded-2xl border border-rose-500/40 bg-rose-950/60 px-4 py-3 text-xs sm:text-sm text-rose-200 leading-relaxed"
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    الاسم الظاهر في الوكالات
                  </label>
                  <div className="relative">
                    <UserIcon
                      width={16}
                      height={16}
                      className="w-4 h-4 text-amber-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                    />
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="مثال: الأمير خالد"
                      className="w-full min-h-[46px] rounded-xl bg-slate-950/90 border border-amber-500/25 pr-10 pl-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    تحديد الجنس
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setGender('male')}
                      className={`min-h-[46px] rounded-xl px-2 py-2 text-xs font-bold border transition cursor-pointer flex items-center justify-center gap-1.5 ${
                        gender === 'male'
                          ? 'bg-amber-500/20 border-amber-400 text-amber-200 shadow-[0_0_16px_rgba(245,158,11,0.2)]'
                          : 'bg-slate-950/85 border-slate-700/70 text-slate-300'
                      }`}
                    >
                      <span>👨</span>
                      <span>ذكر (شاب)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setGender('female')}
                      className={`min-h-[46px] rounded-xl px-2 py-2 text-[11px] font-bold border transition cursor-pointer flex items-center justify-center gap-1 ${
                        gender === 'female'
                          ? 'bg-pink-500/20 border-pink-400 text-pink-100 shadow-[0_0_16px_rgba(244,114,182,0.22)]'
                          : 'bg-slate-950/85 border-slate-700/70 text-slate-300'
                      }`}
                    >
                      <span>👩</span>
                      <span>أنثى (بنت · توثيق صوتي)</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      العمر
                    </label>
                    <input
                      type="number"
                      min={18}
                      max={80}
                      dir="ltr"
                      value={age}
                      onChange={(e) => setAge(e.target.value)}
                      className="w-full min-h-[46px] rounded-xl bg-slate-950/90 border border-amber-500/25 px-3 py-2.5 text-sm text-white font-mono-num text-left focus:outline-none focus:border-amber-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      الدولة
                    </label>
                    <div className="relative">
                      <Globe2
                        width={14}
                        height={14}
                        className="w-3.5 h-3.5 text-amber-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
                      />
                      <select
                        value={country}
                        onChange={(e) => setCountry(e.target.value)}
                        className="w-full min-h-[46px] rounded-xl bg-slate-950/90 border border-amber-500/25 pr-8 pl-2 py-2.5 text-xs font-semibold text-white focus:outline-none focus:border-amber-400"
                      >
                        {ARAB_COUNTRIES.map((c) => (
                          <option key={c.code} value={c.code} className="bg-slate-900 text-white">
                            {c.flag} {c.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    كود الدعوة (اختياري)
                  </label>
                  <div className="relative">
                    <Gift
                      width={16}
                      height={16}
                      className="w-4 h-4 text-amber-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                    />
                    <input
                      type="text"
                      dir="ltr"
                      value={referralCode}
                      onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                      placeholder="REF-XXXXXX"
                      className="w-full min-h-[46px] rounded-xl bg-slate-950/90 border border-amber-500/25 pr-10 pl-4 py-2.5 text-sm text-left font-mono-num text-amber-200 placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                البريد الإلكتروني
              </label>
              <div className="relative">
                <Mail
                  width={16}
                  height={16}
                  className="w-4 h-4 text-amber-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                />
                <input
                  type="email"
                  required
                  dir="ltr"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full min-h-[46px] rounded-xl bg-slate-950/90 border border-amber-500/25 pr-10 pl-4 py-3 text-sm text-white text-left placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                كلمة المرور
              </label>
              <div className="relative">
                <Lock
                  width={16}
                  height={16}
                  className="w-4 h-4 text-amber-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  dir="ltr"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full min-h-[46px] rounded-xl bg-slate-950/90 border border-amber-500/25 pr-10 pl-10 py-3 text-sm text-white text-left placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-amber-300 p-1 cursor-pointer"
                  aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                >
                  {showPassword ? (
                    <EyeOff width={16} height={16} className="w-4 h-4" />
                  ) : (
                    <Eye width={16} height={16} className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full min-h-[48px] rounded-xl py-3 px-4 bg-gradient-to-r from-amber-300 via-amber-400 to-amber-500 text-slate-950 font-extrabold text-sm sm:text-base shadow-lg shadow-amber-500/25 hover:brightness-105 active:scale-[0.98] transition disabled:opacity-60 cursor-pointer"
            >
              {submitting
                ? 'جارٍ التحقق والدخول...'
                : mode === 'register'
                ? 'إنشاء الحساب والدخول الفوري'
                : 'دخول فوري إلى صَدَى'}
            </button>
          </form>

          <div className="mt-5 pt-4 border-t border-amber-500/20 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2 text-xs text-slate-400">
              <div className="flex items-center gap-1.5 text-emerald-300/90">
                <ShieldCheck width={16} height={16} className="w-4 h-4 shrink-0" />
                <span>حماية الجهاز ضد تعدد الحسابات مفعّلة</span>
              </div>
              <span className="font-mono-num text-[11px] text-slate-500" dir="ltr">
                {deviceUuid.slice(0, 8)}…
              </span>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
