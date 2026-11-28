import React, { useEffect, useState } from 'react';
import { ArrowRight, Bell, Eye, Headphones, Shield, Sparkles, Volume2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { safeGetItem, safeSetItem } from '../lib/safeStorage';
import { supabase } from '../lib/supabase';
import type { UserPreferences } from '../types';

const DEFAULT_PREFERENCES: UserPreferences = {
  hideOnlineStatus: false,
  roomStealthMode: false,
  friendsOnlyMessages: false,
  giftAndEntranceEffects: true,
  callRingtone: true,
};

const preferenceGroups: Array<{
  title: string;
  icon: React.ReactNode;
  items: Array<{ key: keyof UserPreferences; label: string; description: string }>;
}> = [
  {
    title: 'الخصوصية',
    icon: <Shield className="h-5 w-5" />,
    items: [
      { key: 'hideOnlineStatus', label: 'إخفاء حالة الاتصال', description: 'لن يظهر للآخرين أنك متصل الآن.' },
      { key: 'roomStealthMode', label: 'وضع التخفي في الغرف', description: 'إخفاء ظهور دخولك عند زيارة الغرف.' },
      { key: 'friendsOnlyMessages', label: 'استقبال الرسائل من الأصدقاء فقط', description: 'تقييد الرسائل الخاصة على قائمة أصدقائك.' },
    ],
  },
  {
    title: 'الصوت',
    icon: <Volume2 className="h-5 w-5" />,
    items: [
      { key: 'giftAndEntranceEffects', label: 'مؤثرات الهدايا والدخوليات', description: 'تشغيل المؤثرات الصوتية للهدايا والدخوليات.' },
      { key: 'callRingtone', label: 'رنين المكالمات', description: 'تشغيل نغمة التنبيه عند ورود مكالمة.' },
    ],
  },
];

export const SettingsPage: React.FC = () => {
  const { user, updateLocalUser } = useAuth();
  const navigate = useNavigate();
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [savingKey, setSavingKey] = useState<keyof UserPreferences | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    let active = true;
    const loadPreferences = async () => {
      try {
        const localValue = safeGetItem(`sada_user_preferences_${user.id}`);
        const localPreferences = localValue
          ? (JSON.parse(localValue) as Partial<UserPreferences>)
          : {};
        const { data, error } = await supabase
          .from('sada_users')
          .select('preferences')
          .eq('id', user.id)
          .maybeSingle();
        if (error) throw new Error(`تعذّر تحميل الإعدادات: ${error.message}`);
        const remotePreferences =
          data?.preferences && typeof data.preferences === 'object'
            ? (data.preferences as Partial<UserPreferences>)
            : {};
        const next = { ...DEFAULT_PREFERENCES, ...localPreferences, ...remotePreferences };
        if (!active) return;
        setPreferences(next);
        safeSetItem(`sada_user_preferences_${user.id}`, JSON.stringify(next));
        setReady(true);
      } catch (error) {
        if (active) {
          setFeedback({
            type: 'err',
            text: error instanceof Error ? error.message : 'تعذّر تحميل الإعدادات.',
          });
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadPreferences();
    return () => {
      active = false;
    };
  }, [user?.id]);

  const handleToggle = async (key: keyof UserPreferences) => {
    if (!user || savingKey) return;
    const next = { ...preferences, [key]: !preferences[key] };
    setPreferences(next);
    safeSetItem(`sada_user_preferences_${user.id}`, JSON.stringify(next));
    setSavingKey(key);
    setFeedback(null);
    try {
      const { error } = await supabase
        .from('sada_users')
        .update({ preferences: next })
        .eq('id', user.id);
      if (error) throw new Error(`تعذّر حفظ الإعدادات على الخادم: ${error.message}`);
      updateLocalUser({ ...user, preferences: next });
      setFeedback({ type: 'ok', text: 'تم حفظ الإعدادات محلياً وفي حسابك.' });
    } catch (error) {
      setPreferences(preferences);
      safeSetItem(`sada_user_preferences_${user.id}`, JSON.stringify(preferences));
      setFeedback({
        type: 'err',
        text: error instanceof Error ? error.message : 'تعذّر حفظ الإعدادات.',
      });
    } finally {
      setSavingKey(null);
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-full bg-[#0F1117] px-4 py-4 pb-28 text-white">
      <div className="mx-auto max-w-2xl space-y-5">
        <header className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/profile')}
            aria-label="العودة إلى ملفي"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#D4AF37]/30 bg-white/5 text-[#D4AF37]"
          >
            <ArrowRight className="h-5 w-5" />
          </button>
          <div>
            <p className="text-xs font-bold text-[#D4AF37]">صَدَى · SADA v1.0</p>
            <h1 className="text-xl font-black text-[#FCE9A6]">الإعدادات</h1>
          </div>
        </header>

        {feedback && (
          <p
            role={feedback.type === 'err' ? 'alert' : 'status'}
            className={`rounded-2xl border px-4 py-3 text-xs font-bold ${
              feedback.type === 'ok'
                ? 'border-emerald-500/30 bg-emerald-950/30 text-emerald-200'
                : 'border-rose-500/30 bg-rose-950/30 text-rose-200'
            }`}
          >
            {feedback.text}
          </p>
        )}

        {preferenceGroups.map((group) => (
          <section
            key={group.title}
            className="rounded-3xl border border-[#D4AF37]/20 bg-[#171A22] p-4 shadow-xl"
          >
            <h2 className="mb-2 flex items-center gap-2 text-sm font-extrabold text-[#FCE9A6]">
              <span className="text-[#D4AF37]">{group.icon}</span>
              {group.title}
            </h2>
            <div className="divide-y divide-white/5">
              {group.items.map((item) => (
                <div key={item.key} className="flex items-center justify-between gap-4 py-3">
                  <div>
                    <p className="text-sm font-bold text-white">{item.label}</p>
                    <p className="mt-1 text-[11px] leading-5 text-slate-400">{item.description}</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={preferences[item.key]}
                    aria-label={item.label}
                    disabled={loading || !ready || savingKey !== null}
                    onClick={() => void handleToggle(item.key)}
                    className={`relative h-7 w-12 shrink-0 rounded-full border transition ${
                      preferences[item.key]
                        ? 'border-[#D4AF37] bg-[#D4AF37]'
                        : 'border-slate-600 bg-slate-700'
                    } disabled:opacity-50`}
                  >
                    <span
                      className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${
                        preferences[item.key] ? 'left-0.5' : 'left-[22px]'
                      }`}
                    />
                  </button>
                </div>
              ))}
            </div>
          </section>
        ))}

        <button
          type="button"
          onClick={() => window.alert('مركز الدعم الفني والمساعدة في صَدَى:\nلأي استفسار أو بلاغ أو تفعيل، تواصل مباشرةً مع الإدارة العليا عبر غرفة الدعم الرسمية أو البريد: support@sadachat.app')}
          className="flex min-h-14 w-full items-center gap-3 rounded-2xl border border-[#D4AF37]/25 bg-[#171A22] px-4 text-right text-sm font-extrabold text-[#FCE9A6]"
        >
          <Headphones className="h-5 w-5 text-[#D4AF37]" />
          <span className="flex-1">الدعم الفني والمساعدة</span>
          <Sparkles className="h-4 w-4 text-[#D4AF37]" />
        </button>
        <div className="flex items-center justify-center gap-2 pb-2 text-[11px] text-slate-500">
          <Eye className="h-3.5 w-3.5" />
          <Bell className="h-3.5 w-3.5" />
          <span>صدى · SADA v1.0</span>
        </div>
      </div>
    </div>
  );
};
