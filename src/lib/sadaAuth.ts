import type { User } from '../types';
import {
  genId,
  getUserVipTierInfo,
  isSuperAdminUser,
  SUPER_ADMIN_EMAIL,
} from './sadaCatalog';
import {
  DEVICE_LOCK_COLUMNS,
  ensureGlobalZeroResetInSupabase,
  getPlatformState,
  purgeExpiredRewardsOnUser,
  rowToUser,
  savePlatformState,
  USER_COLUMNS,
  userToRow,
} from './sadaMappers';
import { enrichUserWithVipTotals } from './sadaVipService';
import { supabase } from './supabase';

async function sha256Hex(input: string): Promise<string> {
  try {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const data = new TextEncoder().encode(`sada_v2:${input}`);
      const buf = await crypto.subtle.digest('SHA-256', data);
      return Array.from(new Uint8Array(buf))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    }
  } catch {
    // fallback below
  }
  return `sb_auth_${Date.now().toString(36)}`;
}

function translateAuthError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('invalid login credentials')) {
    return 'البريد الإلكتروني أو كلمة المرور غير صحيحة.';
  }
  if (lower.includes('email not confirmed')) {
    return 'يرجى تفعيل بريدك الإلكتروني عبر الرابط المرسل إلى بريدك (أو تعطيل خيار Confirm email في إعدادات Supabase Auth).';
  }
  if (lower.includes('user already registered') || lower.includes('already been registered')) {
    return 'هذا البريد الإلكتروني مسجل مسبقاً. يرجى التبديل إلى تبويب "تسجيل الدخول".';
  }
  if (lower.includes('password should be at least')) {
    return 'كلمة المرور يجب أن تتكون من 6 أحرف على الأقل.';
  }
  if (lower.includes('unable to validate email') || lower.includes('invalid email')) {
    return 'يرجى إدخال بريد إلكتروني صحيح.';
  }
  if (lower.includes('rate limit') || lower.includes('too many requests')) {
    return 'تم إرسال محاولات كثيرة مؤقتاً، يرجى الانتظار قليلاً ثم المحاولة مجدداً.';
  }
  return message || 'تعذّر الاتصال بخدمة المصادقة في Supabase.';
}

async function logSecurityEvent(
  type: 'MULTI_ACCOUNT_BLOCKED' | 'BLOCKED_DEVICE_LOGIN',
  email: string,
  deviceUuid: string,
  details: string
) {
  await supabase.from('sada_security_logs').insert({
    id: genId('sec'),
    type,
    email,
    device_uuid: deviceUuid,
    details,
    timestamp: new Date().toISOString(),
  });
}

async function checkDeviceLock(email: string, deviceUuid: string, isSuperAdmin: boolean) {
  if (isSuperAdmin) return;
  const { data: lock } = await supabase
    .from('sada_device_locks')
    .select(DEVICE_LOCK_COLUMNS)
    .eq('device_uuid', deviceUuid)
    .maybeSingle();

  if (!lock) return;

  if (lock.is_blocked) {
    await logSecurityEvent(
      'BLOCKED_DEVICE_LOGIN',
      email,
      deviceUuid,
      'محاولة دخول من جهاز محظور.'
    );
    throw new Error(
      String(lock.blocked_reason || 'هذا الجهاز محظور من دخول منصة صَدَى.')
    );
  }

  const boundEmail = String(lock.bound_email || '').toLowerCase();
  if (boundEmail && boundEmail !== email.toLowerCase()) {
    await logSecurityEvent(
      'MULTI_ACCOUNT_BLOCKED',
      email,
      deviceUuid,
      `تم رفض تسجيل حساب ثانٍ على جهاز مرتبط بالحساب (${boundEmail}).`
    );
    throw new Error(
      `حماية الحساب الواحد: هذا الجهاز مرتبط مسبقاً بالحساب (${boundEmail}). لا يُسمح بفتح أكثر من حساب على نفس الجهاز.`
    );
  }
}

