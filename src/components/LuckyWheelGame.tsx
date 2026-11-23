import React, { useEffect, useRef, useState } from 'react';
import { Coins, Plus, Sparkles, Trophy, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  addRoomLuckyWheelTestPlayer,
  cancelRoomLuckyWheelRound,
  createRoomLuckyWheelRound,
  eliminateRoomLuckyWheelPlayer,
  finishRoomLuckyWheelRound,
  getActiveRoomLuckyWheelRound,
  joinRoomLuckyWheelRound,
  parseRoomLuckyWheelRound,
  spinRoomLuckyWheelPlayer,
  startRoomLuckyWheelRound,
  type RoomLuckyWheelRound,
} from '../lib/sadaRoomLuckyWheelService';
import { refreshGameUserFromSupabase } from '../lib/sadaGamesService';
import { supabase } from '../lib/supabase';

interface RoomMember {
  userId: string;
  displayName: string;
  avatarUrl: string;
}

interface LuckyWheelGameProps {
  roomId: string;
  userCoins: number;
  members: RoomMember[];
  onPlaySpent: (amount: number) => void;
  onSendChat: (message: string) => Promise<void>;
  onClose: () => void;
}

const ENTRY_FEES = [100, 500, 1000, 5000];
const SPIN_DURATION_MS = 2500;

const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

function getSelectedSpinAngle(
  round: RoomLuckyWheelRound,
  currentRotation: number
): number | null {
  if (!round.spinningPlayerId) return null;
  const alivePlayers = round.players.filter(
    (player) => !round.eliminated.includes(player.userId)
  );
  const selectedIndex = alivePlayers.findIndex(
    (player) => player.userId === round.spinningPlayerId
  );
  if (selectedIndex < 0 || alivePlayers.length === 0) return null;
  const sectorAngle = 360 / alivePlayers.length;
  const sectorCenter = selectedIndex * sectorAngle + sectorAngle / 2;
  return (360 - ((sectorCenter + currentRotation) % 360)) % 360;
}

