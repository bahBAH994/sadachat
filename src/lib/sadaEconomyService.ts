import { supabase } from './supabase';

export interface EconomySettings {
  weeklyAgencyTarget: number;
  agencyBackgroundPrice: number;
  roomBackgroundPrice: number;
  agencyCommissionPct: number;
  wheelCommissionPct: number;
  wheelEntryFee: number;
  diamondConversionRate: number;
}

const ECONOMY_COLUMNS =
  'weekly_agency_target, agency_background_price, room_background_price, agency_commission_pct, wheel_commission_pct, wheel_entry_fee, diamond_conversion_rate';

function mapEconomySettings(row: Record<string, unknown>): EconomySettings {
  return {
    weeklyAgencyTarget: Number(row.weekly_agency_target),
    agencyBackgroundPrice: Number(row.agency_background_price),
    roomBackgroundPrice: Number(row.room_background_price),
    agencyCommissionPct: Number(row.agency_commission_pct),
    wheelCommissionPct: Number(row.wheel_commission_pct),
    wheelEntryFee: Number(row.wheel_entry_fee),
    diamondConversionRate: Number(row.diamond_conversion_rate),
  };
}

function validateEconomySettings(settings: EconomySettings): void {
  const positiveValues = [
    settings.weeklyAgencyTarget,
    settings.agencyBackgroundPrice,
    settings.roomBackgroundPrice,
    settings.wheelEntryFee,
    settings.diamondConversionRate,
  ];
  if (positiveValues.some((value) => !Number.isFinite(value) || value <= 0)) {
    throw new Error('يجب أن تكون أهداف وأسعار وإعدادات التحويل أكبر من صفر.');
  }
  const commissionValues = [
    settings.agencyCommissionPct,
    settings.wheelCommissionPct,
  ];
  if (
    commissionValues.some(
      (value) => !Number.isFinite(value) || value < 0 || value > 100
    )
  ) {
    throw new Error('يجب أن تكون نسب العمولة بين 0 و100%.');
  }
}

export async function getEconomySettingsFromSupabase(): Promise<EconomySettings> {
  const { data, error } = await supabase
    .from('sada_economy_settings')
    .select(ECONOMY_COLUMNS)
    .eq('id', 'global')
    .maybeSingle();
  if (error) {
    throw new Error(`تعذّر تحميل إعدادات الاقتصاد: ${error.message}`);
  }
  if (!data) {
    throw new Error('إعدادات الاقتصاد غير موجودة. يرجى تطبيق مخطط قاعدة البيانات.');
  }
  const settings = mapEconomySettings(data);
  validateEconomySettings(settings);
  return settings;
}

export async function updateEconomySettingsInSupabase(
  settings: EconomySettings
): Promise<EconomySettings> {
  validateEconomySettings(settings);
  const { data, error } = await supabase
    .from('sada_economy_settings')
    .update({
      weekly_agency_target: Math.floor(settings.weeklyAgencyTarget),
      agency_background_price: Math.floor(settings.agencyBackgroundPrice),
      room_background_price: Math.floor(settings.roomBackgroundPrice),
      agency_commission_pct: settings.agencyCommissionPct,
      wheel_commission_pct: settings.wheelCommissionPct,
      wheel_entry_fee: Math.floor(settings.wheelEntryFee),
      diamond_conversion_rate: settings.diamondConversionRate,
    })
    .eq('id', 'global')
    .select(ECONOMY_COLUMNS)
    .maybeSingle();
  if (error) {
    throw new Error(`تعذّر حفظ إعدادات الاقتصاد: ${error.message}`);
  }
  if (!data) {
    throw new Error('لم يتم العثور على سجل إعدادات الاقتصاد لتحديثه.');
  }
  const saved = mapEconomySettings(data);
  validateEconomySettings(saved);
  return saved;
}