async function upsertDeviceLock(user: User, deviceUuid: string) {
  const now = new Date().toISOString();
  await supabase.from('sada_device_locks').upsert(
    {
      device_uuid: deviceUuid,
      bound_user_id: user.id,
      bound_email: user.email.toLowerCase(),
      is_blocked: false,
      blocked_reason: null,
      created_at: now,
      last_attempt_at: now,
    },
    { onConflict: 'device_uuid' }
  );
}

async function createUserProfileRow(params: {
  id: string;
  email: string;
  displayName: string;
  gender: 'female' | 'male';
  deviceUuid: string;
  passwordHash: string;
  referralCodeInput?: string;
}): Promise<User> {
  const now = new Date().toISOString();
  const cleanEmail = params.email.toLowerCase();
  const isSuperAdmin = cleanEmail === SUPER_ADMIN_EMAIL;
  const userGender = isSuperAdmin ? 'male' : params.gender;

  let validReferrer: User | null = null;
  const cleanRef = (params.referralCodeInput || '').trim().toUpperCase();
  if (cleanRef) {
    const { data: refRow } = await supabase
      .from('sada_users')
      .select(USER_COLUMNS)
      .eq('referral_code', cleanRef)
      .maybeSingle();
    if (refRow && String(refRow.email).toLowerCase() !== cleanEmail) {
      validReferrer = rowToUser(refRow);
    }
  }

  const ownReferralCode = `REF-${params.id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase()}`;

  const newUser: User = {
    id: params.id,
    email: cleanEmail,
    displayName: params.displayName || (isSuperAdmin ? 'المدير العام — صَدَى' : 'عضو صَدَى'),
    bio: isSuperAdmin
      ? 'المدير العام ومؤسس منصة صَدَى - SADA.'
      : 'عضو جديد في منصة صَدَى - SADA.',
    avatarUrl: isSuperAdmin
      ? 'host_male'
      : userGender === 'female'
      ? 'host_female'
      : 'host_male',
    gender: userGender,
    femaleVoiceStatus:
      userGender === 'female' && !isSuperAdmin ? 'unverified' : 'none',
    femaleVerified: false,
    femaleVerifiedBadge: null,
    femaleVoiceNote: null,
    isHost: false,
    isAgent: false,
    agencyId: null,
    hostBadge: null,
    hostAgencyName: null,
    hostDiamondsEarned: 0,
    referralCode: ownReferralCode,
    referredBy: validReferrer ? validReferrer.id : null,
    referralCount: 0,
    referralSpins: 0,
    frameId: 'frame_obsidian',
    unlockedFrames: ['frame_obsidian'],
    previousPermanentFrameId: null,
    tempFrameId: null,
    tempFrameExpiresAt: null,
    activeEntryId: null,
    activeEntryName: null,
    tempEntryExpiresAt: null,
    coins: 0,
    diamonds: 0,
    level: 1,
    xp: 0,
    role: isSuperAdmin ? 'admin' : 'user',
    is_admin: isSuperAdmin,
    is_banned: false,
    device_uuid: params.deviceUuid,
    createdAt: now,
    lastSeen: now,
  };

  const { error: insertErr } = await supabase
    .from('sada_users')
    .upsert(userToRow(newUser, params.passwordHash), { onConflict: 'email' });

  if (insertErr) {
    throw new Error(`تعذّر حفظ بيانات الحساب في Supabase: ${insertErr.message}`);
  }

  await upsertDeviceLock(newUser, params.deviceUuid);

  if (validReferrer) {
    await supabase
      .from('sada_users')
      .update({
        referral_count: (validReferrer.referralCount || 0) + 1,
        referral_spins: (validReferrer.referralSpins || 0) + 1,
      })
      .eq('id', validReferrer.id);
  }

  return newUser;
}

