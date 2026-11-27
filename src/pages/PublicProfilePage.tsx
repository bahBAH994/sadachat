import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, MapPin, UserRound } from 'lucide-react';
import { AvatarWithFrame, VipTierBadge, VipUserName } from '../components/AvatarWithFrame';
import { GenderBadge } from '../components/GenderBadge';
import { ARAB_COUNTRIES, getUserVipTierInfo } from '../lib/sadaCatalog';
import { getUserPublicProfileFromSupabase } from '../lib/sadaAuth';
import { useAuth } from '../context/AuthContext';
import type { User } from '../types';

export const PublicProfilePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!id) {
      setError('الملف الشخصي غير موجود.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    void getUserPublicProfileFromSupabase(id)
      .then((result) => {
        if (!active) return;
        if (!result) {
          setError('تعذّر العثور على هذا الملف الشخصي.');
          return;
        }
        setProfile(result);
      })
      .catch((err: unknown) => {
        if (active) {
          setError(err instanceof Error ? err.message : 'تعذّر تحميل الملف الشخصي.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id]);

  const frameId = profile?.frameId;
  const country = profile?.country
    ? ARAB_COUNTRIES.find((item) => item.code === profile.country)
    : undefined;

  return (
    <div className="min-h-full bg-slate-100 px-4 py-5">
      <div className="mx-auto max-w-xl space-y-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-white px-3 text-sm font-bold text-slate-700 shadow-sm cursor-pointer"
        >
          <ArrowRight className="w-4 h-4" />
          رجوع
        </button>

        {loading ? (
          <div className="rounded-3xl bg-white p-8 text-center text-sm font-bold text-slate-500">
            جارٍ تحميل الملف الشخصي...
          </div>
        ) : error || !profile ? (
          <div className="rounded-3xl border border-rose-200 bg-white p-8 text-center text-sm font-bold text-rose-700">
            {error || 'تعذّر تحميل الملف الشخصي.'}
          </div>
        ) : (
          <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col items-center gap-3 bg-gradient-to-br from-slate-900 to-slate-800 px-5 py-8 text-center text-white">
              <AvatarWithFrame
                src={profile.avatarUrl}
                alt={profile.displayName}
                frameId={frameId}
                vipTier={profile.vipLevel || getUserVipTierInfo(profile).key}
                size="xl"
              />
              <div className="space-y-1">
                <div className="flex items-center justify-center gap-1">
                  <h1 className="text-xl font-extrabold">
                    <VipUserName name={profile.displayName} vipTier={profile.vipLevel} />
                  </h1>
                  <GenderBadge gender={profile.gender} />
                </div>
                <div className="flex items-center justify-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-xs font-mono-num">
                    <UserRound className="w-3.5 h-3.5" />
                    Lv.{profile.level}
                  </span>
                  <VipTierBadge vipTier={profile.vipLevel} />
                </div>
              </div>
            </div>

            <div className="space-y-4 p-5">
              <div>
                <h2 className="mb-1 text-xs font-extrabold text-slate-500">نبذة</h2>
                <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">
                  {profile.bio || 'لا توجد نبذة شخصية.'}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs font-bold text-slate-600">
                {profile.age && (
                  <span className="rounded-full bg-amber-50 px-3 py-1.5">{profile.age} سنة</span>
                )}
                {country && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-3 py-1.5">
                    <MapPin className="w-3 h-3" />
                    {country.flag} {country.label}
                  </span>
                )}
                {profile.isHost && (
                  <span className="rounded-full bg-emerald-50 px-3 py-1.5">
                    {profile.hostAgencyName ? `مضيف · ${profile.hostAgencyName}` : 'مضيف رسمي'}
                  </span>
                )}
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
};
