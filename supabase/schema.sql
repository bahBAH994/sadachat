-- ============================================================================
-- منصة صَدَى الملكية (SADA) — Supabase Full PostgreSQL Schema + Realtime
-- نفّذ هذا السكربت بالكامل داخل Supabase SQL Editor
-- ============================================================================

-- 1. جدول المستخدمين والأرصدة والتوثيق والإطارات
CREATE TABLE IF NOT EXISTS public.sada_users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  bio TEXT NOT NULL DEFAULT '',
  avatar_url TEXT NOT NULL DEFAULT 'host_male',
  gender TEXT NOT NULL DEFAULT 'male',
  female_voice_status TEXT NOT NULL DEFAULT 'none',
  female_verified BOOLEAN NOT NULL DEFAULT FALSE,
  female_verified_badge TEXT,
  female_voice_note TEXT,
  is_host BOOLEAN NOT NULL DEFAULT FALSE,
  is_agent BOOLEAN NOT NULL DEFAULT FALSE,
  agency_id TEXT,
  host_badge TEXT,
  host_agency_name TEXT,
  host_diamonds_earned BIGINT NOT NULL DEFAULT 0,
  referral_code TEXT,
  referred_by TEXT,
  referral_count INTEGER NOT NULL DEFAULT 0,
  referral_spins INTEGER NOT NULL DEFAULT 0,
  frame_id TEXT NOT NULL DEFAULT 'frame_obsidian',
  unlocked_frames JSONB NOT NULL DEFAULT '["frame_obsidian"]'::jsonb,
  previous_permanent_frame_id TEXT,
  temp_frame_id TEXT,
  temp_frame_expires_at TIMESTAMPTZ,
  active_entry_id TEXT,
  active_entry_name TEXT,
  temp_entry_expires_at TIMESTAMPTZ,
  coins BIGINT NOT NULL DEFAULT 10000,
  diamonds BIGINT NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 1,
  xp BIGINT NOT NULL DEFAULT 0,
  is_admin BOOLEAN NOT NULL DEFAULT FALSE,
  is_banned BOOLEAN NOT NULL DEFAULT FALSE,
  device_uuid TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sada_users_email ON public.sada_users(email);
CREATE INDEX IF NOT EXISTS idx_sada_users_device ON public.sada_users(device_uuid);
CREATE INDEX IF NOT EXISTS idx_sada_users_agency ON public.sada_users(agency_id);

-- 2. جدول جلسات تسجيل الدخول
CREATE TABLE IF NOT EXISTS public.sada_sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sada_sessions_user ON public.sada_sessions(user_id);

