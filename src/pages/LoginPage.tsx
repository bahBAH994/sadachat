import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { Eye, EyeOff, Gift, Globe2, Lock, Mail, ShieldCheck, User as UserIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { resolveAsset } from '../lib/assets';
import { ARAB_COUNTRIES } from '../lib/sadaCatalog';
import { PWAInstallButton } from '../components/PWAInstallButton';

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
    <div className="relative min-h-screen flex items-center justify-center p-4 sm:p-6 overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center opacity-20 pointer-events-none"
        style={{ backgroundImage: `url(${resolveAsset('royal_stage')})` }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-[#070913]/80 via-[#070913]/90 to-[#070913] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-md"
      >
        <div className="royal-glass rounded-3xl p-6 sm:p-8">
          <div className="flex flex-col items-center text-center mb-6">
            <img
              src={resolveAsset('emblem')}
              alt="شعار منصة صَدَى"
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              className="w-16 h-16 rounded-2xl object-cover border border-[#D4AF37]/50 shadow-[0_0_28px_rgba(212,175,55,0.35)] mb-3"
            />
            <h1 className="text-3xl font-extrabold gold-gradient-text tracking-tight">
              صَدَى - SADA
            </h1>
            <p className="text-sm text-slate-300 mt-1">
              الوكالات الصوتية الفاخرة وساحة المسابقات الملكية
            </p>
          </div>

          <div className="grid grid-cols-2 gap-1.5 p-1 rounded-2xl bg-[#070913]/80 border border-[#D4AF37]/20 mb-6">
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError(null);
              }}
              className={`min-h-[42px] rounded-xl text-sm font-bold transition cursor-pointer ${
                mode === 'register'
                  ? 'bg-gradient-to-r from-[#D4AF37] to-[#B58922] text-[#070913] shadow-sm'
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
              className={`min-h-[42px] rounded-xl text-sm font-bold transition cursor-pointer ${
                mode === 'login'
                  ? 'bg-gradient-to-r from-[#D4AF37] to-[#B58922] text-[#070913] shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              تسجيل الدخول
            </button>
          </div>

          {error && (
            <div
              role="alert"
              className="mb-4 rounded-2xl border border-rose-500/40 bg-rose-950/50 px-4 py-3 text-xs sm:text-sm text-rose-200 leading-relaxed"
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
                    <UserIcon className="w-4 h-4 text-[#D4AF37] absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="مثال: الأمير خالد"
                      className="w-full rounded-xl bg-[#070913]/85 border border-[#D4AF37]/25 pr-10 pl-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-[#D4AF37]"
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
                      className={`min-h-[44px] rounded-xl px-2 py-2 text-xs font-bold border transition cursor-pointer flex items-center justify-center gap-1.5 ${
                        gender === 'male'
                          ? 'bg-[#D4AF37]/20 border-[#D4AF37] text-[#FCE9A6] shadow-[0_0_16px_rgba(212,175,55,0.2)]'
                          : 'bg-[#070913]/80 border-white/10 text-slate-300'
                      }`}
                    >
                      <span>👨</span>
                      <span>ذكر (شاب)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setGender('female')}
                      className={`min-h-[44px] rounded-xl px-2 py-2 text-[11px] font-bold border transition cursor-pointer flex items-center justify-center gap-1 ${
                        gender === 'female'
                          ? 'bg-pink-500/20 border-pink-400 text-pink-100 shadow-[0_0_16px_rgba(244,114,182,0.22)]'
                          : 'bg-[#070913]/80 border-white/10 text-slate-300'
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
                      className="w-full rounded-xl bg-[#070913]/85 border border-[#D4AF37]/25 px-3 py-2.5 text-sm text-white font-mono-num text-left focus:outline-none focus:border-[#D4AF37]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      الدولة
                    </label>
                    <div className="relative">
                      <Globe2 className="w-3.5 h-3.5 text-[#D4AF37] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <select
                        value={country}
                        onChange={(e) => setCountry(e.target.value)}
                        className="w-full rounded-xl bg-[#070913]/85 border border-[#D4AF37]/25 pr-8 pl-2 py-2.5 text-xs font-semibold text-white focus:outline-none focus:border-[#D4AF37]"
                      >
                        {ARAB_COUNTRIES.map((c) => (
                          <option key={c.code} value={c.code}>
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
                    <Gift className="w-4 h-4 text-[#D4AF37] absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      dir="ltr"
                      value={referralCode}
                      onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                      placeholder="REF-XXXXXX"
                      className="w-full rounded-xl bg-[#070913]/85 border border-[#D4AF37]/25 pr-10 pl-4 py-2.5 text-sm text-left font-mono-num text-[#FCE9A6] placeholder:text-slate-500 focus:outline-none focus:border-[#D4AF37]"
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
                <Mail className="w-4 h-4 text-[#D4AF37] absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="email"
                  required
                  dir="ltr"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full rounded-xl bg-[#070913]/85 border border-[#D4AF37]/25 pr-10 pl-4 py-3 text-sm text-white text-left placeholder:text-slate-500 focus:outline-none focus:border-[#D4AF37]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                كلمة المرور
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#D4AF37] absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  dir="ltr"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl bg-[#070913]/85 border border-[#D4AF37]/25 pr-10 pl-10 py-3 text-sm text-white text-left placeholder:text-slate-500 focus:outline-none focus:border-[#D4AF37]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#F3D37A] p-1 cursor-pointer"
                  aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="gold-btn w-full min-h-[48px] rounded-xl py-3 text-sm sm:text-base disabled:opacity-60 cursor-pointer"
            >
              {submitting
                ? 'جارٍ التحقق والدخول...'
                : mode === 'register'
                ? 'إنشاء الحساب والدخول الفوري'
                : 'دخول فوري إلى صَدَى'}
            </button>
          </form>

          <div className="mt-5 pt-4 border-t border-[#D4AF37]/15 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2 text-xs text-slate-400">
              <div className="flex items-center gap-1.5 text-emerald-300/90">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>حماية الجهاز ضد تعدد الحسابات مفعّلة</span>
              </div>
              <span className="font-mono-num text-[11px] text-slate-500" dir="ltr">
                {deviceUuid.slice(0, 8)}…
              </span>
            </div>

            <div className="flex justify-center">
              <PWAInstallButton variant="full" />
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
