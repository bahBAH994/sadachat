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
  coins BIGINT NOT NULL DEFAULT 0,
  diamonds BIGINT NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 1,
  xp BIGINT NOT NULL DEFAULT 0,
  svip_level SMALLINT CHECK (svip_level BETWEEN 1 AND 4),
  svip_expires_at TIMESTAMPTZ,
  is_admin BOOLEAN NOT NULL DEFAULT FALSE,
  is_banned BOOLEAN NOT NULL DEFAULT FALSE,
  device_uuid TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sada_users_email ON public.sada_users(email);
CREATE INDEX IF NOT EXISTS idx_sada_users_device ON public.sada_users(device_uuid);
CREATE INDEX IF NOT EXISTS idx_sada_users_agency ON public.sada_users(agency_id);
ALTER TABLE public.sada_users
  ADD COLUMN IF NOT EXISTS svip_level SMALLINT CHECK (svip_level BETWEEN 1 AND 4),
  ADD COLUMN IF NOT EXISTS svip_expires_at TIMESTAMPTZ;

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
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  gift_id TEXT,
  gift_name TEXT,
  gift_glyph TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  replied_at TIMESTAMPTZ
);

ALTER TABLE public.sada_private_messages
  ADD COLUMN IF NOT EXISTS is_read BOOLEAN NOT NULL DEFAULT FALSE;

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

-- جولات ألعاب الغرف المتزامنة والرهانات المحجوزة
CREATE TABLE IF NOT EXISTS public.sada_room_game_rounds (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES public.sada_rooms(id) ON DELETE CASCADE,
  game_kind TEXT NOT NULL CHECK (game_kind IN ('roulette', 'dice')),
  round_number BIGINT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  betting_ends_at TIMESTAMPTZ NOT NULL,
  round_ends_at TIMESTAMPTZ NOT NULL,
  result JSONB,
  settled_at TIMESTAMPTZ,
  UNIQUE (room_id, game_kind, round_number)
);

