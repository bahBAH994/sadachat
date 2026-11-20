import type { User } from '../types';
import { getUserVipTierInfo } from './sadaCatalog';
import { supabase } from './supabase';

export interface UserVipTotals {
  totalRechargedCoins: number;
  totalSpentCoins: number;
}

const VIP_SPEND_TX_TYPES = [
  'gift_sent',
  'pm_sent',
  'vote',
  'store_purchase',
  'slot_spin',
  'game_bet',
];

const VIP_RECHARGE_TX_TYPES = ['topup', 'admin_grant'];

const VIP_ALL_RELEVANT_TX_TYPES = [...VIP_RECHARGE_TX_TYPES, ...VIP_SPEND_TX_TYPES];

const vipTotalsCache = new Map<string, UserVipTotals & { ts: number }>();
const VIP_CACHE_TTL_MS = 15_000;

export function invalidateUserVipCache(userId?: string): void {
  if (!userId) {
    vipTotalsCache.clear();
    return;
  }
  vipTotalsCache.delete(userId);
}

export async function fetchUserVipTotals(
  userId: string,
  forceRefresh = false
): Promise<UserVipTotals> {
  if (!userId) return { totalRechargedCoins: 0, totalSpentCoins: 0 };

  const cached = vipTotalsCache.get(userId);
  if (!forceRefresh && cached && Date.now() - cached.ts < VIP_CACHE_TTL_MS) {
    return {
      totalRechargedCoins: cached.totalRechargedCoins,
      totalSpentCoins: cached.totalSpentCoins,
    };
  }

  try {
    const [{ data: approvedDeps }, { data: txs }] = await Promise.all([
      supabase
        .from('sada_usdt_deposits')
        .select('coins_credited')
        .eq('user_id', userId)
        .eq('status', 'approved'),
      supabase
        .from('sada_transactions')
        .select('type, amount, description')
        .eq('user_id', userId)
        .in('type', VIP_ALL_RELEVANT_TX_TYPES),
    ]);

    const fromDeposits = (approvedDeps || []).reduce(
      (sum, d) => sum + Math.max(0, Number(d.coins_credited || 0)),
      0
    );

    let fromRechargeTxs = 0;
    let totalSpentCoins = 0;

    for (const t of txs || []) {
      const txType = String(t.type || '');
      const rawAmt = Number(t.amount || 0);
      if (txType === 'topup' || txType === 'admin_grant') {
        if (rawAmt <= 0) continue;
        if (txType === 'admin_grant' && String(t.description || '').includes('ترحيبي')) {
          continue;
        }
        fromRechargeTxs += rawAmt;
      } else if (VIP_SPEND_TX_TYPES.includes(txType)) {
        totalSpentCoins += Math.abs(rawAmt);
      }
    }

    const result: UserVipTotals = {
      totalRechargedCoins: fromDeposits + fromRechargeTxs,
      totalSpentCoins,
    };
    vipTotalsCache.set(userId, { ...result, ts: Date.now() });
    return result;
  } catch {
    return { totalRechargedCoins: 0, totalSpentCoins: 0 };
  }
}

export async function fetchUsersVipTotalsBatch(
  userIds: string[]
): Promise<Record<string, UserVipTotals>> {
  const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
  const out: Record<string, UserVipTotals> = {};
  if (uniqueIds.length === 0) return out;

  const missingIds: string[] = [];
  const now = Date.now();
  for (const id of uniqueIds) {
    const cached = vipTotalsCache.get(id);
    if (cached && now - cached.ts < VIP_CACHE_TTL_MS) {
      out[id] = {
        totalRechargedCoins: cached.totalRechargedCoins,
        totalSpentCoins: cached.totalSpentCoins,
      };
    } else {
      out[id] = { totalRechargedCoins: 0, totalSpentCoins: 0 };
      missingIds.push(id);
    }
  }

  if (missingIds.length === 0) return out;

  try {
    const [{ data: approvedDeps }, { data: txs }] = await Promise.all([
      supabase
        .from('sada_usdt_deposits')
        .select('user_id, coins_credited')
        .in('user_id', missingIds)
        .eq('status', 'approved'),
      supabase
        .from('sada_transactions')
        .select('user_id, type, amount, description')
        .in('user_id', missingIds)
        .in('type', VIP_ALL_RELEVANT_TX_TYPES),
    ]);

    for (const d of approvedDeps || []) {
      const uid = String(d.user_id || '');
      if (!uid || !out[uid]) continue;
      out[uid].totalRechargedCoins += Math.max(0, Number(d.coins_credited || 0));
    }

    for (const t of txs || []) {
      const uid = String(t.user_id || '');
      if (!uid || !out[uid]) continue;
      const txType = String(t.type || '');
      const rawAmt = Number(t.amount || 0);
      if (txType === 'topup' || txType === 'admin_grant') {
        if (rawAmt <= 0) continue;
        if (txType === 'admin_grant' && String(t.description || '').includes('ترحيبي')) {
          continue;
        }
        out[uid].totalRechargedCoins += rawAmt;
      } else if (VIP_SPEND_TX_TYPES.includes(txType)) {
        out[uid].totalSpentCoins += Math.abs(rawAmt);
      }
    }

    for (const id of missingIds) {
      vipTotalsCache.set(id, { ...out[id], ts: Date.now() });
    }
  } catch {
    // keep defaults on transient error
  }

  return out;
}

export async function enrichUserWithVipTotals(
  user: User,
  forceRefresh = false
): Promise<User> {
  const [totals] = await Promise.all([
    fetchUserVipTotals(user.id, forceRefresh),
    import('./sadaMappers').then((m) => m.getPlatformState().catch(() => null)),
  ]);
  const merged: User = {
    ...user,
    totalRecharged: Math.max(user.totalRecharged || 0, totals.totalRechargedCoins),
    totalSpentCoins: Math.max(user.totalSpentCoins || 0, totals.totalSpentCoins),
  };
  merged.vipLevel = getUserVipTierInfo(merged).key;
  return merged;
}
