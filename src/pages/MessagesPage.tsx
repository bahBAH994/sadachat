import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowRight,
  Check,
  CheckCheck,
  Coins,
  Crown,
  Gem,
  Image as ImageIcon,
  Ban,
  MessageCircle,
  MoreVertical,
  Plus,
  Search,
  Send,
  Smile,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserCheck,
  UserPlus,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useMiniProfile } from '../context/MiniProfileContext';
import {
  formatShortNumericId,
  genId,
  getCachedGiftCatalog,
  getUserVipTierInfo,
  makeConversationId,
} from '../lib/sadaCatalog';
import {
  getFollowStatus,
  getPmOverviewFromSupabase,
  markPrivateMessagesReadInSupabase,
  searchUsersForFriendInSupabase,
  sendPrivateMessageInSupabase,
  toggleFollowUserInSupabase,
} from '../lib/sadaSocialService';
import { supabase } from '../lib/supabase';
import type {
  GiftItem,
  PrivateConversation,
  PrivateConversationPeer,
  PrivateMessage,
  User,
} from '../types';
import { AvatarWithFrame, VipTierBadge, VipUserName } from '../components/AvatarWithFrame';
import { GenderBadge } from '../components/GenderBadge';
import { FemaleVerifiedBadge } from '../components/FemaleVoiceVerificationCard';
import { Fluent3DAsset } from '../components/Fluent3DAsset';

type InboxFilter = 'كامل' | 'غير مقروء' | 'وجوه مألوفة' | 'المجموعات';

const QUANTITIES = [1, 9, 25, 50, 100] as const;
const COMBO_DURATION_MS = 3000;
const BLOCKED_USERS_SETTING = 'userBlockedUsers';

async function getBlockedUserIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('sada_platform_state')
    .select('settings')
    .eq('id', 'global')
    .maybeSingle();
  if (error) throw new Error(error.message);

  const settings = data?.settings;
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return [];
  const blockedUsers = (settings as Record<string, unknown>)[BLOCKED_USERS_SETTING];
  if (!blockedUsers || typeof blockedUsers !== 'object' || Array.isArray(blockedUsers)) return [];
  const userBlocked = (blockedUsers as Record<string, unknown>)[userId];
  return Array.isArray(userBlocked)
    ? userBlocked.filter((blockedId): blockedId is string => typeof blockedId === 'string')
    : [];
}

async function saveBlockedUserIds(userId: string, blockedIds: string[]): Promise<void> {
  const { data, error: readError } = await supabase
    .from('sada_platform_state')
    .select('settings')
    .eq('id', 'global')
    .maybeSingle();
  if (readError) throw new Error(readError.message);

  const currentSettings = data?.settings;
  const settings =
    currentSettings && typeof currentSettings === 'object' && !Array.isArray(currentSettings)
      ? (currentSettings as Record<string, unknown>)
      : {};
  const currentBlockedUsers = settings[BLOCKED_USERS_SETTING];
  const blockedUsers =
    currentBlockedUsers && typeof currentBlockedUsers === 'object' && !Array.isArray(currentBlockedUsers)
      ? (currentBlockedUsers as Record<string, unknown>)
      : {};
  const nextSettings = {
    ...settings,
    [BLOCKED_USERS_SETTING]: { ...blockedUsers, [userId]: blockedIds },
  };
  const { error: saveError } = data
    ? await supabase.from('sada_platform_state').update({ settings: nextSettings }).eq('id', 'global')
    : await supabase.from('sada_platform_state').upsert({ id: 'global', settings: nextSettings });
  if (saveError) throw new Error(saveError.message);
}

function compressChatImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('تعذّرت قراءة الصورة المحددة.'));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('تعذّر فتح الصورة المحددة.'));
      image.onload = () => {
        const maxSide = 1280;
        const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext('2d');
        if (!context) {
          reject(new Error('تعذّر تجهيز الصورة للإرسال.'));
          return;
        }
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const compressed = canvas.toDataURL('image/jpeg', 0.78);
        if (compressed.length > 2_500_000) {
          reject(new Error('حجم الصورة بعد الضغط أكبر من الحد المسموح به.'));
          return;
        }
        resolve(compressed);
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

interface PmComboSession {
  gift: GiftItem;
  recipientId: string;
  quantity: number;
  comboCount: number;
  expiresAt: number;
}

const PrivateChatMessageItem = memo<{
  message: PrivateMessage;
  isMine: boolean;
  isFemaleRecipient: boolean;
  onImageClick: (image: string) => void;
}>(({ message: m, isMine, isFemaleRecipient, onImageClick }) => {
  const isImage = m.text.startsWith('data:image/');
  const displayText = isImage
    ? m.text
    : m.text.replace(/150 كوينز \+\d+ ألماسة/g, '').trim();
  return (
    <div className={`flex flex-col ${isMine ? 'items-start' : 'items-end'}`}>
      <div className="flex items-end gap-1.5">
        {(m.giftId || isImage || displayText) && (
          <div
            className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs sm:text-sm border ${
              m.giftId
                ? 'bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-300 text-amber-950'
                : isMine
                ? 'bg-emerald-700 border-emerald-700 text-white'
                : 'bg-slate-100 border-slate-200 text-slate-900'
            }`}
          >
            {m.giftId && (
              <div className="flex items-center gap-2 mb-1.5 text-xs font-extrabold text-amber-900">
                <Fluent3DAsset
                  glyph={m.giftGlyph || '🎁'}
                  alt={m.giftName || 'هدية'}
                  sizeClass="w-8 h-8"
                  fallbackTextClass="text-xl"
                />
                <span>{m.giftName}</span>
              </div>
            )}
            {isImage ? (
              <button
                type="button"
                onClick={() => onImageClick(m.text)}
                className="block cursor-zoom-in"
                aria-label="تكبير الصورة"
              >
                <img
                  src={m.text}
                  alt="صورة مرسلة في المحادثة"
                  className="max-h-64 max-w-full rounded-xl object-contain"
                />
              </button>
            ) : displayText ? (
              <p className="leading-relaxed">{displayText}</p>
            ) : null}
          </div>
        )}
        {!isMine && isFemaleRecipient && m.coinsPaid > 0 && m.diamondsAwarded > 0 && (
          <span className="mb-1 inline-flex shrink-0 items-center gap-0.5 rounded-full border border-sky-200 bg-white px-1.5 py-0.5 text-[10px] font-bold text-sky-700 shadow-sm">
            <Gem className="h-3 w-3" />
            {m.diamondsAwarded.toLocaleString('en-US')}
          </span>
        )}
      </div>
      {isMine && (
        <span
          className={`mr-1 mt-0.5 ${
            m.isRead
              ? 'text-sky-300 drop-shadow-[0_0_5px_rgba(56,189,248,0.8)]'
              : 'text-white/70 drop-shadow-[0_1px_1px_rgba(15,23,42,0.7)]'
          }`}
          aria-label={m.isRead ? 'تمت قراءة الرسالة' : 'تم إرسال الرسالة'}
        >
          <CheckCheck className="h-3.5 w-3.5" />
        </span>
      )}
    </div>
  );
});

const PmGiftItem = memo<{
  gift: GiftItem;
  active: boolean;
  onSelect: (giftId: string) => void;
}>(({ gift: g, active, onSelect }) => (
  <button
    type="button"
    onClick={() => onSelect(g.id)}
    className={`shrink-0 w-24 rounded-xl border p-2 text-center flex flex-col items-center gap-1 cursor-pointer transition ${
      active
        ? 'bg-[#362407] border-[#FCE9A6] shadow-[0_0_14px_rgba(243,211,122,0.45)]'
        : 'bg-white/5 border-white/10 hover:border-[#D4AF37]/50'
    }`}
  >
    <div className="relative w-11 h-11 flex items-center justify-center">
      <span
        aria-hidden="true"
        className={`absolute inset-1 rounded-full blur-sm ${
          active ? 'bg-amber-300/45' : 'bg-amber-400/15'
        }`}
      />
      <Fluent3DAsset
        glyph={g.glyph}
        imageUrl={g.imageUrl}
        alt={g.name}
        sizeClass="w-10 h-10"
        fallbackTextClass="text-2xl"
      />
    </div>
    <span className="text-[11px] font-bold text-white line-clamp-1">{g.name}</span>
    <span className="text-[10px] font-mono-num text-[#FCE9A6] font-extrabold inline-flex items-center gap-1">
      <Coins className="w-3 h-3 text-[#FCE9A6]" aria-label="كوينز" />
      <span>{g.coinsCost.toLocaleString('en-US')}</span>
    </span>
  </button>
));

export interface MessagesPageProps {
  embedded?: boolean;
  initialPeerId?: string;
  onCloseEmbedded?: () => void;
  onRechargeCoins?: () => void;
}

export const MessagesPage: React.FC<MessagesPageProps> = ({
  embedded = false,
  initialPeerId,
  onCloseEmbedded,
  onRechargeCoins,
}) => {
  const navigate = useNavigate();
  const { user, updateLocalUser, onlineUserIds } = useAuth();
  const { openMiniProfile } = useMiniProfile();
  const [searchParams, setSearchParams] = useSearchParams();

  const [conversations, setConversations] = useState<PrivateConversation[]>([]);
  const [recipients, setRecipients] = useState<PrivateConversationPeer[]>([]);
  const [gifts, setGifts] = useState<GiftItem[]>(() => getCachedGiftCatalog());
  const [pmCost, setPmCost] = useState(150);
  const [pendingDiamondsTotal, setPendingDiamondsTotal] = useState(0);
  const [userFollows, setUserFollows] = useState<Record<string, string[]>>({});
  const [blockedPeerIds, setBlockedPeerIds] = useState<string[]>([]);
  const [openConversationMenuId, setOpenConversationMenuId] = useState<string | null>(null);
  const [togglingFollow, setTogglingFollow] = useState(false);

  const [selectedPeerId, setSelectedPeerId] = useState<string | null>(initialPeerId || null);
  const privateMessageInputRef = useRef<HTMLInputElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [mobileChatOpen, setMobileChatOpen] = useState(Boolean(initialPeerId));
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isSmallViewport, setIsSmallViewport] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches
  );
  const [visualViewportRect, setVisualViewportRect] = useState(() => ({
    top: typeof window !== 'undefined' ? window.visualViewport?.offsetTop || 0 : 0,
    height: typeof window !== 'undefined' ? window.visualViewport?.height || window.innerHeight : 0,
  }));
  const [inboxFilter, setInboxFilter] = useState<InboxFilter>('كامل');
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [showSearchBar, setShowSearchBar] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Add Friend Modal State
  const [showAddFriendModal, setShowAddFriendModal] = useState(false);
  const [friendQuery, setFriendQuery] = useState('');
  const [friendResults, setFriendResults] = useState<User[]>([]);
  const [friendSearching, setFriendSearching] = useState(false);

  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  // Full-featured Gift Drawer & Combo State
  const [showGiftDrawer, setShowGiftDrawer] = useState(false);
  const [giftCategory, setGiftCategory] = useState<'fixed' | 'lucky'>('fixed');
  const [selectedGiftId, setSelectedGiftId] = useState<string>('gift_01');
  const [giftQuantity, setGiftQuantity] = useState<number>(1);
  const [comboSession, setComboSession] = useState<PmComboSession | null>(null);
  const [comboRemainingMs, setComboRemainingMs] = useState<number>(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [celebration, setCelebration] = useState<{
    title: string;
    subtitle: string;
  } | null>(null);

  const endRef = useRef<HTMLDivElement | null>(null);
  const messagesFeedRef = useRef<HTMLDivElement | null>(null);
  const hasLoadedOverviewRef = useRef(false);
  const longPressTimerRef = useRef<number | null>(null);
  const suppressConversationClickRef = useRef(false);
  const userRef = useRef(user);
  userRef.current = user;
  const queryTarget = !embedded ? searchParams.get('to') : null;
  const wantGift = !embedded && searchParams.get('gift') === '1';

  useEffect(() => {
    if (embedded) return;
    if (queryTarget && queryTarget !== user?.id) {
      setSelectedPeerId(queryTarget);
      setMobileChatOpen(true);
    } else {
      setSelectedPeerId(null);
      setMobileChatOpen(false);
    }
  }, [embedded, queryTarget, user?.id]);

  useEffect(() => {
    const updateViewport = () => {
      const viewport = window.visualViewport;
      window.scrollTo(0, 0);
      setIsSmallViewport(window.matchMedia('(max-width: 1023px)').matches);
      setVisualViewportRect({
        top: viewport?.offsetTop || 0,
        height: viewport?.height || window.innerHeight,
      });
    };
    updateViewport();
    window.visualViewport?.addEventListener('resize', updateViewport);
    window.visualViewport?.addEventListener('scroll', updateViewport);
    window.addEventListener('resize', updateViewport);
    return () => {
      window.visualViewport?.removeEventListener('resize', updateViewport);
      window.visualViewport?.removeEventListener('scroll', updateViewport);
      window.removeEventListener('resize', updateViewport);
    };
  }, []);

  const loadOverview = useCallback(async () => {
    const currentUser = userRef.current;
    if (!currentUser?.id) return;
    try {
      const data = await getPmOverviewFromSupabase(currentUser);
      const currentBlockedPeerIds = await getBlockedUserIds(currentUser.id);
      setConversations(data.conversations);
      setRecipients(data.recipients);
      setBlockedPeerIds(currentBlockedPeerIds);
      setGifts(data.gifts);
      setPmCost(data.pmMessageCost);
      setPendingDiamondsTotal(data.pendingDiamondsTotal);
      setUserFollows(data.userFollows || {});

      if (!embedded) {
        if (queryTarget && queryTarget !== currentUser.id) {
          setSelectedPeerId(queryTarget);
          setMobileChatOpen(true);
          if (wantGift) {
            setShowGiftDrawer(true);
          }
        } else {
          setSelectedPeerId(null);
          setMobileChatOpen(false);
        }
      } else if (initialPeerId && initialPeerId !== currentUser.id) {
        setSelectedPeerId(initialPeerId);
        setMobileChatOpen(true);
      } else if (!hasLoadedOverviewRef.current) {
        setSelectedPeerId(null);
        setMobileChatOpen(false);
      }
      hasLoadedOverviewRef.current = true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر تحميل الرسائل الخاصة.');
    } finally {
      setLoading(false);
    }
  }, [embedded, initialPeerId, queryTarget, user?.id, wantGift]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  useEffect(
    () => () => {
      if (longPressTimerRef.current !== null) {
        window.clearTimeout(longPressTimerRef.current);
      }
    },
    []
  );

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`sada-pm-${embedded ? 'emb-' : ''}${user.id}`)
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
  }, [embedded, user?.id, loadOverview]);

  // Combo circular countdown ticker (3.0s)
  useEffect(() => {
    if (!comboSession) {
      setComboRemainingMs(0);
      return;
    }
    const tick = () => {
      const left = comboSession.expiresAt - Date.now();
      if (left <= 0) {
        setComboSession(null);
        setComboRemainingMs(0);
      } else {
        setComboRemainingMs(left);
      }
    };
    tick();
    const timer = window.setInterval(tick, 50);
    return () => window.clearInterval(timer);
  }, [comboSession]);

  // Debounced friend search inside "إضافة صديق" modal
  useEffect(() => {
    if (!showAddFriendModal || !user?.id) return;
    setFriendSearching(true);
    const timer = window.setTimeout(() => {
      searchUsersForFriendInSupabase(user.id, friendQuery)
        .then((res) => setFriendResults(res))
        .catch(() => setFriendResults([]))
        .finally(() => setFriendSearching(false));
    }, 220);
    return () => window.clearTimeout(timer);
  }, [friendQuery, showAddFriendModal, user?.id]);

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
      if (
        inboxFilter === 'غير مقروء' &&
        !c.messages.some((m) => m.recipientId === user?.id && !m.isRead)
      ) return false;
      if (inboxFilter === 'وجوه مألوفة' && c.messages.length < 2) return false;
      if (q) {
        const numId = formatShortNumericId(c.peer.id).toLowerCase();
        if (
          !c.peer.displayName.toLowerCase().includes(q) &&
          !numId.includes(q)
        ) {
          return false;
        }
      }
      return true;
    }).slice().sort((a, b) =>
      Date.parse(b.lastMessage?.createdAt || '') - Date.parse(a.lastMessage?.createdAt || '')
    );
  }, [conversations, inboxFilter, searchQuery, user?.id]);

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
  const visibleGifts = giftCategory === 'lucky' ? luckyGifts : fixedGifts;
  const selectedGift = useMemo(
    () =>
      gifts.find((g) => g.id === selectedGiftId) ||
      visibleGifts[0] ||
      gifts[0] ||
      null,
    [gifts, selectedGiftId, visibleGifts]
  );

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const feed = messagesFeedRef.current;
      if (feed) {
        feed.scrollTop = feed.scrollHeight;
      }
      endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);

    return () => window.clearTimeout(timeout);
  }, [activeConversation?.messages, mobileChatOpen]);

  useEffect(() => {
    if (!user?.id || !selectedPeerId || !activeConversation) return;
    const hasUnreadIncoming = activeConversation.messages.some(
      (message) => message.recipientId === user.id && !message.isRead
    );
    if (!hasUnreadIncoming) return;

    void markPrivateMessagesReadInSupabase(user.id, activeConversation.id)
      .then(() => loadOverview())
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'تعذّر تحديث حالة قراءة الرسائل.');
      });
  }, [activeConversation, loadOverview, selectedPeerId, user?.id]);

  const handleSelectPeer = (peerId: string) => {
    setOpenConversationMenuId(null);
    setSelectedPeerId(peerId);
    setMobileChatOpen(true);
    if (!embedded) {
      setSearchParams({ to: peerId });
    }
    setError(null);
  };

  const handleRechargeAction = () => {
    setShowGiftDrawer(false);
    if (onRechargeCoins) {
      onRechargeCoins();
    } else {
      navigate('/wallet');
    }
  };

  const handleSend = async (
    e?: React.FormEvent,
    giftId?: string,
    qty = 1,
    comboCount = 1,
    messageText?: string
  ) => {
    if (e) e.preventDefault();
    if (sending || !user || !selectedPeerId) return;
    const outgoingText = messageText ?? text.trim();
    if (!giftId && !outgoingText) return;

    const peer = activePeer;
    const isChargeable = Boolean(
      user.gender === 'male' &&
        peer?.gender === 'female' &&
        !getFollowStatus(userFollows, user.id, peer.id).isMutual
    );
    const optimisticMessageId = !giftId ? genId('pm_pending') : null;
    const conversationId =
      activeConversation?.id || makeConversationId(user.id, selectedPeerId);
    const optimisticMessage: PrivateMessage | null =
      optimisticMessageId && peer
        ? {
            id: optimisticMessageId,
            conversationId,
            senderId: user.id,
            recipientId: selectedPeerId,
            text: outgoingText,
            coinsPaid: isChargeable ? pmCost : 0,
            diamondsPotential: 0,
            diamondsClaimed: false,
            diamondsAwarded: 0,
            isRead: false,
            createdAt: new Date().toISOString(),
            repliedAt: null,
          }
        : null;

    if (optimisticMessage) {
      setConversations((current) => {
        const existingConversation = current.find(
          (conversation) => conversation.peer.id === selectedPeerId
        );
        if (existingConversation) {
          return current.map((conversation) =>
            conversation.peer.id === selectedPeerId
              ? {
                  ...conversation,
                  messages: [...conversation.messages, optimisticMessage],
                  lastMessage: optimisticMessage,
                }
              : conversation
          );
        }
        return [
          {
            id: conversationId,
            peer,
            messages: [optimisticMessage],
            pendingDiamondsForMe: 0,
            lastMessage: optimisticMessage,
          },
          ...current,
        ];
      });
    }
    if (!giftId && !messageText) setText('');

    setSending(true);
    setError(null);
    try {
      const recipientBlockedIds = await getBlockedUserIds(selectedPeerId);
      if (recipientBlockedIds.includes(user.id)) {
        throw new Error('لا يمكنك إرسال رسائل إلى هذا المستخدم لأنه قام بحظرك.');
      }
      const res = await sendPrivateMessageInSupabase(user, {
        recipientId: selectedPeerId,
        text: giftId ? '' : outgoingText,
        giftId,
        quantity: qty,
        comboCount,
      });

      const { data: savedMessage, error: saveError } = await supabase
        .from('sada_private_messages')
        .select('id, conversation_id, sender_id, recipient_id, text')
        .eq('id', res.message.id)
        .maybeSingle();
      if (saveError) throw new Error(saveError.message);
      if (
        !savedMessage ||
        savedMessage.conversation_id !== res.message.conversationId ||
        savedMessage.sender_id !== user.id ||
        savedMessage.recipient_id !== selectedPeerId ||
        savedMessage.text !== res.message.text
      ) {
        throw new Error('تعذّر تأكيد حفظ الرسالة في المحادثة.');
      }

      updateLocalUser(res.user);
      if (optimisticMessage) {
        setConversations((current) =>
          current.map((conversation) =>
            conversation.peer.id === selectedPeerId
              ? {
                  ...conversation,
                  messages: conversation.messages.map((message) =>
                    message.id === optimisticMessageId ? res.message : message
                  ),
                  lastMessage:
                    conversation.lastMessage?.id === optimisticMessageId
                      ? res.message
                      : conversation.lastMessage,
                }
              : conversation
          )
        );
      }
      if (giftId) {
        setShowGiftDrawer(false);
        const sentGift = gifts.find((g) => g.id === giftId);
        if (sentGift) {
          setComboSession({
            gift: sentGift,
            recipientId: selectedPeerId,
            quantity: qty,
            comboCount,
            expiresAt: Date.now() + COMBO_DURATION_MS,
          });
          setComboRemainingMs(COMBO_DURATION_MS);
        }
      }
      void loadOverview();

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
      if (optimisticMessageId) {
        setConversations((current) =>
          current.flatMap((conversation) => {
            if (conversation.peer.id !== selectedPeerId) return [conversation];
            const messages = conversation.messages.filter(
              (message) => message.id !== optimisticMessageId
            );
            if (!messages.length && !activeConversation) return [];
            return [
              {
                ...conversation,
                messages,
                lastMessage: messages[messages.length - 1] || null,
              },
            ];
          })
        );
      }
      setError(err instanceof Error ? err.message : 'تعذّر إرسال الرسالة الخاصة.');
      setComboSession(null);
    } finally {
      setSending(false);
    }
  };

  const handleComboTap = async () => {
    if (!comboSession || !user) return;
    const batchCost = comboSession.gift.coinsCost * comboSession.quantity;
    if (user.coins < batchCost) {
      setComboSession(null);
      setError('رصيد الكوينز لا يكفي للاستمرار في الـ Combo');
      return;
    }
    const nextCombo = comboSession.comboCount + 1;
    const snap = comboSession;
    setComboSession({
      ...snap,
      comboCount: nextCombo,
      expiresAt: Date.now() + COMBO_DURATION_MS,
    });
    setComboRemainingMs(COMBO_DURATION_MS);
    await handleSend(undefined, snap.gift.id, snap.quantity, nextCombo);
  };

  const handleToggleFollowPeer = async (targetId?: string) => {
    const uid = targetId || activePeer?.id;
    if (!user?.id || !uid) return;
    setTogglingFollow(true);
    try {
      const next = await toggleFollowUserInSupabase(user.id, uid);
      setUserFollows(next.userFollows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر تحديث المتابعة.');
    } finally {
      setTogglingFollow(false);
    }
  };

  const handleDeleteConversation = async (conversation: PrivateConversation) => {
    try {
      const { error: deleteError } = await supabase
        .from('sada_private_messages')
        .delete()
        .eq('conversation_id', conversation.id);
      if (deleteError) throw new Error(deleteError.message);

      setConversations((current) => current.filter((item) => item.id !== conversation.id));
      setOpenConversationMenuId(null);
      if (selectedPeerId === conversation.peer.id) {
        setSelectedPeerId(null);
        setMobileChatOpen(false);
        if (!embedded) {
          setSearchParams((current) => {
            const next = new URLSearchParams(current);
            next.delete('to');
            next.delete('gift');
            return next;
          }, { replace: true });
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر حذف المحادثة.');
    }
  };

  const handleToggleBlockedPeer = async (peerId: string) => {
    if (!user?.id) return;
    const nextBlockedPeerIds = blockedPeerIds.includes(peerId)
      ? blockedPeerIds.filter((id) => id !== peerId)
      : [...blockedPeerIds, peerId];
    try {
      await saveBlockedUserIds(user.id, nextBlockedPeerIds);
      setBlockedPeerIds(nextBlockedPeerIds);
      setOpenConversationMenuId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر تحديث قائمة الحظر.');
    }
  };

  const startConversationLongPress = (conversationId: string) => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
    }
    suppressConversationClickRef.current = false;
    longPressTimerRef.current = window.setTimeout(() => {
      setOpenConversationMenuId(conversationId);
      suppressConversationClickRef.current = true;
      longPressTimerRef.current = null;
    }, 500);
  };

  const cancelConversationLongPress = () => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const pendingInCurrentChat = activeConversation?.pendingDiamondsForMe || 0;
  const followRel =
    user && activePeer
      ? getFollowStatus(userFollows, user.id, activePeer.id)
      : { iFollowThem: false, theyFollowMe: false, isMutual: false };
  const isMutualFriends = followRel.isMutual;
  const handleImageSelection = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('يرجى اختيار ملف صورة صالح.');
      return;
    }
    try {
      const compressed = await compressChatImage(file);
      await handleSend(undefined, undefined, 1, 1, compressed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر إرسال الصورة.');
    }
  };

  const giftTotalCost = selectedGift ? selectedGift.coinsCost * giftQuantity : 0;
  const canAffordGift = giftTotalCost <= (user?.coins ?? 0);

  const comboProgress = Math.max(0, Math.min(1, comboRemainingMs / COMBO_DURATION_MS));
  const comboCircleRadius = 29;
  const comboCircumference = 2 * Math.PI * comboCircleRadius;

  return (
    <div className="h-full min-h-0 flex flex-col overflow-hidden bg-[#F5F6FA]">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-100 pt-[max(env(safe-area-inset-top),32px)] shrink-0">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {embedded && onCloseEmbedded && (
              <button
                type="button"
                onClick={onCloseEmbedded}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 cursor-pointer"
                aria-label="إغلاق صندوق الوارد"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <h1 className="text-lg sm:text-xl font-extrabold text-slate-900">صندوق الوارد</h1>
          </div>

          <div className="flex items-center gap-2">
            {pendingDiamondsTotal > 0 && (
              <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-[11px] font-extrabold text-emerald-700 font-mono-num">
                +{pendingDiamondsTotal} 💎
              </span>
            )}
            <button
              type="button"
              onClick={() => setShowAddFriendModal(true)}
              className="inline-flex items-center gap-1 rounded-full bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 h-9 text-xs font-extrabold text-emerald-800 cursor-pointer transition"
              title="إضافة صديق بالاسم أو الـ ID"
            >
              <UserPlus className="w-4 h-4" />
              <span className="hidden sm:inline">إضافة صديق</span>
            </button>
            <button
              type="button"
              onClick={() => setShowSearchBar((prev) => !prev)}
              className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 cursor-pointer"
              title="بحث في المحادثات"
            >
              <Search className="w-4 h-4" />
            </button>
          </div>
        </div>

        {showSearchBar && (
          <div className="max-w-5xl mx-auto px-4 pb-3">
            <input
              ref={privateMessageInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث باسم العضو أو الـ ID في صندوق الوارد..."
              className="w-full rounded-2xl bg-slate-100 border border-slate-200 px-4 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
            />
          </div>
        )}
      </header>

      <div
        className={
          embedded
            ? 'flex-1 min-h-0 overflow-y-auto touch-pan-y px-3 py-3 space-y-3'
            : 'w-full max-w-5xl mx-auto flex-1 min-h-0 overflow-hidden px-3.5 sm:px-5 pt-3 flex flex-col gap-3'
        }
      >

        {/* Celebratory Diamond Banner */}
        <AnimatePresence>
          {celebration && (
            <motion.div
              initial={{ opacity: 0, y: -12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10 }}
              className="shrink-0 rounded-2xl border border-amber-300 bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-3 text-white shadow-lg flex items-center justify-between gap-3"
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
          <div className="shrink-0 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-semibold text-rose-700">
            {error}
          </div>
        )}

        {/* Main Split Layout */}
        <div className="grid flex-1 min-h-0 grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Inbox List Panel */}
          <aside
            className={`lg:col-span-5 min-h-0 flex flex-col gap-3 ${
              mobileChatOpen ? 'hidden lg:flex' : 'flex'
            }`}
          >
            {!embedded && (
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
            )}

            {/* Horizontal Users Strip (real online dots only) */}
            <div className="light-card rounded-2xl p-3">
              {recipients.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-2">
                  لا يوجد أعضاء مسجلون آخرون بعد.
                </p>
              ) : (
                <div className="flex items-center gap-3 overflow-x-auto touch-pan-x no-scrollbar pb-1">
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
                            vipTier={getUserVipTierInfo(rec).key}
                            size="md"
                            onClick={() => openMiniProfile(rec.id, rec)}
                          />
                          {live && (
                            <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-white z-20" />
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleSelectPeer(rec.id)}
                          className="rounded-full bg-sky-500 text-white px-2 py-0.5 text-[9px] font-extrabold cursor-pointer whitespace-nowrap"
                        >
                          🎙️ محادثة
                        </button>
                        <span className="inline-flex w-full items-center justify-center gap-1 text-[10px] font-bold text-slate-700 truncate">
                          {rec.displayName}
                          <GenderBadge gender={rec.gender} />
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Filter Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto touch-pan-x no-scrollbar">
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
            <div className="light-card flex-1 min-h-0 overflow-y-auto overscroll-y-contain touch-pan-y rounded-3xl divide-y divide-slate-100">
              {loading ? (
                <div className="p-6 text-center text-xs text-slate-400">
                  جارٍ تحميل المحادثات...
                </div>
              ) : filteredConversations.length === 0 ? (
                <div className="p-6 text-center space-y-2">
                  <p className="text-xs text-slate-500">
                    لا توجد محادثات خاصة بعد. اختر أي عضو أو اضغط "إضافة صديق" لبدء المراسلة!
                  </p>
                </div>
              ) : (
                filteredConversations.map((conv) => {
                  const active = conv.peer.id === selectedPeerId;
                  return (
                    <div
                      key={conv.id}
                      onClick={() => {
                        if (suppressConversationClickRef.current) {
                          suppressConversationClickRef.current = false;
                          return;
                        }
                        handleSelectPeer(conv.peer.id);
                      }}
                      onPointerDown={() => startConversationLongPress(conv.id)}
                      onPointerUp={cancelConversationLongPress}
                      onPointerLeave={cancelConversationLongPress}
                      onPointerCancel={cancelConversationLongPress}
                      onContextMenu={(event) => {
                        event.preventDefault();
                        cancelConversationLongPress();
                        setOpenConversationMenuId(conv.id);
                      }}
                      className={`relative p-3.5 flex items-center gap-3 cursor-pointer transition select-none ${
                        active ? 'bg-emerald-50/70' : 'hover:bg-slate-50'
                      }`}
                    >
                      <AvatarWithFrame
                        src={conv.peer.avatarUrl}
                        alt={conv.peer.displayName}
                        frameId={conv.peer.frameId}
                        vipTier={getUserVipTierInfo(conv.peer).key}
                        size="md"
                        onClick={() => openMiniProfile(conv.peer.id, conv.peer)}
                      />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                            <span className="text-sm font-extrabold text-slate-900 truncate">
                              <VipUserName name={conv.peer.displayName} vipTier={getUserVipTierInfo(conv.peer).key} />
                            </span>
                            <GenderBadge gender={conv.peer.gender} />
                            <VipTierBadge vipTier={getUserVipTierInfo(conv.peer).key} compact />
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
                          {conv.lastMessage?.text.startsWith('data:image/')
                            ? '📷 صورة'
                            : conv.lastMessage?.text || ''}
                        </p>
                      </div>
                      {blockedPeerIds.includes(conv.peer.id) && (
                        <span className="shrink-0 rounded-full bg-orange-50 px-2 py-1 text-[10px] font-bold text-orange-700">
                          محظور
                        </span>
                      )}
                      <button
                        type="button"
                        aria-label={`خيارات محادثة ${conv.peer.displayName}`}
                        aria-expanded={openConversationMenuId === conv.id}
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={(event) => {
                          event.stopPropagation();
                          cancelConversationLongPress();
                          setOpenConversationMenuId((current) =>
                            current === conv.id ? null : conv.id
                          );
                        }}
                        className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-100 cursor-pointer"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                      {openConversationMenuId === conv.id && (
                        <div
                          className="absolute right-3 top-full z-40 mt-1 flex w-36 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
                          onClick={(event) => event.stopPropagation()}
                          onPointerDown={(event) => event.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => void handleDeleteConversation(conv)}
                            className="flex items-center gap-2 px-3 py-2.5 text-right text-xs font-extrabold text-red-600 hover:bg-red-50 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                            حذف
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleToggleBlockedPeer(conv.peer.id)}
                            className="flex items-center gap-2 border-t border-slate-100 px-3 py-2.5 text-right text-xs font-extrabold text-orange-700 hover:bg-orange-50 cursor-pointer"
                          >
                            <Ban className="w-4 h-4" />
                            {blockedPeerIds.includes(conv.peer.id) ? 'فك الحظر' : 'حظر'}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </aside>

          {/* Active Conversation Window */}
          {(() => {
            if (embedded && !selectedPeerId) return null;
            const chatSection = (
          <section
            className={
              embedded
                ? 'light-card lg:col-span-7 h-[72dvh] max-h-[580px] min-h-0 overflow-hidden rounded-3xl px-3 pt-3 pb-2.5 sm:px-5 sm:pt-4 sm:pb-3 flex flex-col relative'
                : `fixed inset-x-0 z-[9999] flex flex-col bg-slate-50 overflow-hidden ${mobileChatOpen && activePeer ? 'flex' : 'hidden'}`
            }
            style={
              !embedded
                ? {
                    top: `${visualViewportRect.top}px`,
                    height: `${visualViewportRect.height}px`,
                  }
                : undefined
            }
          >
            {activePeer ? (
              <>
                <div className="shrink-0 bg-white border-b border-slate-200 px-3 py-2.5 flex items-center justify-between gap-2 z-20 pt-[max(env(safe-area-inset-top),32px)]">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <button
                      type="button"
                      onClick={() => {
                        setMobileChatOpen(false);
                        setShowEmojiPicker(false);
                        if (!embedded) {
                          setSearchParams((current) => {
                            const next = new URLSearchParams(current);
                            next.delete('to');
                            next.delete('gift');
                            return next;
                          }, { replace: true });
                        }
                      }}
                      className="lg:hidden w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 cursor-pointer shrink-0"
                    >
                      <ArrowRight className="w-4 h-4" />
                    </button>

                    <AvatarWithFrame
                      src={activePeer.avatarUrl}
                      alt={activePeer.displayName}
                      frameId={activePeer.frameId}
                      vipTier={getUserVipTierInfo(activePeer).key}
                      size="sm"
                      onClick={() => openMiniProfile(activePeer.id, activePeer)}
                    />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <h2 className="text-sm font-extrabold text-slate-900 truncate">
                          <VipUserName name={activePeer.displayName} vipTier={getUserVipTierInfo(activePeer).key} />
                        </h2>
                        <GenderBadge gender={activePeer.gender} />
                        <VipTierBadge vipTier={getUserVipTierInfo(activePeer).key} compact />
                        <FemaleVerifiedBadge badge={activePeer.femaleVerifiedBadge} />
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                          <Crown className="w-3 h-3" />
                          Lv.{activePeer.level}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 truncate">
                        {activePeer.gender === 'female'
                          ? 'حساب نسائي · يحصل على الألماس فوراً من الرسائل والهدايا'
                          : 'عضو صَدَى · يستقبل الهدايا والألماس'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      disabled={togglingFollow}
                      onClick={() => void handleToggleFollowPeer()}
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

                  </div>
                </div>

                {pendingInCurrentChat > 0 && (
                  <div className="mb-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-800 shrink-0">
                    💎 لديك {pendingInCurrentChat.toLocaleString('en-US')} ألماسة جاهزة — أرسل ردك الآن لتُضاف تلقائياً لمحفظتك!
                  </div>
                )}

                {/* Messages Feed */}
                <div ref={messagesFeedRef} className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain p-3 space-y-2">
                  {!activeConversation || activeConversation.messages.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-center px-6">
                      <p className="text-sm font-extrabold text-slate-800">
                        ابدأ محادثة خاصة مع {activePeer.displayName}
                      </p>
                    </div>
                  ) : (
                    activeConversation.messages.map((m) => (
                      <PrivateChatMessageItem
                        key={m.id}
                        message={m}
                        isMine={m.senderId === user?.id}
                        isFemaleRecipient={user?.gender === 'female'}
                        onImageClick={setZoomedImage}
                      />
                    ))
                  )}
                  <div ref={endRef} />
                </div>

                {/* Full-Featured Private Gift Drawer (with Quantities, Bottom-Left Balance + Recharge, & Combo) */}
                <AnimatePresence>
                  {showGiftDrawer && (
                    <motion.div
                      initial={{ opacity: 0, y: 14 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 14 }}
                      className="mt-2 rounded-2xl border border-[#D4AF37]/45 bg-[#120E08] text-white p-3 space-y-2.5 shadow-xl shrink-0"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setGiftCategory('fixed');
                              if (fixedGifts[0]) setSelectedGiftId(fixedGifts[0].id);
                            }}
                            className={`rounded-xl px-3 py-1 text-[11px] font-extrabold cursor-pointer transition ${
                              giftCategory === 'fixed'
                                ? 'bg-gradient-to-r from-[#FCE9A6] to-[#D4AF37] text-[#070913]'
                                : 'bg-white/10 text-slate-300'
                            }`}
                          >
                            هدايا 3D ({fixedGifts.length})
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setGiftCategory('lucky');
                              if (luckyGifts[0]) setSelectedGiftId(luckyGifts[0].id);
                            }}
                            className={`rounded-xl px-3 py-1 text-[11px] font-extrabold cursor-pointer transition ${
                              giftCategory === 'lucky'
                                ? 'bg-gradient-to-r from-[#FCE9A6] to-[#D4AF37] text-[#070913]'
                                : 'bg-white/10 text-slate-300'
                            }`}
                          >
                            هدايا الحظ 🎰 ({luckyGifts.length})
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowGiftDrawer(false)}
                          className="w-7 h-7 rounded-full bg-white/10 text-slate-300 hover:text-white flex items-center justify-center cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="flex items-center gap-2 overflow-x-auto touch-pan-x no-scrollbar pb-1">
                        {visibleGifts.map((g) => (
                          <PmGiftItem
                            key={g.id}
                            gift={g}
                            active={selectedGift?.id === g.id}
                            onSelect={setSelectedGiftId}
                          />
                        ))}
                      </div>

                      {selectedGift && (
                        <div className="pt-2 border-t border-white/10 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1 overflow-x-auto touch-pan-x no-scrollbar">
                              {QUANTITIES.map((qty) => (
                                <button
                                  key={qty}
                                  type="button"
                                  onClick={() => setGiftQuantity(qty)}
                                  className={`min-w-[40px] h-7 px-2 rounded-full text-[11px] font-mono-num font-extrabold cursor-pointer shrink-0 ${
                                    giftQuantity === qty
                                      ? 'bg-gradient-to-r from-[#FCE9A6] to-[#D4AF37] text-[#070913]'
                                      : 'bg-white/10 text-slate-200 border border-white/10'
                                  }`}
                                >
                                  ×{qty}
                                </button>
                              ))}
                            </div>
                            <span
                              className={`text-xs font-mono-num font-extrabold shrink-0 inline-flex items-center gap-1 ${
                                canAffordGift ? 'text-[#FCE9A6]' : 'text-rose-400'
                              }`}
                            >
                              <span>الإجمالي:</span>
                              <Coins className="w-3.5 h-3.5 text-[#FCE9A6]" aria-label="كوينز" />
                              <span>{giftTotalCost.toLocaleString('en-US')}</span>
                            </span>
                          </div>

                          <div className="flex items-center justify-between gap-2">
                            <button
                              type="button"
                              disabled={sending || !canAffordGift}
                              onClick={() =>
                                void handleSend(undefined, selectedGift.id, giftQuantity, 1)
                              }
                              className={`flex-1 min-h-[40px] rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 px-3 cursor-pointer transition ${
                                canAffordGift
                                  ? 'bg-gradient-to-r from-[#FDE047] via-[#D4AF37] to-[#B45309] text-[#070913] shadow-[0_0_16px_rgba(243,211,122,0.5)]'
                                  : 'bg-rose-950/70 border border-rose-400/40 text-rose-200 cursor-not-allowed'
                              }`}
                            >
                              <Sparkles className="w-3.5 h-3.5" />
                              {canAffordGift && !sending && (
                                <Fluent3DAsset
                                  glyph={selectedGift.glyph}
                                  imageUrl={selectedGift.imageUrl}
                                  alt={selectedGift.name}
                                  sizeClass="w-5 h-5"
                                  priority
                                />
                              )}
                              <span className="truncate">
                                {sending
                                  ? 'جارٍ الإرسال...'
                                  : !canAffordGift
                                  ? 'رصيد الكوينز غير كافٍ'
                                  : `إرسال ${selectedGift.name} ×${giftQuantity}`}
                              </span>
                            </button>

                            {/* Bottom-Left Real Coins Balance + (+) Quick Recharge */}
                            <button
                              type="button"
                              onClick={handleRechargeAction}
                              className="flex items-center gap-1.5 rounded-xl bg-black/70 border border-[#F3D37A]/50 px-2.5 py-1.5 shrink-0 cursor-pointer hover:border-[#FCE9A6]"
                              title="رصيدك الحالي · اضغط للشحن السريع"
                            >
                              <Coins className="w-3.5 h-3.5 text-[#FCE9A6]" aria-label="كوينز" />
                              <span className="text-xs font-mono-num font-black text-[#FCE9A6]">
                                {(user?.coins ?? 0).toLocaleString('en-US')}
                              </span>
                              <span className="w-5 h-5 rounded-full bg-gradient-to-br from-[#FDE047] to-[#D4AF37] text-[#070913] flex items-center justify-center">
                                <Plus className="w-3 h-3 stroke-[3]" />
                              </span>
                            </button>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="shrink-0 bg-white border-t border-slate-200 p-2.5 pb-4">
                  {showEmojiPicker && (
                    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-2">
                      {['😊', '😂', '😍', '🥰', '👍', '👏', '❤️', '🔥'].map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => setText((current) => `${current}${emoji}`)}
                          className="w-9 h-9 rounded-xl hover:bg-slate-100 text-xl cursor-pointer shrink-0"
                          aria-label={`إضافة ${emoji}`}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}
                  <form
                    onSubmit={(e) => handleSend(e)}
                    className="flex items-center gap-2"
                  >
                    <input
                      ref={imageInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(event) => void handleImageSelection(event)}
                    />
                    <button
                      type="submit"
                      disabled={sending || !text.trim()}
                      className="min-h-[40px] rounded-2xl bg-emerald-800 hover:bg-emerald-900 border border-emerald-700 text-white px-3 text-xs font-extrabold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0 shadow-sm transition"
                    >
                      <Send className="w-4 h-4" />
                      <span>إرسال</span>
                    </button>
                    <input
                      type="text"
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      onFocus={() => {
                        setShowEmojiPicker(false);
                        window.scrollTo(0, 0);
                        const viewport = window.visualViewport;
                        setVisualViewportRect({
                          top: viewport?.offsetTop || 0,
                          height: viewport?.height || window.innerHeight,
                        });
                      }}
                      placeholder="اكتب رسالة..."
                      className="flex-1 min-w-0 rounded-2xl bg-slate-100 border border-slate-200 px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-700"
                    />
                    <div className="flex items-center gap-2 shrink-0" dir="rtl">
                      <button
                        type="button"
                        onClick={() => {
                          privateMessageInputRef.current?.blur();
                          setShowEmojiPicker((current) => !current);
                        }}
                        className={`w-10 h-10 rounded-xl flex items-center justify-center cursor-pointer shrink-0 ${
                          showEmojiPicker ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                        }`}
                        aria-label="اختيار سمايل"
                        aria-expanded={showEmojiPicker}
                      >
                        <Smile className="w-5 h-5" />
                      </button>
                      <button
                        type="button"
                        disabled={sending}
                        onClick={() => imageInputRef.current?.click()}
                        className="w-10 h-10 rounded-xl flex items-center justify-center cursor-pointer shrink-0 bg-slate-100 text-slate-600 disabled:opacity-50"
                        aria-label="رفع صورة من الاستوديو"
                      >
                        <ImageIcon className="w-5 h-5" />
                      </button>
                    </div>
                  </form>
                </div>

                {/* 3.0s Circular Combo Button inside Private Chat */}
                <AnimatePresence>
                  {comboSession &&
                    comboSession.recipientId === activePeer.id &&
                    comboRemainingMs > 0 && (
                      <motion.button
                        type="button"
                        initial={{ scale: 0.3, opacity: 0 }}
                        animate={{ scale: [1, 1.06, 1], opacity: 1 }}
                        exit={{ scale: 0.4, opacity: 0 }}
                        transition={{ scale: { repeat: Infinity, duration: 1.0 } }}
                        onClick={() => void handleComboTap()}
                        className="absolute left-4 bottom-[66px] z-20 w-[68px] h-[68px] rounded-full flex items-center justify-center cursor-pointer active:scale-90 select-none"
                        title="اضغط للاستمرار في إرسال الهدية (Combo)"
                      >
                        <svg
                          width={68}
                          height={68}
                          className="absolute inset-0 w-full h-full -rotate-90 drop-shadow-[0_0_12px_rgba(251,191,36,0.85)]"
                          viewBox="0 0 68 68"
                        >
                          <circle
                            cx="34"
                            cy="34"
                            r={comboCircleRadius}
                            fill="rgba(22, 16, 8, 0.92)"
                            stroke="rgba(255,255,255,0.2)"
                            strokeWidth="4.5"
                          />
                          <circle
                            cx="34"
                            cy="34"
                            r={comboCircleRadius}
                            fill="none"
                            stroke="#FDE047"
                            strokeWidth="4.5"
                            strokeLinecap="round"
                            strokeDasharray={comboCircumference}
                            strokeDashoffset={comboCircumference * (1 - comboProgress)}
                          />
                        </svg>
                        <div className="relative flex flex-col items-center justify-center text-center leading-none">
                          <Fluent3DAsset
                            glyph={comboSession.gift.glyph}
                            imageUrl={comboSession.gift.imageUrl}
                            alt={comboSession.gift.name}
                            sizeClass="w-6 h-6"
                            priority
                          />
                          <span className="mt-0.5 text-[9px] font-mono-num font-extrabold text-[#FDE047]">
                            Combo ×{comboSession.comboCount}
                          </span>
                          <span className="text-[8px] font-mono-num text-amber-200/85">
                            {(comboRemainingMs / 1000).toFixed(1)}s
                          </span>
                        </div>
                      </motion.button>
                    )}
                </AnimatePresence>
              </>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center text-sm text-slate-400 gap-2">
                <Gem className="w-10 h-10 text-emerald-400" />
                <span>اختر محادثة أو عضواً لبدء المراسلة الخاصة</span>
              </div>
            )}
          </section>
            );
            return !embedded && mobileChatOpen && activePeer
              ? createPortal(chatSection, document.body)
              : chatSection;
          })()}
        </div>
      </div>

      <AnimatePresence>
        {zoomedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/90 p-4"
            onClick={() => setZoomedImage(null)}
          >
            <button
              type="button"
              onClick={() => setZoomedImage(null)}
              className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white"
              aria-label="إغلاق الصورة"
            >
              <X className="h-5 w-5" />
            </button>
            <img
              src={zoomedImage}
              alt="صورة المحادثة مكبرة"
              className="max-h-full max-w-full rounded-xl object-contain"
              onClick={(event) => event.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Friend Search Modal (Search Supabase Users by Name or Numeric ID) */}
      <AnimatePresence>
        {showAddFriendModal && (
          <div
            className="fixed inset-0 z-[75] flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-sm p-0 sm:p-4"
            onClick={() => setShowAddFriendModal(false)}
          >
            <motion.div
              initial={{ y: 36, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 36, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl bg-white border border-slate-200 p-5 space-y-4 shadow-2xl text-slate-900 max-h-[82dvh] flex flex-col"
            >
              <div className="flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <UserPlus className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900">إضافة صديق جديد</h3>
                    <p className="text-[11px] text-slate-500">
                      ابحث بالاسم أو رقم الـ ID لإرسال متابعة أو بدء محادثة
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddFriendModal(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="relative shrink-0">
                <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={friendQuery}
                  onChange={(e) => setFriendQuery(e.target.value)}
                  placeholder="اكتب الاسم أو رقم الـ ID..."
                  className="w-full rounded-2xl bg-slate-100 border border-slate-200 pr-10 pl-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar space-y-2">
                {friendSearching ? (
                  <p className="text-xs text-slate-400 text-center py-8">
                    جارٍ البحث في قاعدة الأعضاء...
                  </p>
                ) : friendResults.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-8">
                    لم يتم العثور على أعضاء مطابقين لبحثك.
                  </p>
                ) : (
                  friendResults.map((u) => {
                    const rel = user
                      ? getFollowStatus(userFollows, user.id, u.id)
                      : { iFollowThem: false, theyFollowMe: false, isMutual: false };
                    return (
                      <div
                        key={u.id}
                        className="rounded-2xl border border-slate-200 bg-slate-50 p-3 flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <AvatarWithFrame
                            src={u.avatarUrl}
                            alt={u.displayName}
                            frameId={u.frameId}
                            vipTier={getUserVipTierInfo(u).key}
                            size="sm"
                            onClick={() => openMiniProfile(u.id, u)}
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs sm:text-sm font-extrabold text-slate-900 truncate">
                                <VipUserName name={u.displayName} vipTier={getUserVipTierInfo(u).key} />
                              </span>
                              <GenderBadge gender={u.gender} />
                              <VipTierBadge vipTier={getUserVipTierInfo(u).key} compact />
                              <FemaleVerifiedBadge badge={u.femaleVerifiedBadge} />
                            </div>
                            <p className="text-[10px] font-mono-num text-slate-500">
                              ID: {formatShortNumericId(u.id)} · Lv.{u.level}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            disabled={togglingFollow}
                            onClick={() => void handleToggleFollowPeer(u.id)}
                            className={`min-h-[34px] rounded-xl px-2.5 text-[11px] font-extrabold border cursor-pointer ${
                              rel.isMutual
                                ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                                : rel.iFollowThem
                                ? 'bg-amber-50 border-amber-300 text-amber-800'
                                : 'bg-white border-slate-200 text-slate-700 hover:border-emerald-400'
                            }`}
                          >
                            {rel.isMutual
                              ? 'أصدقاء 🤝'
                              : rel.iFollowThem
                              ? 'متابَع ✓'
                              : '+ إضافة'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setShowAddFriendModal(false);
                              handleSelectPeer(u.id);
                            }}
                            className="min-h-[34px] rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white px-2.5 text-[11px] font-extrabold flex items-center gap-1 cursor-pointer"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span>دردشة</span>
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Community Rules Modal */}
      {!embedded && showRulesModal && (
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