CREATE TABLE IF NOT EXISTS public.sada_room_game_bets (
  id TEXT PRIMARY KEY,
  round_id TEXT NOT NULL REFERENCES public.sada_room_game_rounds(id) ON DELETE CASCADE,
  room_id TEXT NOT NULL REFERENCES public.sada_rooms(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  amount BIGINT NOT NULL CHECK (amount > 0),
  selection JSONB NOT NULL,
  is_winner BOOLEAN NOT NULL DEFAULT FALSE,
  multiplier NUMERIC(10, 2) NOT NULL DEFAULT 0,
  payout BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (round_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_sada_room_game_bets_round
  ON public.sada_room_game_bets(round_id, created_at);

CREATE TABLE IF NOT EXISTS public.sada_room_lucky_wheel_rounds (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES public.sada_rooms(id) ON DELETE CASCADE,
  creator_id TEXT NOT NULL,
  entry_fee BIGINT NOT NULL CHECK (entry_fee IN (100, 500, 1000, 5000)),
  prize_pool BIGINT NOT NULL DEFAULT 0 CHECK (prize_pool >= 0),
  players JSONB NOT NULL DEFAULT '[]'::jsonb,
  eliminated JSONB NOT NULL DEFAULT '[]'::jsonb,
  spinning_player_id TEXT,
  last_eliminated_id TEXT,
  status TEXT NOT NULL DEFAULT 'registering'
    CHECK (status IN ('registering', 'spinning', 'finished')),
  winner_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP INDEX IF EXISTS public.idx_sada_room_lucky_wheel_active;
CREATE UNIQUE INDEX idx_sada_room_lucky_wheel_active
  ON public.sada_room_lucky_wheel_rounds(room_id)
  WHERE status <> 'finished';

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

CREATE TABLE IF NOT EXISTS public.sada_vip_ids_catalog (
  id TEXT PRIMARY KEY,
  number TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  badge TEXT NOT NULL,
  price_coins BIGINT NOT NULL CHECK (price_coins > 0),
  owner_id TEXT UNIQUE REFERENCES public.sada_users(id) ON DELETE SET NULL
);

INSERT INTO public.sada_vip_ids_catalog (id, number, title, badge, price_coins) VALUES
  ('vip_id_100', '100', 'المئة الملكية', '👑', 70000),
  ('vip_id_111', '111', 'ثلاثية النور', '✨', 65000),
  ('vip_id_222', '222', 'ثلاثية التاج', '👑', 65000),
  ('vip_id_333', '333', 'ثلاثية الألماس', '💎', 65000),
  ('vip_id_444', '444', 'ثلاثية الفخامة', '🏆', 65000),
  ('vip_id_555', '555', 'ثلاثية الصقر', '🦅', 65000),
  ('vip_id_666', '666', 'ثلاثية المجد', '⚜️', 65000),
  ('vip_id_777', '777', 'السلطان الملكي', '👑', 85000),
  ('vip_id_888', '888', 'ثلاثية الحظ', '🍀', 65000),
  ('vip_id_999', '999', 'التسعمئة الإمبراطورية', '💠', 85000),
  ('vip_id_1000', '1000', 'الأسطورة الذهبية', '🏆', 35000),
  ('vip_id_1001', '1001', 'مرآة الألف', '🪞', 28000),
  ('vip_id_1111', '1111', 'الرباعية الملكية', '👑', 40000),
  ('vip_id_1221', '1221', 'انعكاس الصقر', '🦅', 28000),
  ('vip_id_2000', '2000', 'بداية الألفين', '✨', 25000),
  ('vip_id_2026', '2026', 'عام التميز', '🌟', 35000),
  ('vip_id_2222', '2222', 'الرباعية الفضية', '💠', 35000),
  ('vip_id_3333', '3333', 'الرباعية المتلألئة', '💎', 35000),
  ('vip_id_4444', '4444', 'الرباعية الإمبراطورية', '🏆', 45000),
  ('vip_id_5555', '5555', 'الصقر الإمبراطوري', '🦅', 30000),
  ('vip_id_6666', '6666', 'الرباعية الأنيقة', '⚜️', 35000),
  ('vip_id_7000', '7000', 'الفارس الإمبراطوري', '🗡️', 12000),
  ('vip_id_7777', '7777', 'الرباعية السلطانية', '👑', 45000),
  ('vip_id_8888', '8888', 'الجوهرة المزدوجة', '💠', 40000),
  ('vip_id_9000', '9000', 'قمة التسعة', '🌟', 25000),
  ('vip_id_9090', '9090', 'توازن التسعة', '✨', 28000),
  ('vip_id_9999', '9999', 'التاج الماسي', '💎', 45000),
  ('vip_id_10101', '10101', 'خماسي المرآة', '🪞', 18000),
  ('vip_id_11111', '11111', 'الخماسي الملكي', '👑', 25000),
  ('vip_id_12345', '12345', 'التسلسل الفاخر', '✨', 15000),
  ('vip_id_20000', '20000', 'عشرون ألفاً', '🏅', 12000),
  ('vip_id_22222', '22222', 'خماسي التاج', '👑', 22000),
  ('vip_id_33333', '33333', 'خماسي الجوهرة', '💎', 22000),
  ('vip_id_44444', '44444', 'خماسي الفخامة', '🏆', 22000),
  ('vip_id_55555', '55555', 'الخماسي الإمبراطوري', '🦅', 25000),
  ('vip_id_66666', '66666', 'خماسي المجد', '⚜️', 22000),
  ('vip_id_77777', '77777', 'خماسي السلطان', '👑', 25000),
  ('vip_id_88888', '88888', 'خماسي الحظ', '💠', 25000),
  ('vip_id_90000', '90000', 'الرقم الملكي الأخير', '🌟', 18000),
  ('vip_id_99999', '99999', 'الخماسي الأسطوري', '🐉', 30000)
ON CONFLICT (id) DO UPDATE SET
  number = EXCLUDED.number,
  title = EXCLUDED.title,
  badge = EXCLUDED.badge,
  price_coins = EXCLUDED.price_coins;

WITH legacy_owned_ids AS (
  SELECT DISTINCT ON (id_number.value)
    id_number.key AS owner_id,
    id_number.value AS number
  FROM public.sada_platform_state AS platform,
       jsonb_each_text(coalesce(platform.settings -> 'customVipIds', '{}'::jsonb)) AS id_number
  WHERE platform.id = 'global'
  ORDER BY id_number.value, id_number.key
)
UPDATE public.sada_vip_ids_catalog AS catalog
SET owner_id = legacy_owned_ids.owner_id
FROM legacy_owned_ids
WHERE catalog.number = legacy_owned_ids.number
  AND catalog.owner_id IS NULL;

CREATE TABLE IF NOT EXISTS public.sada_svip_tiers (
  level SMALLINT PRIMARY KEY CHECK (level BETWEEN 1 AND 4),
  label TEXT NOT NULL,
  price_coins BIGINT NOT NULL CHECK (price_coins > 0)
);

INSERT INTO public.sada_svip_tiers (level, label, price_coins) VALUES
  (1, 'SVIP 1 البرونزي', 10000),
  (2, 'SVIP 2 الفضي', 25000),
  (3, 'SVIP 3 الذهبي', 60000),
  (4, 'SVIP 4 الإمبراطوري', 150000)
ON CONFLICT (level) DO UPDATE SET
  label = EXCLUDED.label,
  price_coins = EXCLUDED.price_coins;

ALTER TABLE public.sada_vip_ids_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sada_svip_tiers ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.sada_vip_ids_catalog, public.sada_svip_tiers TO anon, authenticated, service_role;
REVOKE INSERT, UPDATE, DELETE ON public.sada_vip_ids_catalog, public.sada_svip_tiers FROM anon, authenticated;
DROP POLICY IF EXISTS "sada_vip_ids_catalog_read" ON public.sada_vip_ids_catalog;
CREATE POLICY "sada_vip_ids_catalog_read" ON public.sada_vip_ids_catalog
  FOR SELECT TO anon, authenticated, service_role USING (TRUE);
DROP POLICY IF EXISTS "sada_svip_tiers_read" ON public.sada_svip_tiers;
CREATE POLICY "sada_svip_tiers_read" ON public.sada_svip_tiers
  FOR SELECT TO anon, authenticated, service_role USING (TRUE);

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

ALTER TABLE public.sada_room_game_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sada_room_game_bets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sada_room_lucky_wheel_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sada_room_game_rounds REPLICA IDENTITY FULL;
ALTER TABLE public.sada_room_game_bets REPLICA IDENTITY FULL;
ALTER TABLE public.sada_room_lucky_wheel_rounds REPLICA IDENTITY FULL;
GRANT SELECT, INSERT ON public.sada_room_game_rounds, public.sada_room_game_bets
  TO authenticated, service_role;
GRANT SELECT ON public.sada_room_game_rounds, public.sada_room_game_bets TO anon;
GRANT SELECT ON public.sada_room_lucky_wheel_rounds TO anon, authenticated, service_role;
REVOKE INSERT, UPDATE, DELETE ON public.sada_room_game_rounds, public.sada_room_game_bets
  FROM anon, authenticated;
DROP POLICY IF EXISTS "sada_room_game_rounds_read" ON public.sada_room_game_rounds;
CREATE POLICY "sada_room_game_rounds_read" ON public.sada_room_game_rounds
  FOR SELECT TO anon, authenticated, service_role USING (TRUE);
DROP POLICY IF EXISTS "sada_room_game_bets_read" ON public.sada_room_game_bets;
CREATE POLICY "sada_room_game_bets_read" ON public.sada_room_game_bets
  FOR SELECT TO anon, authenticated, service_role USING (TRUE);
DROP POLICY IF EXISTS "sada_room_game_rounds_insert" ON public.sada_room_game_rounds;
CREATE POLICY "sada_room_game_rounds_insert" ON public.sada_room_game_rounds
  FOR INSERT TO authenticated, service_role WITH CHECK (TRUE);
DROP POLICY IF EXISTS "sada_room_game_bets_insert" ON public.sada_room_game_bets;
CREATE POLICY "sada_room_game_bets_insert" ON public.sada_room_game_bets
  FOR INSERT TO authenticated, service_role WITH CHECK (TRUE);
DROP POLICY IF EXISTS "sada_room_lucky_wheel_rounds_read"
  ON public.sada_room_lucky_wheel_rounds;
CREATE POLICY "sada_room_lucky_wheel_rounds_read"
  ON public.sada_room_lucky_wheel_rounds
  FOR SELECT TO anon, authenticated, service_role USING (TRUE);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'sada_room_game_rounds'
    ) THEN
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.sada_room_game_rounds';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'sada_room_game_bets'
    ) THEN
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.sada_room_game_bets';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'sada_room_lucky_wheel_rounds'
    ) THEN
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.sada_room_lucky_wheel_rounds';
    END IF;
  END IF;
END $$;

DROP POLICY IF EXISTS "sada_full_access_sada_users" ON public.sada_users;
DROP POLICY IF EXISTS "sada_users_read" ON public.sada_users;
DROP POLICY IF EXISTS "sada_users_insert" ON public.sada_users;
DROP POLICY IF EXISTS "sada_users_update" ON public.sada_users;
DROP POLICY IF EXISTS "sada_users_admin_delete" ON public.sada_users;
CREATE POLICY "sada_users_read" ON public.sada_users
  FOR SELECT TO anon, authenticated, service_role USING (TRUE);
CREATE POLICY "sada_users_insert" ON public.sada_users
  FOR INSERT TO anon, authenticated, service_role WITH CHECK (TRUE);
CREATE POLICY "sada_users_update" ON public.sada_users
  FOR UPDATE TO anon, authenticated, service_role USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "sada_users_admin_delete" ON public.sada_users
  FOR DELETE TO authenticated
  USING (lower(coalesce(auth.jwt() ->> 'email', '')) = 'bahaa.f36@gmail.com');

DROP POLICY IF EXISTS "sada_full_access_sada_room_messages" ON public.sada_room_messages;
DROP POLICY IF EXISTS "sada_room_messages_read" ON public.sada_room_messages;
DROP POLICY IF EXISTS "sada_room_messages_insert" ON public.sada_room_messages;
DROP POLICY IF EXISTS "sada_room_messages_update" ON public.sada_room_messages;
DROP POLICY IF EXISTS "sada_room_messages_admin_delete" ON public.sada_room_messages;
CREATE POLICY "sada_room_messages_read" ON public.sada_room_messages
  FOR SELECT TO anon, authenticated, service_role USING (TRUE);
CREATE POLICY "sada_room_messages_insert" ON public.sada_room_messages
  FOR INSERT TO anon, authenticated, service_role WITH CHECK (TRUE);
CREATE POLICY "sada_room_messages_update" ON public.sada_room_messages
  FOR UPDATE TO anon, authenticated, service_role USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "sada_room_messages_admin_delete" ON public.sada_room_messages
  FOR DELETE TO authenticated
  USING (lower(coalesce(auth.jwt() ->> 'email', '')) = 'bahaa.f36@gmail.com');

ALTER TABLE public.sada_room_messages REPLICA IDENTITY FULL;

CREATE OR REPLACE FUNCTION public.sada_settle_room_game_round(
  p_room_id TEXT,
  p_game_kind TEXT,
  p_round_number BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_round public.sada_room_game_rounds%ROWTYPE;
  v_bet RECORD;
  v_now TIMESTAMPTZ;
  v_number INTEGER;
  v_color TEXT;
  v_wheel_index INTEGER;
  v_dice INTEGER[];
  v_sum INTEGER;
  v_total_sum INTEGER;
  v_bet_type TEXT;
  v_game_id TEXT;
  v_pick TEXT;
  v_won BOOLEAN;
  v_multiplier NUMERIC(10, 2);
  v_payout BIGINT;
  v_candidate_number INTEGER;
  v_candidate_payout BIGINT;
  v_minimum_payout BIGINT;
  v_total_bets BIGINT;
  v_die_one INTEGER;
  v_die_two INTEGER;
  v_die_three INTEGER;
  v_roulette_bet JSONB;
  v_bet_amount BIGINT;
  v_selection_total BIGINT;
  v_winner_names TEXT := '';
  v_has_bets BOOLEAN := FALSE;
  v_result JSONB;
  v_announcement TEXT;
  v_red_numbers INTEGER[] := ARRAY[
    1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36
  ];
  v_wheel_order INTEGER[] := ARRAY[
    0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10,
    5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
  ];
BEGIN
  SELECT * INTO v_round
  FROM public.sada_room_game_rounds
  WHERE room_id = p_room_id
    AND game_kind = p_game_kind
    AND round_number = p_round_number
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'الجولة غير موجودة.';
  END IF;
  v_now := clock_timestamp();
  IF v_round.result IS NOT NULL THEN
    RETURN v_round.result;
  END IF;
  IF v_now < v_round.betting_ends_at THEN
    RAISE EXCEPTION 'لم ينته وقت الرهان بعد.';
  END IF;

  IF p_game_kind = 'roulette' THEN
    v_number := floor(random() * 37)::INTEGER;
    SELECT coalesce(sum(amount), 0) INTO v_total_bets
    FROM public.sada_room_game_bets
    WHERE round_id = v_round.id;
    IF v_total_bets >= 5000 THEN
      FOR v_candidate_number IN 0..36 LOOP
        SELECT coalesce(sum(
          CASE
            WHEN item.value->>'betType' = 'zero' AND v_candidate_number = 0
              THEN coalesce(nullif(item.value->>'amount', '')::BIGINT, b.amount) * 28
            WHEN item.value->>'betType' = 'straight'
              AND v_candidate_number = coalesce(nullif(item.value->>'targetNumber', '')::INTEGER, 0)
              THEN coalesce(nullif(item.value->>'amount', '')::BIGINT, b.amount) * 32
            WHEN item.value->>'betType' = 'red' AND v_candidate_number <> 0
              AND v_candidate_number = ANY(v_red_numbers)
              THEN coalesce(nullif(item.value->>'amount', '')::BIGINT, b.amount) * 2
            WHEN item.value->>'betType' = 'black' AND v_candidate_number <> 0
              AND NOT (v_candidate_number = ANY(v_red_numbers))
              THEN coalesce(nullif(item.value->>'amount', '')::BIGINT, b.amount) * 2
            WHEN item.value->>'betType' = 'even' AND v_candidate_number <> 0
              AND mod(v_candidate_number, 2) = 0
              THEN coalesce(nullif(item.value->>'amount', '')::BIGINT, b.amount) * 2
            WHEN item.value->>'betType' = 'odd' AND v_candidate_number <> 0
              AND mod(v_candidate_number, 2) = 1
              THEN coalesce(nullif(item.value->>'amount', '')::BIGINT, b.amount) * 2
            WHEN item.value->>'betType' = 'dozen_1' AND v_candidate_number BETWEEN 1 AND 12
              THEN coalesce(nullif(item.value->>'amount', '')::BIGINT, b.amount) * 3
            WHEN item.value->>'betType' = 'dozen_2' AND v_candidate_number BETWEEN 13 AND 24
              THEN coalesce(nullif(item.value->>'amount', '')::BIGINT, b.amount) * 3
            WHEN item.value->>'betType' = 'dozen_3' AND v_candidate_number BETWEEN 25 AND 36
              THEN coalesce(nullif(item.value->>'amount', '')::BIGINT, b.amount) * 3
            ELSE 0
          END
        ), 0)::BIGINT INTO v_candidate_payout
        FROM public.sada_room_game_bets b
        CROSS JOIN LATERAL jsonb_array_elements(
          CASE
            WHEN jsonb_typeof(b.selection->'bets') = 'array' THEN b.selection->'bets'
            ELSE jsonb_build_array(b.selection)
          END
        ) AS item(value)
        WHERE b.round_id = v_round.id;

        IF v_minimum_payout IS NULL OR v_candidate_payout < v_minimum_payout THEN
          v_minimum_payout := v_candidate_payout;
          v_number := v_candidate_number;
        ELSIF v_candidate_payout = v_minimum_payout AND random() < 0.5 THEN
          v_number := v_candidate_number;
        END IF;
      END LOOP;
    END IF;
    v_color := CASE
      WHEN v_number = 0 THEN 'green'
      WHEN v_number = ANY(v_red_numbers) THEN 'red'
      ELSE 'black'
    END;
    v_wheel_index := array_position(v_wheel_order, v_number) - 1;
    v_result := jsonb_build_object(
      'number', v_number,
      'color', v_color,
      'wheel_index', v_wheel_index
    );
  ELSE
    SELECT coalesce(sum(amount), 0) INTO v_total_bets
    FROM public.sada_room_game_bets
    WHERE round_id = v_round.id;
    v_dice := ARRAY[
      floor(random() * 6)::INTEGER + 1,
      floor(random() * 6)::INTEGER + 1,
      floor(random() * 6)::INTEGER + 1
    ];
    IF v_total_bets >= 5000 THEN
      v_minimum_payout := NULL;
      FOR v_die_one IN 1..6 LOOP
        FOR v_die_two IN 1..6 LOOP
          FOR v_die_three IN 1..6 LOOP
            SELECT coalesce(sum(b.amount * CASE
              WHEN b.selection->>'gameId' = 'double_dice'
                AND b.selection->>'pick' = 'high' AND v_die_one + v_die_two >= 8
                THEN 1.95
              WHEN b.selection->>'gameId' = 'double_dice'
                AND b.selection->>'pick' = 'low' AND v_die_one + v_die_two <= 6
                THEN 1.95
              WHEN b.selection->>'gameId' = 'double_dice'
                AND b.selection->>'pick' = 'seven' AND v_die_one + v_die_two = 7
                THEN 4.2
              WHEN b.selection->>'gameId' = 'double_dice'
                AND b.selection->>'pick' = 'doubles' AND v_die_one = v_die_two
                THEN 4.8
              WHEN b.selection->>'gameId' = 'prediction_dice'
                AND b.selection->>'pick' = 'even' AND mod(v_die_one, 2) = 0 THEN 1.92
              WHEN b.selection->>'gameId' = 'prediction_dice'
                AND b.selection->>'pick' = 'odd' AND mod(v_die_one, 2) = 1 THEN 1.92
              WHEN b.selection->>'gameId' = 'prediction_dice'
                AND b.selection->>'pick' ~ '^exact_[1-6]$'
                AND v_die_one = substring(b.selection->>'pick' FROM 7)::INTEGER THEN 5.2
              WHEN b.selection->>'gameId' = 'speed_dice'
                AND b.selection->>'pick' = 'under_10'
                AND v_die_one + v_die_two + v_die_three <= 10 THEN 1.9
              WHEN b.selection->>'gameId' = 'speed_dice'
                AND b.selection->>'pick' = 'over_11'
                AND v_die_one + v_die_two + v_die_three >= 11 THEN 1.9
              WHEN b.selection->>'gameId' = 'speed_dice'
                AND b.selection->>'pick' = 'lucky_16'
                AND v_die_one + v_die_two + v_die_three >= 16 THEN 4.5
              WHEN b.selection->>'gameId' = 'speed_dice'
                AND b.selection->>'pick' = 'triple'
                AND v_die_one = v_die_two AND v_die_two = v_die_three THEN 12
              ELSE 0
            END), 0)::BIGINT INTO v_candidate_payout
            FROM public.sada_room_game_bets b
            WHERE b.round_id = v_round.id;
            IF v_minimum_payout IS NULL OR v_candidate_payout < v_minimum_payout THEN
              v_minimum_payout := v_candidate_payout;
              v_dice := ARRAY[v_die_one, v_die_two, v_die_three];
            ELSIF v_candidate_payout = v_minimum_payout AND random() < 0.5 THEN
              v_dice := ARRAY[v_die_one, v_die_two, v_die_three];
            END IF;
          END LOOP;
        END LOOP;
      END LOOP;
    END IF;
    v_sum := v_dice[1] + v_dice[2] + v_dice[3];
    v_total_sum := v_sum;
    v_result := jsonb_build_object('dice', v_dice, 'sum', v_sum);
  END IF;

  FOR v_bet IN
    SELECT b.*, coalesce(u.display_name, b.display_name) AS winner_name
    FROM public.sada_room_game_bets b
    LEFT JOIN public.sada_users u ON u.id = b.user_id
    WHERE b.round_id = v_round.id
    ORDER BY b.created_at, b.id
    FOR UPDATE OF b
  LOOP
    v_has_bets := TRUE;
    v_won := FALSE;
    v_multiplier := 0;
    v_payout := 0;

    IF p_game_kind = 'roulette' THEN
      IF jsonb_typeof(v_bet.selection->'bets') = 'array' THEN
        SELECT coalesce(sum(
          CASE
            WHEN item.value->>'betType' = 'zero' AND v_number = 0
              THEN coalesce(nullif(item.value->>'amount', '')::BIGINT, v_bet.amount) * 28
            WHEN item.value->>'betType' = 'straight'
              AND v_number = coalesce(nullif(item.value->>'targetNumber', '')::INTEGER, 0)
              THEN coalesce(nullif(item.value->>'amount', '')::BIGINT, v_bet.amount) * 32
            WHEN item.value->>'betType' = 'red' AND v_number <> 0
              AND v_number = ANY(v_red_numbers)
              THEN coalesce(nullif(item.value->>'amount', '')::BIGINT, v_bet.amount) * 2
            WHEN item.value->>'betType' = 'black' AND v_number <> 0
              AND NOT (v_number = ANY(v_red_numbers))
              THEN coalesce(nullif(item.value->>'amount', '')::BIGINT, v_bet.amount) * 2
            WHEN item.value->>'betType' = 'even' AND v_number <> 0
              AND mod(v_number, 2) = 0
              THEN coalesce(nullif(item.value->>'amount', '')::BIGINT, v_bet.amount) * 2
            WHEN item.value->>'betType' = 'odd' AND v_number <> 0
              AND mod(v_number, 2) = 1
              THEN coalesce(nullif(item.value->>'amount', '')::BIGINT, v_bet.amount) * 2
            WHEN item.value->>'betType' = 'dozen_1' AND v_number BETWEEN 1 AND 12
              THEN coalesce(nullif(item.value->>'amount', '')::BIGINT, v_bet.amount) * 3
            WHEN item.value->>'betType' = 'dozen_2' AND v_number BETWEEN 13 AND 24
              THEN coalesce(nullif(item.value->>'amount', '')::BIGINT, v_bet.amount) * 3
            WHEN item.value->>'betType' = 'dozen_3' AND v_number BETWEEN 25 AND 36
              THEN coalesce(nullif(item.value->>'amount', '')::BIGINT, v_bet.amount) * 3
            ELSE 0
          END
        ), 0)::BIGINT INTO v_payout
        FROM jsonb_array_elements(v_bet.selection->'bets') AS item(value);
        v_won := v_payout > 0;
        IF v_won THEN
          v_multiplier := v_payout::NUMERIC / v_bet.amount;
        END IF;
      ELSE
        v_bet_type := v_bet.selection ->> 'betType';
        CASE v_bet_type
          WHEN 'zero' THEN
            v_won := v_number = 0;
            IF v_won THEN v_multiplier := 28; END IF;
          WHEN 'straight' THEN
            v_won := v_number = (v_bet.selection ->> 'targetNumber')::INTEGER;
            IF v_won THEN v_multiplier := 32; END IF;
          WHEN 'red' THEN
            v_won := v_number <> 0 AND v_number = ANY(v_red_numbers);
            IF v_won THEN v_multiplier := 2; END IF;
          WHEN 'black' THEN
            v_won := v_number <> 0 AND NOT (v_number = ANY(v_red_numbers));
            IF v_won THEN v_multiplier := 2; END IF;
          WHEN 'even' THEN
            v_won := v_number <> 0 AND mod(v_number, 2) = 0;
            IF v_won THEN v_multiplier := 2; END IF;
          WHEN 'odd' THEN
            v_won := v_number <> 0 AND mod(v_number, 2) = 1;
            IF v_won THEN v_multiplier := 2; END IF;
          WHEN 'dozen_1' THEN
            v_won := v_number BETWEEN 1 AND 12;
            IF v_won THEN v_multiplier := 3; END IF;
          WHEN 'dozen_2' THEN
            v_won := v_number BETWEEN 13 AND 24;
            IF v_won THEN v_multiplier := 3; END IF;
          WHEN 'dozen_3' THEN
            v_won := v_number BETWEEN 25 AND 36;
            IF v_won THEN v_multiplier := 3; END IF;
          ELSE
            RAISE EXCEPTION 'نوع رهان روليت غير صالح.';
        END CASE;
      END IF;
    ELSE
      v_game_id := v_bet.selection ->> 'gameId';
      v_pick := v_bet.selection ->> 'pick';
      v_sum := v_dice[1] + v_dice[2] + v_dice[3];
      IF v_game_id = 'double_dice' THEN
        v_sum := v_dice[1] + v_dice[2];
        CASE v_pick
          WHEN 'high' THEN v_won := v_sum >= 8; v_multiplier := 1.95;
          WHEN 'low' THEN v_won := v_sum <= 6; v_multiplier := 1.95;
          WHEN 'seven' THEN v_won := v_sum = 7; v_multiplier := 4.2;
          WHEN 'doubles' THEN v_won := v_dice[1] = v_dice[2]; v_multiplier := 4.8;
          ELSE RAISE EXCEPTION 'توقع نرد غير صالح.';
        END CASE;
      ELSIF v_game_id = 'prediction_dice' THEN
        CASE v_pick
          WHEN 'even' THEN v_won := mod(v_dice[1], 2) = 0; v_multiplier := 1.92;
          WHEN 'odd' THEN v_won := mod(v_dice[1], 2) = 1; v_multiplier := 1.92;
          ELSE
            v_won := v_dice[1] = substring(v_pick FROM 7)::INTEGER;
            v_multiplier := 5.2;
        END CASE;
      ELSIF v_game_id = 'speed_dice' THEN
        CASE v_pick
          WHEN 'under_10' THEN v_won := v_sum <= 10; v_multiplier := 1.9;
          WHEN 'over_11' THEN v_won := v_sum >= 11; v_multiplier := 1.9;
          WHEN 'lucky_16' THEN v_won := v_sum >= 16; v_multiplier := 4.5;
          WHEN 'triple' THEN v_won := v_dice[1] = v_dice[2] AND v_dice[2] = v_dice[3]; v_multiplier := 12;
          ELSE RAISE EXCEPTION 'توقع نرد غير صالح.';
        END CASE;
      ELSE
        RAISE EXCEPTION 'نوع لعبة نرد غير صالح.';
      END IF;

      IF NOT v_won THEN
        v_multiplier := 0;
      END IF;
    END IF;

    IF v_won THEN
      IF NOT (p_game_kind = 'roulette' AND jsonb_typeof(v_bet.selection->'bets') = 'array') THEN
        v_payout := round(v_bet.amount * v_multiplier)::BIGINT;
      END IF;
      UPDATE public.sada_users
      SET coins = coins + v_payout
      WHERE id = v_bet.user_id;
      INSERT INTO public.sada_transactions (
        id, user_id, type, amount, currency, description, timestamp
      ) VALUES (
        'room_win_' || md5(v_round.id || ':' || v_bet.user_id),
        v_bet.user_id,
        'game_win',
        v_payout,
        'coins',
        'ربح جولة ألعاب الغرفة (' || p_game_kind || ')',
        v_now
      ) ON CONFLICT (id) DO NOTHING;
      v_winner_names := concat_ws(
        '، ',
        nullif(v_winner_names, ''),
        v_bet.winner_name || ' (+' || v_payout::TEXT || ')'
      );
    END IF;

    UPDATE public.sada_room_game_bets
    SET is_winner = v_won, multiplier = v_multiplier, payout = v_payout
    WHERE id = v_bet.id;
  END LOOP;

  IF p_game_kind = 'roulette' THEN
    v_announcement := '🎡 انتهت جولة الروليت: الرقم #' || v_number ||
      ' (' || v_color || '). ';
  ELSE
    v_announcement := '🎲 انتهت جولة النرد: ' || array_to_string(v_dice, ' - ') ||
      ' (المجموع ' || v_total_sum || '). ';
  END IF;
  v_announcement := v_announcement || CASE
    WHEN v_winner_names = '' THEN 'لا يوجد فائزون هذه المرة.'
    ELSE 'الفائزون: ' || v_winner_names
  END;

  UPDATE public.sada_room_game_rounds
  SET result = v_result, settled_at = v_now
  WHERE id = v_round.id;

  IF v_has_bets THEN
    INSERT INTO public.sada_room_messages (
      id, room_id, user_id, display_name, level, is_admin, text, type, timestamp
    ) VALUES (
      'room_game_' || md5(v_round.id),
      p_room_id,
      'system',
      'نظام الألعاب',
      1,
      FALSE,
      v_announcement,
      'system',
      v_now
    ) ON CONFLICT (id) DO NOTHING;
  END IF;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.sada_get_room_game_round(
  p_room_id TEXT,
  p_game_kind TEXT,
  p_user_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_now TIMESTAMPTZ := clock_timestamp();
  v_round_number BIGINT;
  v_started_at TIMESTAMPTZ;
  v_round_id TEXT;
  v_round public.sada_room_game_rounds%ROWTYPE;
  v_pending_round BIGINT;
  v_bets JSONB;
BEGIN
  IF p_game_kind NOT IN ('roulette', 'dice') THEN
    RAISE EXCEPTION 'نوع لعبة غير صالح.';
  END IF;
  IF auth.uid() IS NULL OR auth.uid()::TEXT IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'يجب تسجيل الدخول للانضمام إلى جولة الغرفة.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.sada_rooms WHERE id = p_room_id) THEN
    RAISE EXCEPTION 'الغرفة غير موجودة.';
  END IF;

  v_round_number := floor(extract(epoch FROM v_now) / 20)::BIGINT;
  v_started_at := to_timestamp(v_round_number * 20);
  v_round_id := p_room_id || ':' || p_game_kind || ':' || v_round_number::TEXT;

  INSERT INTO public.sada_room_game_rounds (
    id, room_id, game_kind, round_number, started_at, betting_ends_at, round_ends_at
  ) VALUES (
    v_round_id,
    p_room_id,
    p_game_kind,
    v_round_number,
    v_started_at,
    v_started_at + INTERVAL '15 seconds',
    v_started_at + INTERVAL '20 seconds'
  ) ON CONFLICT (room_id, game_kind, round_number) DO NOTHING;

  FOR v_pending_round IN
    SELECT round_number
    FROM public.sada_room_game_rounds
    WHERE room_id = p_room_id
      AND game_kind = p_game_kind
      AND round_number <= v_round_number
      AND result IS NULL
      AND betting_ends_at <= v_now
    ORDER BY round_number
  LOOP
    PERFORM public.sada_settle_room_game_round(
      p_room_id, p_game_kind, v_pending_round
    );
  END LOOP;

  SELECT * INTO v_round
  FROM public.sada_room_game_rounds
  WHERE id = v_round_id;

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'user_id', b.user_id,
        'display_name', b.display_name,
        'amount', b.amount,
        'selection', b.selection,
        'is_winner', b.is_winner,
        'multiplier', b.multiplier,
        'payout', b.payout
      ) ORDER BY b.created_at, b.id
    ),
    '[]'::JSONB
  ) INTO v_bets
  FROM public.sada_room_game_bets b
  WHERE b.round_id = v_round.id;

  RETURN jsonb_build_object(
    'round_id', v_round.id,
    'round_number', v_round.round_number,
    'started_at', v_round.started_at,
    'betting_ends_at', v_round.betting_ends_at,
    'round_ends_at', v_round.round_ends_at,
    'server_now', v_now,
    'phase', CASE WHEN v_now < v_round.betting_ends_at THEN 'betting' ELSE 'revealing' END,
    'result', v_round.result,
    'bets', v_bets
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.sada_place_room_game_bet(
  p_room_id TEXT,
  p_game_kind TEXT,
  p_round_number BIGINT,
  p_user_id TEXT,
  p_amount BIGINT,
  p_selection JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_now TIMESTAMPTZ;
  v_round public.sada_room_game_rounds%ROWTYPE;
  v_user_name TEXT;
  v_bet_id TEXT;
  v_bet_type TEXT;
  v_roulette_bet JSONB;
  v_bet_amount BIGINT;
  v_selection_total BIGINT;
  v_game_id TEXT;
  v_pick TEXT;
BEGIN
  IF p_amount < 10 OR p_amount > 1000000 THEN
    RAISE EXCEPTION 'قيمة الرهان يجب أن تكون بين 10 و1,000,000 كوين.';
  END IF;
  IF p_game_kind NOT IN ('roulette', 'dice') THEN
    RAISE EXCEPTION 'نوع لعبة غير صالح.';
  END IF;
  IF auth.uid() IS NULL OR auth.uid()::TEXT IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'لا يمكن وضع رهان لحساب آخر.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.sada_rooms WHERE id = p_room_id) THEN
    RAISE EXCEPTION 'الغرفة غير موجودة.';
  END IF;

  SELECT * INTO v_round
  FROM public.sada_room_game_rounds
  WHERE room_id = p_room_id
    AND game_kind = p_game_kind
    AND round_number = p_round_number
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'انتهى وقت الرهان؛ انتظر الجولة التالية.';
  END IF;
  v_now := clock_timestamp();
  IF v_now >= v_round.betting_ends_at THEN
    RAISE EXCEPTION 'انتهى وقت الرهان؛ انتظر الجولة التالية.';
  END IF;
  IF v_round.result IS NOT NULL THEN
    RAISE EXCEPTION 'تم إغلاق الرهان لهذه الجولة.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.sada_room_game_bets
    WHERE round_id = v_round.id AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'لديك رهان مسجل في هذه الجولة بالفعل.';
  END IF;

  IF p_selection IS NULL OR jsonb_typeof(p_selection) <> 'object' THEN
    RAISE EXCEPTION 'بيانات الرهان غير صالحة.';
  END IF;

  IF p_game_kind = 'roulette' THEN
    IF jsonb_typeof(p_selection->'bets') = 'array' THEN
      IF jsonb_array_length(p_selection->'bets') = 0 THEN
        RAISE EXCEPTION 'اختر رهاناً واحداً على الأقل.';
      END IF;
      v_selection_total := 0;
      FOR v_roulette_bet IN
        SELECT value FROM jsonb_array_elements(p_selection->'bets')
      LOOP
        v_bet_type := v_roulette_bet->>'betType';
        v_bet_amount := nullif(v_roulette_bet->>'amount', '')::BIGINT;
        IF v_bet_type IS NULL OR v_bet_type NOT IN (
          'red', 'black', 'even', 'odd', 'dozen_1', 'dozen_2', 'dozen_3', 'zero', 'straight'
        ) OR v_bet_amount IS NULL OR v_bet_amount < 10 OR
          (v_bet_type = 'straight' AND
            coalesce((v_roulette_bet->>'targetNumber')::INTEGER, 0) NOT BETWEEN 1 AND 36) THEN
          RAISE EXCEPTION 'رهان الروليت غير صالح.';
        END IF;
        v_selection_total := v_selection_total + v_bet_amount;
      END LOOP;
      IF v_selection_total <> p_amount THEN
        RAISE EXCEPTION 'مجموع رهانات الروليت لا يطابق الرصيد المخصوم.';
      END IF;
    ELSE
      v_bet_type := p_selection ->> 'betType';
      IF v_bet_type IS NULL OR v_bet_type NOT IN (
        'red', 'black', 'even', 'odd', 'dozen_1', 'dozen_2', 'dozen_3', 'zero', 'straight'
      ) OR (v_bet_type = 'straight' AND
        coalesce((p_selection ->> 'targetNumber')::INTEGER, 0) NOT BETWEEN 1 AND 36) THEN
        RAISE EXCEPTION 'رهان الروليت غير صالح.';
      END IF;
    END IF;
  ELSE
    v_game_id := p_selection ->> 'gameId';
    v_pick := p_selection ->> 'pick';
    IF v_game_id IS NULL OR v_pick IS NULL THEN
      RAISE EXCEPTION 'توقع النرد غير صالح.';
    ELSIF v_game_id = 'double_dice' AND v_pick NOT IN ('high', 'low', 'seven', 'doubles') THEN
      RAISE EXCEPTION 'توقع النرد غير صالح.';
    ELSIF v_game_id = 'prediction_dice' AND NOT (
      v_pick IN ('even', 'odd') OR v_pick ~ '^exact_[1-6]$'
    ) THEN
      RAISE EXCEPTION 'توقع النرد غير صالح.';
    ELSIF v_game_id = 'speed_dice' AND v_pick NOT IN (
      'under_10', 'over_11', 'lucky_16', 'triple'
    ) THEN
      RAISE EXCEPTION 'توقع النرد غير صالح.';
    ELSIF v_game_id NOT IN ('double_dice', 'prediction_dice', 'speed_dice') THEN
      RAISE EXCEPTION 'هذه الجولة لا تدعم هذا النوع من النرد.';
    END IF;
  END IF;

  UPDATE public.sada_users
  SET coins = coins - p_amount
  WHERE id = p_user_id
    AND is_banned = FALSE
    AND coins >= p_amount
  RETURNING display_name INTO v_user_name;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'رصيد الكوينز غير كافٍ أو الحساب غير متاح.';
  END IF;

  v_bet_id := 'room_bet_' || md5(v_round.id || ':' || p_user_id);
  INSERT INTO public.sada_room_game_bets (
    id, round_id, room_id, user_id, display_name, amount, selection
  ) VALUES (
    v_bet_id, v_round.id, p_room_id, p_user_id, v_user_name, p_amount, p_selection
  );

  INSERT INTO public.sada_transactions (
    id, user_id, type, amount, currency, description, timestamp
  ) VALUES (
    'room_bet_tx_' || md5(v_round.id || ':' || p_user_id),
    p_user_id,
    'game_bet',
    -p_amount,
    'coins',
    'رهان جولة ألعاب الغرفة (' || p_game_kind || ')',
    v_now
  );

  RETURN public.sada_get_room_game_round(p_room_id, p_game_kind, p_user_id);
END;
$$;

REVOKE ALL ON FUNCTION public.sada_settle_room_game_round(TEXT, TEXT, BIGINT)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sada_get_room_game_round(TEXT, TEXT, TEXT)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sada_place_room_game_bet(TEXT, TEXT, BIGINT, TEXT, BIGINT, JSONB)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sada_get_room_game_round(TEXT, TEXT, TEXT)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sada_place_room_game_bet(TEXT, TEXT, BIGINT, TEXT, BIGINT, JSONB)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.sada_create_room_lucky_wheel(
  p_room_id TEXT,
  p_creator_id TEXT,
  p_entry_fee BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_round public.sada_room_lucky_wheel_rounds%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR auth.uid()::TEXT IS DISTINCT FROM p_creator_id THEN
    RAISE EXCEPTION 'يجب تسجيل الدخول لإنشاء الجولة.';
  END IF;
  IF p_entry_fee NOT IN (100, 500, 1000, 5000) THEN
    RAISE EXCEPTION 'قيمة الدخول غير صالحة.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.sada_rooms WHERE id = p_room_id) THEN
    RAISE EXCEPTION 'الغرفة غير موجودة.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.sada_users WHERE id = p_creator_id) THEN
    RAISE EXCEPTION 'الحساب غير متاح.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.sada_room_lucky_wheel_rounds
    WHERE room_id = p_room_id AND status <> 'finished'
  ) THEN
    RAISE EXCEPTION 'توجد جولة دولاب نشطة بالفعل.';
  END IF;

  INSERT INTO public.sada_room_lucky_wheel_rounds (
    id, room_id, creator_id, entry_fee
  ) VALUES (
    'rwl_' || md5(p_room_id || p_creator_id || clock_timestamp()::TEXT),
    p_room_id, p_creator_id, p_entry_fee
  ) RETURNING * INTO v_round;

  RETURN to_jsonb(v_round);
END;
$$;

CREATE OR REPLACE FUNCTION public.sada_join_room_lucky_wheel(
  p_round_id TEXT,
  p_user_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_round public.sada_room_lucky_wheel_rounds%ROWTYPE;
  v_user public.sada_users%ROWTYPE;
  v_player JSONB;
BEGIN
  IF auth.uid() IS NULL OR auth.uid()::TEXT IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'لا يمكن الانضمام بجهاز حساب آخر.';
  END IF;
  SELECT * INTO v_round
  FROM public.sada_room_lucky_wheel_rounds
  WHERE id = p_round_id
  FOR UPDATE;
  IF NOT FOUND OR v_round.status <> 'registering' THEN
    RAISE EXCEPTION 'انتهى التسجيل في الجولة.';
  END IF;
  IF v_round.players @> jsonb_build_array(jsonb_build_object('userId', p_user_id)) THEN
    RAISE EXCEPTION 'أنت منضم إلى الجولة بالفعل.';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(v_round.players) AS player(value)
    WHERE coalesce((value->>'test')::BOOLEAN, FALSE)
  ) THEN
    RAISE EXCEPTION 'هذه جولة تدريبية ولا تقبل رهانات مدفوعة.';
  END IF;

  UPDATE public.sada_users
  SET coins = coins - v_round.entry_fee
  WHERE id = p_user_id AND coins >= v_round.entry_fee AND is_banned = FALSE
  RETURNING * INTO v_user;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'رصيد الكوينز غير كافٍ لقيمة الدخول.';
  END IF;

  v_player := jsonb_build_object(
    'userId', v_user.id,
    'displayName', v_user.display_name,
    'avatarUrl', v_user.avatar_url,
    'test', FALSE
  );
  UPDATE public.sada_room_lucky_wheel_rounds
  SET players = players || jsonb_build_array(v_player),
      prize_pool = prize_pool + v_round.entry_fee
  WHERE id = p_round_id
  RETURNING * INTO v_round;

  INSERT INTO public.sada_transactions (
    id, user_id, type, amount, currency, description
  ) VALUES (
    'rwl_join_' || md5(p_round_id || p_user_id),
    p_user_id, 'game_bet', -v_round.entry_fee, 'coins',
    'دخول جولة دولاب الإقصاء'
  ) ON CONFLICT (id) DO NOTHING;

  RETURN to_jsonb(v_round);
END;
$$;

CREATE OR REPLACE FUNCTION public.sada_add_room_lucky_wheel_test_player(
  p_round_id TEXT,
  p_creator_id TEXT,
  p_user_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_round public.sada_room_lucky_wheel_rounds%ROWTYPE;
  v_user public.sada_users%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR auth.uid()::TEXT IS DISTINCT FROM p_creator_id THEN
    RAISE EXCEPTION 'منشئ الجولة فقط يمكنه إضافة منافسين.';
  END IF;
  SELECT * INTO v_round
  FROM public.sada_room_lucky_wheel_rounds
  WHERE id = p_round_id AND creator_id = p_creator_id
  FOR UPDATE;
  IF NOT FOUND OR v_round.status <> 'registering' THEN
    RAISE EXCEPTION 'لا يمكن إضافة منافسين بعد بدء السحب.';
  END IF;
  IF v_round.prize_pool > 0 OR EXISTS (
    SELECT 1
    FROM jsonb_array_elements(v_round.players) AS player(value)
    WHERE coalesce((value->>'test')::BOOLEAN, FALSE) = FALSE
  ) THEN
    RAISE EXCEPTION 'لا يمكن إضافة منافس تدريبي بعد انضمام لاعب برسوم.';
  END IF;
  IF v_round.players @> jsonb_build_array(jsonb_build_object('userId', p_user_id)) THEN
    RAISE EXCEPTION 'هذا المنافس موجود في الجولة بالفعل.';
  END IF;
  SELECT * INTO v_user FROM public.sada_users WHERE id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'المنافس غير متاح.';
  END IF;

  UPDATE public.sada_room_lucky_wheel_rounds
  SET players = players || jsonb_build_array(jsonb_build_object(
    'userId', v_user.id,
    'displayName', v_user.display_name,
    'avatarUrl', v_user.avatar_url,
    'test', TRUE
  ))
  WHERE id = p_round_id
  RETURNING * INTO v_round;
  RETURN to_jsonb(v_round);
END;
$$;

CREATE OR REPLACE FUNCTION public.sada_start_room_lucky_wheel(
  p_round_id TEXT,
  p_creator_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_round public.sada_room_lucky_wheel_rounds%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR auth.uid()::TEXT IS DISTINCT FROM p_creator_id THEN
    RAISE EXCEPTION 'منشئ الجولة فقط يمكنه بدء السحب.';
  END IF;
  SELECT * INTO v_round
  FROM public.sada_room_lucky_wheel_rounds
  WHERE id = p_round_id AND creator_id = p_creator_id
  FOR UPDATE;
  IF NOT FOUND OR v_round.status <> 'registering' THEN
    RAISE EXCEPTION 'لا يمكن بدء هذه الجولة.';
  END IF;
  IF jsonb_array_length(v_round.players) < 2 THEN
    RAISE EXCEPTION 'يلزم وجود لاعبين على الأقل.';
  END IF;
  UPDATE public.sada_room_lucky_wheel_rounds
  SET status = 'spinning'
  WHERE id = p_round_id
  RETURNING * INTO v_round;
  RETURN to_jsonb(v_round);
END;
$$;

CREATE OR REPLACE FUNCTION public.sada_cancel_room_lucky_wheel(
  p_round_id TEXT,
  p_creator_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_round public.sada_room_lucky_wheel_rounds%ROWTYPE;
  v_player JSONB;
BEGIN
  IF auth.uid() IS NULL OR auth.uid()::TEXT IS DISTINCT FROM p_creator_id THEN
    RAISE EXCEPTION 'منشئ الجولة فقط يمكنه إلغاء التسجيل.';
  END IF;
  SELECT * INTO v_round
  FROM public.sada_room_lucky_wheel_rounds
  WHERE id = p_round_id AND creator_id = p_creator_id
  FOR UPDATE;
  IF NOT FOUND OR v_round.status <> 'registering' THEN
    RAISE EXCEPTION 'لا يمكن إلغاء الجولة بعد بدء السحب.';
  END IF;

  FOR v_player IN SELECT value FROM jsonb_array_elements(v_round.players)
  LOOP
    IF coalesce((v_player->>'test')::BOOLEAN, FALSE) = FALSE THEN
      UPDATE public.sada_users
      SET coins = coins + v_round.entry_fee
      WHERE id = v_player->>'userId';
      INSERT INTO public.sada_transactions (
        id, user_id, type, amount, currency, description
      ) VALUES (
        'rwl_refund_' || md5(p_round_id || (v_player->>'userId')),
        v_player->>'userId', 'game_refund', v_round.entry_fee, 'coins',
        'استرداد دخول جولة دولاب الإقصاء الملغاة'
      ) ON CONFLICT (id) DO NOTHING;
    END IF;
  END LOOP;

  UPDATE public.sada_room_lucky_wheel_rounds
  SET status = 'finished'
  WHERE id = p_round_id
  RETURNING * INTO v_round;
  RETURN to_jsonb(v_round);
END;
$$;

CREATE OR REPLACE FUNCTION public.sada_eliminate_room_lucky_wheel_player(
  p_round_id TEXT,
  p_creator_id TEXT,
  p_user_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_round public.sada_room_lucky_wheel_rounds%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR auth.uid()::TEXT IS DISTINCT FROM p_creator_id THEN
    RAISE EXCEPTION 'منشئ الجولة فقط يمكنه إقصاء اللاعبين.';
  END IF;
  SELECT * INTO v_round
  FROM public.sada_room_lucky_wheel_rounds
  WHERE id = p_round_id AND creator_id = p_creator_id
  FOR UPDATE;
  IF NOT FOUND OR v_round.status <> 'spinning' THEN
    RAISE EXCEPTION 'الجولة ليست في مرحلة السحب.';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(v_round.players) AS player(value)
    WHERE value->>'userId' = p_user_id
      AND NOT v_round.eliminated @> jsonb_build_array(p_user_id)
  ) THEN
    RAISE EXCEPTION 'اللاعب غير موجود أو تم إقصاؤه.';
  END IF;
  IF v_round.spinning_player_id IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'اللاعب الذي تم اختياره في هذا الدور مختلف.';
  END IF;

  UPDATE public.sada_room_lucky_wheel_rounds
  SET eliminated = eliminated || jsonb_build_array(p_user_id),
      spinning_player_id = NULL,
      last_eliminated_id = p_user_id
  WHERE id = p_round_id
  RETURNING * INTO v_round;
  RETURN to_jsonb(v_round);
END;
$$;

DROP FUNCTION IF EXISTS public.sada_spin_room_lucky_wheel_player(TEXT, TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.sada_spin_room_lucky_wheel_player(
  p_round_id TEXT,
  p_creator_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_round public.sada_room_lucky_wheel_rounds%ROWTYPE;
  v_selected_user_id TEXT;
BEGIN
  IF auth.uid() IS NULL OR auth.uid()::TEXT IS DISTINCT FROM p_creator_id THEN
    RAISE EXCEPTION 'منشئ الجولة فقط يمكنه تشغيل الدولاب.';
  END IF;
  SELECT * INTO v_round
  FROM public.sada_room_lucky_wheel_rounds
  WHERE id = p_round_id AND creator_id = p_creator_id
  FOR UPDATE;
  IF NOT FOUND OR v_round.status <> 'spinning' THEN
    RAISE EXCEPTION 'لا يمكن بدء هذا الدور في الجولة.';
  END IF;
  IF v_round.spinning_player_id IS NOT NULL THEN
    RETURN to_jsonb(v_round);
  END IF;
  SELECT value->>'userId' INTO v_selected_user_id
  FROM jsonb_array_elements(v_round.players) AS player(value)
  WHERE NOT v_round.eliminated @> jsonb_build_array(value->>'userId')
  ORDER BY random()
  LIMIT 1;
  IF v_selected_user_id IS NULL THEN
    RAISE EXCEPTION 'لم يتم العثور على متنافس متبقٍ.';
  END IF;
  UPDATE public.sada_room_lucky_wheel_rounds
  SET spinning_player_id = v_selected_user_id
  WHERE id = p_round_id
  RETURNING * INTO v_round;
  RETURN to_jsonb(v_round);
END;
$$;

CREATE OR REPLACE FUNCTION public.sada_finish_room_lucky_wheel(
  p_round_id TEXT,
  p_creator_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_round public.sada_room_lucky_wheel_rounds%ROWTYPE;
  v_winner_id TEXT;
  v_winner_name TEXT;
  v_payout BIGINT;
  v_alive_count INTEGER;
BEGIN
  IF auth.uid() IS NULL OR auth.uid()::TEXT IS DISTINCT FROM p_creator_id THEN
    RAISE EXCEPTION 'منشئ الجولة فقط يمكنه تسويتها.';
  END IF;
  SELECT * INTO v_round
  FROM public.sada_room_lucky_wheel_rounds
  WHERE id = p_round_id AND creator_id = p_creator_id
  FOR UPDATE;
  IF NOT FOUND OR v_round.status <> 'spinning' THEN
    RAISE EXCEPTION 'الجولة ليست جاهزة للتسوية.';
  END IF;

  SELECT count(*)::INTEGER, max(value->>'userId'), max(value->>'displayName')
  INTO v_alive_count, v_winner_id, v_winner_name
  FROM jsonb_array_elements(v_round.players) AS player(value)
  WHERE NOT v_round.eliminated @> jsonb_build_array(value->>'userId');
  IF v_alive_count <> 1 OR v_winner_id IS NULL THEN
    RAISE EXCEPTION 'يجب أن يبقى لاعب واحد فقط قبل تسوية الجولة.';
  END IF;

  v_payout := floor(v_round.prize_pool * 0.8)::BIGINT;
  UPDATE public.sada_users SET coins = coins + v_payout WHERE id = v_winner_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'تعذّر إضافة الجائزة إلى رصيد الفائز.';
  END IF;
  UPDATE public.sada_room_lucky_wheel_rounds
  SET status = 'finished', winner_id = v_winner_id
  WHERE id = p_round_id
  RETURNING * INTO v_round;

  IF v_payout > 0 THEN
    INSERT INTO public.sada_transactions (
      id, user_id, type, amount, currency, description
    ) VALUES (
      'rwl_win_' || md5(p_round_id || v_winner_id),
      v_winner_id, 'game_win', v_payout, 'coins',
      'جائزة الفائز في دولاب الإقصاء بعد عمولة المنصة'
    ) ON CONFLICT (id) DO NOTHING;
  END IF;

  RETURN jsonb_build_object(
    'round', to_jsonb(v_round),
    'winner_id', v_winner_id,
    'winner_name', v_winner_name,
    'payout', v_payout
  );
END;
$$;

REVOKE ALL ON FUNCTION public.sada_create_room_lucky_wheel(TEXT, TEXT, BIGINT)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sada_join_room_lucky_wheel(TEXT, TEXT)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sada_add_room_lucky_wheel_test_player(TEXT, TEXT, TEXT)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sada_start_room_lucky_wheel(TEXT, TEXT)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sada_cancel_room_lucky_wheel(TEXT, TEXT)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sada_eliminate_room_lucky_wheel_player(TEXT, TEXT, TEXT)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sada_spin_room_lucky_wheel_player(TEXT, TEXT)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sada_finish_room_lucky_wheel(TEXT, TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sada_create_room_lucky_wheel(TEXT, TEXT, BIGINT)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sada_join_room_lucky_wheel(TEXT, TEXT)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sada_add_room_lucky_wheel_test_player(TEXT, TEXT, TEXT)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sada_start_room_lucky_wheel(TEXT, TEXT)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sada_cancel_room_lucky_wheel(TEXT, TEXT)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sada_eliminate_room_lucky_wheel_player(TEXT, TEXT, TEXT)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sada_spin_room_lucky_wheel_player(TEXT, TEXT)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sada_finish_room_lucky_wheel(TEXT, TEXT)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.sada_can_clear_room_chat(p_room_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
DECLARE
  caller_email TEXT := lower(coalesce(auth.jwt() ->> 'email', ''));
  caller_id TEXT;
  room_host_id TEXT;
  host_agency_id TEXT;
  deputy_ids JSONB;
BEGIN
  IF caller_email = '' THEN
    RETURN FALSE;
  END IF;

  SELECT id INTO caller_id
  FROM public.sada_users
  WHERE lower(email) = caller_email;
  IF caller_id IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT host_id INTO room_host_id
  FROM public.sada_rooms
  WHERE id = p_room_id AND is_active = TRUE;
  IF room_host_id IS NULL THEN
    RETURN FALSE;
  END IF;
  IF caller_id = room_host_id THEN
    RETURN TRUE;
  END IF;

  SELECT settings -> 'roomConfigs' -> p_room_id -> 'deputyIds'
  INTO deputy_ids
  FROM public.sada_platform_state
  WHERE id = 'global';
  IF coalesce(deputy_ids, '[]'::jsonb) ? caller_id THEN
    RETURN TRUE;
  END IF;

  SELECT agency_id INTO host_agency_id
  FROM public.sada_users
  WHERE id = room_host_id;
  IF host_agency_id IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.sada_agencies
    WHERE id = host_agency_id
      AND (
        owner_id = caller_id
        OR coalesce(host_ids, '[]'::jsonb) ? caller_id
      )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.sada_clear_room_chat(p_room_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
DECLARE
  caller_email TEXT := lower(coalesce(auth.jwt() ->> 'email', ''));
  caller_id TEXT;
  caller_name TEXT;
  caller_level INTEGER;
  notice public.sada_room_messages%ROWTYPE;
BEGIN
  IF NOT public.sada_can_clear_room_chat(p_room_id) THEN
    RAISE EXCEPTION 'لا تملك صلاحية مسح دردشة هذه الغرفة.';
  END IF;

  SELECT id, display_name, level
  INTO caller_id, caller_name, caller_level
  FROM public.sada_users
  WHERE lower(email) = caller_email;

  DELETE FROM public.sada_room_messages
  WHERE room_id = p_room_id;

  INSERT INTO public.sada_room_messages (
    id,
    room_id,
    user_id,
    display_name,
    level,
    is_admin,
    text,
    type,
    timestamp
  )
  VALUES (
    'msg_' || replace(gen_random_uuid()::TEXT, '-', ''),
    p_room_id,
    caller_id,
    caller_name,
    caller_level,
    FALSE,
    'تم مسح الدردشة بواسطة الإدارة',
    'system',
    NOW()
  )
  RETURNING * INTO notice;

  RETURN to_jsonb(notice);
END;
$$;

CREATE OR REPLACE FUNCTION public.sada_admin_reset_all_except_super_admin()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
DECLARE
  caller_email TEXT := lower(coalesce(auth.jwt() ->> 'email', ''));
  admin_id TEXT;
  app_user_ids TEXT[];
BEGIN
  IF caller_email <> 'bahaa.f36@gmail.com' THEN
    RAISE EXCEPTION 'هذه العملية مخصصة لحساب الإدارة العليا فقط.';
  END IF;

  SELECT id INTO admin_id
  FROM public.sada_users
  WHERE lower(email) = 'bahaa.f36@gmail.com';
  IF admin_id IS NULL THEN
    RAISE EXCEPTION 'تعذّر العثور على حساب الإدارة المطلوب الإبقاء عليه.';
  END IF;

  SELECT coalesce(array_agg(id), ARRAY[]::TEXT[])
  INTO app_user_ids
  FROM public.sada_users
  WHERE id <> admin_id;

  DELETE FROM public.sada_private_messages;
  DELETE FROM public.sada_room_messages;
  DELETE FROM public.sada_sessions WHERE user_id <> admin_id;
  DELETE FROM public.sada_device_locks WHERE bound_user_id <> admin_id;
  DELETE FROM public.sada_security_logs;
  DELETE FROM public.sada_transactions;
  DELETE FROM public.sada_rooms;
  DELETE FROM public.sada_agencies;
  DELETE FROM public.sada_competitions;
  DELETE FROM public.sada_cultural_questions;
  DELETE FROM public.sada_usdt_deposits;
  DELETE FROM public.sada_usdt_withdrawals;
  DELETE FROM public.sada_female_voice_requests;
  DELETE FROM public.sada_platform_state;
  INSERT INTO public.sada_platform_state (
    id,
    app_prize_pool_coins,
    settings,
    quiz_sessions,
    voted_keys,
    ladder_sessions,
    updated_at
  )
  VALUES ('global', 0, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, NOW());
  DELETE FROM public.sada_gifts
  WHERE id NOT SIMILAR TO 'gift_[0-9][0-9]'
    AND id NOT SIMILAR TO 'lucky_[0-9][0-9]';
  DELETE FROM public.sada_users WHERE id <> admin_id;
  DELETE FROM auth.users
  WHERE id::TEXT = ANY(app_user_ids)
    AND lower(email) IS DISTINCT FROM 'bahaa.f36@gmail.com';

  RETURN jsonb_build_object('status', 'reset', 'admin_id', admin_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.sada_purchase_vip_id(p_user_id TEXT, p_item_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
DECLARE
  caller_id TEXT := auth.uid()::TEXT;
  item public.sada_vip_ids_catalog%ROWTYPE;
  next_coins BIGINT;
BEGIN
  IF caller_id IS NULL OR caller_id <> p_user_id THEN
    RAISE EXCEPTION 'لا يمكن شراء رقم ID لحساب آخر.';
  END IF;

  SELECT * INTO item
  FROM public.sada_vip_ids_catalog
  WHERE id = p_item_id
  FOR UPDATE;
  IF item.id IS NULL THEN
    RAISE EXCEPTION 'رقم ID غير موجود في المتجر.';
  END IF;
  IF item.owner_id IS NOT NULL THEN
    RAISE EXCEPTION 'هذا الرقم مملوك بالفعل.';
  END IF;

  UPDATE public.sada_users
  SET coins = coins - item.price_coins
  WHERE id = p_user_id AND coins >= item.price_coins
  RETURNING coins INTO next_coins;
  IF next_coins IS NULL THEN
    RAISE EXCEPTION 'رصيد الكوينز غير كافٍ.';
  END IF;

  UPDATE public.sada_vip_ids_catalog SET owner_id = NULL WHERE owner_id = p_user_id;
  UPDATE public.sada_vip_ids_catalog SET owner_id = p_user_id WHERE id = p_item_id;

  INSERT INTO public.sada_platform_state (id, settings)
  VALUES ('global', '{}'::jsonb)
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.sada_platform_state
  SET settings = jsonb_set(
    coalesce(settings, '{}'::jsonb),
    '{customVipIds}',
    (CASE
      WHEN jsonb_typeof(settings -> 'customVipIds') = 'object'
        THEN settings -> 'customVipIds'
      ELSE '{}'::jsonb
    END) || jsonb_build_object(p_user_id, item.number),
    TRUE
  ),
  updated_at = NOW()
  WHERE id = 'global';

  INSERT INTO public.sada_transactions (id, user_id, type, amount, currency, description, timestamp)
  VALUES (
    'tx_' || replace(gen_random_uuid()::TEXT, '-', ''),
    p_user_id,
    'store_purchase',
    -item.price_coins,
    'coins',
    'شراء رقم ID مميز: ' || item.number,
    NOW()
  );

  RETURN jsonb_build_object('number', item.number, 'price_coins', item.price_coins, 'coins', next_coins);
END;
$$;

CREATE OR REPLACE FUNCTION public.sada_activate_svip(p_user_id TEXT, p_level SMALLINT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
DECLARE
  caller_id TEXT := auth.uid()::TEXT;
  tier public.sada_svip_tiers%ROWTYPE;
  updated_user public.sada_users%ROWTYPE;
BEGIN
  IF caller_id IS NULL OR caller_id <> p_user_id THEN
    RAISE EXCEPTION 'لا يمكن تفعيل عضوية SVIP لحساب آخر.';
  END IF;

  SELECT * INTO tier
  FROM public.sada_svip_tiers
  WHERE level = p_level
  FOR UPDATE;
  IF tier.level IS NULL THEN
    RAISE EXCEPTION 'مستوى SVIP غير صالح.';
  END IF;

  UPDATE public.sada_users
  SET coins = coins - tier.price_coins,
      svip_level = tier.level,
      svip_expires_at = greatest(coalesce(svip_expires_at, NOW()), NOW()) + INTERVAL '30 days'
  WHERE id = p_user_id AND coins >= tier.price_coins
  RETURNING * INTO updated_user;
  IF updated_user.id IS NULL THEN
    RAISE EXCEPTION 'رصيد الكوينز غير كافٍ.';
  END IF;

  INSERT INTO public.sada_transactions (id, user_id, type, amount, currency, description, timestamp)
  VALUES (
    'tx_' || replace(gen_random_uuid()::TEXT, '-', ''),
    p_user_id,
    'store_purchase',
    -tier.price_coins,
    'coins',
    'تفعيل عضوية ' || tier.label || ' لمدة 30 يوماً',
    NOW()
  );

  RETURN jsonb_build_object(
    'coins', updated_user.coins,
    'svip_level', updated_user.svip_level,
    'svip_expires_at', updated_user.svip_expires_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.sada_can_clear_room_chat(TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sada_clear_room_chat(TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sada_admin_reset_all_except_super_admin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sada_purchase_vip_id(TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sada_activate_svip(TEXT, SMALLINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sada_can_clear_room_chat(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sada_clear_room_chat(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sada_admin_reset_all_except_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.sada_purchase_vip_id(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sada_activate_svip(TEXT, SMALLINT) TO authenticated;

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
