import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Briefcase,
  Building2,
  Camera,
  Check,
  ChevronLeft,
  Coins,
  Copy,
  Crown,
  Gamepad2,
  Gem,
  Gift,
  LogOut,
  MapPin,
  Mic2,
  Save,
  Settings,
  Shield,
  ShieldCheck,
  Sparkles,
  Store,
  User as UserIcon,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { AVATAR_CHOICES } from '../lib/assets';
import { updateProfileInSupabase } from '../lib/sadaAuth';
import { formatShortNumericId, STORE_3D_ITEMS } from '../lib/sadaCatalog';
import { AvatarWithFrame } from '../components/AvatarWithFrame';
import {
  FemaleVerifiedBadge,
  FemaleVoiceVerificationCard,
} from '../components/FemaleVoiceVerificationCard';
import { PWAInstallButton } from '../components/PWAInstallButton';

async function compressStaticImageToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('تعذّر قراءة الصورة.'));
    reader.onload = () => {
      const rawUrl = String(reader.result);
      if (file.size <= 750_000) {
        resolve(rawUrl);
        return;
      }
      const img = new Image();
      img.onerror = () => resolve(rawUrl);
      img.onload = () => {
        const maxSide = 512;
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(rawUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.86));
      };
      img.src = rawUrl;
    };
    reader.readAsDataURL(file);
  });
}

