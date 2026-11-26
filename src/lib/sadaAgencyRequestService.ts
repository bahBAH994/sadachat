import type { Agency, AgencyRequest, User } from '../types';
import { genId } from './sadaCatalog';
import { rowToUser, USER_COLUMNS } from './sadaMappers';
import { getEconomySettingsFromSupabase } from './sadaEconomyService';
import { createRoomInSupabase } from './sadaRoomsService';
import { supabase } from './supabase';

export const AGENCY_REQUEST_COLUMNS =
  'id, user_id, agency_name, description, whatsapp_or_contact, status, created_at';

function rowToAgencyRequest(row: Record<string, unknown>): AgencyRequest {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    agencyName: String(row.agency_name),
    description: String(row.description || ''),
    whatsappOrContact: String(row.whatsapp_or_contact),
    status: row.status as AgencyRequest['status'],
    createdAt: String(row.created_at),
  };
}

export async function getAgencyRequestStatusInSupabase(
  user: User
): Promise<'pending' | 'approved' | 'suspended' | null> {
  const { data: userRow, error: userError } = await supabase
    .from('sada_users')
    .select('agency_id')
    .eq('id', user.id)
    .maybeSingle();
  if (userError) {
    throw new Error(`تعذّر التحقق من حالة وكالة المستخدم: ${userError.message}`);
  }

  const { data: agencyRows, error: agenciesError } = await supabase
    .from('sada_agencies')
    .select('id, owner_id, host_ids, status');
  if (agenciesError) {
    throw new Error(`تعذّر التحقق من الوكالات: ${agenciesError.message}`);
  }
  const userAgencies = (agencyRows || []).filter(
    (agency) =>
      String(agency.id) === String(userRow?.agency_id || '') ||
      String(agency.owner_id) === user.id ||
      (Array.isArray(agency.host_ids) &&
        agency.host_ids.some((hostId) => String(hostId) === user.id))
  );
  if (userAgencies.some((agency) => agency.status === 'approved')) {
    return 'approved';
  }
  if (userAgencies.some((agency) => agency.status === 'suspended')) {
    return 'suspended';
  }

  const { data: pendingRequest, error: requestError } = await supabase
    .from('sada_agency_requests')
    .select('id')
    .eq('user_id', user.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (requestError) {
    throw new Error(`تعذّر التحقق من طلب الوكالة: ${requestError.message}`);
  }
  return pendingRequest ? 'pending' : null;
}

export async function getPendingAgencyRequestInSupabase(
  userId: string
): Promise<AgencyRequest | null> {
  const { data, error } = await supabase
    .from('sada_agency_requests')
    .select(AGENCY_REQUEST_COLUMNS)
    .eq('user_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    throw new Error(`تعذّر تحميل طلب الوكالة قيد المراجعة: ${error.message}`);
  }
  return data ? rowToAgencyRequest(data) : null;
}

export async function cancelPendingAgencyRequestInSupabase(
  userId: string
): Promise<void> {
  const { data, error } = await supabase
    .from('sada_agency_requests')
    .delete()
    .not('id', 'is', null)
    .eq('user_id', userId)
    .eq('status', 'pending')
    .select('id');
  if (error) {
    throw new Error(`تعذّر إلغاء طلب الوكالة: ${error.message}`);
  }
  if (!data?.length) throw new Error('لا يوجد طلب قيد المراجعة لإلغائه.');
}

export async function submitAgencyRequestInSupabase(
  user: User,
  payload: { agencyName: string; description: string; whatsappOrContact: string }
): Promise<AgencyRequest> {
  const agencyName = payload.agencyName.trim();
  const description = payload.description.trim();
  const whatsappOrContact = payload.whatsappOrContact.trim();
  if (agencyName.length < 3) throw new Error('اسم الوكالة يجب أن يتكون من 3 أحرف على الأقل.');
  if (!description) throw new Error('يرجى كتابة نبذة عن الوكالة.');
  if (!whatsappOrContact) throw new Error('يرجى إدخال وسيلة للتواصل.');

  const currentStatus = await getAgencyRequestStatusInSupabase(user);
  if (currentStatus === 'pending') {
    throw new Error('لديك طلب وكالة قيد المراجعة بالفعل.');
  }
  if (currentStatus === 'approved') {
    throw new Error('لديك وكالة معتمدة بالفعل.');
  }
  if (currentStatus === 'suspended') {
    throw new Error('وكالتك معلّقة حالياً. تواصل مع الإدارة العليا لمراجعة حالتها.');
  }

  const request = {
    id: genId('agencyreq'),
    user_id: user.id,
    agency_name: agencyName.slice(0, 48),
    description: description.slice(0, 500),
    whatsapp_or_contact: whatsappOrContact.slice(0, 120),
    status: 'pending',
    created_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from('sada_agency_requests')
    .insert(request)
    .select(AGENCY_REQUEST_COLUMNS)
    .single();
  if (error) {
    throw new Error(`تعذّر إرسال طلب إنشاء الوكالة: ${error.message}`);
  }
  return rowToAgencyRequest(data);
}

export async function getAgencyRequestsInSupabase(): Promise<AgencyRequest[]> {
  const { data, error } = await supabase
    .from('sada_agency_requests')
    .select(AGENCY_REQUEST_COLUMNS)
    .order('created_at', { ascending: false });
  if (error) {
    throw new Error(`تعذّر تحميل طلبات الوكالات: ${error.message}`);
  }
  return (data || []).map(rowToAgencyRequest);
}

export async function reviewAgencyRequestInSupabase(
  requestId: string,
  decision: 'approved' | 'rejected'
): Promise<void> {
  const { data: requestRow, error: requestError } = await supabase
    .from('sada_agency_requests')
    .select(AGENCY_REQUEST_COLUMNS)
    .eq('id', requestId)
    .eq('status', 'pending')
    .maybeSingle();
  if (requestError) {
    throw new Error(`تعذّر تحميل طلب الوكالة: ${requestError.message}`);
  }
  if (!requestRow) throw new Error('الطلب غير موجود أو تمت مراجعته مسبقاً.');

  if (decision === 'rejected') {
    const { data: rejectedRequest, error } = await supabase
      .from('sada_agency_requests')
      .update({ status: 'rejected' })
      .eq('id', requestId)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle();
    if (error) throw new Error(`تعذّر رفض طلب الوكالة: ${error.message}`);
    if (!rejectedRequest) throw new Error('تمت مراجعة الطلب مسبقاً.');
    return;
  }

  const { data: ownerRow, error: ownerError } = await supabase
    .from('sada_users')
    .select(USER_COLUMNS)
    .eq('id', String(requestRow.user_id))
    .maybeSingle();
  if (ownerError) throw new Error(`تعذّر تحميل حساب صاحب الطلب: ${ownerError.message}`);
  if (!ownerRow) throw new Error('تعذّر العثور على حساب صاحب الطلب.');
  const owner = rowToUser(ownerRow);
  const { data: existingAgencies, error: agenciesError } = await supabase
    .from('sada_agencies')
    .select('code');
  if (agenciesError) {
    throw new Error(`تعذّر التحقق من أكواد الوكالات: ${agenciesError.message}`);
  }
  const existingCodes = new Set((existingAgencies || []).map((agency) => String(agency.code)));
  let code = '';
  do {
    code = `SADA-${Math.floor(1000 + Math.random() * 9000)}`;
  } while (existingCodes.has(code));

  const economySettings = await getEconomySettingsFromSupabase();
  const now = new Date().toISOString();
  const agency: Agency = {
    id: genId('agency'),
    name: String(requestRow.agency_name),
    description: String(requestRow.description || ''),
    code,
    ownerId: owner.id,
    ownerName: owner.displayName,
    ownerAvatar: owner.avatarUrl,
    commissionRate: economySettings.agencyCommissionPct / 100,
    totalCommissionDiamonds: 0,
    totalHostDiamonds: 0,
    hostIds: [],
    status: 'approved',
    createdAt: now,
  };
  const { error: insertAgencyError } = await supabase.from('sada_agencies').insert({
    id: agency.id,
    name: agency.name,
    description: agency.description,
    code: agency.code,
    owner_id: agency.ownerId,
    owner_name: agency.ownerName,
    owner_avatar: agency.ownerAvatar,
    commission_rate: agency.commissionRate,
    total_commission_diamonds: 0,
    total_host_diamonds: 0,
    host_ids: [],
    status: 'approved',
    created_at: now,
  });
  if (insertAgencyError) {
    throw new Error(`تعذّر إنشاء الوكالة المعتمدة: ${insertAgencyError.message}`);
  }

  const approvedOwner: User = {
    ...owner,
    isAgent: true,
    isHost: true,
    agencyId: agency.id,
    hostBadge: 'وكيل معتمد ✦',
    hostAgencyName: agency.name,
  };
  let roomId: string | null = null;
  try {
    const { error: ownerUpdateError } = await supabase
      .from('sada_users')
      .update({
        is_agent: true,
        is_host: true,
        agency_id: agency.id,
        host_badge: approvedOwner.hostBadge,
        host_agency_name: agency.name,
      })
      .eq('id', owner.id);
    if (ownerUpdateError) {
      throw new Error(`تعذّر ربط الوكالة بصاحبها: ${ownerUpdateError.message}`);
    }

    const room = await createRoomInSupabase(approvedOwner, {
      title: `وكالة ${agency.name}`,
      description: agency.description,
      maxSeats: 12,
      isAgency: true,
      agencyId: agency.id,
    });
    roomId = room.id;

    const { data: approvedRequest, error: approveError } = await supabase
      .from('sada_agency_requests')
      .update({ status: 'approved' })
      .eq('id', requestId)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle();
    if (approveError) {
      throw new Error(`تعذّر اعتماد الطلب: ${approveError.message}`);
    }
    if (!approvedRequest) throw new Error('تمت مراجعة الطلب مسبقاً.');
  } catch (error) {
    const [roomCleanup, userRestore, agencyCleanup] = await Promise.all([
      roomId
        ? supabase.from('sada_rooms').delete().not('id', 'is', null).eq('id', roomId)
        : Promise.resolve({ error: null }),
      supabase
        .from('sada_users')
        .update({
          is_agent: Boolean(owner.isAgent),
          is_host: Boolean(owner.isHost),
          agency_id: owner.agencyId || null,
          host_badge: owner.hostBadge || null,
          host_agency_name: owner.hostAgencyName || null,
        })
        .eq('id', owner.id),
      supabase.from('sada_agencies').delete().not('id', 'is', null).eq('id', agency.id),
    ]);
    const rollbackError = roomCleanup.error || userRestore.error || agencyCleanup.error;
    if (rollbackError) {
      throw new Error(
        `تعذّر اعتماد الوكالة (${error instanceof Error ? error.message : 'خطأ غير معروف'}) أو التراجع عن التغييرات (${rollbackError.message}).`
      );
    }
    throw error;
  }
}