export async function loginOrRegisterWithSupabase(payload: {
  email: string;
  password: string;
  displayName?: string;
  gender?: 'female' | 'male';
  age?: number;
  country?: string;
  referralCode?: string;
  mode: 'login' | 'register';
  deviceUuid: string;
}): Promise<{ user: User; redirectTo: string }> {
  const cleanEmail = (payload.email || '').trim().toLowerCase();
  const cleanPassword = payload.password || '';
  const deviceUuid = (payload.deviceUuid || '').trim();

  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    throw new Error('يرجى إدخال بريد إلكتروني صحيح.');
  }
  if (cleanPassword.length < 6) {
    throw new Error('كلمة المرور يجب أن تكون 6 أحرف على الأقل.');
  }
  if (!deviceUuid || deviceUuid.length < 8) {
    throw new Error('تعذّر التحقق من معرّف الجهاز.');
  }

  const isSuperAdmin = cleanEmail === SUPER_ADMIN_EMAIL;

  if (payload.mode === 'register') {
    const cleanName = (payload.displayName || '').trim();
    if (cleanName.length < 2) {
      throw new Error('يرجى إدخال الاسم الظاهر (حرفان على الأقل).');
    }

    await checkDeviceLock(cleanEmail, deviceUuid, isSuperAdmin);

    const { data: existingProfile } = await supabase
      .from('sada_users')
      .select('id')
      .eq('email', cleanEmail)
      .maybeSingle();

    if (existingProfile) {
      throw new Error(
        'هذا البريد الإلكتروني مسجل مسبقاً في قاعدة البيانات. يرجى التبديل إلى "تسجيل الدخول".'
      );
    }

    const userGender: 'female' | 'male' =
      payload.gender === 'female' ? 'female' : 'male';

    const { data: authData, error: authErr } = await supabase.auth.signUp({
      email: cleanEmail,
      password: cleanPassword,
      options: {
        data: {
          display_name: cleanName,
          gender: userGender,
        },
      },
    });

    if (authErr) {
      throw new Error(translateAuthError(authErr.message));
    }

    const authUserId = authData.user?.id || genId('user');
    const pwdHash = await sha256Hex(cleanPassword);

    const createdUser = await createUserProfileRow({
      id: authUserId,
      email: cleanEmail,
      displayName: cleanName,
      gender: userGender,
      deviceUuid,
      passwordHash: pwdHash,
      referralCodeInput: payload.referralCode,
    });

    const cleanAge =
      typeof payload.age === 'number' && payload.age >= 18 && payload.age <= 80
        ? Math.round(payload.age)
        : undefined;
    const cleanCountry = (payload.country || '').trim() || undefined;
    if (cleanAge || cleanCountry) {
      createdUser.age = cleanAge;
      createdUser.country = cleanCountry;
      const st = await getPlatformState();
      await savePlatformState({
        settings: {
          ...st.settings,
          userMeta: {
            ...(st.settings.userMeta || {}),
            [createdUser.id]: {
              age: cleanAge,
              country: cleanCountry,
            },
          },
        },
      });
    }

    if (!authData.session) {
      // Attempt immediate sign-in in case auto-confirm is active; otherwise prompt user
      const { data: signInTry } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: cleanPassword,
      });
      if (!signInTry.session) {
        throw new Error(
          'تم إنشاء حسابك في Supabase وحفظ بياناتك! يرجى تأكيد بريدك الإلكتروني عبر الرابط المرسل ثم تسجيل الدخول.'
        );
      }
    }

    return {
      user: createdUser,
      redirectTo: isSuperAdminUser(createdUser) ? '/admin' : '/',
    };
  }

  // LOGIN FLOW via Supabase Auth
  const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
    email: cleanEmail,
    password: cleanPassword,
  });

  if (signInErr || !signInData.user) {
    throw new Error(translateAuthError(signInErr?.message || ''));
  }

  await ensureGlobalZeroResetInSupabase();

  const { data: byEmail } = await supabase
    .from('sada_users')
    .select(USER_COLUMNS)
    .eq('email', cleanEmail)
    .maybeSingle();

  let profile: User;
  if (byEmail) {
    profile = rowToUser(byEmail);
  } else {
    const metaName = String(
      signInData.user.user_metadata?.display_name ||
        cleanEmail.split('@')[0] ||
        'عضو صَدَى'
    );
    const metaGender =
      signInData.user.user_metadata?.gender === 'female' ? 'female' : 'male';
    const pwdHash = await sha256Hex(cleanPassword);
    profile = await createUserProfileRow({
      id: signInData.user.id,
      email: cleanEmail,
      displayName: metaName,
      gender: metaGender,
      deviceUuid,
      passwordHash: pwdHash,
    });
  }

  if (profile.is_banned && !isSuperAdmin) {
    await supabase.auth.signOut();
    throw new Error('تم تعليق هذا الحساب من قِبل الإدارة.');
  }

  try {
    await checkDeviceLock(cleanEmail, deviceUuid, isSuperAdmin);
  } catch (err) {
    await supabase.auth.signOut();
    throw err;
  }

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { last_seen: now };
  if (isSuperAdmin && (!profile.is_admin || profile.is_banned)) {
    profile.is_admin = true;
    profile.is_banned = false;
    patch.is_admin = true;
    patch.is_banned = false;
  }
  await supabase.from('sada_users').update(patch).eq('id', profile.id);
  await upsertDeviceLock(profile, deviceUuid);
  await purgeExpiredRewardsOnUser(profile);
  const metaState = await getPlatformState().catch(() => null);
  const meta = metaState?.settings?.userMeta?.[profile.id];
  if (meta) {
    profile.age = meta.age;
    profile.country = meta.country;
  }

  return {
    user: profile,
    redirectTo: isSuperAdminUser(profile) ? '/admin' : '/',
  };
}

