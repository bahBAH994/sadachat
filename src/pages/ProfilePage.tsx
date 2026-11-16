import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Coins, Crown, Gem, LogOut, Save, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { AVATAR_CHOICES } from '../lib/assets';
import { updateProfileInSupabase } from '../lib/sadaAuth';
import { AvatarWithFrame } from '../components/AvatarWithFrame';
import {
  FemaleVerifiedBadge,
  FemaleVoiceVerificationCard,
} from '../components/FemaleVoiceVerificationCard';
import { PWAInstallButton } from '../components/PWAInstallButton';

export const ProfilePage: React.FC = () => {
  const { user, updateLocalUser, logout } = useAuth();
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || 'host_male');
  const [gender, setGender] = useState<'female' | 'male'>(user?.gender || 'male');
  const [isHost, setIsHost] = useState<boolean>(Boolean(user?.isHost));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (!user) return null;

  const xpNextLevel = Math.pow(user.level, 2) * 120;
  const xpProgress = Math.min(100, Math.round((user.xp / Math.max(1, xpNextLevel)) * 100));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const updatedUser = await updateProfileInSupabase(user, {
        displayName,
        bio,
        avatarUrl,
        gender,
        isHost,
      });
      updateLocalUser(updatedUser);
      setMessage('تم حفظ بيانات ملفك الملكي بنجاح.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'تعذّر حفظ التعديلات.');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-5 pb-28 space-y-6">
      {/* Header Card */}
      <section className="royal-glass rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row items-center gap-6">
        <AvatarWithFrame
          src={avatarUrl}
          alt={user.displayName}
          frameId={user.frameId}
          size="xl"
        />

        <div className="flex-1 text-center sm:text-right space-y-2">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
            <h1 className="text-2xl font-extrabold text-white">{user.displayName}</h1>
            <FemaleVerifiedBadge badge={user.femaleVerifiedBadge} />
            {user.hostBadge && (
              <span className="inline-flex items-center gap-1 rounded-full border border-[#F3D37A]/55 bg-[#D4AF37]/15 px-2.5 py-0.5 text-[11px] font-bold text-[#FCE9A6]">
                {user.hostBadge}
              </span>
            )}
            {user.is_admin && (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-[#FCE9A6]">
                <ShieldCheck className="w-4 h-4" />
                المدير العام
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400" dir="ltr">
            {user.email}
          </p>

          <div className="pt-2 space-y-1.5 max-w-md mx-auto sm:mx-0">
            <div className="flex items-center justify-between text-xs font-mono-num">
              <span className="text-[#F3D37A] font-bold flex items-center gap-1">
                <Crown className="w-3.5 h-3.5" />
                المستوى {user.level}
              </span>
              <span className="text-slate-400">
                {user.xp.toLocaleString('en-US')} XP
              </span>
            </div>
            <div className="h-2 rounded-full bg-[#070913] overflow-hidden border border-[#D4AF37]/20">
              <div
                className="h-full bg-gradient-to-r from-[#D4AF37] to-[#FCE9A6]"
                style={{ width: `${xpProgress}%` }}
              />
            </div>
          </div>

          <div className="pt-2 flex flex-wrap items-center justify-center sm:justify-start gap-4 text-xs font-mono-num">
            <span className="flex items-center gap-1.5 text-[#FCE9A6]">
              <Coins className="w-4 h-4 text-[#D4AF37]" />
              {user.coins.toLocaleString('en-US')} كوينز
            </span>
            <span className="flex items-center gap-1.5 text-sky-200">
              <Gem className="w-4 h-4 text-sky-400" />
              {user.diamonds.toLocaleString('en-US')} ألماس
            </span>
          </div>
        </div>
      </section>

      <FemaleVoiceVerificationCard />

      {/* Edit Profile Form */}
      <form onSubmit={handleSave} className="royal-glass rounded-3xl p-6 space-y-5">
        <h2 className="text-base font-bold text-[#F3D37A]">تخصيص الهوية الملكية</h2>

        {message && (
          <div className="rounded-xl border border-[#D4AF37]/40 bg-[#D4AF37]/10 px-4 py-2.5 text-xs text-[#FCE9A6]">
            {message}
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-2">
            اختيار الصورة الرمزية
          </label>
          <div className="flex flex-wrap items-center gap-3">
            {AVATAR_CHOICES.map((choice) => (
              <button
                key={choice.id}
                type="button"
                onClick={() => setAvatarUrl(choice.id)}
                className={`p-1.5 rounded-2xl border transition cursor-pointer flex items-center gap-2 ${
                  avatarUrl === choice.id
                    ? 'border-[#D4AF37] bg-[#D4AF37]/15'
                    : 'border-white/10 bg-[#070913]/60 hover:border-[#D4AF37]/40'
                }`}
              >
                <img
                  src={choice.src}
                  alt={choice.label}
                  referrerPolicy="no-referrer"
                  className="w-10 h-10 rounded-xl object-cover"
                />
                <span className="text-xs font-semibold text-slate-200 pl-2">
                  {choice.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              الاسم الظاهر
            </label>
            <input
              type="text"
              required
              minLength={2}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-xl bg-[#070913]/85 border border-[#D4AF37]/25 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#D4AF37]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              معرّف الجهاز المرتبط (Device UUID)
            </label>
            <div
              dir="ltr"
              className="w-full rounded-xl bg-[#070913]/60 border border-white/10 px-3.5 py-2.5 text-xs text-slate-400 font-mono-num truncate"
            >
              {user.device_uuid}
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">
            النبذة التعريفية
          </label>
          <textarea
            rows={2}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            className="w-full rounded-xl bg-[#070913]/85 border border-[#D4AF37]/25 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#D4AF37]"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              فئة الحساب
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setGender('male')}
                className={`min-h-[40px] rounded-xl text-xs font-bold border transition cursor-pointer ${
                  gender === 'male'
                    ? 'bg-[#D4AF37]/20 border-[#D4AF37] text-[#FCE9A6]'
                    : 'bg-[#070913]/80 border-white/10 text-slate-300'
                }`}
              >
                عضو
              </button>
              <button
                type="button"
                onClick={() => setGender('female')}
                className={`min-h-[40px] rounded-xl text-xs font-bold border transition cursor-pointer ${
                  gender === 'female'
                    ? 'bg-[#D4AF37]/20 border-[#D4AF37] text-[#FCE9A6]'
                    : 'bg-[#070913]/80 border-white/10 text-slate-300'
                }`}
              >
                حساب نسائي (ألماس)
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              وضع المضيف (الرسائل المدفوعة)
            </label>
            <button
              type="button"
              onClick={() => setIsHost((prev) => !prev)}
              className={`w-full min-h-[40px] rounded-xl text-xs font-bold border transition cursor-pointer px-3 ${
                isHost
                  ? 'bg-sky-500/20 border-sky-400/60 text-sky-200'
                  : 'bg-[#070913]/80 border-white/10 text-slate-300'
              }`}
            >
              {isHost
                ? 'وضع المضيف مفعّل ✓ (يستلم ألماساً عند الرد)'
                : 'تفعيل حساب كمضيف مجلس'}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="gold-btn min-h-[44px] rounded-xl px-6 py-2.5 text-sm flex items-center gap-2 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'جارٍ الحفظ...' : 'حفظ التعديلات'}</span>
          </button>

          <div className="flex flex-wrap items-center gap-2">
            <PWAInstallButton variant="full" />
            {user.is_admin && (
              <button
                type="button"
                onClick={() => navigate('/admin')}
                className="min-h-[44px] rounded-xl px-4 py-2.5 text-xs font-bold bg-[#D4AF37]/20 border border-[#D4AF37]/50 text-[#FCE9A6] hover:bg-[#D4AF37]/30 cursor-pointer flex items-center gap-1.5"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>لوحة الإدارة العليا</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleLogout}
              className="min-h-[44px] rounded-xl px-4 py-2.5 text-xs font-bold bg-rose-950/50 border border-rose-500/35 text-rose-200 hover:bg-rose-900/50 cursor-pointer flex items-center gap-1.5"
            >
              <LogOut className="w-4 h-4" />
              <span>تسجيل الخروج</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
