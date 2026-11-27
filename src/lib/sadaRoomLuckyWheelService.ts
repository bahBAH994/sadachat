import { supabase } from './supabase';

export interface RoomLuckyWheelPlayer {
  userId: string;
  displayName: string;
  avatarUrl: string;
  test: boolean;
}

export interface RoomLuckyWheelRound {
  id: string;
  roomId: string;
  creatorId: string;
  entryFee: number;
  prizePool: number;
  players: RoomLuckyWheelPlayer[];
  eliminated: string[];
  spinningPlayerId: string | null;
  lastEliminatedId: string | null;
  status: 'registering' | 'spinning' | 'finished';
  winnerId: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseRoomLuckyWheelRound(value: unknown): RoomLuckyWheelRound {
  if (!isRecord(value) || !Array.isArray(value.players) || !Array.isArray(value.eliminated)) {
    throw new Error('بيانات جولة دولاب الإقصاء غير صالحة.');
  }
  const players = value.players.map((player): RoomLuckyWheelPlayer => {
    if (
      !isRecord(player) ||
      typeof player.userId !== 'string' ||
      typeof player.displayName !== 'string' ||
      typeof player.avatarUrl !== 'string'
    ) {
      throw new Error('بيانات أحد لاعبي الجولة غير صالحة.');
    }
    return {
      userId: player.userId,
      displayName: player.displayName,
      avatarUrl: player.avatarUrl,
      test: player.test === true,
    };
  });
  if (
    typeof value.id !== 'string' ||
    typeof value.room_id !== 'string' ||
    typeof value.creator_id !== 'string' ||
    typeof value.entry_fee !== 'number' ||
    typeof value.prize_pool !== 'number' ||
    !value.eliminated.every((id) => typeof id === 'string') ||
    (value.status !== 'registering' && value.status !== 'spinning' && value.status !== 'finished')
  ) {
    throw new Error('بيانات جولة دولاب الإقصاء غير مكتملة.');
  }
  return {
    id: value.id,
    roomId: value.room_id,
    creatorId: value.creator_id,
    entryFee: value.entry_fee,
    prizePool: value.prize_pool,
    players,
    eliminated: value.eliminated.map((id) => String(id)),
    spinningPlayerId:
      typeof value.spinning_player_id === 'string' ? value.spinning_player_id : null,
    lastEliminatedId:
      typeof value.last_eliminated_id === 'string' ? value.last_eliminated_id : null,
    status: value.status,
    winnerId: typeof value.winner_id === 'string' ? value.winner_id : null,
  };
}

export async function getActiveRoomLuckyWheelRound(
  roomId: string
): Promise<RoomLuckyWheelRound | null> {
  const { data, error } = await supabase
    .from('sada_room_lucky_wheel_rounds')
    .select('*')
    .eq('room_id', roomId)
    .neq('status', 'finished')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`تعذّر تحميل جولة دولاب الحظ: ${error.message}`);
  return data ? parseRoomLuckyWheelRound(data) : null;
}

async function reloadRound(roundId: string): Promise<RoomLuckyWheelRound> {
  const { data, error } = await supabase
    .from('sada_room_lucky_wheel_rounds')
    .select('*')
    .eq('id', roundId)
    .single();
  if (error || !data) {
    throw new Error(error?.message || 'تعذّر تحديث بيانات الجولة.');
  }
  return parseRoomLuckyWheelRound(data);
}

async function callRoundRpc(
  name: string,
  args: Record<string, string | number>
): Promise<unknown> {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error(error.message || 'تعذّر تحديث جولة دولاب الحظ.');
  return data;
}

export async function createRoomLuckyWheelRound(
  roomId: string,
  creatorId: string,
  entryFee: number
): Promise<RoomLuckyWheelRound> {
  if (![200, 500, 1000].includes(entryFee)) {
    throw new Error('رسوم الدخول المتاحة هي 200 أو 500 أو 1,000 كوينز.');
  }
  const data = await callRoundRpc('sada_create_room_lucky_wheel', {
    p_room_id: roomId,
    p_creator_id: creatorId,
    p_entry_fee: entryFee,
  });
  return parseRoomLuckyWheelRound(data);
}

export async function joinRoomLuckyWheelRound(
  roundId: string,
  userId: string
): Promise<RoomLuckyWheelRound> {
  await callRoundRpc('sada_join_room_lucky_wheel', {
    p_round_id: roundId,
    p_user_id: userId,
  });
  return reloadRound(roundId);
}

export async function addRoomLuckyWheelTestPlayer(
  roundId: string,
  creatorId: string,
  userId: string
): Promise<RoomLuckyWheelRound> {
  await callRoundRpc('sada_add_room_lucky_wheel_test_player', {
    p_round_id: roundId,
    p_creator_id: creatorId,
    p_user_id: userId,
  });
  return reloadRound(roundId);
}

export async function startRoomLuckyWheelRound(
  roundId: string,
  creatorId: string
): Promise<RoomLuckyWheelRound> {
  await callRoundRpc('sada_start_room_lucky_wheel', {
    p_round_id: roundId,
    p_creator_id: creatorId,
  });
  return reloadRound(roundId);
}

export async function cancelRoomLuckyWheelRound(
  roundId: string,
  creatorId: string
): Promise<RoomLuckyWheelRound> {
  await callRoundRpc('sada_cancel_room_lucky_wheel', {
    p_round_id: roundId,
    p_creator_id: creatorId,
  });
  return reloadRound(roundId);
}

export async function eliminateRoomLuckyWheelPlayer(
  roundId: string,
  creatorId: string,
  userId: string
): Promise<RoomLuckyWheelRound> {
  await callRoundRpc('sada_eliminate_room_lucky_wheel_player', {
    p_round_id: roundId,
    p_creator_id: creatorId,
    p_user_id: userId,
  });
  return reloadRound(roundId);
}

export async function spinRoomLuckyWheelPlayer(
  roundId: string,
  creatorId: string
): Promise<RoomLuckyWheelRound> {
  await callRoundRpc('sada_spin_room_lucky_wheel_player', {
    p_round_id: roundId,
    p_creator_id: creatorId,
  });
  return reloadRound(roundId);
}

export async function finishRoomLuckyWheelRound(
  roundId: string,
  creatorId: string
): Promise<{ winnerId: string; winnerName: string; payout: number }> {
  const data = await callRoundRpc('sada_finish_room_lucky_wheel', {
    p_round_id: roundId,
    p_creator_id: creatorId,
  });
  if (
    !isRecord(data) ||
    typeof data.winner_id !== 'string' ||
    typeof data.winner_name !== 'string' ||
    typeof data.payout !== 'number'
  ) {
    throw new Error('استجابة تسوية دولاب الحظ غير صالحة.');
  }
  return {
    winnerId: data.winner_id,
    winnerName: data.winner_name,
    payout: data.payout,
  };
}
