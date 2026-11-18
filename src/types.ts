export type AssetKey =
  | 'royal_stage'
  | 'competition_crest'
  | 'host_male'
  | 'host_female'
  | 'emblem';

export interface User {
  id: string;
  email: string;
  displayName: string;
  bio: string;
  avatarUrl: string;
  gender?: 'female' | 'male';
  age?: number;
  country?: string;
  femaleVoiceStatus?: 'none' | 'unverified' | 'pending' | 'verified' | 'rejected';
  femaleVerified?: boolean;
  femaleVerifiedBadge?: string | null;
  femaleVoiceNote?: string | null;
  isHost?: boolean;
  isAgent?: boolean;
  agencyId?: string | null;
  hostBadge?: string | null;
  hostAgencyName?: string | null;
  hostDiamondsEarned?: number;
  referralCode?: string;
  referredBy?: string | null;
  referralCount?: number;
  referralSpins?: number;
  frameId: string;
  unlockedFrames: string[];
  previousPermanentFrameId?: string | null;
  tempFrameId?: string | null;
  tempFrameExpiresAt?: string | null;
  activeEntryId?: 'entry_car_15d' | 'entry_legendary_30d' | null;
  activeEntryName?: string | null;
  tempEntryExpiresAt?: string | null;
  coins: number;
  diamonds: number;
  level: number;
  xp: number;
  is_admin: boolean;
  is_banned: boolean;
  device_uuid: string;
  createdAt: string;
  lastSeen: string;
}

export interface RoomEntryEvent {
  userId: string;
  displayName: string;
  avatarUrl: string;
  frameId: string;
  level: number;
  entryId: 'entry_car_15d' | 'entry_legendary_30d';
  entryName: string;
  timestamp: string;
}

export interface RoomSeat {
  seatIndex: number;
  userId: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  frameId: string | null;
  level: number | null;
  isMuted: boolean;
  isLocked: boolean;
  isSpeaking: boolean;
  receivedDiamonds: number;
  femaleVerifiedBadge?: string | null;
}

export interface RoomMessage {
  id: string;
  userId: string;
  displayName: string;
  level: number;
  isAdmin: boolean;
  vipTier?: string;
  hostBadge?: string | null;
  femaleVerifiedBadge?: string | null;
  text: string;
  type: 'chat' | 'system' | 'gift' | 'wheel' | 'entry';
  timestamp: string;
}

export interface LuckyWheelSegment {
  id: string;
  label: string;
  shortLabel: string;
  rewardType: 'coins' | 'frame' | 'xp';
  coinsAmount?: number;
  xpAmount?: number;
  frameId?: string;
  glyph: string;
}

export interface LuckyWheelResult {
  segmentIndex: number;
  segment: LuckyWheelSegment;
  user: User;
  room: Room;
  message: RoomMessage;
}

export interface RoomMusicState {
  isPlaying: boolean;
  trackName: string;
  djUserId: string;
  djName: string;
  sourceType: 'file';
  audioDataUrl?: string | null;
  updatedAt: number;
}

export interface RoomGifterEntry {
  userId: string;
  displayName: string;
  avatarUrl: string;
  frameId?: string;
  totalCoins: number;
}

export interface RoomPlayerEntry {
  userId: string;
  displayName: string;
  avatarUrl: string;
  frameId?: string;
  playCoins: number;
}

export type RoomModLogActionType =
  | 'kick_room'
  | 'unban_room'
  | 'kick_seat'
  | 'mute_user'
  | 'mute_all'
  | 'clear_all'
  | 'lock_seat'
  | 'unlock_seat';

export interface RoomModLogEntry {
  id: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  actionType: RoomModLogActionType;
  targetUserId?: string;
  targetName?: string;
  details: string;
  timestamp: string;
}

export interface RoomContestEntry {
  userId: string;
  displayName: string;
  avatarUrl: string;
  frameId?: string;
  votes: number;
  note?: string;
  joinedAt: string;
}

export interface RoomLiveContest {
  id: string;
  title: string;
  mode: 'open' | 'mics' | 'qa';
  prizeLabel: string;
  hostId: string;
  hostName: string;
  status: 'active' | 'ended';
  entries: RoomContestEntry[];
  voterIds: string[];
  winnerUserId?: string | null;
  winnerName?: string | null;
  createdAt: string;
  endedAt?: string | null;
}

export interface RoomExtrasConfig {
  deputyIds: string[];
  moderatorIds: string[];
  kickedUserIds: string[];
  kickedUserNames?: Record<string, string>;
  mutedUserIds: string[];
  gifters: Record<string, RoomGifterEntry>;
  players?: Record<string, RoomPlayerEntry>;
  modLogs?: RoomModLogEntry[];
  playVolumeCoins: number;
  musicState?: RoomMusicState | null;
  activeContest?: RoomLiveContest | null;
}

