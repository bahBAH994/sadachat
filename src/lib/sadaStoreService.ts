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
  expiresAt: string | null;
  source: 'purchase' | 'reward';
  equipped: boolean;
}

export interface EquippedStoreAsset {
  category: StoreCategory;
  name: string;
  assetUrl: string;
  assetPath: string;
  frameId?: string;
}

const STORE_ASSETS_BUCKET = 'store-assets';
const DATA_URL_ASSET_PREFIX = 'data:';

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('تعذّرت قراءة الملف كبيانات محلية.'));
        return;
      }
      resolve(reader.result);
    };
    reader.onerror = () => reject(new Error('تعذّرت قراءة الملف كبيانات محلية.'));
    reader.readAsDataURL(file);
  });
}

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
  const { error: expiryError } = await supabase.rpc('sada_expire_store_items', {
    p_user_id: userId,
  });
  if (expiryError) throw new Error(expiryError.message);

  let query = supabase
    .from('sada_user_store_items')
    .select(
      'acquired_at, expires_at, source, is_equipped, item:sada_store_items!inner(id, category, name, price_coins, asset_url, asset_path, created_at)'
    )
    .eq('user_id', userId)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .order('acquired_at', { ascending: false });
  if (category) query = query.eq('item.category', category);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data || []).map((row) => ({
    ...mapStoreItem(row.item as Record<string, unknown>),
    acquiredAt: String(row.acquired_at),
    expiresAt: row.expires_at ? String(row.expires_at) : null,
    source: row.source as OwnedStoreItem['source'],
    equipped: Boolean(row.is_equipped),
  }));
}

export async function getEquippedStoreAsset(
  userId: string,
  category: StoreCategory
): Promise<EquippedStoreAsset | null> {
  const { data, error } = await supabase
    .from('sada_user_store_items')
    .select(
      'is_equipped, item:sada_store_items!inner(id, category, name, asset_url, asset_path)'
    )
    .eq('user_id', userId)
    .eq('is_equipped', true)
    .eq('item.category', category)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (data?.item) {
    const item = data.item as Record<string, unknown>;
    return {
      category,
      name: String(item.name),
      assetUrl: String(item.asset_url),
      assetPath: String(item.asset_path),
    };
  }

  if (category !== 'frames') return null;

  const { data: userFrame, error: userFrameError } = await supabase
    .from('sada_users')
    .select('equipped_frame, frame_url')
    .eq('id', userId)
    .maybeSingle();
  if (userFrameError && userFrameError.code !== '42703') {
    throw new Error(userFrameError.message);
  }
  if (!userFrame) return null;

  const frameUrl =
    typeof userFrame.frame_url === 'string' && userFrame.frame_url.trim()
      ? userFrame.frame_url
      : typeof userFrame.equipped_frame === 'string' &&
          /^(https?:|data:|blob:)/i.test(userFrame.equipped_frame)
        ? userFrame.equipped_frame
        : null;
  if (frameUrl) {
    return {
      category,
      name: 'إطار مرتدى',
      assetUrl: frameUrl,
      assetPath: frameUrl,
    };
  }

  const frameId =
    typeof userFrame.equipped_frame === 'string' && userFrame.equipped_frame.trim()
      ? userFrame.equipped_frame
      : undefined;
  if (!frameId) return null;

  const { data: storeFrame, error: storeFrameError } = await supabase
    .from('sada_store_items')
    .select('name, asset_url, asset_path')
    .eq('id', frameId)
    .eq('category', 'frames')
    .maybeSingle();
  if (storeFrameError) throw new Error(storeFrameError.message);
  return storeFrame
    ? {
        category,
        name: String(storeFrame.name),
        assetUrl: String(storeFrame.asset_url),
        assetPath: String(storeFrame.asset_path),
      }
    : { category, name: 'إطار مرتدى', assetUrl: '', assetPath: '', frameId };
}