-- 3. جدول حماية الأجهزة (Device UUID) ومنع تعدد الحسابات
CREATE TABLE IF NOT EXISTS public.sada_device_locks (
  device_uuid TEXT PRIMARY KEY,
  bound_user_id TEXT NOT NULL,
  bound_email TEXT NOT NULL,
  is_blocked BOOLEAN NOT NULL DEFAULT FALSE,
  blocked_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. جدول السجلات الأمنية
CREATE TABLE IF NOT EXISTS public.sada_security_logs (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  email TEXT NOT NULL,
  device_uuid TEXT NOT NULL,
  details TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. جدول الغرف الصوتية والمقاعد
CREATE TABLE IF NOT EXISTS public.sada_rooms (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'حوار',
  description TEXT NOT NULL DEFAULT '',
  host_id TEXT NOT NULL,
  host_name TEXT NOT NULL,
  host_avatar TEXT NOT NULL,
  cover_image TEXT NOT NULL DEFAULT 'royal_stage',
  is_private BOOLEAN NOT NULL DEFAULT FALSE,
  password TEXT,
  max_seats INTEGER NOT NULL DEFAULT 8,
  seats JSONB NOT NULL DEFAULT '[]'::jsonb,
  listeners_count INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  total_gifts_coins BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. جدول الدردشة الفورية داخل الغرف الصوتية
CREATE TABLE IF NOT EXISTS public.sada_room_messages (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES public.sada_rooms(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  level INTEGER NOT NULL DEFAULT 1,
  is_admin BOOLEAN NOT NULL DEFAULT FALSE,
  vip_tier TEXT,
  host_badge TEXT,
  female_verified_badge TEXT,
  text TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'chat',
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sada_room_msgs_room ON public.sada_room_messages(room_id, timestamp);

-- 7. جدول الرسائل الخاصة المدفوعة ومكافآت الألماس
CREATE TABLE IF NOT EXISTS public.sada_private_messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  recipient_id TEXT NOT NULL,
  text TEXT NOT NULL,
  coins_paid BIGINT NOT NULL DEFAULT 0,
  diamonds_potential BIGINT NOT NULL DEFAULT 0,
  diamonds_claimed BOOLEAN NOT NULL DEFAULT FALSE,
  diamonds_awarded BIGINT NOT NULL DEFAULT 0,
  gift_id TEXT,
  gift_name TEXT,
  gift_glyph TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  replied_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sada_pm_conv ON public.sada_private_messages(conversation_id, created_at);

-- 8. جدول كتالوج الهدايا (الثابتة والحظ)
CREATE TABLE IF NOT EXISTS public.sada_gifts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  coins_cost BIGINT NOT NULL,
  diamonds_value BIGINT NOT NULL,
  xp_gain INTEGER NOT NULL DEFAULT 0,
  tier TEXT NOT NULL DEFAULT 'classic',
  category TEXT NOT NULL DEFAULT 'fixed',
  glyph TEXT NOT NULL
);

-- 9. جدول المعاملات المالية (الكوينز، الألماس، الألعاب، الهدايا، العمولات)
CREATE TABLE IF NOT EXISTS public.sada_transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  amount BIGINT NOT NULL,
  currency TEXT NOT NULL,
  description TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sada_tx_user ON public.sada_transactions(user_id, timestamp DESC);

-- 10. جدول الوكالات والمضيفين ونسب العمولات
CREATE TABLE IF NOT EXISTS public.sada_agencies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  code TEXT UNIQUE NOT NULL,
  owner_id TEXT NOT NULL,
  owner_name TEXT NOT NULL,
  owner_avatar TEXT NOT NULL,
  commission_rate DOUBLE PRECISION NOT NULL DEFAULT 0.15,
  total_commission_diamonds BIGINT NOT NULL DEFAULT 0,
  total_host_diamonds BIGINT NOT NULL DEFAULT 0,
  host_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'approved',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. جدول المسابقات والبطولات الصوتية
CREATE TABLE IF NOT EXISTS public.sada_competitions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  subtitle TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'تحدي الأصوات',
  prize_coins BIGINT NOT NULL DEFAULT 0,
  prize_diamonds BIGINT NOT NULL DEFAULT 0,
  banner_image TEXT NOT NULL DEFAULT 'competition_crest',
  status TEXT NOT NULL DEFAULT 'live',
  ends_at TIMESTAMPTZ NOT NULL,
  winner_id TEXT,
  contestants JSONB NOT NULL DEFAULT '[]'::jsonb
);

-- 12. جدول بنك الأسئلة الثقافية (CSV/Excel)
CREATE TABLE IF NOT EXISTS public.sada_cultural_questions (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  question TEXT NOT NULL,
  options JSONB NOT NULL,
  correct_index INTEGER NOT NULL,
  xp_reward INTEGER NOT NULL DEFAULT 120,
  coins_reward INTEGER NOT NULL DEFAULT 350
);

-- 13. جدول طلبات شحن USDT TRC20
CREATE TABLE IF NOT EXISTS public.sada_usdt_deposits (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  user_email TEXT NOT NULL,
  user_display_name TEXT NOT NULL,
  amount_usdt DOUBLE PRECISION NOT NULL,
  coins_credited BIGINT NOT NULL,
  tx_id TEXT UNIQUE NOT NULL,
  proof_image TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  network TEXT NOT NULL DEFAULT 'TRC20',
  reward_tier_label TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  admin_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);

-- 14. جدول طلبات سحب أرباح USDT TRC20
CREATE TABLE IF NOT EXISTS public.sada_usdt_withdrawals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  user_email TEXT NOT NULL,
  user_display_name TEXT NOT NULL,
  user_role_label TEXT NOT NULL,
  source_currency TEXT NOT NULL,
  source_amount BIGINT NOT NULL,
  amount_usdt DOUBLE PRECISION NOT NULL,
  trc20_address TEXT NOT NULL,
  network TEXT NOT NULL DEFAULT 'TRC20',
  status TEXT NOT NULL DEFAULT 'pending',
  admin_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);

-- 15. جدول طلبات التوثيق الصوتي للحسابات النسائية (5 ثوانٍ)
CREATE TABLE IF NOT EXISTS public.sada_female_voice_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  email TEXT NOT NULL,
  audio_data_url TEXT NOT NULL,
  duration_seconds INTEGER NOT NULL DEFAULT 5,
  phrase TEXT NOT NULL DEFAULT 'أهلاً بكم في تطبيق صَدَى',
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  admin_note TEXT
);

CREATE INDEX IF NOT EXISTS idx_sada_fvr_user ON public.sada_female_voice_requests(user_id, created_at DESC);

-- 16. جدول الإعدادات العليا للمنصة، مخزون الجوائز، ونسب الفوز في الألعاب
CREATE TABLE IF NOT EXISTS public.sada_platform_state (
  id TEXT PRIMARY KEY,
  app_prize_pool_coins BIGINT NOT NULL DEFAULT 250000,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  quiz_sessions JSONB NOT NULL DEFAULT '{}'::jsonb,
  voted_keys JSONB NOT NULL DEFAULT '{}'::jsonb,
  ladder_sessions JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- صلاحيات الوصول وسياسات RLS (لعمل الباك-إند والواجهة الفورية بسلاسة)
-- ============================================================================
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'sada_users',
    'sada_sessions',
    'sada_device_locks',
    'sada_security_logs',
    'sada_rooms',
    'sada_room_messages',
    'sada_private_messages',
    'sada_gifts',
    'sada_transactions',
    'sada_agencies',
    'sada_competitions',
    'sada_cultural_questions',
    'sada_usdt_deposits',
    'sada_usdt_withdrawals',
    'sada_female_voice_requests',
    'sada_platform_state'
  ]
  LOOP
    EXECUTE format('GRANT ALL ON TABLE public.%I TO anon, authenticated, service_role;', tbl);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "sada_full_access_%s" ON public.%I;', tbl, tbl);
    EXECUTE format('CREATE POLICY "sada_full_access_%s" ON public.%I FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);', tbl, tbl);
  END LOOP;
END $$;

-- ============================================================================
-- تفعيل المزامنة الفورية (Supabase Realtime) للجداول التفاعلية
-- ============================================================================
DO $$
DECLARE
  rt_tbl TEXT;
BEGIN
  FOREACH rt_tbl IN ARRAY ARRAY[
    'sada_users',
    'sada_rooms',
    'sada_room_messages',
    'sada_private_messages',
    'sada_transactions',
    'sada_agencies',
    'sada_competitions',
    'sada_cultural_questions',
    'sada_usdt_deposits',
    'sada_usdt_withdrawals',
    'sada_female_voice_requests',
    'sada_platform_state'
  ]
  LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I;', rt_tbl);
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END LOOP;
END $$;
