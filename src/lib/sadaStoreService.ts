import { supabase } from './supabase';
import { genId } from './sadaCatalog';

export type StoreCategory = 'frames' | 'entrances' | 'backgrounds';

export interface StoreItem {
  id: string;
  category: StoreCategory;
  name: string;
  priceCoins: number;
  assetUrl: string;
  assetPath: string;
  createdAt: string;
}

export interface OwnedStoreItem extends StoreItem {
  acquiredAt: string;
  source: 'purchase' | 'reward';
  equipped: boolean;
}

const STORE_ASSETS_BUCKET = 'sada-store-assets';

function mapStoreItem(row: Record<string, unknown>): StoreItem {
  return {
    id: String(row.id),
    category: row.category as StoreCategory,
    name: String(row.name),
    priceCoins: Number(row.price_coins),
    assetUrl: String(row.asset_url),
    assetPath: String(row.asset_path),
    createdAt: String(row.created_at),
  };
}

export async function getStoreItems(category?: StoreCategory): Promise<StoreItem[]> {
  let query = supabase.from('sada_store_items').select('*').order('created_at', {
    ascending: false,
  });
  if (category) query = query.eq('category', category);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data || []).map((row) => mapStoreItem(row as Record<string, unknown>));
}

export async function getMyStoreItems(
  userId: string,
  category?: StoreCategory
): Promise<OwnedStoreItem[]> {
  let query = supabase
    .from('sada_user_store_items')
    .select(
      'acquired_at, source, is_equipped, item:sada_store_items!inner(id, category, name, price_coins, asset_url, asset_path, created_at)'
    )
    .eq('user_id', userId)
    .order('acquired_at', { ascending: false });
  if (category) query = query.eq('item.category', category);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data || []).map((row) => ({
    ...mapStoreItem(row.item as Record<string, unknown>),
    acquiredAt: String(row.acquired_at),
    source: row.source as OwnedStoreItem['source'],
    equipped: Boolean(row.is_equipped),
  }));
}

export async function purchaseStoreItem(userId: string, itemId: string): Promise<number> {
  const { data, error } = await supabase.rpc('sada_purchase_store_item', {
    p_user_id: userId,
    p_item_id: itemId,
  });
  if (error) throw new Error(error.message);
  const coins = Number((data as { coins?: unknown } | null)?.coins);
  if (!Number.isFinite(coins)) throw new Error('تعذّر تحديث رصيد الكوينز بعد الشراء.');
  return coins;
}

export async function setStoreItemEquipped(
  userId: string,
  itemId: string,
  equipped: boolean
): Promise<void> {
  const { error } = await supabase.rpc('sada_set_store_item_equipped', {
    p_user_id: userId,
    p_item_id: itemId,
    p_equipped: equipped,
  });
  if (error) throw new Error(error.message);
}

export async function removeStoreItemFromBag(
  userId: string,
  itemId: string
): Promise<void> {
  const { error } = await supabase.rpc('sada_remove_store_item_from_bag', {
    p_user_id: userId,
    p_item_id: itemId,
  });
  if (error) throw new Error(error.message);
}

export async function addStoreItem(input: {
  category: StoreCategory;
  name: string;
  priceCoins: number;
  file: File;
}): Promise<void> {
  if (!input.file.type.startsWith('image/') && !input.file.type.startsWith('video/')) {
    throw new Error('اختر ملف صورة أو فيديو متحركاً صالحاً.');
  }
  const itemId = genId('store');
  const safeFileName = input.file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const assetPath = `${itemId}/${safeFileName}`;
  const storage = supabase.storage.from(STORE_ASSETS_BUCKET);
  const { error: uploadError } = await storage.upload(assetPath, input.file, {
    contentType: input.file.type,
    upsert: false,
  });
  if (uploadError) throw new Error(uploadError.message);

  const { data: publicUrl } = storage.getPublicUrl(assetPath);
  const { error: insertError } = await supabase.from('sada_store_items').insert({
    id: itemId,
    category: input.category,
    name: input.name.trim(),
    price_coins: input.priceCoins,
    asset_url: publicUrl.publicUrl,
    asset_path: assetPath,
  });
  if (insertError) {
    const { error: cleanupError } = await storage.remove([assetPath]);
    if (cleanupError) {
      console.error('Unable to remove uploaded store asset after item insert failed:', cleanupError);
    }
    throw new Error(insertError.message);
  }
}

export async function deleteStoreItem(itemId: string): Promise<void> {
  const { data: item, error: loadError } = await supabase
    .from('sada_store_items')
    .select('asset_path')
    .eq('id', itemId)
    .maybeSingle();
  if (loadError) throw new Error(loadError.message);
  if (!item) throw new Error('العنصر غير موجود في المتجر.');

  const { error: deleteError } = await supabase
    .from('sada_store_items')
    .delete()
    .eq('id', itemId);
  if (deleteError) throw new Error(deleteError.message);

  const { error: storageError } = await supabase.storage
    .from(STORE_ASSETS_BUCKET)
    .remove([String(item.asset_path)]);
  if (storageError) throw new Error(`حُذف العنصر، لكن تعذّر حذف ملفه: ${storageError.message}`);
}
