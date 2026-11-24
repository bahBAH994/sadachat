import type { GrandCompetitionSettings } from '../types';
import { createDefaultPlatformSettings } from './sadaCatalog';
import { supabase } from './supabase';

export const GRAND_COMPETITION_PACKAGES = [
  { coins: 20_000, weight: 1 },
  { coins: 50_000, weight: 3 },
  { coins: 100_000, weight: 7 },
  { coins: 200_000, weight: 16 },
] as const;

export type GrandCompetitionContent = Pick<
  GrandCompetitionSettings,
  'monthlyClosingPrizes' | 'participationTerms' | 'schedule'
>;

const defaultGrandCompetition = createDefaultPlatformSettings().grandCompetition!;

function normalizeGrandCompetition(value: unknown): GrandCompetitionSettings {
  const raw =
    value && typeof value === 'object'
      ? (value as Partial<GrandCompetitionSettings>)
      : {};
  return {
    ...defaultGrandCompetition,
    ...raw,
  };
}

export async function getGrandCompetitionSettings(): Promise<GrandCompetitionSettings> {
  const { data, error } = await supabase
    .from('sada_platform_state')
    .select('settings')
    .eq('id', 'global')
    .maybeSingle();
  if (error) throw new Error(`تعذّر تحميل إعدادات المسابقة: ${error.message}`);

  const settings = data?.settings;
  return normalizeGrandCompetition(
    settings && typeof settings === 'object'
      ? (settings as Record<string, unknown>).grandCompetition
      : null
  );
}

export async function getGrandCompetitionShare(): Promise<{
  participantWeight: number;
  sharePercent: number;
}> {
  const { data, error } = await supabase.rpc('sada_get_my_grand_competition_share');
  if (error) throw new Error(error.message);
  if (!data || typeof data !== 'object') {
    throw new Error('تعذّر تحميل حصة اشتراكك في المسابقة.');
  }
  const result = data as Record<string, unknown>;
  const participantWeight = Number(result.participant_weight);
  const sharePercent = Number(result.share_percent);
  if (!Number.isFinite(participantWeight) || !Number.isFinite(sharePercent)) {
    throw new Error('لم تُرجع قاعدة البيانات حصة مشاركة صالحة.');
  }
  return { participantWeight, sharePercent };
}

export async function subscribeToGrandCompetitionPackage(
  userId: string,
  packageCoins: number
): Promise<{
  coins: number;
  settings: GrandCompetitionSettings;
  participantWeight: number;
  sharePercent: number;
}> {
  const { data, error } = await supabase.rpc('sada_join_grand_competition', {
    p_user_id: userId,
    p_package_coins: packageCoins,
  });
  if (error) throw new Error(error.message);
  if (!data || typeof data !== 'object') {
    throw new Error('لم تُرجع قاعدة البيانات تأكيداً للاشتراك.');
  }

  const result = data as Record<string, unknown>;
  const coins = Number(result.coins);
  const participantWeight = Number(result.participant_weight);
  const sharePercent = Number(result.share_percent);
  if (
    !Number.isFinite(coins) ||
    !Number.isFinite(participantWeight) ||
    !Number.isFinite(sharePercent)
  ) {
    throw new Error('لم تُرجع قاعدة البيانات نتيجة اشتراك صالحة.');
  }
  return {
    coins,
    settings: normalizeGrandCompetition(result.grand_competition),
    participantWeight,
    sharePercent,
  };
}

export async function saveGrandCompetitionContent(
  content: GrandCompetitionContent
): Promise<void> {
  const { error } = await supabase.rpc('sada_admin_save_grand_competition', {
    p_monthly_closing_prizes: content.monthlyClosingPrizes,
    p_participation_terms: content.participationTerms,
    p_schedule: content.schedule,
  });
  if (error) throw new Error(error.message);
}

export async function resetGrandCompetitionCycle(): Promise<void> {
  const { error } = await supabase.rpc('sada_admin_reset_grand_competition_cycle');
  if (error) throw new Error(error.message);
}
