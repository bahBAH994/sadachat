import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowRight,
  Bell,
  Check,
  Coins,
  Crown,
  Gem,
  Gift,
  MessageCircleHeart,
  MoreVertical,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  UserCheck,
  UserPlus,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useMiniProfile } from '../context/MiniProfileContext';
import {
  getFollowStatus,
  getPmOverviewFromSupabase,
  sendPrivateMessageInSupabase,
  toggleFollowUserInSupabase,
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

type InboxFilter = 'كامل' | 'غير مقروء' | 'وجوه مألوفة' | 'المجموعات';

export const MessagesPage: React.FC = () => {
  const { user, updateLocalUser, onlineUserIds } = useAuth();
  const { openMiniProfile } = useMiniProfile();
  const [searchParams, setSearchParams] = useSearchParams();

  const [conversations, setConversations] = useState<PrivateConversation[]>([]);
  const [recipients, setRecipients] = useState<PrivateConversationPeer[]>([]);
  const [gifts, setGifts] = useState<GiftItem[]>([]);
  const [pmCost, setPmCost] = useState(50);
  const [pmReplyDiamonds, setPmReplyDiamonds] = useState(38);
  const [pendingDiamondsTotal, setPendingDiamondsTotal] = useState(0);
  const [canReceivePaidPm, setCanReceivePaidPm] = useState(false);
  const [userFollows, setUserFollows] = useState<Record<string, string[]>>({});
  const [togglingFollow, setTogglingFollow] = useState(false);

  const [selectedPeerId, setSelectedPeerId] = useState<string>('');
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const [inboxFilter, setInboxFilter] = useState<InboxFilter>('كامل');
  const [showNotifBar, setShowNotifBar] = useState(true);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [showSearchBar, setShowSearchBar] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

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
      setUserFollows(data.userFollows || {});

      const queryTarget = searchParams.get('to');
      if (queryTarget && queryTarget !== user.id) {
        setSelectedPeerId(queryTarget);
        setMobileChatOpen(true);
      } else {
        setSelectedPeerId((prev) => {
          if (prev) return prev;
          if (data.conversations[0]?.peer.id) return data.conversations[0].peer.id;
          return data.recipients[0]?.id || '';
        });
      }
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
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sada_platform_state' },
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

  const filteredConversations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return conversations.filter((c) => {
      if (inboxFilter === 'غير مقروء' && c.pendingDiamondsForMe <= 0) return false;
      if (inboxFilter === 'وجوه مألوفة' && c.messages.length < 2) return false;
      if (q && !c.peer.displayName.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [conversations, inboxFilter, searchQuery]);

  const isPeerOnline = useCallback(
    (peer: PrivateConversationPeer) => {
      if (onlineUserIds.includes(peer.id)) return true;
      if (!peer.lastSeen) return false;
      const ms = new Date(peer.lastSeen).getTime();
      return Number.isFinite(ms) && Date.now() - ms <= 5 * 60 * 1000;
    },
    [onlineUserIds]
  );

  const fixedGifts = useMemo(() => gifts.filter((g) => g.category !== 'lucky'), [gifts]);
  const luckyGifts = useMemo(() => gifts.filter((g) => g.category === 'lucky'), [gifts]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeConversation?.messages.length, mobileChatOpen]);

  const handleSelectPeer = (peerId: string) => {
    setSelectedPeerId(peerId);
    setMobileChatOpen(true);
    setSearchParams({ to: peerId });
    setError(null);
  };

  const handleEnableNotifications = () => {
    if (typeof Notification !== 'undefined' && Notification.requestPermission) {
      Notification.requestPermission().finally(() => setShowNotifBar(false));
    } else {
      setShowNotifBar(false);
    }
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
      } else if (res.immediatePmDiamondsAwarded > 0) {
        setCelebration({
          title: '💌 تم إرسال رسالتك المدفوعة بنجاح!',
          subtitle: `حصل ${activePeer?.displayName || 'المستلم'} على +${res.immediatePmDiamondsAwarded.toLocaleString('en-US')} ألماسة فوراً في رصيده.`,
        });
        setTimeout(() => setCelebration(null), 4000);
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

  const handleToggleFollowPeer = async () => {
    if (!user?.id || !activePeer?.id) return;
    setTogglingFollow(true);
    try {
      const next = await toggleFollowUserInSupabase(user.id, activePeer.id);
      setUserFollows(next.userFollows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر تحديث المتابعة.');
    } finally {
      setTogglingFollow(false);
    }
  };

  const pendingInCurrentChat = activeConversation?.pendingDiamondsForMe || 0;
  const followRel =
    user && activePeer
      ? getFollowStatus(userFollows, user.id, activePeer.id)
      : { iFollowThem: false, theyFollowMe: false, isMutual: false };
  const isMutualFriends = followRel.isMutual;
  const isPmFreeNow = isMutualFriends || pmCost <= 0;
  const isFreeReply =
    !isPmFreeNow &&
    canReceivePaidPm &&
    Boolean(activeConversation?.messages.some((m) => m.senderId === selectedPeerId));

  return (
    <div className="min-h-screen bg-[#F5F6FA] pb-28">
      {/* Top Header matching Screenshot 3 */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-100">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-2">
          <h1 className="text-xl font-extrabold text-slate-900">صندوق الوارد</h1>
          <div className="flex items-center gap-2">
            {pendingDiamondsTotal > 0 && (
              <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-[11px] font-extrabold text-emerald-700 font-mono-num">
                +{pendingDiamondsTotal} 💎
              </span>
            )}
            <button
              type="button"
              onClick={() => setMobileChatOpen(false)}
              className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 cursor-pointer"
              title="المضيفون والعضوات"
            >
              <UserPlus className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setShowSearchBar((prev) => !prev)}
              className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 cursor-pointer"
              title="بحث"
            >
              <Search className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setShowRulesModal(true)}
              className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 cursor-pointer"
              title="قواعد المستخدم"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
          </div>
        </div>

        {showSearchBar && (
          <div className="max-w-5xl mx-auto px-4 pb-3">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث باسم العضو في صندوق الوارد..."
              className="w-full rounded-2xl bg-slate-100 border border-slate-200 px-4 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
            />
          </div>
        )}
      </header>

      {/* Notification Permission Strip */}
      {showNotifBar && (
        <div className="bg-white border-b border-slate-100">
          <div className="max-w-5xl mx-auto px-4 py-2.5 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
              <Bell className="w-4 h-4 text-amber-500 shrink-0" />
              <span>فتح الإشعارات، لا تفوت الرسائل الجديدة</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleEnableNotifications}
                className="emerald-btn rounded-xl px-3 py-1 text-xs cursor-pointer"
              >
                يفتح
              </button>
              <button
                type="button"
                onClick={() => setShowNotifBar(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                aria-label="إغلاق"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-5xl mx-auto px-3.5 sm:px-5 pt-3 space-y-4">
        <FemaleVoiceVerificationCard />

        {/* Celebratory Diamond Banner */}
        <AnimatePresence>
          {celebration && (
            <motion.div
              initial={{ opacity: 0, y: -12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10 }}
              className="rounded-2xl border border-amber-300 bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-3 text-white shadow-lg flex items-center justify-between gap-3"
            >
              <div>
                <p className="text-sm font-extrabold">{celebration.title}</p>
                <p className="text-xs text-emerald-50 mt-0.5">{celebration.subtitle}</p>
              </div>
              <Sparkles className="w-5 h-5 text-amber-200 shrink-0" />
            </motion.div>
          )}
        </AnimatePresence>

        {error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-semibold text-rose-700">
            {error}
          </div>
        )}

        {/* Main Split Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Inbox List Panel (Hidden on mobile only when active chat is open) */}
          <aside
            className={`lg:col-span-5 space-y-3 ${
              mobileChatOpen ? 'hidden lg:block' : 'block'
            }`}
          >
            {/* Purple Gradient Community Rules Banner matching screenshot 3 */}
            <button
              type="button"
              onClick={() => setShowRulesModal(true)}
              className="w-full rounded-3xl bg-gradient-to-r from-[#8B5CF6] via-[#9333EA] to-[#6366F1] p-4 text-white text-right shadow-md hover:brightness-105 transition cursor-pointer flex items-center justify-between gap-3"
            >
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-0.5 text-[10px] font-bold">
                  <Sparkles className="w-3 h-3 text-amber-200" />
                  <span>صَدَى - SADA</span>
                </div>
                <h2 className="text-lg font-extrabold leading-tight">قواعد المستخدم</h2>
                <p className="text-[11px] text-purple-100">
                  حافظ على الأجواء الجيدة: نصائح مجتمع صَدَى - SADA
                </p>
              </div>
              <div className="w-14 h-14 rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center text-3xl shrink-0">
                📜
              </div>
            </button>

            {/* Horizontal Users Strip (real online dots only) */}
            <div className="light-card rounded-2xl p-3">
              {recipients.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-2">
                  لا يوجد أعضاء مسجلون آخرون بعد.
                </p>
              ) : (
                <div className="flex items-center gap-3 overflow-x-auto no-scrollbar pb-1">
                  {recipients.map((rec) => {
                    const live = isPeerOnline(rec);
                    return (
                      <div
                        key={rec.id}
                        className="flex flex-col items-center gap-1 shrink-0 w-16"
                      >
                        <div className="relative">
                          <AvatarWithFrame
                            src={rec.avatarUrl}
                            alt={rec.displayName}
                            frameId={rec.frameId}
                            size="md"
                            onClick={() => openMiniProfile(rec.id, rec)}
                          />
                          {live && (
                            <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-white" />
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleSelectPeer(rec.id)}
                          className="rounded-full bg-sky-500 text-white px-2 py-0.5 text-[9px] font-extrabold cursor-pointer whitespace-nowrap"
                        >
                          🎙️ محادثة
                        </button>
                        <span className="text-[10px] font-bold text-slate-700 truncate w-full text-center">
                          {rec.displayName}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Filter Chips matching Screenshot 3 */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {(['كامل', 'غير مقروء', 'وجوه مألوفة', 'المجموعات'] as InboxFilter[]).map(
                (tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setInboxFilter(tab)}
                    className={`rounded-xl px-3.5 py-1.5 text-xs font-extrabold whitespace-nowrap cursor-pointer transition ${
                      inboxFilter === tab
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-300'
                        : 'bg-white text-slate-500 border border-slate-200/80'
                    }`}
                  >
                    {tab}
                  </button>
                )
              )}
            </div>

            {/* Real Conversations List from Supabase */}
            <div className="light-card rounded-3xl divide-y divide-slate-100 overflow-hidden">

              {loading ? (
                <div className="p-6 text-center text-xs text-slate-400">
                  جارٍ تحميل المحادثات...
                </div>
              ) : filteredConversations.length === 0 ? (
                <div className="p-6 text-center space-y-2">
                  <p className="text-xs text-slate-500">
                    لا توجد محادثات خاصة بعد. اختر أي عضو من الشريط أعلاه لبدء المراسلة!
                  </p>
                </div>
              ) : (
                filteredConversations.map((conv) => {
                  const active = conv.peer.id === selectedPeerId;
                  return (
                    <div
                      key={conv.id}
                      onClick={() => handleSelectPeer(conv.peer.id)}
                      className={`p-3.5 flex items-center gap-3 cursor-pointer transition ${
                        active ? 'bg-emerald-50/70' : 'hover:bg-slate-50'
                      }`}
                    >
                      <AvatarWithFrame
                        src={conv.peer.avatarUrl}
                        alt={conv.peer.displayName}
                        frameId={conv.peer.frameId}
                        size="md"
                        onClick={() => openMiniProfile(conv.peer.id, conv.peer)}
                      />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-sm font-extrabold text-slate-900 truncate">
                              {conv.peer.displayName}
                            </span>
                            <FemaleVerifiedBadge badge={conv.peer.femaleVerifiedBadge} />
                            <span className="rounded-full bg-violet-100 text-violet-700 px-1.5 py-0.5 text-[10px] font-bold font-mono-num">
                              Lv.{conv.peer.level}
                            </span>
                          </div>
                          {conv.pendingDiamondsForMe > 0 && (
                            <span className="rounded-full bg-rose-50 text-rose-600 border border-rose-200 px-2 py-0.5 text-[10px] font-extrabold font-mono-num shrink-0">
                              +{conv.pendingDiamondsForMe} 💎
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 truncate mt-0.5">
                          {conv.lastMessage?.text || ''}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </aside>

          {/* Active Conversation Window */}
          <section
            className={`lg:col-span-7 light-card rounded-3xl p-4 sm:p-5 flex flex-col h-[560px] ${
              mobileChatOpen ? 'flex' : 'hidden lg:flex'
            }`}
          >
            {activePeer ? (
              <>
                <div className="pb-3 mb-3 border-b border-slate-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <button
                      type="button"
                      onClick={() => setMobileChatOpen(false)}
                      className="lg:hidden w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 cursor-pointer shrink-0"
                    >
                      <ArrowRight className="w-4 h-4" />
                    </button>

                    <AvatarWithFrame
                      src={activePeer.avatarUrl}
                      alt={activePeer.displayName}
                      frameId={activePeer.frameId}
                      size="sm"
                      onClick={() => openMiniProfile(activePeer.id, activePeer)}
                    />
                    <div
                      className="min-w-0 cursor-pointer"
                      onClick={() => openMiniProfile(activePeer.id, activePeer)}
                    >
                      <div className="flex flex-wrap items-center gap-1.5">
                        <h2 className="text-sm font-extrabold text-slate-900 truncate">
                          {activePeer.displayName}
                        </h2>
                        <FemaleVerifiedBadge badge={activePeer.femaleVerifiedBadge} />
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                          <Crown className="w-3 h-3" />
                          Lv.{activePeer.level}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 truncate">
                        {activePeer.gender === 'female'
                          ? 'حساب نسائي · يحصل على الألماس عند الرد أو الهدايا'
                          : 'مضيف وكالة صوتية · يحصل على الألماس عند الرد أو الهدايا'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      disabled={togglingFollow}
                      onClick={handleToggleFollowPeer}
                      className={`min-h-[38px] rounded-xl px-3 py-1.5 text-xs font-extrabold border flex items-center gap-1 cursor-pointer transition disabled:opacity-50 ${
                        isMutualFriends
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                          : followRel.iFollowThem
                          ? 'bg-amber-50 border-amber-300 text-amber-800'
                          : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
                      }`}
                    >
                      {isMutualFriends ? (
                        <>
                          <UserCheck className="w-3.5 h-3.5" />
                          <span>أصدقاء 🤝</span>
                        </>
                      ) : followRel.iFollowThem ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>متابع ✓</span>
                        </>
                      ) : (
                        <>
                          <UserPlus className="w-3.5 h-3.5" />
                          <span>متابعة</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowGiftDrawer((prev) => !prev)}
                      className="gold-btn min-h-[38px] rounded-xl px-3 py-1.5 text-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <Gift className="w-4 h-4" />
                      <span>هدية</span>
                    </button>
                  </div>
                </div>

                {/* Clear Top Billing Status Banner */}
                {isMutualFriends ? (
                  <div className="mb-2.5 rounded-2xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-extrabold text-emerald-800 flex items-center justify-between gap-2">
                    <span>🤝 متابعة متبادلة (أصدقاء) — الرسائل مجانية بالكامل (0 كوين)</span>
                    <span className="rounded-full bg-emerald-600 text-white px-2 py-0.5 text-[10px] font-mono-num shrink-0">
                      0 كوين
                    </span>
                  </div>
                ) : (
                  <div className="mb-2.5 rounded-2xl border border-amber-200 bg-amber-50/90 px-3.5 py-2 text-[11px] sm:text-xs font-bold text-amber-900 flex items-center justify-between gap-2">
                    <span>
                      الرسائل مدفوعة ({pmCost} كوين/رسالة) - تصبح مجانية فور متابعة الطرفين لبعضهما
                    </span>
                    {!followRel.iFollowThem && (
                      <button
                        type="button"
                        onClick={handleToggleFollowPeer}
                        className="rounded-full bg-amber-500 text-white px-2.5 py-0.5 text-[10px] font-extrabold shrink-0 cursor-pointer hover:bg-amber-600"
                      >
                        + متابعة
                      </button>
                    )}
                  </div>
                )}

                {pendingInCurrentChat > 0 && (
                  <div className="mb-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-800">
                    💎 لديك {pendingInCurrentChat.toLocaleString('en-US')} ألماسة جاهزة — أرسل ردك الآن لتُضاف تلقائياً لمحفظتك!
                  </div>
                )}

                <div className="flex-1 overflow-y-auto no-scrollbar space-y-3 pl-1">
                  {!activeConversation || activeConversation.messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center px-6 space-y-2">
                      <MessageCircleHeart className="w-10 h-10 text-emerald-500" />
                      <p className="text-sm font-extrabold text-slate-800">
                        ابدأ محادثة خاصة مع {activePeer.displayName}
                      </p>
                      <p className="text-xs text-slate-500 max-w-md">
                        {isMutualFriends
                          ? 'أنتما أصدقاء بمتابعة متبادلة! الدردشة الخاصة بينكما مجانية بالكامل (0 كوين).'
                          : `الرسالة الخاصة بـ ${pmCost} كوينز وتصل ألماساتها فوراً للمستلم — وتتحول الدردشة إلى مجانية فوراً عند متابعة الطرفين لبعضهما.`}
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
                            className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs sm:text-sm border ${
                              m.giftId
                                ? 'bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-300 text-amber-950'
                                : isMine
                                ? 'bg-emerald-600 border-emerald-600 text-white'
                                : 'bg-slate-100 border-slate-200 text-slate-900'
                            }`}
                          >
                            {m.giftId && (
                              <div className="flex items-center gap-2 mb-1 text-xs font-extrabold text-amber-800">
                                <span className="text-xl">{m.giftGlyph}</span>
                                <span>{m.giftName}</span>
                              </div>
                            )}
                            <p className="leading-relaxed">{m.text}</p>
                            {(m.coinsPaid > 0 || m.diamondsPotential > 0) && (
                              <div
                                className={`mt-1.5 pt-1 border-t flex flex-wrap items-center gap-2 text-[10px] font-mono-num ${
                                  isMine
                                    ? 'border-white/20 text-emerald-50'
                                    : 'border-slate-200 text-slate-500'
                                }`}
                              >
                                {m.coinsPaid > 0 && (
                                  <span className="flex items-center gap-1">
                                    <Coins className="w-3 h-3" />
                                    {m.coinsPaid.toLocaleString('en-US')} كوينز
                                  </span>
                                )}
                                {m.diamondsPotential > 0 && (
                                  <span className="font-bold">
                                    {m.diamondsClaimed
                                      ? `💎 +${(m.diamondsAwarded || m.diamondsPotential).toLocaleString('en-US')} ألماسة ✓`
                                      : `💎 +${m.diamondsPotential.toLocaleString('en-US')} ألماسة عند الرد`}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={endRef} />
                </div>

                {showGiftDrawer && (
                  <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setGiftCategory('fixed')}
                          className={`rounded-xl px-3 py-1 text-xs font-bold cursor-pointer ${
                            giftCategory === 'fixed'
                              ? 'bg-emerald-600 text-white'
                              : 'bg-white text-slate-600 border border-slate-200'
                          }`}
                        >
                          هدايا ثابتة ({fixedGifts.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setGiftCategory('lucky')}
                          className={`rounded-xl px-3 py-1 text-xs font-bold cursor-pointer ${
                            giftCategory === 'lucky'
                              ? 'bg-emerald-600 text-white'
                              : 'bg-white text-slate-600 border border-slate-200'
                          }`}
                        >
                          هدايا الحظ ({luckyGifts.length})
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowGiftDrawer(false)}
                        className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
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
                          className="shrink-0 w-28 rounded-xl border border-slate-200 bg-white hover:border-emerald-400 p-2 text-center flex flex-col items-center gap-1 cursor-pointer disabled:opacity-50"
                        >
                          <span className="text-2xl">{g.glyph}</span>
                          <span className="text-[11px] font-bold text-slate-900 line-clamp-1">
                            {g.name}
                          </span>
                          <span className="text-[10px] font-mono-num text-amber-700 font-bold">
                            {g.coinsCost.toLocaleString('en-US')} 🪙
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <form onSubmit={(e) => handleSend(e)} className="mt-3 flex items-center gap-2">
                  <input
                    type="text"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder={
                      isMutualFriends
                        ? 'اكتب رسالتك المجانية الآن...'
                        : isFreeReply
                        ? 'أرسل ردك الآن لإضافة الألماس تلقائياً...'
                        : `اكتب رسالة خاصة (${pmCost} كوينز)...`
                    }
                    className="flex-1 rounded-2xl bg-slate-100 border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="submit"
                    disabled={sending || !text.trim()}
                    className="emerald-btn min-h-[42px] rounded-2xl px-4 text-xs font-extrabold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
                  >
                    <Send className="w-4 h-4" />
                    <span>
                      {isMutualFriends
                        ? 'إرسال مجاني'
                        : isFreeReply
                        ? 'رد واستلم 💎'
                        : `إرسال (${pmCost})`}
                    </span>
                  </button>
                </form>
              </>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center text-sm text-slate-400 gap-2">
                <Gem className="w-10 h-10 text-emerald-400" />
                <span>اختر محادثة أو عضواً لبدء المراسلة الخاصة</span>
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Community Rules Modal */}
      {showRulesModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4"
          onClick={() => setShowRulesModal(false)}
        >
          <div
            className="w-full max-w-md rounded-3xl bg-white border border-slate-200 p-6 space-y-4 shadow-2xl text-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <span>قواعد مجتمع صَدَى - SADA</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowRulesModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <ul className="space-y-2.5 text-xs sm:text-sm text-slate-700 leading-relaxed">
              <li>1. الالتزام بالاحترام المتبادل داخل جميع الوكالات الصوتية والرسائل الخاصة.</li>
              <li>2. يُمنع نشر الروابط الخارجية أو انتحال صفة المضيفين أو الإدارة.</li>
              <li>3. التوثيق الصوتي للحسابات النسائية يحمي الجميع ويُفعّل الألماس تلقائياً.</li>
              <li>4. جميع معاملات الشحن والسحب محمية عبر شبكة USDT TRC20 وإدارة صَدَى.</li>
            </ul>
            <button
              type="button"
              onClick={() => setShowRulesModal(false)}
              className="emerald-btn w-full min-h-[42px] rounded-2xl text-xs font-extrabold cursor-pointer"
            >
              فهمت، الحفاظ على الأجواء الجميلة
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