export interface Room {
  id: string;
  title: string;
  category: 'مسابقات' | 'شعر وأدب' | 'طرب' | 'حوار';
  description: string;
  hostId: string;
  hostName: string;
  hostAvatar: string;
  coverImage: string;
  isPrivate: boolean;
  hasPassword?: boolean;
  maxSeats: number;
  seats: RoomSeat[];
  listenersCount: number;
  isActive: boolean;
  totalGiftsCoins: number;
  createdAt: string;
  messages: RoomMessage[];
}

export interface Contestant {
  id: string;
  userId: string;
  displayName: string;
  avatarUrl: string;
  level: number;
  performanceTitle: string;
  votes: number;
  giftScore: number;
}

export interface Competition {
  id: string;
  title: string;
  subtitle: string;
  category: string;
  status: 'live' | 'upcoming' | 'ended';
  prizeCoins: number;
  prizeDiamonds: number;
  bannerImage: string;
  endsAt: string;
  winnerId: string | null;
  contestants: Contestant[];
}

export interface Transaction {
  id: string;
  userId: string;
  type:
    | 'topup'
    | 'usdt_deposit'
    | 'usdt_withdrawal'
    | 'usdt_withdrawal_refund'
    | 'gift_sent'
    | 'gift_received'
    | 'lucky_gift_bonus'
    | 'pm_sent'
    | 'pm_reply_diamond'
    | 'agency_commission'
    | 'quiz_reward'
    | 'referral_wheel'
    | 'vote'
    | 'store_purchase'
    | 'convert'
    | 'admin_grant'
    | 'prize'
    | 'slot_spin'
    | 'slot_win'
    | 'game_bet'
    | 'game_win';
  amount: number;
  currency: 'coins' | 'diamonds';
  description: string;
  timestamp: string;
}

export interface GiftItem {
  id: string;
  name: string;
  coinsCost: number;
  diamondsValue: number;
  xpGain: number;
  tier: 'classic' | 'royal' | 'imperial';
  category?: 'fixed' | 'lucky' | 'royal';
  glyph: string;
}

export interface PrivateMessage {
  id: string;
  conversationId: string;
  senderId: string;
  recipientId: string;
  text: string;
  coinsPaid: number;
  diamondsPotential: number;
  diamondsClaimed: boolean;
  diamondsAwarded: number;
  giftId?: string;
  giftName?: string;
  giftGlyph?: string;
  createdAt: string;
  repliedAt?: string | null;
}

export interface PrivateConversationPeer {
  id: string;
  displayName: string;
  avatarUrl: string;
  frameId: string;
  level: number;
  gender?: 'female' | 'male';
  age?: number;
  country?: string;
  femaleVerified?: boolean;
  femaleVerifiedBadge?: string | null;
  isHost?: boolean;
  is_admin: boolean;
  bio: string;
  lastSeen?: string;
}

export interface PrivateConversation {
  id: string;
  peer: PrivateConversationPeer;
  messages: PrivateMessage[];
  pendingDiamondsForMe: number;
  lastMessage: PrivateMessage | null;
}

export interface AgencyHostSummary {
  id: string;
  displayName: string;
  avatarUrl: string;
  frameId: string;
  level: number;
  gender?: 'female' | 'male';
  diamonds: number;
  hostDiamondsEarned: number;
  weeklyDiamonds: number;
  hostBadge: string;
  lastSeen: string;
}

export interface HostJoinApplication {
  id: string;
  userId: string;
  displayName: string;
  avatarUrl: string;
  frameId: string;
  agencyId: string;
  agencyName: string;
  agencyOwnerId: string;
  bio: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  reviewedAt?: string | null;
}

export interface HostTaskProgress {
  streakDays: number;
  lastCheckInDate: string | null;
  claimedDay7: boolean;
  claimedDay15: boolean;
}

export interface UserGiftStats {
  sentCoins: number;
  receivedCoins: number;
}

export interface Agency {
  id: string;
  name: string;
  description: string;
  code: string;
  ownerId: string;
  ownerName: string;
  ownerAvatar: string;
  commissionRate: number;
  totalCommissionDiamonds: number;
  totalHostDiamonds: number;
  hostIds: string[];
  status?: 'approved' | 'pending' | 'suspended';
  createdAt: string;
}

export interface LuckyGiftMultiplierSetting {
  multiplier: number;
  weight: number;
}

export interface RechargeRewardTierSetting {
  id: string;
  minUsdt: number;
  days: number;
  frameId: string;
  frameName: string;
  entryId: 'entry_car_15d' | 'entry_legendary_30d' | null;
  entryName: string | null;
  bonusRate: number;
  label: string;
}

export interface RoomWheelSegmentSetting extends LuckyWheelSegment {
  weight: number;
}