export const LuckyWheelGame: React.FC<LuckyWheelGameProps> = ({
  roomId,
  userCoins,
  members,
  onPlaySpent,
  onSendChat,
  onClose,
}) => {
  const { user, updateLocalUser } = useAuth();
  const [round, setRound] = useState<RoomLuckyWheelRound | null>(null);
  const [entryFee, setEntryFee] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [addingCompetitor, setAddingCompetitor] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const rotationRef = useRef(0);
  const creatorRunningRef = useRef(false);
  const remoteSpinPlayerRef = useRef<string | null>(null);
  const winnerRefreshRef = useRef<string | null>(null);
  const remoteSpinTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    let active = true;
    const loadRound = async () => {
      try {
        const activeRound = await getActiveRoomLuckyWheelRound(roomId);
        if (active) {
          setRound(activeRound);
          if (
            activeRound &&
            activeRound.creatorId !== user?.id &&
            activeRound.spinningPlayerId &&
            remoteSpinPlayerRef.current !== activeRound.spinningPlayerId
          ) {
            const spinAngle = getSelectedSpinAngle(activeRound, rotationRef.current);
            remoteSpinPlayerRef.current = activeRound.spinningPlayerId;
            if (spinAngle !== null) {
              setSpinning(true);
              rotationRef.current += 1800 + spinAngle;
              setRotation(rotationRef.current);
              remoteSpinTimeoutRef.current = window.setTimeout(() => {
                remoteSpinTimeoutRef.current = null;
                setSpinning(false);
                const eliminated = activeRound.players.find(
                  (player) => player.userId === activeRound.spinningPlayerId
                );
                if (eliminated) setNotice(`تم إقصاء ${eliminated.displayName}!`);
              }, SPIN_DURATION_MS);
            }
          }
        }
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : 'تعذّر تحميل الجولة.');
        }
      }
    };
    void loadRound();
    const channel = supabase
      .channel(`room-lucky-wheel:${roomId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sada_room_lucky_wheel_rounds',
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          if (!payload.new || Object.keys(payload.new).length === 0) return;
          try {
            const nextRound = parseRoomLuckyWheelRound(payload.new);
            setRound(nextRound);
            if (
              !creatorRunningRef.current &&
              nextRound.spinningPlayerId &&
              remoteSpinPlayerRef.current !== nextRound.spinningPlayerId
            ) {
              const spinAngle = getSelectedSpinAngle(nextRound, rotationRef.current);
              const eliminated = nextRound.players.find(
                (player) => player.userId === nextRound.spinningPlayerId
              );
              remoteSpinPlayerRef.current = nextRound.spinningPlayerId;
              if (eliminated && spinAngle !== null) {
                setSpinning(true);
                rotationRef.current += 1800 + spinAngle;
                setRotation(rotationRef.current);
                remoteSpinTimeoutRef.current = window.setTimeout(() => {
                  remoteSpinTimeoutRef.current = null;
                  setSpinning(false);
                  setNotice(`تم إقصاء ${eliminated.displayName}!`);
                }, SPIN_DURATION_MS);
              }
            } else if (!nextRound.spinningPlayerId) {
              remoteSpinPlayerRef.current = null;
            }
          } catch (parseError) {
            setError(parseError instanceof Error ? parseError.message : 'تعذّر تحديث الجولة.');
          }
        }
      )
      .subscribe();
    return () => {
      active = false;
      if (remoteSpinTimeoutRef.current !== null) {
        window.clearTimeout(remoteSpinTimeoutRef.current);
      }
      void supabase.removeChannel(channel);
    };
  }, [roomId, user?.id]);

  useEffect(() => {
    if (
      !round ||
      round.status !== 'finished' ||
      round.winnerId !== user?.id ||
      winnerRefreshRef.current === round.id ||
      !user
    ) {
      return;
    }
    winnerRefreshRef.current = round.id;
    void refreshGameUserFromSupabase(user.id)
      .then(updateLocalUser)
      .catch((refreshError: unknown) => {
        setError(
          refreshError instanceof Error
            ? `تم توزيع الجائزة لكن تعذّر تحديث رصيدك: ${refreshError.message}`
            : 'تم توزيع الجائزة لكن تعذّر تحديث رصيدك.'
        );
      });
  }, [round, updateLocalUser, user]);

  const isCreator = Boolean(round && user && round.creatorId === user.id);
  const alivePlayers = round
    ? round.players.filter((player) => !round.eliminated.includes(player.userId))
    : [];
  const hasJoined = Boolean(round?.players.some((player) => player.userId === user?.id));
  const practiceRound = Boolean(round?.players.some((player) => player.test));

  const handleCreateRound = async () => {
    if (!user || busy) return;
    setBusy(true);
    setError(null);
    try {
      const next = await createRoomLuckyWheelRound(roomId, user.id, entryFee);
      setRound(next);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'تعذّر إنشاء الجولة.');
    } finally {
      setBusy(false);
    }
  };

  const handleJoinRound = async () => {
    if (!user || !round || busy) return;
    setBusy(true);
    setError(null);
    try {
      const next = await joinRoomLuckyWheelRound(round.id, user.id);
      setRound(next);
      onPlaySpent(round.entryFee);
      try {
        updateLocalUser(await refreshGameUserFromSupabase(user.id));
      } catch (refreshError) {
        setError(
          refreshError instanceof Error
            ? `تم الانضمام لكن تعذّر تحديث رصيدك: ${refreshError.message}`
            : 'تم الانضمام لكن تعذّر تحديث رصيدك.'
        );
      }
    } catch (joinError) {
      setError(joinError instanceof Error ? joinError.message : 'تعذّر الانضمام إلى الجولة.');
    } finally {
      setBusy(false);
    }
  };

  const handleAddCompetitor = async (member: RoomMember) => {
    if (!user || !round || busy) return;
    setBusy(true);
    setError(null);
    try {
      const next = await addRoomLuckyWheelTestPlayer(round.id, user.id, member.userId);
      setRound(next);
    } catch (addError) {
      setError(addError instanceof Error ? addError.message : 'تعذّرت إضافة المنافس.');
    } finally {
      setBusy(false);
    }
  };

  const handleStartRound = async () => {
    if (!user || !round || busy || round.players.length < 2) return;
    setBusy(true);
    setError(null);
    creatorRunningRef.current = true;
    try {
      const currentRound =
        round.status === 'registering'
          ? await startRoomLuckyWheelRound(round.id, user.id)
          : await getActiveRoomLuckyWheelRound(roomId);
      if (!currentRound || currentRound.status !== 'spinning') {
        throw new Error('لا توجد جولة قيد السحب لمتابعتها.');
      }
      const started = currentRound;
      setRound(started);
      let alive = started.players.filter(
        (player) => !started.eliminated.includes(player.userId)
      );
      let currentSpinRound = started;
      while (alive.length > 1) {
        const spinningRound = currentSpinRound.spinningPlayerId
          ? currentSpinRound
          : await spinRoomLuckyWheelPlayer(started.id, user.id);
        const eliminatedIndex = alive.findIndex(
          (player) => player.userId === spinningRound.spinningPlayerId
        );
        if (eliminatedIndex < 0) throw new Error('تعذّر تحديد اللاعب المختار في الدور.');
        const eliminated = alive[eliminatedIndex];
        const winningSectorAngle = getSelectedSpinAngle(
          spinningRound,
          rotationRef.current
        );
        if (winningSectorAngle === null) throw new Error('تعذّر تحديد قطاع اللاعب المختار.');
        setRound(spinningRound);
        rotationRef.current += 1800 + winningSectorAngle;
        setRotation(rotationRef.current);
        setSpinning(true);
        await wait(SPIN_DURATION_MS);
        setSpinning(false);

        const next = await eliminateRoomLuckyWheelPlayer(
          started.id,
          user.id,
          eliminated.userId
        );
        setRound(next);
        currentSpinRound = next;
        setNotice(`تم إقصاء ${eliminated.displayName}!`);
        try {
          await onSendChat(`🎡 تم إقصاء ${eliminated.displayName} من دولاب الإقصاء!`);
        } catch (chatError) {
          setError(
            chatError instanceof Error
              ? `تم الإقصاء لكن تعذّر إرسال إشعار الشات: ${chatError.message}`
              : 'تم الإقصاء لكن تعذّر إرسال إشعار الشات.'
          );
        }
        alive = alive.filter((player) => player.userId !== eliminated.userId);
      }

      const result = await finishRoomLuckyWheelRound(started.id, user.id);
      setRound((current) =>
        current
          ? { ...current, status: 'finished', winnerId: result.winnerId }
          : current
      );
      setNotice(
        `🏆 تهانينا ${result.winnerName}! فاز بـ ${result.payout.toLocaleString('en-US')} كوينز.`
      );
      try {
        await onSendChat(
          `🏆 تهانينا ${result.winnerName}! فاز بدولاب الإقصاء وربح ${result.payout.toLocaleString('en-US')} كوينز بعد خصم عمولة المنصة 20%.`
        );
      } catch (chatError) {
        setError(
          chatError instanceof Error
            ? `تم توزيع الجائزة لكن تعذّر إرسال تهنئة الشات: ${chatError.message}`
            : 'تم توزيع الجائزة لكن تعذّر إرسال تهنئة الشات.'
        );
      }
      const finishedRound = await getActiveRoomLuckyWheelRound(roomId);
      if (finishedRound) setRound(finishedRound);
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : 'تعذّر إكمال السحب.');
    } finally {
      creatorRunningRef.current = false;
      setSpinning(false);
      setBusy(false);
    }
  };

  const handleCancelRound = async () => {
    if (!user || !round || busy) return;
    setBusy(true);
    setError(null);
    try {
      const cancelled = await cancelRoomLuckyWheelRound(round.id, user.id);
      setRound(cancelled);
      if (cancelled.players.some((player) => player.userId === user.id && !player.test)) {
        try {
          updateLocalUser(await refreshGameUserFromSupabase(user.id));
        } catch (refreshError) {
          setError(
            refreshError instanceof Error
              ? `تم إلغاء الجولة لكن تعذّر تحديث رصيدك: ${refreshError.message}`
              : 'تم إلغاء الجولة لكن تعذّر تحديث رصيدك.'
          );
        }
      }
      setNotice('تم إلغاء التسجيل واسترداد رسوم دخول المشاركين.');
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : 'تعذّر إلغاء الجولة.');
    } finally {
      setBusy(false);
    }
  };

  const wheelGradient = alivePlayers.length
    ? `conic-gradient(${alivePlayers
        .map((_, index) => {
          const angle = (index * 360) / alivePlayers.length;
          const nextAngle = ((index + 1) * 360) / alivePlayers.length;
          return `${index % 2 ? '#18213A' : '#9A7021'} ${angle}deg ${nextAngle}deg`;
        })
        .join(', ')})`
    : 'conic-gradient(#9A7021 0deg 180deg, #18213A 180deg 360deg)';

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-3 backdrop-blur-md"
      onClick={() => !spinning && !busy && onClose()}
    >
      <section
        className="royal-glass relative flex max-h-[92dvh] w-full max-w-lg flex-col gap-3 overflow-y-auto rounded-3xl border-2 border-[#F3D37A]/60 p-4 shadow-[0_24px_60px_rgba(0,0,0,0.85)]"
        onClick={(event) => event.stopPropagation()}
        dir="rtl"
      >
        <header className="flex items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-extrabold text-[#FCE9A6]">
              <Sparkles className="h-5 w-5" />
              دولاب الإقصاء الجماعي
            </h2>
            <p className="mt-1 flex items-center gap-1 text-xs text-slate-300">
              <Coins className="h-3.5 w-3.5 text-[#F3D37A]" />
              رصيدك {userCoins.toLocaleString('en-US')} كوينز
            </p>
          </div>
          <button
            type="button"
            disabled={spinning || busy}
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full text-slate-300 hover:bg-white/10 disabled:opacity-40"
            aria-label="إغلاق"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {error && (
          <p role="alert" className="rounded-xl border border-rose-400/40 bg-rose-950/50 p-2 text-xs text-rose-200">
            {error}
          </p>
        )}
        {notice && (
          <p className="rounded-xl border border-[#F3D37A]/40 bg-[#D4AF37]/10 p-2 text-center text-sm font-bold text-[#FCE9A6]">
            {notice}
          </p>
        )}

        {!round ? (
          <div className="space-y-3 rounded-2xl bg-black/25 p-3">
            <p className="text-sm font-bold text-white">أنشئ جولة واختر قيمة الدخول</p>
            <div className="grid grid-cols-4 gap-2">
              {ENTRY_FEES.map((fee) => (
                <button
                  key={fee}
                  type="button"
                  disabled={busy}
                  onClick={() => setEntryFee(fee)}
                  className={`rounded-xl border px-2 py-2 text-sm font-extrabold ${
                    entryFee === fee
                      ? 'border-[#FCE9A6] bg-[#D4AF37] text-[#070913]'
                      : 'border-white/15 bg-white/5 text-white'
                  }`}
                >
                  {fee.toLocaleString('en-US')}
                </button>
              ))}
            </div>
            <button
              type="button"
              disabled={busy || !user}
              onClick={() => void handleCreateRound()}
              className="gold-btn w-full rounded-xl py-2.5 text-sm font-extrabold disabled:opacity-50"
            >
              {busy ? 'جارٍ إنشاء الجولة...' : 'إنشاء جولة'}
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between rounded-xl bg-black/30 px-3 py-2 text-xs">
              <span className="text-slate-300">
                الدخول: <b className="text-[#FCE9A6]">{round.entryFee.toLocaleString('en-US')}</b>
              </span>
              <span className="text-slate-300">
                مجموع الجائزة: <b className="text-emerald-300">{round.prizePool.toLocaleString('en-US')}</b>
              </span>
            </div>

            <div className="relative mx-auto h-64 w-64 shrink-0 rounded-full border-[7px] border-[#D4AF37] p-1 shadow-[0_0_35px_rgba(212,175,55,0.35)]">
              <span className="absolute -top-3 left-1/2 z-20 -translate-x-1/2 border-x-[12px] border-t-[22px] border-x-transparent border-t-rose-500 drop-shadow-md" />
              <div
                className="relative h-full w-full overflow-hidden rounded-full border-2 border-[#FCE9A6]/70 transition-transform"
                style={{
                  background: wheelGradient,
                  transform: `rotate(${rotation}deg)`,
                  transitionDuration: spinning ? `${SPIN_DURATION_MS}ms` : '0ms',
                  transitionTimingFunction: 'cubic-bezier(0.12, 0.78, 0.22, 1)',
                }}
              >
                {alivePlayers.map((player, index) => {
                  const angle = (index * 360) / alivePlayers.length + 180 / alivePlayers.length - 90;
                  const radians = (angle * Math.PI) / 180;
                  const left = 50 + 36 * Math.cos(radians);
                  const top = 50 + 36 * Math.sin(radians);
                  return (
                    <div
                      key={player.userId}
                      className="absolute flex w-16 -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center"
                      style={{ left: `${left}%`, top: `${top}%` }}
                    >
                      <img
                        src={player.avatarUrl}
                        alt=""
                        className="h-9 w-9 rounded-full border-2 border-[#FCE9A6] bg-slate-800 object-cover"
                      />
                      <span className="mt-0.5 max-w-full truncate rounded bg-black/70 px-1 text-[9px] font-bold text-white">
                        {player.displayName}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="h-10 w-10 rounded-full border-2 border-[#FCE9A6] bg-[#070913] shadow-lg" />
              </div>
            </div>

            <div className="flex items-center justify-center gap-2 text-xs text-slate-300">
              <Trophy className="h-4 w-4 text-[#F3D37A]" />
              {alivePlayers.length} متنافس متبقٍ من {round.players.length}
            </div>

            {round.status === 'registering' && !hasJoined && (
              <button
                type="button"
                disabled={busy || practiceRound || userCoins < round.entryFee}
                onClick={() => void handleJoinRound()}
                className="gold-btn w-full rounded-xl py-2.5 text-sm font-extrabold disabled:opacity-50"
              >
                {busy
                  ? 'جارٍ الانضمام...'
                  : practiceRound
                  ? 'جولة تدريبية بدون رسوم'
                  : `انضمام للجولة (${round.entryFee.toLocaleString('en-US')} كوينز)`}
              </button>
            )}

            {isCreator && (round.status === 'registering' || round.status === 'spinning') && (
              <div className="space-y-2">
                {round.status === 'registering' && round.prizePool === 0 && (
                  <>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setAddingCompetitor((value) => !value)}
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#D4AF37]/40 bg-white/5 py-2 text-xs font-bold text-[#FCE9A6]"
                    >
                      <Plus className="h-4 w-4" />
                      إضافة منافس
                    </button>
                    {addingCompetitor && (
                      <div className="max-h-28 space-y-1 overflow-y-auto rounded-xl bg-black/30 p-2">
                        {members
                          .filter(
                            (member) =>
                              member.userId !== user?.id &&
                              !round.players.some((player) => player.userId === member.userId)
                          )
                          .map((member) => (
                            <button
                              key={member.userId}
                              type="button"
                              disabled={busy}
                              onClick={() => void handleAddCompetitor(member)}
                              className="flex w-full items-center gap-2 rounded-lg p-1.5 text-right text-xs text-white hover:bg-white/10"
                            >
                              <img src={member.avatarUrl} alt="" className="h-7 w-7 rounded-full object-cover" />
                              <span>{member.displayName}</span>
                            </button>
                          ))}
                      </div>
                    )}
                    <button
                      type="button"
                      disabled={busy || round.players.length < 2}
                      onClick={() => void handleStartRound()}
                      className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-700 py-2.5 text-sm font-extrabold text-white disabled:opacity-45"
                    >
                      {busy ? 'جارٍ بدء السحب...' : 'ابدأ السحب'}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handleCancelRound()}
                      className="w-full rounded-xl border border-rose-400/40 bg-rose-950/30 py-2 text-xs font-bold text-rose-200 disabled:opacity-45"
                    >
                      إلغاء الجولة واسترداد الرسوم
                    </button>
                  </>
                )}
                {round.status === 'spinning' && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleStartRound()}
                    className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-700 py-2.5 text-sm font-extrabold text-white disabled:opacity-45"
                  >
                    {busy ? 'جارٍ استكمال السحب...' : 'متابعة السحب'}
                  </button>
                )}
              </div>
            )}

            {round.status === 'spinning' && (
              <p className="text-center text-sm font-extrabold text-[#FCE9A6]">
                {spinning ? 'يدور الدولاب... ' : 'تتم الإقصاءات تلقائياً حتى يبقى فائز واحد'}
              </p>
            )}
            {round.status === 'finished' && round.winnerId && (
              <p className="text-center text-sm font-extrabold text-emerald-300">
                انتهت الجولة — الفائز: {round.players.find((player) => player.userId === round.winnerId)?.displayName}
              </p>
            )}
          </>
        )}
      </section>
    </div>
  );
};
