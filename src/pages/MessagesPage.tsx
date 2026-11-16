import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import {
  Coins,
  Crown,
  Gem,
  Gift,
  MessageCircleHeart,
  Send,
  Sparkles,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  getPmOverviewFromSupabase,
  sendPrivateMessageInSupabase,
} from '../lib/sadaSocialService';
import { supabase } from '../lib/supabase';
import type {
  GiftItem,
  PrivateConversation,
  PrivateConversationPeer,
} from '../types';
import { AvatarWithFrame } from '../components/AvatarWithFrame';
import {
  FemaleVerifiedBadge,
  FemaleVoiceVerificationCard,
} from '../components/FemaleVoiceVerificationCard';

export const MessagesPage: React.FC = () => {
  const { user, updateLocalUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [conversations, setConversations] = useState<PrivateConversation[]>([]);
  const [recipients, setRecipients] = useState<PrivateConversationPeer[]>([]);
  const [gifts, setGifts] = useState<GiftItem[]>([]);
  const [pmCost, setPmCost] = useState(150);
  const [pmReplyDiamonds, setPmReplyDiamonds] = useState(115);
  const [pendingDiamondsTotal, setPendingDiamondsTotal] = useState(0);
  const [canReceivePaidPm, setCanReceivePaidPm] = useState(false);

  const [selectedPeerId, setSelectedPeerId] = useState<string>('');
  const [listTab, setListTab] = useState<'chats' | 'directory'>('chats');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [showGiftDrawer, setShowGiftDrawer] = useState(false);
  const [giftCategory, setGiftCategory] = useState<'fixed' | 'lucky'>('fixed');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [celebration, setCelebration] = useState<{
    title: string;
    subtitle: string;
  } | null>(null);

  const endRef = useRef<HTMLDivElement | null>(null);

  const loadOverview = useCallback(async () => {
    if (!user) return;
    try {
      const data = await getPmOverviewFromSupabase(user);
      setConversations(data.conversations);
      setRecipients(data.recipients);
      setGifts(data.gifts);
      setPmCost(data.pmMessageCost);
      setPmReplyDiamonds(data.pmReplyDiamonds);
      setPendingDiamondsTotal(data.pendingDiamondsTotal);
      setCanReceivePaidPm(data.canReceivePaidPm);

      const queryTarget = searchParams.get('to');
      setSelectedPeerId((prev) => {
        if (queryTarget && queryTarget !== user.id) return queryTarget;
        if (prev) return prev;
        if (data.conversations[0]?.peer.id) return data.conversations[0].peer.id;
        return data.recipients[0]?.id || '';
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر تحميل الرسائل الخاصة.');
    } finally {
      setLoading(false);
    }
  }, [searchParams, user]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`sada-pm-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sada_private_messages' },
        () => {
          void loadOverview();
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.id, loadOverview]);

  const activeConversation = useMemo(
    () => conversations.find((c) => c.peer.id === selectedPeerId) || null,
    [conversations, selectedPeerId]
  );

  const activePeer = useMemo(() => {
    if (activeConversation) return activeConversation.peer;
    return recipients.find((r) => r.id === selectedPeerId) || null;
  }, [activeConversation, recipients, selectedPeerId]);

  const fixedGifts = useMemo(
    () => gifts.filter((g) => g.category !== 'lucky'),
    [gifts]
  );
  const luckyGifts = useMemo(
    () => gifts.filter((g) => g.category === 'lucky'),
    [gifts]
  );

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeConversation?.messages.length]);

  const handleSelectPeer = (peerId: string) => {
    setSelectedPeerId(peerId);
    setSearchParams({ to: peerId });
    setError(null);
  };

  const handleSend = async (e?: React.FormEvent, giftId?: string) => {
    if (e) e.preventDefault();
    if (!user || !selectedPeerId) return;
    if (!giftId && !text.trim()) return;

    setSending(true);
    setError(null);
    try {
      const res = await sendPrivateMessageInSupabase(user, {
        recipientId: selectedPeerId,
        text: giftId ? '' : text.trim(),
        giftId,
      });

      updateLocalUser(res.user);
      if (!giftId) setText('');
      setShowGiftDrawer(false);
      await loadOverview();

      if (res.unlockedReplyDiamonds > 0) {
        setCelebration({
          title: '💎 تمت إضافة الألماس لمحفظتك تلقائياً!',
          subtitle: `حصلت على +${res.unlockedReplyDiamonds.toLocaleString('en-US')} ألماسة فور الرد على الرسالة الخاصة.`,
        });
        setTimeout(() => setCelebration(null), 4800);
      } else if (res.luckyMultiplier && res.luckyBonusCoins) {
        setCelebration({
          title: `🎰 مضاعف هدية الحظ ×${res.luckyMultiplier}!`,
          subtitle: `أُضيف +${res.luckyBonusCoins.toLocaleString('en-US')} كوينز لرصيدك و +${res.giftDiamondsAwarded.toLocaleString('en-US')} ألماسة للمستلم.`,
        });
        setTimeout(() => setCelebration(null), 4800);
      } else if (res.giftDiamondsAwarded > 0) {
        setCelebration({
          title: '🎁 تم إرسال الهدية الخاصة بنجاح!',
          subtitle: `تم تحويل +${res.giftDiamondsAwarded.toLocaleString('en-US')} ألماسة إلى محفظة ${activePeer?.displayName || 'المستلم'} تلقائياً.`,
        });
        setTimeout(() => setCelebration(null), 4200);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر إرسال الرسالة الخاصة.');
    } finally {
      setSending(false);
    }
  };

  const pendingInCurrentChat = activeConversation?.pendingDiamondsForMe || 0;
  const isFreeReply =
    canReceivePaidPm &&
    Boolean(
      activeConversation?.messages.some((m) => m.senderId === selectedPeerId)
    );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-5 pb-28 space-y-5">
      {/* Header */}
      <div className="royal-glass rounded-3xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold gold-gradient-text flex items-center gap-2.5">
            <MessageCircleHeart className="w-7 h-7 text-[#F3D37A]" />
            <span>الرسائل الخاصة والألماس</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1">
            تتلقى الحسابات النسائية والمضيفون رسائل مدفوعة بالكوينز وهدايا — وتُضاف مكافآت الألماس تلقائياً إلى المحفظة عند الرد أو الاستلام.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="royal-capsule rounded-2xl px-4 py-2 flex items-center gap-2 text-xs font-mono-num">
            <Gem className="w-4 h-4 text-sky-400" />
            <span className="text-slate-300">محفظتك:</span>
            <span className="font-extrabold text-sky-200">
              {(user?.diamonds ?? 0).toLocaleString('en-US')} ألماسة
            </span>
          </div>
          {pendingDiamondsTotal > 0 && (
            <div className="rounded-2xl border border-emerald-400/50 bg-emerald-500/15 px-3.5 py-2 text-xs font-bold text-emerald-200 font-mono-num">
              💎 {pendingDiamondsTotal.toLocaleString('en-US')} ألماسة بانتظار ردك
            </div>
          )}
        </div>
      </div>

      <FemaleVoiceVerificationCard />

      {/* Celebratory Diamond Banner */}
      <AnimatePresence>
        {celebration && (
          <motion.div
            initial={{ opacity: 0, y: -14, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10 }}
            className="rounded-3xl border border-[#FCE9A6]/75 bg-gradient-to-r from-[#2D2006]/95 via-[#131A34]/95 to-[#2D2006]/95 px-5 py-4 shadow-[0_0_38px_rgba(243,211,122,0.45)] flex items-center justify-between gap-3"
          >
            <div>
              <p className="text-sm sm:text-base font-extrabold text-[#FCE9A6]">
                {celebration.title}
              </p>
              <p className="text-xs sm:text-sm text-slate-200 mt-0.5">
                {celebration.subtitle}
              </p>
            </div>
            <Sparkles className="w-6 h-6 text-[#F3D37A] shrink-0" />
          </motion.div>
        )}
      </AnimatePresence>

      {error && (
        <div className="rounded-2xl border border-rose-500/40 bg-rose-950/55 px-4 py-3 text-xs sm:text-sm text-rose-200">
          {error}
        </div>
      )}

      {/* Main Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Sidebar: Conversations + Eligible Female/Host Directory */}
        <aside className="lg:col-span-4 royal-glass rounded-3xl p-4 flex flex-col gap-3 h-[420px] lg:h-[580px]">
          <div className="grid grid-cols-2 gap-1.5 p-1 rounded-2xl bg-[#070913]/85 border border-[#D4AF37]/20">
            <button
              type="button"
              onClick={() => setListTab('chats')}
              className={`min-h-[38px] rounded-xl text-xs font-bold transition cursor-pointer ${
                listTab === 'chats'
                  ? 'bg-gradient-to-r from-[#D4AF37] to-[#B58922] text-[#070913]'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              المحادثات ({conversations.length})
            </button>
            <button
              type="button"
              onClick={() => setListTab('directory')}
              className={`min-h-[38px] rounded-xl text-xs font-bold transition cursor-pointer ${
                listTab === 'directory'
                  ? 'bg-gradient-to-r from-[#D4AF37] to-[#B58922] text-[#070913]'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              المضيفون والعضوات ({recipients.length})
            </button>
          </div>

          <div className="flex-1 overflow-y-auto no-scrollbar space-y-2">
            {loading ? (
              <p className="text-xs text-slate-400 text-center py-8">جارٍ التحميل...</p>
            ) : listTab === 'chats' ? (
              conversations.length === 0 ? (
                <div className="text-center py-10 space-y-3">
                  <p className="text-xs text-slate-400">
                    لا توجد محادثات خاصة بعد. اختر مضيفاً أو حساباً نسائياً لبدء المراسلة أو الإهداء!
                  </p>
                  <button
                    type="button"
                    onClick={() => setListTab('directory')}
                    className="gold-btn rounded-xl px-4 py-2 text-xs cursor-pointer"
                  >
                    استعراض المضيفين والعضوات
                  </button>
                </div>
              ) : (
                conversations.map((conv) => {
                  const active = conv.peer.id === selectedPeerId;
                  return (
                    <button
                      key={conv.id}
                      type="button"
                      onClick={() => handleSelectPeer(conv.peer.id)}
                      className={`w-full rounded-2xl p-3 flex items-center gap-3 text-right transition cursor-pointer border ${
                        active
                          ? 'bg-[#D4AF37]/15 border-[#F3D37A]/60'
                          : 'bg-[#070913]/65 border-[#D4AF37]/15 hover:border-[#D4AF37]/40'
                      }`}
                    >
                      <AvatarWithFrame
                        src={conv.peer.avatarUrl}
                        alt={conv.peer.displayName}
                        frameId={conv.peer.frameId}
                        size="sm"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs sm:text-sm font-bold text-white truncate">
                            {conv.peer.displayName}
                          </span>
                          {conv.pendingDiamondsForMe > 0 && (
                            <span className="text-[10px] font-mono-num font-bold text-emerald-300 shrink-0">
                              +{conv.pendingDiamondsForMe} 💎
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 truncate mt-0.5">
                          {conv.lastMessage?.text || ''}
                        </p>
                      </div>
                    </button>
                  );
                })
              )
            ) : (
              recipients.map((rec) => {
                const active = rec.id === selectedPeerId;
                return (
                  <button
                    key={rec.id}
                    type="button"
                    onClick={() => handleSelectPeer(rec.id)}
                    className={`w-full rounded-2xl p-3 flex items-center gap-3 text-right transition cursor-pointer border ${
                      active
                        ? 'bg-[#D4AF37]/15 border-[#F3D37A]/60'
                        : 'bg-[#070913]/65 border-[#D4AF37]/15 hover:border-[#D4AF37]/40'
                    }`}
                  >
                    <AvatarWithFrame
                      src={rec.avatarUrl}
                      alt={rec.displayName}
                      frameId={rec.frameId}
                      size="sm"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-xs sm:text-sm font-bold text-white truncate">
                            {rec.displayName}
                          </span>
                          <FemaleVerifiedBadge badge={rec.femaleVerifiedBadge} />
                        </div>
                        <span className="text-[10px] text-[#FCE9A6] font-semibold shrink-0">
                          {rec.gender === 'female' ? 'حساب نسائي' : 'مضيف مجلس'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">
                        {rec.bio}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* Conversation Window */}
        <section className="lg:col-span-8 royal-glass rounded-3xl p-4 sm:p-5 flex flex-col h-[520px] lg:h-[580px]">
          {activePeer ? (
            <>
              {/* Peer Header */}
              <div className="pb-3 mb-3 border-b border-[#D4AF37]/15 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <AvatarWithFrame
                    src={activePeer.avatarUrl}
                    alt={activePeer.displayName}
                    frameId={activePeer.frameId}
                    size="sm"
                  />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-sm sm:text-base font-extrabold text-white truncate">
                        {activePeer.displayName}
                      </h2>
                      <FemaleVerifiedBadge badge={activePeer.femaleVerifiedBadge} />
                      <span className="text-[10px] font-bold text-[#F3D37A] flex items-center gap-1 shrink-0">
                        <Crown className="w-3 h-3" />
                        Lv.{activePeer.level}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 truncate">
                      {activePeer.gender === 'female'
                        ? 'حساب نسائي ملكي · يحصل على الألماس عند الرد أو الهدايا'
                        : 'مضيف مجلس صوتي · يحصل على الألماس عند الرد أو الهدايا'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowGiftDrawer((prev) => !prev)}
                  className="gold-btn min-h-[38px] rounded-xl px-3.5 py-1.5 text-xs flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <Gift className="w-4 h-4" />
                  <span>هدية خاصة</span>
                </button>
              </div>

              {pendingInCurrentChat > 0 && (
                <div className="mb-3 rounded-2xl border border-emerald-400/45 bg-emerald-500/12 px-4 py-2.5 text-xs font-bold text-emerald-200 flex items-center justify-between gap-2">
                  <span>
                    💎 لديك {pendingInCurrentChat.toLocaleString('en-US')} ألماسة جاهزة — أرسل ردك الآن لتُضاف تلقائياً لمحفظتك!
                  </span>
                </div>
              )}

              {/* Messages Feed */}
              <div className="flex-1 overflow-y-auto no-scrollbar space-y-3 pl-1">
                {!activeConversation || activeConversation.messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center px-6 space-y-2">
                    <MessageCircleHeart className="w-10 h-10 text-[#D4AF37]/70" />
                    <p className="text-sm font-bold text-white">
                      ابدأ محادثة خاصة مع {activePeer.displayName}
                    </p>
                    <p className="text-xs text-slate-400 max-w-md">
                      تكلفة الرسالة الخاصة المدفوعة {pmCost} كوينز، وتمنح المستلم +{pmReplyDiamonds} ألماسة تلقائياً بمجرد الرد على رسالتك، أو أرسل هدية خاصة لتُضاف الألماسات فوراً!
                    </p>
                  </div>
                ) : (
                  activeConversation.messages.map((m) => {
                    const isMine = m.senderId === user?.id;
                    return (
                      <div
                        key={m.id}
                        className={`flex flex-col ${isMine ? 'items-start' : 'items-end'}`}
                      >
                        <div
                          className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 text-xs sm:text-sm border ${
                            m.giftId
                              ? 'bg-gradient-to-br from-[#342407]/90 to-[#141A33]/95 border-[#FCE9A6]/55 text-[#FCE9A6]'
                              : isMine
                              ? 'bg-[#D4AF37]/15 border-[#D4AF37]/40 text-white'
                              : 'bg-[#070913]/85 border-white/10 text-slate-100'
                          }`}
                        >
                          {m.giftId && (
                            <div className="flex items-center gap-2 mb-1 text-xs font-extrabold text-[#FCE9A6]">
                              <span className="text-xl">{m.giftGlyph}</span>
                              <span>{m.giftName}</span>
                            </div>
                          )}
                          <p className="leading-relaxed">{m.text}</p>
                          <div className="mt-2 pt-1.5 border-t border-white/10 flex flex-wrap items-center gap-2 text-[10px] font-mono-num">
                            {m.coinsPaid > 0 && (
                              <span className="text-amber-300 flex items-center gap-1">
                                <Coins className="w-3 h-3" />
                                {m.coinsPaid.toLocaleString('en-US')} كوينز
                              </span>
                            )}
                            {m.diamondsPotential > 0 && (
                              <span
                                className={
                                  m.diamondsClaimed
                                    ? 'text-emerald-300 font-bold'
                                    : 'text-sky-300'
                                }
                              >
                                {m.diamondsClaimed
                                  ? `💎 أُضيفت +${(m.diamondsAwarded || m.diamondsPotential).toLocaleString('en-US')} ألماسة للمحفظة ✓`
                                  : `💎 +${m.diamondsPotential.toLocaleString('en-US')} ألماسة عند الرد`}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={endRef} />
              </div>

              {/* Quick Private Gift Drawer */}
              {showGiftDrawer && (
                <div className="mt-3 rounded-2xl border border-[#D4AF37]/35 bg-[#070913]/95 p-3 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setGiftCategory('fixed')}
                        className={`rounded-xl px-3 py-1 text-xs font-bold cursor-pointer ${
                          giftCategory === 'fixed'
                            ? 'bg-[#D4AF37] text-[#070913]'
                            : 'bg-white/5 text-slate-300'
                        }`}
                      >
                        هدايا ثابتة ({fixedGifts.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setGiftCategory('lucky')}
                        className={`rounded-xl px-3 py-1 text-xs font-bold cursor-pointer ${
                          giftCategory === 'lucky'
                            ? 'bg-[#D4AF37] text-[#070913]'
                            : 'bg-white/5 text-slate-300'
                        }`}
                      >
                        هدايا الحظ ({luckyGifts.length})
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowGiftDrawer(false)}
                      className="text-slate-400 hover:text-white p-1 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                    {(giftCategory === 'lucky' ? luckyGifts : fixedGifts).map((g) => (
                      <button
                        key={g.id}
                        type="button"
                        disabled={sending}
                        onClick={() => handleSend(undefined, g.id)}
                        className="shrink-0 w-28 rounded-xl border border-[#D4AF37]/25 bg-[#0D1122] hover:border-[#F3D37A] p-2 text-center flex flex-col items-center gap-1 cursor-pointer disabled:opacity-50"
                      >
                        <span className="text-2xl">{g.glyph}</span>
                        <span className="text-[11px] font-bold text-white line-clamp-1">
                          {g.name}
                        </span>
                        <span className="text-[10px] font-mono-num text-[#FCE9A6]">
                          {g.coinsCost.toLocaleString('en-US')} 🪙
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Message Composer */}
              <form onSubmit={(e) => handleSend(e)} className="mt-3 flex items-center gap-2">
                <input
                  type="text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={
                    isFreeReply
                      ? 'أرسل ردك الآن لإضافة الألماس تلقائياً إلى محفظتك...'
                      : `اكتب رسالة خاصة مدفوعة (${pmCost} كوينز)...`
                  }
                  className="flex-1 rounded-xl bg-[#070913]/85 border border-[#D4AF37]/25 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-[#D4AF37]"
                />
                <button
                  type="submit"
                  disabled={sending || !text.trim()}
                  className="gold-btn min-h-[42px] rounded-xl px-4 text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
                >
                  <Send className="w-4 h-4" />
                  <span>{isFreeReply ? 'رد واستلم 💎' : `إرسال (${pmCost})`}</span>
                </button>
              </form>
            </>
          ) : (
            <div className="h-full flex items-center justify-center text-sm text-slate-400">
              اختر حساباً من القائمة لبدء المراسلة الخاصة
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