export const ProfilePage: React.FC = () => {
  const { user, updateLocalUser, logout } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || 'host_male');
  const [gender, setGender] = useState<'female' | 'male'>(user?.gender || 'male');
  const [isHost, setIsHost] = useState<boolean>(Boolean(user?.isHost));
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(
    null
  );

  if (!user) return null;

  const numericId = formatShortNumericId(user.id);
  const xpNextLevel = Math.pow(user.level, 2) * 120;
  const xpProgress = Math.min(100, Math.round((user.xp / Math.max(1, xpNextLevel)) * 100));
  const active3D = STORE_3D_ITEMS.find((i) => i.id === user.frameId) || STORE_3D_ITEMS[0];

  const handleCopyId = () => {
    navigator.clipboard?.writeText(numericId).catch(() => {});
    setCopiedId(true);
    window.setTimeout(() => setCopiedId(false), 1600);
  };

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const isAnimated =
      file.type === 'image/gif' ||
      file.type === 'image/webp' ||
      /\.(gif|webp)$/i.test(file.name);

    if (isAnimated && file.size > 4_500_000) {
      setFeedback({
        type: 'err',
        text: 'حجم الصورة المتحركة كبير جداً (الحد الأقصى 4.5 ميجابايت).',
      });
      return;
    }

    setUploadingAvatar(true);
    setFeedback(null);
    try {
      let finalDataUrl: string;
      if (isAnimated) {
        // Read .gif / .webp raw via FileReader without canvas compression so animation stays intact
        finalDataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onerror = () => reject(new Error('تعذّر قراءة الصورة المتحركة.'));
          reader.onload = () => resolve(String(reader.result));
          reader.readAsDataURL(file);
        });
      } else {
        finalDataUrl = await compressStaticImageToDataUrl(file);
      }

      setAvatarUrl(finalDataUrl);
      const updated = await updateProfileInSupabase(user, { avatarUrl: finalDataUrl });
      updateLocalUser(updated);
      setFeedback({
        type: 'ok',
        text: isAnimated
          ? 'تم رفع صورتك المتحركة بنجاح وستظهر متحركة على المايك!'
          : 'تم تحديث صورتك الشخصية بنجاح!',
      });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'تعذّر رفع الصورة الشخصية.',
      });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      const updatedUser = await updateProfileInSupabase(user, {
        displayName,
        bio,
        avatarUrl,
        gender,
        isHost,
      });
      updateLocalUser(updatedUser);
      setShowEditModal(false);
      setFeedback({ type: 'ok', text: 'تم حفظ تعديلات ملفك الشخصي بنجاح.' });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'تعذّر حفظ التعديلات.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#F5F6FA] pb-28">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.gif,.webp"
        onChange={handleAvatarFileChange}
        className="hidden"
      />

      {/* Dark Royal Profile Top Header matching Screenshot 2 */}
      <section className="relative bg-gradient-to-b from-[#090D16] via-[#12192B] to-[#1A2438] text-white pt-4 pb-12 px-4 overflow-hidden">
        <div className="max-w-3xl mx-auto space-y-5 relative z-10">
          {/* Top utility row */}
          <div className="flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={() => setShowEditModal(true)}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/10 hover:bg-white/15 px-3 py-1.5 font-bold text-slate-200 cursor-pointer transition"
            >
              <Settings className="w-3.5 h-3.5 text-[#FCE9A6]" />
              <span>تعديل الحساب</span>
            </button>

            <div className="flex items-center gap-2">
              {user.is_admin && (
                <button
                  type="button"
                  onClick={() => navigate('/admin')}
                  className="inline-flex items-center gap-1 rounded-full bg-[#D4AF37]/25 border border-[#D4AF37]/50 px-3 py-1 text-[11px] font-bold text-[#FCE9A6] cursor-pointer"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>الإدارة العليا</span>
                </button>
              )}
              <span className="inline-flex items-center gap-1 text-slate-300 font-semibold">
                <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                <span>موقع المدينة</span>
              </span>
            </div>
          </div>

          {/* Main Identity Row */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              {/* Circular Avatar + Golden Camera Icon */}
              <div className="relative shrink-0">
                <AvatarWithFrame
                  src={avatarUrl}
                  alt={user.displayName}
                  frameId={user.frameId}
                  size="xl"
                />
                <button
                  type="button"
                  disabled={uploadingAvatar}
                  onClick={() => fileInputRef.current?.click()}
                  title="تغيير الصورة الشخصية (يدعم GIF و WebP المتحركة)"
                  className="absolute bottom-0 right-0 w-9 h-9 rounded-full bg-gradient-to-br from-[#FCE9A6] via-[#D4AF37] to-[#A67C1E] text-[#070913] border-2 border-[#0B0F1A] shadow-[0_0_16px_rgba(212,175,55,0.75)] flex items-center justify-center cursor-pointer hover:scale-105 transition disabled:opacity-60 z-20"
                >
                  <Camera className="w-4 h-4" />
                </button>
              </div>

              <div className="min-w-0 space-y-1.5">
                <div className="flex items-center flex-wrap gap-1.5">
                  <h1 className="text-xl sm:text-2xl font-extrabold text-white truncate">
                    {user.displayName}
                  </h1>
                  <FemaleVerifiedBadge badge={user.femaleVerifiedBadge} />
                </div>

                <div className="flex items-center flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleCopyId}
                    className="inline-flex items-center gap-1 rounded-full bg-white/10 hover:bg-white/15 px-2.5 py-0.5 text-xs font-mono-num text-slate-200 cursor-pointer"
                  >
                    <span>ID: {numericId}</span>
                    {copiedId ? (
                      <Check className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Copy className="w-3 h-3 text-slate-300" />
                    )}
                  </button>

                  <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/25 border border-violet-300/40 px-2.5 py-0.5 text-[11px] font-bold text-violet-100 font-mono-num">
                    <Crown className="w-3 h-3 text-amber-300" />
                    Lv.{user.level}
                  </span>
                </div>

                <p className="text-[11px] text-slate-300 line-clamp-1">{user.bio}</p>
              </div>
            </div>
          </div>

          {/* 4 Stats Row + Active 3D Card */}
          <div className="grid grid-cols-12 items-center gap-3 pt-1">
            <div className="col-span-7 grid grid-cols-4 gap-1 text-center">
              <div className="space-y-0.5">
                <span className="block text-base sm:text-lg font-extrabold font-mono-num">
                  {Math.max(12, user.level * 5)}
                </span>
                <span className="block text-[11px] text-slate-400">الأصدقاء</span>
              </div>
              <div className="space-y-0.5">
                <span className="block text-base sm:text-lg font-extrabold font-mono-num">
                  {Math.max(24, user.level * 9)}
                </span>
                <span className="block text-[11px] text-slate-400">التالية</span>
              </div>
              <div className="space-y-0.5">
                <span className="block text-base sm:text-lg font-extrabold font-mono-num">
                  {user.referralCount || 0}
                </span>
                <span className="block text-[11px] text-slate-400">أتابع</span>
              </div>
              <div className="space-y-0.5">
                <span className="block text-base sm:text-lg font-extrabold font-mono-num">
                  {Math.max(0, Math.floor(user.xp / 50))}
                </span>
                <span className="block text-[11px] text-slate-400">زائر</span>
              </div>
            </div>

            <div className="col-span-5 flex justify-end">
              <button
                type="button"
                onClick={() => navigate('/store')}
                className="rounded-2xl bg-white/10 hover:bg-white/15 border border-white/15 px-3.5 py-2.5 flex items-center gap-1.5 text-xs font-extrabold text-[#FCE9A6] cursor-pointer transition shadow-md"
              >
                <span className="text-base">{active3D.badgeGlyph}</span>
                <span>احصل على SVIP</span>
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Crisp White Rounded Body */}
      <div className="max-w-3xl mx-auto -mt-6 relative z-20 rounded-t-[28px] bg-[#F5F6FA] px-4 pt-5 space-y-4">
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

        {/* 4 Quick Icons Bar (مستواي - المتجر - الحقيبة - عائلة) */}
        <section className="light-card rounded-3xl p-4 grid grid-cols-4 gap-2 text-center">
          <button
            type="button"
            onClick={() => setShowEditModal(true)}
            className="flex flex-col items-center gap-1.5 cursor-pointer group"
          >
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-100 to-amber-200 border border-amber-300/70 flex items-center justify-center text-amber-700 group-hover:scale-105 transition">
              <Crown className="w-6 h-6" />
            </div>
            <span className="text-xs font-extrabold text-slate-800">مستواي</span>
            <span className="text-[10px] text-amber-600 font-mono-num font-bold">
              {xpProgress}% XP
            </span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/store')}
            className="flex flex-col items-center gap-1.5 cursor-pointer group"
          >
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-200 border border-emerald-300/70 flex items-center justify-center text-emerald-700 group-hover:scale-105 transition">
              <Store className="w-6 h-6" />
            </div>
            <span className="text-xs font-extrabold text-slate-800">المتجر</span>
            <span className="text-[10px] text-emerald-600 font-bold">دخوليات 3D</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/bag')}
            className="flex flex-col items-center gap-1.5 cursor-pointer group"
          >
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-100 to-indigo-200 border border-sky-300/70 flex items-center justify-center text-sky-700 group-hover:scale-105 transition">
              <Briefcase className="w-6 h-6" />
            </div>
            <span className="text-xs font-extrabold text-slate-800">الحقيبة</span>
            <span className="text-[10px] text-sky-600 font-bold">ألماس وممتلكات</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/agency')}
            className="flex flex-col items-center gap-1.5 cursor-pointer group"
          >
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-lime-100 to-emerald-200 border border-lime-300/70 flex items-center justify-center text-emerald-700 group-hover:scale-105 transition">
              <Shield className="w-6 h-6" />
            </div>
            <span className="text-xs font-extrabold text-slate-800">عائلة</span>
            <span className="text-[10px] text-slate-500 font-bold">الوكالات</span>
          </button>
        </section>

        {/* Dual Wallet Summary Card */}
        <section className="light-card rounded-3xl p-4 grid grid-cols-2 divide-x divide-x-reverse divide-slate-100">
          <button
            type="button"
            onClick={() => navigate('/wallet')}
            className="pl-3 text-right space-y-1.5 cursor-pointer group"
          >
            <div className="flex items-center justify-between text-xs text-slate-500 font-bold">
              <span>كوينز</span>
              <span className="text-slate-400 group-hover:text-emerald-600 flex items-center gap-0.5">
                المحفظة
                <ChevronLeft className="w-3.5 h-3.5" />
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
                <Coins className="w-4 h-4" />
              </div>
              <span className="text-lg font-black text-slate-900 font-mono-num">
                {user.coins.toLocaleString('en-US')}
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => navigate('/bag')}
            className="pr-4 text-right space-y-1.5 cursor-pointer group"
          >
            <div className="flex items-center justify-between text-xs text-slate-500 font-bold">
              <span>ألماس</span>
              <span className="text-slate-400 group-hover:text-sky-600 flex items-center gap-0.5">
                الحقيبة
                <ChevronLeft className="w-3.5 h-3.5" />
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-sky-100 flex items-center justify-center text-sky-600">
                <Gem className="w-4 h-4" />
              </div>
              <span className="text-lg font-black text-slate-900 font-mono-num">
                {user.diamonds.toLocaleString('en-US')}
              </span>
            </div>
          </button>
        </section>

        {/* Female Voice Verification Card if applicable */}
        <FemaleVoiceVerificationCard />

        {/* 4 Pastel Feature Tiles matching Screenshot 2 */}
        <section className="light-card rounded-3xl p-4 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => navigate('/agency')}
            className="rounded-2xl bg-emerald-50/90 hover:bg-emerald-100/80 border border-emerald-100 p-4 flex items-center justify-between cursor-pointer transition"
          >
            <span className="text-sm font-extrabold text-emerald-950">وكالتي</span>
            <div className="w-10 h-10 rounded-xl bg-white/80 flex items-center justify-center text-emerald-600 shadow-sm">
              <Building2 className="w-5 h-5" />
            </div>
          </button>

          <button
            type="button"
            onClick={() => navigate('/agency')}
            className="rounded-2xl bg-violet-50/90 hover:bg-violet-100/80 border border-violet-100 p-4 flex items-center justify-between cursor-pointer transition"
          >
            <span className="text-sm font-extrabold text-violet-950">مركز المضيف</span>
            <div className="w-10 h-10 rounded-xl bg-white/80 flex items-center justify-center text-violet-600 shadow-sm">
              <Mic2 className="w-5 h-5" />
            </div>
          </button>

          <button
            type="button"
            onClick={() => navigate('/competitions')}
            className="rounded-2xl bg-amber-50/90 hover:bg-amber-100/80 border border-amber-100 p-4 flex items-center justify-between cursor-pointer transition"
          >
            <span className="text-sm font-extrabold text-amber-950">مركز المهام</span>
            <div className="w-10 h-10 rounded-xl bg-white/80 flex items-center justify-center text-amber-600 shadow-sm">
              <Sparkles className="w-5 h-5" />
            </div>
          </button>

          <button
            type="button"
            onClick={() => navigate('/competitions')}
            className="rounded-2xl bg-rose-50/90 hover:bg-rose-100/80 border border-rose-100 p-4 flex items-center justify-between cursor-pointer transition"
          >
            <span className="text-sm font-extrabold text-rose-950">دعوة الأصدقاء</span>
            <div className="w-10 h-10 rounded-xl bg-white/80 flex items-center justify-center text-rose-600 shadow-sm">
              <Gift className="w-5 h-5" />
            </div>
          </button>
        </section>

        {/* Bottom Utility Row */}
        <section className="light-card rounded-3xl p-4 grid grid-cols-4 gap-2 text-center">
          <button
            type="button"
            onClick={() => setShowEditModal(true)}
            className="flex flex-col items-center gap-1.5 text-slate-600 hover:text-emerald-600 cursor-pointer transition"
          >
            <UserIcon className="w-5 h-5" />
            <span className="text-xs font-bold">الحساب</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/games')}
            className="flex flex-col items-center gap-1.5 text-slate-600 hover:text-emerald-600 cursor-pointer transition"
          >
            <Gamepad2 className="w-5 h-5" />
            <span className="text-xs font-bold">الألعاب</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/wallet')}
            className="flex flex-col items-center gap-1.5 text-slate-600 hover:text-emerald-600 cursor-pointer transition"
          >
            <Coins className="w-5 h-5" />
            <span className="text-xs font-bold">الشحن USDT</span>
          </button>

          <button
            type="button"
            onClick={handleLogout}
            className="flex flex-col items-center gap-1.5 text-rose-500 hover:text-rose-700 cursor-pointer transition"
          >
            <LogOut className="w-5 h-5" />
            <span className="text-xs font-bold">خروج</span>
          </button>
        </section>

        <div className="flex justify-center">
          <PWAInstallButton variant="full" />
        </div>
      </div>

      {/* Edit Profile & Animated Avatar Modal */}
      {showEditModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4"
          onClick={() => setShowEditModal(false)}
        >
          <form
            onSubmit={handleSave}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg max-h-[90vh] overflow-y-auto no-scrollbar rounded-3xl bg-white border border-slate-200 p-6 space-y-4 shadow-2xl text-slate-900"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-extrabold text-slate-900">تعديل الملف الشخصي</h2>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700">
                الصورة الشخصية (اختر رمزاً أو ارفع صورة ثابتة / متحركة GIF & WebP)
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-2xl border-2 border-dashed border-amber-400 bg-amber-50 px-3.5 py-2 text-xs font-extrabold text-amber-800 flex items-center gap-1.5 cursor-pointer hover:bg-amber-100 transition"
                >
                  <Camera className="w-4 h-4 text-amber-600" />
                  <span>رفع صورة / GIF من المعرض</span>
                </button>
                {AVATAR_CHOICES.map((choice) => (
                  <button
                    key={choice.id}
                    type="button"
                    onClick={() => setAvatarUrl(choice.id)}
                    className={`p-1 rounded-xl border cursor-pointer transition ${
                      avatarUrl === choice.id
                        ? 'border-emerald-500 bg-emerald-50'
                        : 'border-slate-200 bg-slate-50'
                    }`}
                  >
                    <img
                      src={choice.src}
                      alt={choice.label}
                      className="w-9 h-9 rounded-lg object-cover"
                    />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                الاسم الظاهر
              </label>
              <input
                type="text"
                required
                minLength={2}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                النبذة التعريفية
              </label>
              <textarea
                rows={2}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  فئة الحساب
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setGender('male')}
                    className={`min-h-[40px] rounded-xl text-xs font-bold border cursor-pointer ${
                      gender === 'male'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-800'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    عضو
                  </button>
                  <button
                    type="button"
                    onClick={() => setGender('female')}
                    className={`min-h-[40px] rounded-xl text-xs font-bold border cursor-pointer ${
                      gender === 'female'
                        ? 'bg-pink-50 border-pink-400 text-pink-800'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    حساب نسائي 💎
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  وضع المضيف
                </label>
                <button
                  type="button"
                  onClick={() => setIsHost((prev) => !prev)}
                  className={`w-full min-h-[40px] rounded-xl text-xs font-bold border cursor-pointer px-3 ${
                    isHost
                      ? 'bg-sky-50 border-sky-400 text-sky-800'
                      : 'bg-slate-50 border-slate-200 text-slate-600'
                  }`}
                >
                  {isHost ? 'مضيف وكالة مفعّل ✓' : 'تفعيل حساب كمضيف وكالة'}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="emerald-btn w-full min-h-[46px] rounded-2xl py-2.5 text-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'جارٍ الحفظ...' : 'حفظ التعديلات'}</span>
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
