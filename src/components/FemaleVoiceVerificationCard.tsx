import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Lock,
  Mic,
  RotateCcw,
  Send,
  Sparkles,
  Square,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import type { FemaleVoiceVerificationRequest, User } from '../types';

const REQUIRED_PHRASE = 'أهلاً بكم في تطبيق صَدَى';
const RECORD_DURATION_MS = 5000;

export const FemaleVerifiedBadge: React.FC<{ badge?: string | null; className?: string }> = ({
  badge,
  className = '',
}) => {
  if (!badge) return null;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-extrabold whitespace-nowrap border border-pink-300/65 bg-gradient-to-r from-pink-500/25 via-[#D4AF37]/30 to-rose-400/25 text-pink-100 shadow-[0_0_14px_rgba(244,114,182,0.42)] ${className}`}
    >
      <span>🌸</span>
      <span>{badge}</span>
    </span>
  );
};

export const FemaleVoiceVerificationCard: React.FC = () => {
  const { user, updateLocalUser, refreshUser } = useAuth();

  const [isRecording, setIsRecording] = useState(false);
  const [remainingMs, setRemainingMs] = useState(RECORD_DURATION_MS);
  const [recordedDataUrl, setRecordedDataUrl] = useState<string | null>(null);
  const [recordedSeconds, setRecordedSeconds] = useState(5);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [latestReq, setLatestReq] = useState<FemaleVoiceVerificationRequest | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const autoStopRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!user || user.gender !== 'female' || user.is_admin || user.femaleVoiceStatus === 'verified') {
      return;
    }
    apiFetch<{
      status: User['femaleVoiceStatus'];
      latestRequest: FemaleVoiceVerificationRequest | null;
    }>('/api/verification/female-voice/status')
      .then((res) => {
        setLatestReq(res.latestRequest);
      })
      .catch(() => {});
  }, [user?.id, user?.femaleVoiceStatus, user?.gender, user?.is_admin]);

  const cleanupRecording = () => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (autoStopRef.current !== null) {
      window.clearTimeout(autoStopRef.current);
      autoStopRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  useEffect(() => {
    return () => cleanupRecording();
  }, []);

  if (!user || user.gender !== 'female' || user.is_admin || user.femaleVoiceStatus === 'verified') {
    return null;
  }

  const status = user.femaleVoiceStatus || 'unverified';

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const startRecording = async () => {
    setError(null);
    setSuccessMsg(null);
    setRecordedDataUrl(null);

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('متصفحك لا يدعم تسجيل الصوت المباشر. يرجى استخدام متصفح حديث مع السماح بالمايكروفون.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const mimeCandidates = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/ogg;codecs=opus',
      ];
      const chosenMime = mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m));
      const recorder = chosenMime
        ? new MediaRecorder(stream, { mimeType: chosenMime })
        : new MediaRecorder(stream);

      mediaRecorderRef.current = recorder;
      startTimeRef.current = Date.now();
      setRemainingMs(RECORD_DURATION_MS);
      setIsRecording(true);

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) {
          chunksRef.current.push(ev.data);
        }
      };

      recorder.onstop = () => {
        const elapsed = Math.max(
          1,
          Math.min(5, Math.round((Date.now() - startTimeRef.current) / 1000))
        );
        cleanupRecording();
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        });
        if (blob.size < 80) {
          setError('التسجيل قصير جداً أو فارغ، يرجى المحاولة مجدداً ونطق العبارة بوضوح.');
          return;
        }
        const reader = new FileReader();
        reader.onloadend = () => {
          setRecordedDataUrl(String(reader.result));
          setRecordedSeconds(elapsed);
        };
        reader.readAsDataURL(blob);
      };

      recorder.start(150);

      timerRef.current = window.setInterval(() => {
        const elapsed = Date.now() - startTimeRef.current;
        const left = Math.max(0, RECORD_DURATION_MS - elapsed);
        setRemainingMs(left);
      }, 100);

      autoStopRef.current = window.setTimeout(() => {
        stopRecording();
      }, RECORD_DURATION_MS);
    } catch {
      cleanupRecording();
      setIsRecording(false);
      setError('يرجى السماح بصلاحية المايكروفون لتسجيل البصمة الصوتية (5 ثوانٍ).');
    }
  };

  const handleSubmit = async () => {
    if (!recordedDataUrl) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await apiFetch<{
        request: FemaleVoiceVerificationRequest;
        user: User;
      }>('/api/verification/female-voice', {
        method: 'POST',
        body: JSON.stringify({
          audioDataUrl: recordedDataUrl,
          durationSeconds: recordedSeconds,
          phrase: REQUIRED_PHRASE,
        }),
      });
      updateLocalUser(res.user);
      setLatestReq(res.request);
      setRecordedDataUrl(null);
      setSuccessMsg('تم إرسال بصمتكِ الصوتية بنجاح! سيتم تفعيل الألماس والرسائل الخاصة فور اعتماد الإدارة.');
      await refreshUser();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر إرسال طلب التوثيق.');
    } finally {
      setSubmitting(false);
    }
  };

  const progressPct = Math.min(
    100,
    Math.round(((RECORD_DURATION_MS - remainingMs) / RECORD_DURATION_MS) * 100)
  );

  return (
    <section className="rounded-3xl border border-[#FCE9A6]/55 bg-gradient-to-br from-[#2C1F08]/90 via-[#11162B]/95 to-[#2A1025]/90 p-5 sm:p-6 shadow-[0_0_38px_rgba(212,175,55,0.28)] space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#FCE9A6]/30 to-pink-500/20 border border-[#FCE9A6]/55 flex items-center justify-center shrink-0 shadow-[0_0_20px_rgba(243,211,122,0.35)]">
            <Mic className="w-6 h-6 text-[#FCE9A6]" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base sm:text-lg font-extrabold text-[#FCE9A6]">
                التوثيق الصوتي للحسابات النسائية
              </h2>
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 border border-[#D4AF37]/45 px-2.5 py-0.5 text-[11px] font-bold text-[#FCE9A6]">
                <Lock className="w-3 h-3" />
                <span>
                  {status === 'pending'
                    ? 'قيد مراجعة الإدارة'
                    : status === 'rejected'
                    ? 'مرفوض — يتطلب إعادة التسجيل'
                    : 'بانتظار التوثيق الصوتي'}
                </span>
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-200 mt-1 leading-relaxed">
              حسابكِ مفتوح بالكامل للتصفح والغرف الصوتية، بينما يظل رصيد <strong>الألماس واستقبال الرسائل المدفوعة</strong> مقفلاً لحماية عضوات صَدَى حتى اعتماد بصمتكِ الصوتية من الإدارة.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-500/45 bg-rose-950/60 px-4 py-2.5 text-xs text-rose-200 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="rounded-2xl border border-emerald-400/45 bg-emerald-950/50 px-4 py-2.5 text-xs text-emerald-200 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {status === 'rejected' && user.femaleVoiceNote && (
        <div className="rounded-2xl border border-rose-400/45 bg-rose-950/45 px-4 py-3 text-xs text-rose-100">
          <span className="font-extrabold block mb-0.5">ملاحظة الإدارة على الطلب السابق:</span>
          <span>{user.femaleVoiceNote}</span>
        </div>
      )}

      {status === 'pending' ? (
        <div className="rounded-2xl bg-[#070913]/85 border border-[#D4AF37]/35 p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-[#FCE9A6]">
            <Clock className="w-4 h-4 text-[#D4AF37]" />
            <span>بصمتكِ الصوتية وصلت إلى لوحة الإدارة العليا وبانتظار القبول والتوثيق</span>
          </div>
          {latestReq?.audioDataUrl && (
            <audio controls src={latestReq.audioDataUrl} className="w-full h-10" />
          )}
          <p className="text-[11px] text-slate-300">
            فور قبول الإدارة، سيُفتح رصيد الألماس والرسائل الخاصة المدفوعة تلقائياً وتظهر شارة التوثيق الوردية الذهبية بجانب اسمكِ.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl bg-[#070913]/85 border border-[#D4AF37]/30 p-4 sm:p-5 space-y-4">
          <div className="text-center space-y-1.5">
            <span className="text-[11px] font-bold text-slate-300">
              اضغطي على زر المايكروفون وسجّلي صوتكِ لمدة 5 ثوانٍ بنطق العبارة التالية بوضوح:
            </span>
            <p className="text-lg sm:text-xl font-extrabold gold-gradient-text tracking-wide">
              « {REQUIRED_PHRASE} »
            </p>
          </div>

          {isRecording && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-mono-num text-[#FCE9A6]">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
                  <span>جارٍ التسجيل الصوتي...</span>
                </span>
                <span>{(remainingMs / 1000).toFixed(1)} ثانية متبقية</span>
              </div>
              <div className="h-2.5 rounded-full bg-[#0B0F20] border border-[#D4AF37]/30 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#D4AF37] via-pink-400 to-[#FCE9A6] transition-all duration-100"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          )}

          {recordedDataUrl && !isRecording && (
            <div className="rounded-2xl bg-[#0B0F20] border border-[#D4AF37]/30 p-3 space-y-2">
              <span className="text-[11px] font-bold text-[#F3D37A] block">
                معاينة التسجيل الصوتي ({recordedSeconds} ثوانٍ):
              </span>
              <audio controls src={recordedDataUrl} className="w-full h-10" />
            </div>
          )}

          <div className="flex flex-wrap items-center justify-center gap-3">
            {!isRecording ? (
              <button
                type="button"
                disabled={submitting}
                onClick={startRecording}
                className="gold-btn min-h-[46px] rounded-2xl px-6 py-2.5 text-sm font-extrabold flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {recordedDataUrl ? (
                  <>
                    <RotateCcw className="w-4 h-4" />
                    <span>إعادة التسجيل (5 ثوانٍ)</span>
                  </>
                ) : (
                  <>
                    <Mic className="w-4 h-4" />
                    <span>بدء التسجيل الصوتي (5 ثوانٍ)</span>
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={stopRecording}
                className="min-h-[46px] rounded-2xl bg-rose-600/85 hover:bg-rose-500 border border-rose-300/60 px-6 py-2.5 text-sm font-extrabold text-white flex items-center gap-2 cursor-pointer transition"
              >
                <Square className="w-4 h-4" />
                <span>إيقاف التسجيل الآن</span>
              </button>
            )}

            {recordedDataUrl && !isRecording && (
              <button
                type="button"
                disabled={submitting}
                onClick={handleSubmit}
                className="min-h-[46px] rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 border border-emerald-300/60 px-6 py-2.5 text-sm font-extrabold text-[#070913] flex items-center gap-2 cursor-pointer transition disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                <span>{submitting ? 'جارٍ إرسال البصمة...' : 'إرسال طلب التوثيق للإدارة'}</span>
              </button>
            )}
          </div>

          <p className="text-[11px] text-center text-slate-400 flex items-center justify-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-pink-300" />
            <span>يُستخدم المقطع الصوتي حصراً للتحقق الإداري وتفعيل الألماس وشارة التوثيق.</span>
          </p>
        </div>
      )}
    </section>
  );
};