export async function fetchCurrentUserFromSupabaseSession(
  deviceUuid: string
): Promise<User | null> {
  const { data: sessionData } = await supabase.auth.getSession();
  const authUser = sessionData.session?.user;
  if (!authUser || !authUser.email) return null;

  const cleanEmail = authUser.email.toLowerCase();
  const isSuperAdmin = cleanEmail === SUPER_ADMIN_EMAIL;

  void ensureGlobalZeroResetInSupabase();

  const { data: row } = await supabase
    .from('sada_users')
    .select(USER_COLUMNS)
    .eq('email', cleanEmail)
    .maybeSingle();

  let profile: User;
  if (row) {
    profile = rowToUser(row);
  } else {
    const metaName = String(
      authUser.user_metadata?.display_name || cleanEmail.split('@')[0] || 'عضو صَدَى'
    );
    const metaGender =
      authUser.user_metadata?.gender === 'female' ? 'female' : 'male';
    const pwdHash = await sha256Hex(authUser.id);
    profile = await createUserProfileRow({
      id: authUser.id,
      email: cleanEmail,
      displayName: metaName,
      gender: metaGender,
      deviceUuid: deviceUuid || 'web-device',
      passwordHash: pwdHash,
    });
  }

  if (profile.is_banned && !isSuperAdmin) {
    await supabase.auth.signOut();
    return null;
  }

  const now = new Date().toISOString();
  if (isSuperAdmin && !row?.is_admin) {
    profile.is_admin = true;
    await supabase
      .from('sada_users')
      .update({ is_admin: true, is_banned: false, last_seen: now })
      .eq('id', profile.id);
  }

  await purgeExpiredRewardsOnUser(profile).catch(() => false);
  const metaState = await getPlatformState().catch(() => null);
  const meta = metaState?.settings?.userMeta?.[profile.id];
  if (meta) {
    profile.age = meta.age;
    profile.country = meta.country;
  }
  return Promise.race([
    enrichUserWithVipTotals(profile).catch(() => profile),
    new Promise<User>((resolve) => setTimeout(() => resolve(profile), 1500)),
  ]);
}

export async function logoutFromSupabase(): Promise<void> {
  await supabase.auth.signOut();
}

