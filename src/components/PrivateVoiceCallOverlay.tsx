import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { AvatarWithFrame } from './AvatarWithFrame';
import { makeConversationId } from '../lib/sadaCatalog';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import type { PrivateConversationPeer } from '../types';

type PrivateCallStatus = 'ringing' | 'accepted' | 'rejected' | 'ended';
interface PrivateCall {
  id: string;
  conversation_id: string;
  caller_id: string;
  receiver_id: string;
  status: PrivateCallStatus;
  created_at: string;
  accepted_at: string | null;
  ended_at: string | null;
}

interface CallParticipant {
  id: string;
  displayName: string;
  avatarUrl: string;
  frameId: string;
}

interface StartCallEvent extends CustomEvent<{ peer: PrivateConversationPeer }> {}

interface CallSignal {
  from: string;
  type: 'ready' | 'offer' | 'answer' | 'candidate';
  description?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
}

const CALL_TIMEOUT_MS = 45_000;

function participantFromUserRow(row: Record<string, unknown>): CallParticipant {
  return {
    id: String(row.id),
    displayName: String(row.display_name || 'عضو صَدَى'),
    avatarUrl: String(row.avatar_url || 'host_male'),
    frameId: String(row.frame_id || 'frame_obsidian'),
  };
}

export const PrivateVoiceCallOverlay: React.FC = () => {
  const { user } = useAuth();
  const [call, setCall] = useState<PrivateCall | null>(null);
  const [peer, setPeer] = useState<CallParticipant | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [speakerEnabled, setSpeakerEnabled] = useState(true);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [error, setError] = useState('');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const startingCallRef = useRef(false);
  const callRef = useRef(call);
  const speakerEnabledRef = useRef(speakerEnabled);
  callRef.current = call;
  speakerEnabledRef.current = speakerEnabled;

  const setParticipantFromConversation = useCallback((value: PrivateConversationPeer) => {
    setPeer({
      id: value.id,
      displayName: value.displayName,
      avatarUrl: value.avatarUrl,
      frameId: value.frameId,
    });
  }, []);

  const updateCall = useCallback(async (callId: string, status: PrivateCallStatus) => {
    const update: Record<string, string> = { status };
    if (status === 'accepted') update.accepted_at = new Date().toISOString();
    if (status === 'ended' || status === 'rejected') update.ended_at = new Date().toISOString();
    const { data, error: updateError } = await supabase
      .from('sada_private_calls')
      .update(update)
      .eq('id', callId)
      .in(
        'status',
        status === 'accepted' || status === 'rejected' ? ['ringing'] : ['ringing', 'accepted']
      )
      .select('id')
      .maybeSingle();
    if (updateError) throw new Error(updateError.message);
    if (!data) throw new Error('لم تعد هذه المكالمة متاحة.');
  }, []);

  useEffect(() => {
    if (!user?.id) {
      setCall(null);
      setPeer(null);
      return;
    }

    let active = true;
    const hydrateParticipant = async (callRow: PrivateCall) => {
      const peerId = callRow.caller_id === user.id ? callRow.receiver_id : callRow.caller_id;
      const { data, error: profileError } = await supabase
        .from('sada_users')
        .select('id, display_name, avatar_url, frame_id')
        .eq('id', peerId)
        .maybeSingle();
      if (profileError) {
        console.error('Unable to load private call participant:', profileError.message);
        setError(`تعذّر تحميل بيانات الطرف الآخر: ${profileError.message}`);
      }
      if (active) {
        setPeer(
          data
            ? participantFromUserRow(data)
            : {
                id: peerId,
                displayName: 'عضو صَدَى',
                avatarUrl: 'host_male',
                frameId: 'frame_obsidian',
              }
        );
      }
    };
    const applyRow = (raw: Record<string, unknown>) => {
      if (
        String(raw.caller_id) !== user.id &&
        String(raw.receiver_id) !== user.id
      ) return;
      const next = raw as unknown as PrivateCall;
      setCall(next);
      void hydrateParticipant(next);
      if (next.status === 'ended' || next.status === 'rejected') {
        setTimeout(() => {
          setCall((current) => current?.id === next.id ? null : current);
          setPeer((current) => current?.id === (next.caller_id === user.id ? next.receiver_id : next.caller_id) ? null : current);
        }, 2200);
      }
    };

    void supabase
      .from('sada_private_calls')
      .select('id, conversation_id, caller_id, receiver_id, status, created_at, accepted_at, ended_at')
      .or(`caller_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .in('status', ['ringing', 'accepted'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data, error: queryError }) => {
        if (queryError) {
          console.error('Unable to load active private calls:', queryError.message);
          return;
        }
        if (!active || !data) return;
        if (
          data.status === 'ringing' &&
          Date.now() - Date.parse(data.created_at) >= CALL_TIMEOUT_MS
        ) {
          void updateCall(data.id, 'ended').catch((updateError: unknown) => {
            console.error('Unable to close an expired private call:', updateError);
          });
          return;
        }
        applyRow(data);
      });

    const channel = supabase
      .channel(`sada-private-calls-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sada_private_calls' },
        (payload) => {
          const row = (payload.new || payload.old) as Record<string, unknown> | undefined;
          if (row) applyRow(row);
        }
      )
      .subscribe();

    const beginCall = async (event: Event) => {
      const detail = (event as StartCallEvent).detail;
      if (!detail?.peer || detail.peer.id === user.id) return;
      if (callRef.current || startingCallRef.current) {
        setError('لديك مكالمة نشطة بالفعل.');
        return;
      }
      startingCallRef.current = true;
      setError('');
      try {
        const id =
          typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : `call-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const createdAt = new Date().toISOString();
        const conversationId = makeConversationId(user.id, detail.peer.id);
        const { data, error: insertError } = await supabase
          .from('sada_private_calls')
          .insert({
            id,
            conversation_id: conversationId,
            caller_id: user.id,
            receiver_id: detail.peer.id,
            status: 'ringing',
            created_at: createdAt,
          })
          .select('id, conversation_id, caller_id, receiver_id, status, created_at, accepted_at, ended_at')
          .single();
        if (insertError) {
          setError(`تعذّر بدء المكالمة: ${insertError.message}`);
          return;
        }
        setParticipantFromConversation(detail.peer);
        setCall(data as PrivateCall);
      } catch (insertError) {
        setError(
          insertError instanceof Error
            ? `تعذّر بدء المكالمة: ${insertError.message}`
            : 'تعذّر بدء المكالمة.'
        );
      } finally {
        startingCallRef.current = false;
      }
    };

    window.addEventListener('sada:start-private-call', beginCall);
    return () => {
      active = false;
      window.removeEventListener('sada:start-private-call', beginCall);
      void supabase.removeChannel(channel);
    };
  }, [setParticipantFromConversation, updateCall, user?.id]);

  useEffect(() => {
    if (!call || call.status !== 'ringing') return;
    let context: AudioContext | null = null;
    let oscillator: OscillatorNode | null = null;
    let gain: GainNode | null = null;
    let timer: number | null = null;
    try {
      context = new AudioContext();
      oscillator = context.createOscillator();
      gain = context.createGain();
      oscillator.frequency.value = 520;
      gain.gain.value = 0;
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      let pulse = false;
      timer = window.setInterval(() => {
        pulse = !pulse;
        if (gain) gain.gain.setTargetAtTime(pulse ? 0.035 : 0, context!.currentTime, 0.08);
      }, 700);
      void context.resume().catch((audioError: unknown) => {
        console.warn('Private call ringtone could not start:', audioError);
      });
    } catch (audioError) {
      console.warn('Private call ringtone is unavailable:', audioError);
    }
    return () => {
      if (timer !== null) window.clearInterval(timer);
      oscillator?.stop();
      void context?.close().catch((audioError: unknown) => {
        console.warn('Unable to close ringtone audio context:', audioError);
      });
    };
  }, [call?.id, call?.status]);

  useEffect(() => {
    if (!call || call.status !== 'ringing') return;
    const timeout = window.setTimeout(() => {
      void updateCall(call.id, 'ended').catch((updateError: unknown) => {
        setError(updateError instanceof Error ? updateError.message : 'تعذّر إنهاء المكالمة.');
      });
    }, CALL_TIMEOUT_MS);
    return () => window.clearTimeout(timeout);
  }, [call?.id, call?.status, updateCall]);

  useEffect(() => {
    if (!call || call.status !== 'accepted') return;
    let disposed = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let connection: RTCPeerConnection | null = null;
    let offerCreated = false;
    const pendingCandidates: RTCIceCandidateInit[] = [];

    const sendSignal = async (signal: Omit<CallSignal, 'from'>) => {
      if (!channel || !user?.id) return;
      const result = await channel.send({
        type: 'broadcast',
        event: 'signal',
        payload: { ...signal, from: user.id },
      });
      if (result !== 'ok') setError('تعذّر إرسال بيانات اتصال الصوت.');
    };

    const connect = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('هذا الجهاز لا يدعم الوصول إلى المايكروفون.');
        void updateCall(call.id, 'ended').catch((updateError: unknown) => {
          console.error('Unable to end a call without microphone access:', updateError);
        });
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (disposed) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        localStreamRef.current = stream;
        connection = new RTCPeerConnection({
          iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
        });
        stream.getTracks().forEach((track) => connection?.addTrack(track, stream));
        connection.ontrack = (event) => {
          if (audioRef.current) {
            audioRef.current.srcObject = event.streams[0];
            audioRef.current.muted = !speakerEnabledRef.current;
            void audioRef.current.play().catch((playError: unknown) => {
              console.warn('Remote call audio requires user interaction:', playError);
            });
          }
        };
        connection.onicecandidate = (event) => {
          if (event.candidate) {
            void sendSignal({ type: 'candidate', candidate: event.candidate.toJSON() });
          }
        };
        connection.onconnectionstatechange = () => {
          if (connection?.connectionState === 'failed') {
            setError('انقطع اتصال الصوت. يمكنك إنهاء المكالمة والمحاولة مجدداً.');
          }
        };

        channel = supabase
          .channel(`private_call_${call.id}`)
          .on('broadcast', { event: 'signal' }, async ({ payload }) => {
            const signal = payload as CallSignal;
            if (!connection || signal.from === user?.id) return;
            try {
              if (signal.type === 'offer' && signal.description) {
                await connection.setRemoteDescription(signal.description);
                for (const candidate of pendingCandidates.splice(0)) {
                  await connection.addIceCandidate(candidate);
                }
                const answer = await connection.createAnswer();
                await connection.setLocalDescription(answer);
                await sendSignal({ type: 'answer', description: answer });
              } else if (signal.type === 'answer' && signal.description) {
                await connection.setRemoteDescription(signal.description);
                for (const candidate of pendingCandidates.splice(0)) {
                  await connection.addIceCandidate(candidate);
                }
              } else if (signal.type === 'candidate' && signal.candidate) {
                if (connection.remoteDescription) {
                  await connection.addIceCandidate(signal.candidate);
                } else {
                  pendingCandidates.push(signal.candidate);
                }
              } else if (signal.type === 'ready' && call.caller_id === user?.id && !offerCreated) {
                offerCreated = true;
                const offer = await connection.createOffer();
                await connection.setLocalDescription(offer);
                await sendSignal({ type: 'offer', description: offer });
              }
            } catch (signalError) {
              setError(signalError instanceof Error ? signalError.message : 'تعذّر إنشاء اتصال الصوت.');
            }
          })
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') void sendSignal({ type: 'ready' });
          });
      } catch (mediaError) {
        setError(
          mediaError instanceof Error
            ? `تعذّر تشغيل المايكروفون: ${mediaError.message}`
            : 'تعذّر تشغيل المايكروفون.'
        );
        void updateCall(call.id, 'ended').catch((updateError: unknown) => {
          console.error('Unable to end a call after microphone setup failed:', updateError);
        });
      }
    };

    void connect();
    return () => {
      disposed = true;
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
      connection?.close();
      if (channel) void supabase.removeChannel(channel);
      if (audioRef.current) audioRef.current.srcObject = null;
    };
  }, [call?.id, call?.status, call?.caller_id, updateCall, user?.id]);

  useEffect(() => {
    if (!call || call.status !== 'accepted' || !call.accepted_at) return;
    const tick = () => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - Date.parse(call.accepted_at!)) / 1000)));
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [call?.id, call?.status, call?.accepted_at]);

  const handleAnswer = async () => {
    if (!call) return;
    setError('');
    try {
      await updateCall(call.id, 'accepted');
      setCall((current) =>
        current?.id === call.id
          ? {
              ...current,
              status: 'accepted',
              accepted_at: new Date().toISOString(),
            }
          : current
      );
    } catch (answerError) {
      setError(answerError instanceof Error ? answerError.message : 'تعذّر الرد على المكالمة.');
    }
  };

  const handleEnd = async (status: 'ended' | 'rejected') => {
    if (!call) return;
    setError('');
    try {
      await updateCall(call.id, status);
      setCall((current) =>
        current?.id === call.id
          ? { ...current, status, ended_at: new Date().toISOString() }
          : current
      );
    } catch (endError) {
      setError(endError instanceof Error ? endError.message : 'تعذّر إنهاء المكالمة.');
    }
  };

  if (!call || !peer || !user) return null;
  const isCaller = call.caller_id === user.id;
  const isIncoming = !isCaller && call.status === 'ringing';
  const formatDuration = (seconds: number) =>
    `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-[#08090D]/95 p-5 text-white backdrop-blur-xl">
      <audio ref={audioRef} autoPlay playsInline />
      <section
        role="dialog"
        aria-modal="true"
        aria-label="مكالمة صوتية خاصة"
        className="relative flex w-full max-w-md flex-col items-center rounded-[2rem] border border-[#D4AF37]/30 bg-gradient-to-b from-[#181711] via-[#111116] to-[#090A0F] px-7 py-10 text-center shadow-[0_0_80px_rgba(212,175,55,0.12)]"
      >
        <div className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-[#F3D37A] to-transparent" />
        <div className="mb-7 rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/10 p-2.5">
          <AvatarWithFrame src={peer.avatarUrl} alt={peer.displayName} frameId={peer.frameId} size="xl" />
        </div>
        <h2 className="text-xl font-black text-[#FFF4CB]">{peer.displayName}</h2>
        {call.status === 'ringing' && (
          <p className="mt-2 text-sm font-bold text-amber-100/70">
            {isIncoming ? 'مكالمة صوتية واردة' : `جاري الاتصال بـ ${peer.displayName}...`}
          </p>
        )}
        {call.status === 'accepted' && (
          <>
            <p className="mt-2 text-xs font-bold tracking-widest text-emerald-300">مكالمة نشطة</p>
            <p className="mt-1 font-mono text-2xl font-extrabold tabular-nums text-[#F3D37A]">
              {formatDuration(elapsedSeconds)}
            </p>
          </>
        )}
        {(call.status === 'ended' || call.status === 'rejected') && (
          <p className="mt-2 text-sm font-bold text-amber-100/70">
            {call.status === 'rejected' ? 'تم رفض المكالمة' : 'انتهت المكالمة'}
          </p>
        )}
        {error && <p role="alert" className="mt-4 text-xs font-bold text-rose-300">{error}</p>}

        {call.status === 'ringing' && isIncoming && (
          <div className="mt-9 flex w-full items-center justify-center gap-8">
            <button
              type="button"
              onClick={() => void handleEnd('rejected')}
              className="flex min-h-20 min-w-24 flex-col items-center justify-center gap-2 rounded-2xl bg-rose-600 px-4 text-xs font-extrabold text-white shadow-lg shadow-rose-950/40"
            >
              <PhoneOff className="h-6 w-6" />
              رفض
            </button>
            <button
              type="button"
              onClick={() => void handleAnswer()}
              className="flex min-h-20 min-w-24 flex-col items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 text-xs font-extrabold text-white shadow-lg shadow-emerald-950/40"
            >
              <Phone className="h-6 w-6" />
              ردّ على المكالمة
            </button>
          </div>
        )}

        {call.status === 'accepted' && (
          <div className="mt-9 flex items-start justify-center gap-5">
            <button
              type="button"
              aria-label={isMuted ? 'تشغيل المايك' : 'كتم المايك'}
              onClick={() => {
                const nextMuted = !isMuted;
                localStreamRef.current?.getAudioTracks().forEach((track) => {
                  track.enabled = !nextMuted;
                });
                setIsMuted(nextMuted);
              }}
              className="flex flex-col items-center gap-2 text-[10px] font-bold text-white/80"
            >
              <span className={`flex h-14 w-14 items-center justify-center rounded-full border ${isMuted ? 'border-amber-300 bg-amber-300 text-slate-950' : 'border-white/15 bg-white/10 text-white'}`}>
                {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              </span>
              {isMuted ? 'تشغيل المايك' : 'كتم المايك'}
            </button>
            <button
              type="button"
              aria-label={speakerEnabled ? 'إيقاف مكبر الصوت' : 'تشغيل مكبر الصوت'}
              onClick={() => {
                const nextEnabled = !speakerEnabled;
                if (audioRef.current) audioRef.current.muted = !nextEnabled;
                setSpeakerEnabled(nextEnabled);
              }}
              className="flex flex-col items-center gap-2 text-[10px] font-bold text-white/80"
            >
              <span className={`flex h-14 w-14 items-center justify-center rounded-full border ${speakerEnabled ? 'border-white/15 bg-white/10 text-white' : 'border-amber-300 bg-amber-300 text-slate-950'}`}>
                {speakerEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
              </span>
              مكبر الصوت
            </button>
            <button
              type="button"
              onClick={() => void handleEnd('ended')}
              className="flex flex-col items-center gap-2 text-[10px] font-bold text-rose-200"
              aria-label="إنهاء المكالمة"
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-600 text-white shadow-lg shadow-rose-950/50">
                <PhoneOff className="h-6 w-6" />
              </span>
              إنهاء المكالمة
            </button>
          </div>
        )}
        {call.status === 'ringing' && isCaller && (
          <button
            type="button"
            onClick={() => void handleEnd('ended')}
            className="mt-9 flex min-h-12 items-center justify-center gap-2 rounded-full bg-rose-600 px-6 text-sm font-extrabold text-white shadow-lg shadow-rose-950/50"
          >
            <PhoneOff className="h-5 w-5" />
            إنهاء المكالمة
          </button>
        )}
        {(call.status === 'ended' || call.status === 'rejected') && (
          <button
            type="button"
            onClick={() => {
              setCall(null);
              setPeer(null);
            }}
            className="mt-8 rounded-xl border border-white/15 px-6 py-2.5 text-sm font-extrabold text-white/80"
          >
            إغلاق
          </button>
        )}
      </section>
    </div>
  );
};