export async function getEquippedRoomBackground(
  roomId: string
): Promise<EquippedStoreAsset | null> {
  const { data: roomRow } = await supabase
    .from('rooms')
    .select('owner_id')
    .eq('id', roomId)
    .maybeSingle();
  if (!roomRow?.owner_id) return null;
  return getEquippedStoreAsset(String(roomRow.owner_id), 'backgrounds');
}

export async function purchaseStoreItem(userId: string, itemId: string): Promise<number> {
  const { data, error } = await supabase.rpc('sada_purchase_store_item', {
    p_user_id: userId,
    p_item_id: itemId,
  });
  if (error) throw new Error(error.message);
  const result = data as
    | { success?: unknown; new_coins?: unknown; coins?: unknown; message?: unknown }
    | null;
  if (result?.success === false) {
    throw new Error(
      typeof result.message === 'string' ? result.message : 'تعذّر إتمام الشراء.'
    );
  }
  const coins = Number(result?.new_coins ?? result?.coins);
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
}): Promise<StoreItem> {
  if (!input.file.type.startsWith('image/') && !input.file.type.startsWith('video/')) {
    throw new Error('اختر ملف صورة أو فيديو متحركاً صالحاً.');
  }
  const itemId = genId('store');
  const safeFileName = input.file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `${itemId}/${safeFileName}`;
  const storage = supabase.storage.from(STORE_ASSETS_BUCKET);
  let uploadedToStorage = false;
  let assetUrl: string;
  let assetPath = storagePath;
  let uploadError: Error | null = null;
  try {
    const upload = await storage.upload(storagePath, input.file, {
      contentType: input.file.type,
      upsert: false,
    });
    uploadError = upload.error;
  } catch (error) {
    uploadError = error instanceof Error ? error : new Error(String(error));
  }

  if (uploadError) {
    let createBucketError: Error | null = null;
    try {
      const createBucket = await supabase.storage.createBucket(STORE_ASSETS_BUCKET, {
        public: true,
      });
      createBucketError = createBucket.error;
    } catch (error) {
      createBucketError = error instanceof Error ? error : new Error(String(error));
    }

    try {
      const retry = await storage.upload(storagePath, input.file, {
        contentType: input.file.type,
        upsert: false,
      });
      uploadError = retry.error;
    } catch (error) {
      uploadError = error instanceof Error ? error : new Error(String(error));
    }
    if (uploadError) {
      console.warn('Cloud store asset upload failed; using a data URL fallback.', {
        uploadError,
        createBucketError,
      });
    }
  }

  if (!uploadError) {
    uploadedToStorage = true;
    const { data: publicUrl } = storage.getPublicUrl(storagePath);
    assetUrl = publicUrl.publicUrl;
  } else {
    assetUrl = await readFileAsDataUrl(input.file);
    assetPath = `${DATA_URL_ASSET_PREFIX}${storagePath}`;
  }

  const { data, error: insertError } = await supabase
    .from('sada_store_items')
    .insert({
      id: itemId,
      category: input.category,
      name: input.name.trim(),
      price_coins: input.priceCoins,
      asset_url: assetUrl,
      asset_path: assetPath,
    })
    .select('*')
    .single();
  if (insertError) {
    if (uploadedToStorage) {
      const { error: cleanupError } = await storage.remove([storagePath]);
      if (cleanupError) {
        console.error('Unable to remove uploaded store asset after item insert failed:', cleanupError);
      }
    }
    throw new Error(insertError.message);
  }

  return mapStoreItem(data as Record<string, unknown>);
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

  const assetPath = String(item.asset_path);
  if (!assetPath.startsWith(DATA_URL_ASSET_PREFIX)) {
    const { error: storageError } = await supabase.storage
      .from(STORE_ASSETS_BUCKET)
      .remove([assetPath]);
    if (storageError) throw new Error(`حُذف العنصر، لكن تعذّر حذف ملفه: ${storageError.message}`);
  }
}
