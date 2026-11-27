import { supabase } from './supabase';

export interface EconomySettings {
  weeklyAgencyTarget: number;
  agencyBackgroundClassicPrice: number;
  agencyBackgroundGoldPrice: number;
  agencyBackgroundRoyalPrice: number;
  roomBackgroundPrice: number;
  agencyCommissionPct: number;
  wheelCommissionPct: number;
  wheelEntryFee: number;
  diamondsPerUsdt: number;
  minWithdrawUsdt: number;
  usdtToCoinsRate: number;
  usdtToSypRate: number;
  diamondToCoinRate: number;
}

const ECONOMY_COLUMNS =
  'weekly_agency_target, agency_background_classic_price, agency_background_gold_price, agency_background_royal_price, room_background_price, agency_commission_pct, wheel_commission_pct, wheel_entry_fee, diamonds_per_usdt, min_withdraw_usdt, usdt_to_coins_rate, usdt_to_syp_rate, diamond_to_coin_rate';

function mapEconomySettings(row: Record<string, unknown>): EconomySettings {
  return {
    weeklyAgencyTarget: Number(row.weekly_agency_target),
    agencyBackgroundClassicPrice: Number(row.agency_background_classic_price),
    agencyBackgroundGoldPrice: Number(row.agency_background_gold_price),
    agencyBackgroundRoyalPrice: Number(row.agency_background_royal_price),
    roomBackgroundPrice: Number(row.room_background_price),
    agencyCommissionPct: Number(row.agency_commission_pct),
    wheelCommissionPct: Number(row.wheel_commission_pct),
    wheelEntryFee: Number(row.wheel_entry_fee),
    diamondsPerUsdt: Number(row.diamonds_per_usdt),
    minWithdrawUsdt: Number(row.min_withdraw_usdt),
    usdtToCoinsRate: Number(row.usdt_to_coins_rate),
    usdtToSypRate: Number(row.usdt_to_syp_rate),
    diamondToCoinRate: Number(row.diamond_to_coin_rate),
  };
}

function validateEconomySettings(settings: EconomySettings): void {
  const positiveValues = [
    settings.weeklyAgencyTarget,
    settings.agencyBackgroundClassicPrice,
    settings.agencyBackgroundGoldPrice,
    settings.agencyBackgroundRoyalPrice,
    settings.roomBackgroundPrice,
    settings.diamondsPerUsdt,
    settings.minWithdrawUsdt,
    settings.usdtToCoinsRate,
    settings.usdtToSypRate,
    settings.diamondToCoinRate,
  ];
  if (positiveValues.some((value) => !Number.isFinite(value) || value <= 0)) {
    throw new Error('يجب أن تكون أهداف وأسعار وإعدادات التحويل أكبر من صفر.');
  }
  if (
    ![200, 500, 1000].includes(settings.wheelEntryFee)
  ) {
    throw new Error('رسوم الدخول المتاحة هي 200 أو 500 أو 1,000 كوينز.');
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
  if (settings.diamondToCoinRate > 100) {
    throw new Error('معدل تحويل الألماس إلى كوينز يجب ألا يتجاوز 100%.');
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
      agency_background_classic_price: Math.floor(settings.agencyBackgroundClassicPrice),
      agency_background_gold_price: Math.floor(settings.agencyBackgroundGoldPrice),
      agency_background_royal_price: Math.floor(settings.agencyBackgroundRoyalPrice),
      room_background_price: Math.floor(settings.roomBackgroundPrice),
      agency_commission_pct: settings.agencyCommissionPct,
      wheel_commission_pct: settings.wheelCommissionPct,
      wheel_entry_fee: Math.floor(settings.wheelEntryFee),
      diamonds_per_usdt: Math.floor(settings.diamondsPerUsdt),
      min_withdraw_usdt: settings.minWithdrawUsdt,
      usdt_to_coins_rate: Math.floor(settings.usdtToCoinsRate),
      usdt_to_syp_rate: Math.floor(settings.usdtToSypRate),
      diamond_to_coin_rate: settings.diamondToCoinRate,
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