export interface GameWinRatesSettings {
  slotsWinRate: number;
  doubleDiceWinRate: number;
  predictionDiceWinRate: number;
  ladderDiceWinRate: number;
  speedDiceWinRate: number;
  rouletteWinRate: number;
  mysteryBoxWinRate: number;
}

export interface PlatformSettings {
  usdtToCoinsRate: number;
  coinsPerUsdtWithdraw: number;
  diamondsPerUsdt: number;
  diamondToCoinsRate: number;
  defaultAgencyCommissionRate: number;
  minAgencyCommissionRate: number;
  maxAgencyCommissionRate: number;
  pmMessageCost: number;
  pmReplyDiamonds: number;
  giftDiamondsRatio: number;
  roomWheelCost: number;
  roomWheelSegments: RoomWheelSegmentSetting[];
  luckyGiftMultipliers: LuckyGiftMultiplierSetting[];
  rechargeRewardTiers: RechargeRewardTierSetting[];
  gameRates?: GameWinRatesSettings;
  roomConfigs?: Record<string, RoomExtrasConfig>;
  userFollows?: Record<string, string[]>;
  userVisitors?: Record<string, string[]>;
  userMeta?: Record<string, { age?: number; country?: string }>;
  userFollowedAgencies?: Record<string, string[]>;
  userOwnedBackgrounds?: Record<string, string[]>;
  userHostTasks?: Record<string, HostTaskProgress>;
  userGiftStats?: Record<string, UserGiftStats>;
  hostJoinApplications?: HostJoinApplication[];
  globalZeroResetV1Applied?: boolean;
}

export interface CulturalQuestionAdminItem {
  id: string;
  category: string;
  question: string;
  options: [string, string, string, string];
  correctIndex: number;
  xpReward: number;
  coinsReward: number;
}

export interface CulturalQuizRound {
  roundId: string;
  category: string;
  question: string;
  options: [string, string, string, string];
  xpReward: number;
  coinsReward: number;
  timeLimitSeconds: number;
  expiresAt: number;
}

export interface CulturalQuizResult {
  isCorrect: boolean;
  timedOut?: boolean;
  correctIndex: number;
  xpGained: number;
  coinsGained: number;
  user: User;
}

export interface ReferralWheelSegment {
  id: string;
  label: string;
  shortLabel: string;
  coinsAmount: number;
  glyph: string;
  weight: number;
}

export interface ReferralWheelResult {
  segmentIndex: number;
  segment: ReferralWheelSegment;
  user: User;
  appPrizePoolCoins: number;
}

export interface FrameItem {
  id: string;
  name: string;
  description: string;
  priceCoins: number;
  minLevel: number;
  ringClass: string;
  isTemporary?: boolean;
}

export interface Store3DItem {
  id: string;
  name: string;
  subtitle: string;
  kind: 'frame_and_entry' | 'frame';
  minRechargeCoins: number;
  priceCoins?: number;
  purchaseMode?: 'recharge' | 'coins' | 'gift';
  giftHint?: string;
  badgeGlyph: string;
  entryId?: 'entry_car_15d' | 'entry_legendary_30d';
  entryName?: string;
  previewGradient: string;
  ringClass: string;
}

export interface StoreBackgroundItem {
  id: string;
  name: string;
  subtitle: string;
  priceCoins: number;
  badgeGlyph: string;
  previewClass: string;
}

export interface UsdtDepositRequest {
  id: string;
  userId: string;
  userEmail: string;
  userDisplayName: string;
  amountUsdt: number;
  coinsCredited: number;
  txId: string;
  proofImage: string;
  walletAddress: string;
  network: 'TRC20';
  rewardTierLabel: string | null;
  status: 'pending' | 'approved' | 'rejected';
  adminNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
}

export interface UsdtWithdrawalRequest {
  id: string;
  userId: string;
  userEmail: string;
  userDisplayName: string;
  userRoleLabel: string;
  sourceCurrency: 'diamonds' | 'coins';
  sourceAmount: number;
  amountUsdt: number;
  trc20Address: string;
  network: 'TRC20';
  status: 'pending' | 'approved' | 'rejected';
  adminNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
}

export interface DeviceLock {
  device_uuid: string;
  boundUserId: string;
  boundEmail: string;
  isBlocked: boolean;
  blockedReason: string | null;
  createdAt: string;
  lastAttemptAt: string;
}

export interface SecurityLog {
  id: string;
  type:
    | 'MULTI_ACCOUNT_BLOCKED'
    | 'ADMIN_AUTO_PROMOTED'
    | 'DEVICE_UNLOCKED'
    | 'DEVICE_BLOCKED'
    | 'USER_BANNED';
  email: string;
  device_uuid: string;
  details: string;
  timestamp: string;
}

export interface FemaleVoiceVerificationRequest {
  id: string;
  userId: string;
  displayName: string;
  email: string;
  audioDataUrl: string;
  durationSeconds: number;
  phrase: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  reviewedAt?: string | null;
  adminNote?: string | null;
}