export async function updateProfileInSupabase(
  currentUser: User,
  payload: {
    displayName?: string;
    bio?: string;
    avatarUrl?: string;
    gender?: 'female' | 'male';
    isHost?: boolean;
  }
): Promise<User> {
  const next = { ...currentUser };
  if (typeof payload.displayName === 'string' && payload.displayName.trim().length >= 2) {
    next.displayName = payload.displayName.trim().slice(0, 32);
  }
  if (typeof payload.bio === 'string') {
    next.bio = payload.bio.trim().slice(0, 160);
  }
  if (typeof payload.avatarUrl === 'string' && payload.avatarUrl.trim().length > 0) {
    next.avatarUrl = payload.avatarUrl.trim();
  }
  if (payload.gender === 'female' || payload.gender === 'male') {
    const prevGender = next.gender || 'male';
    next.gender = payload.gender;
    if (
      payload.gender === 'female' &&
      prevGender !== 'female' &&
      !next.is_admin &&
      next.femaleVoiceStatus !== 'verified'
    ) {
      next.femaleVoiceStatus = 'unverified';
      next.femaleVerified = false;
      next.femaleVerifiedBadge = null;
    } else if (payload.gender === 'male') {
      next.femaleVoiceStatus = 'none';
      next.femaleVerified = false;
      next.femaleVerifiedBadge = null;
    }
  }
  if (typeof payload.isHost === 'boolean') {
    next.isHost = payload.isHost;
  }
  next.lastSeen = new Date().toISOString();

  const { error } = await supabase
    .from('sada_users')
    .update({
      display_name: next.displayName,
      bio: next.bio,
      avatar_url: next.avatarUrl,
      gender: next.gender,
      female_voice_status: next.femaleVoiceStatus,
      female_verified: Boolean(next.femaleVerified),
      female_verified_badge: next.femaleVerifiedBadge || null,
      is_host: Boolean(next.isHost),
      last_seen: next.lastSeen,
    })
    .eq('id', next.id);

  if (error) {
    throw new Error('تعذّر حفظ تعديلات الملف الشخصي في Supabase.');
  }

  await syncUserOnActiveRoomSeats(next);
  return next;
}

export async function syncUserOnActiveRoomSeats(
  user: Pick<
    User,
    | 'id'
    | 'displayName'
    | 'avatarUrl'
    | 'frameId'
    | 'level'
    | 'femaleVerifiedBadge'
    | 'coins'
    | 'totalRecharged'
    | 'totalSpentCoins'
    | 'vipLevel'
  >
): Promise<void> {
  const { data: activeRooms } = await supabase
    .from('sada_rooms')
    .select('id, seats, host_id')
    .eq('is_active', true);

  const resolvedVipLevel = getUserVipTierInfo(user).key;

  for (const r of activeRooms || []) {
    const seats = Array.isArray(r.seats) ? (r.seats as Array<Record<string, unknown>>) : [];
    let dirty = false;
    const nextSeats = seats.map((s) => {
      if (s.userId === user.id) {
        dirty = true;
        return {
          ...s,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
          frameId: user.frameId,
          level: user.level,
          vipLevel: resolvedVipLevel,
          femaleVerifiedBadge: user.femaleVerifiedBadge || null,
        };
      }
      return s;
    });
    const hostPatch =
      String(r.host_id) === user.id
        ? { host_name: user.displayName, host_avatar: user.avatarUrl }
        : {};
    if (dirty || String(r.host_id) === user.id) {
      await supabase
        .from('sada_rooms')
        .update({
          ...(dirty ? { seats: nextSeats } : {}),
          ...hostPatch,
        })
        .eq('id', r.id);
    }
  }
}

export async function getUserPublicProfileFromSupabase(userId: string): Promise<User | null> {
  const { data } = await supabase
    .from('sada_users')
    .select(USER_COLUMNS)
    .eq('id', userId)
    .maybeSingle();
  if (!data) return null;
  const user = rowToUser(data);
  const state = await getPlatformState().catch(() => null);
  const meta = state?.settings?.userMeta?.[user.id];
  if (meta) {
    user.age = meta.age;
    user.country = meta.country;
  }
  return enrichUserWithVipTotals(user).catch(() => user);
}
