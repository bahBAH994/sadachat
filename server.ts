import crypto from 'crypto';
import dotenv from 'dotenv';
import express from 'express';
import http from 'http';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { WebSocket, WebSocketServer } from 'ws';
import {
  ADMIN_USDT_TRC20_ADDRESS,
  COINS_PER_USDT_WITHDRAW,
  computeLevelFromXp,
  createDefaultPlatformSettings,
  DIAMONDS_PER_USDT,
  FRAME_CATALOG,
  getDb,
  getRechargeRewardTier,
  getVipTierLabel,
  GIFT_CATALOG,
  hashPassword,
  initDatabase,
  isFemaleOrHost,
  isFemaleVoiceLocked,
  isUserEligibleForWithdrawal,
  LUCKY_WHEEL_COST,
  LUCKY_WHEEL_SEGMENTS,
  makeConversationId,
  MIN_WITHDRAW_USDT,
  PM_MESSAGE_COST,
  PM_REPLY_DIAMONDS,
  purgeExpiredVisualRewards,
  RECHARGE_REWARD_TIERS,
  REFERRAL_WHEEL_SEGMENTS,
  rollLuckyGiftMultiplier,
  sanitizeRoom,
  sanitizeUser,
  saveDb,
  SUPER_ADMIN_EMAIL,
  syncNowWithSupabase,
  TOPUP_PACKS,
  USDT_TO_COINS_RATE,
} from './server/db';
import { getSupabaseSyncStatus } from './server/supabase';
import type {
  FemaleVoiceVerificationRequest,
  PrivateMessage,
  RoomEntryEvent,
  RoomMessage,
  UsdtDepositRequest,
  UsdtWithdrawalRequest,
} from './src/types';

dotenv.config();

const PORT = Number(process.env.PORT) || 3000;

interface WsClientMeta {
  ws: WebSocket;
  roomId: string | null;
  userId: string | null;
}

const wsClients = new Set<WsClientMeta>();

function broadcastRoom(roomId: string, event: string, payload: unknown) {
  const data = JSON.stringify({ event, roomId, payload });
  for (const client of wsClients) {
    if (client.roomId === roomId && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(data);
    }
  }
}

function broadcastAll(event: string, payload: unknown) {
  const data = JSON.stringify({ event, payload });
  for (const client of wsClients) {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(data);
    }
  }
}

function broadcastToUser(userId: string, event: string, payload: unknown) {
  const data = JSON.stringify({ event, payload });
  for (const client of wsClients) {
    if (client.userId === userId && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(data);
    }
  }
}

function applyHostEarningsAndAgencyCommission(
  db: ReturnType<typeof getDb>,
  hostUser: ReturnType<typeof getDb>['users'][number],
  diamondsEarned: number,
  now: string
): number {
  if (diamondsEarned <= 0) return 0;
  hostUser.hostDiamondsEarned = (hostUser.hostDiamondsEarned || 0) + diamondsEarned;
  if (!hostUser.agencyId) return 0;

  const agency = db.agencies.find((a) => a.id === hostUser.agencyId);
  if (!agency) return 0;
  if (agency.status === 'suspended') return 0;
  const agent = db.users.find((u) => u.id === agency.ownerId);
  if (!agent || agent.id === hostUser.id) return 0;

  const commissionDiamonds = Math.max(1, Math.round(diamondsEarned * agency.commissionRate));
  agent.diamonds += commissionDiamonds;
  agency.totalHostDiamonds += diamondsEarned;
  agency.totalCommissionDiamonds += commissionDiamonds;

  db.transactions.unshift({
    id: `tx_${crypto.randomUUID().slice(0, 8)}`,
    userId: agent.id,
    type: 'agency_commission',
    amount: commissionDiamonds,
    currency: 'diamonds',
    description: `عمولة وكالة تلقائية (${Math.round(agency.commissionRate * 100)}%) من أرباح المضيف ${hostUser.displayName}`,
    timestamp: now,
  });

  broadcastToUser(agent.id, 'agency:commission', {
    diamondsAdded: commissionDiamonds,
    hostName: hostUser.displayName,
    agencyName: agency.name,
  });

  return commissionDiamonds;
}

function getAuthUser(req: express.Request) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) return null;
  const db = getDb();
  const session = db.sessions[token];
  if (!session) return null;
  const user = db.users.find((u) => u.id === session.userId);
  if (!user) return null;
  if (purgeExpiredVisualRewards(user, db)) {
    saveDb();
  }
  return { user, token };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '6mb' }));

  // Auto-purge expired temporary frames & room entries every 30s
  setInterval(() => {
    const db = getDb();
    let changed = false;
    for (const u of db.users) {
      if (purgeExpiredVisualRewards(u, db)) {
        changed = true;
      }
    }
    if (changed) {
      saveDb();
    }
  }, 30000);

  const server = http.createServer(app);
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const pathname = (request.url || '').split('?')[0];
    if (pathname === '/ws') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  wss.on('connection', (ws) => {
    const meta: WsClientMeta = { ws, roomId: null, userId: null };
    wsClients.add(meta);

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as {
          type: string;
          roomId?: string;
          userId?: string;
          seatIndex?: number;
          text?: string;
          isSpeaking?: boolean;
          isMuted?: boolean;
          isLocked?: boolean;
        };

        const db = getDb();

        if (msg.type === 'user:auth' && msg.userId) {
          meta.userId = msg.userId;
          return;
        }

        if (msg.type === 'room:join' && msg.roomId) {
          if (meta.roomId && meta.roomId !== msg.roomId) {
            const prev = db.rooms.find((r) => r.id === meta.roomId);
            if (prev) {
              prev.listenersCount = Math.max(1, prev.listenersCount - 1);
              broadcastRoom(prev.id, 'room:state', sanitizeRoom(prev));
            }
          }
          meta.roomId = msg.roomId;
          meta.userId = msg.userId || null;
          const room = db.rooms.find((r) => r.id === msg.roomId);
          if (room) {
            room.listenersCount += 1;
            const joiningUser = meta.userId
              ? db.users.find((u) => u.id === meta.userId)
              : undefined;
            if (joiningUser) {
              purgeExpiredVisualRewards(joiningUser, db);
              if (
                joiningUser.activeEntryId &&
                joiningUser.tempEntryExpiresAt &&
                Date.now() < new Date(joiningUser.tempEntryExpiresAt).getTime()
              ) {
                const nowIso = new Date().toISOString();
                const entryPayload: RoomEntryEvent = {
                  userId: joiningUser.id,
                  displayName: joiningUser.displayName,
                  avatarUrl: joiningUser.avatarUrl,
                  frameId: joiningUser.frameId,
                  level: joiningUser.level,
                  entryId: joiningUser.activeEntryId,
                  entryName: joiningUser.activeEntryName || 'دخولية ملكية',
                  timestamp: nowIso,
                };
                const entryChatMsg: RoomMessage = {
                  id: `msg_${crypto.randomUUID().slice(0, 8)}`,
                  userId: joiningUser.id,
                  displayName: joiningUser.displayName,
                  level: joiningUser.level,
                  isAdmin: joiningUser.is_admin,
                  vipTier: getVipTierLabel(joiningUser.level, joiningUser.is_admin),
                  hostBadge: joiningUser.hostBadge || null,
                  femaleVerifiedBadge: joiningUser.femaleVerifiedBadge || null,
                  text:
                    joiningUser.activeEntryId === 'entry_legendary_30d'
                      ? `🐉👑 الدخولية الأسطورية الملكية: شرّف ${joiningUser.displayName} المجلس بحضوره الإمبراطوري!`
                      : `🚘✨ موكب السيارة الذهبية: وصل ${joiningUser.displayName} إلى المجلس!`,
                  type: 'entry',
                  timestamp: nowIso,
                };
                room.messages.push(entryChatMsg);
                if (room.messages.length > 80) {
                  room.messages = room.messages.slice(-80);
                }
                broadcastRoom(room.id, 'room:entry', entryPayload);
                broadcastRoom(room.id, 'room:message', entryChatMsg);
              }
            }
            saveDb();
            broadcastRoom(room.id, 'room:state', sanitizeRoom(room));
          }
          return;
        }

        if (msg.type === 'room:leave' && meta.roomId) {
          const room = db.rooms.find((r) => r.id === meta.roomId);
          if (room) {
            room.listenersCount = Math.max(0, room.listenersCount - 1);
            if (meta.userId) {
              for (const seat of room.seats) {
                if (seat.userId === meta.userId) {
                  seat.userId = null;
                  seat.displayName = null;
                  seat.avatarUrl = null;
                  seat.frameId = null;
                  seat.level = null;
                  seat.isSpeaking = false;
                  seat.isMuted = false;
                }
              }
            }
            saveDb();
            broadcastRoom(room.id, 'room:state', sanitizeRoom(room));
          }
          meta.roomId = null;
          return;
        }

        if (msg.type === 'seat:take' && msg.roomId && msg.userId !== undefined && msg.seatIndex !== undefined) {
          const room = db.rooms.find((r) => r.id === msg.roomId);
          const user = db.users.find((u) => u.id === msg.userId);
          if (!room || !user || user.is_banned) return;
          const targetSeat = room.seats.find((s) => s.seatIndex === msg.seatIndex);
          if (!targetSeat || targetSeat.isLocked || targetSeat.userId) return;

          // Clear user's previous seat in this room
          for (const s of room.seats) {
            if (s.userId === user.id) {
              s.userId = null;
              s.displayName = null;
              s.avatarUrl = null;
              s.frameId = null;
              s.level = null;
              s.isSpeaking = false;
              s.isMuted = false;
            }
          }

          targetSeat.userId = user.id;
          targetSeat.displayName = user.displayName;
          targetSeat.avatarUrl = user.avatarUrl;
          targetSeat.frameId = user.frameId;
          targetSeat.level = user.level;
          targetSeat.isMuted = false;
          targetSeat.isSpeaking = false;
          targetSeat.femaleVerifiedBadge = user.femaleVerifiedBadge || null;
          saveDb();
          broadcastRoom(room.id, 'room:state', sanitizeRoom(room));
          return;
        }

        if (msg.type === 'seat:leave' && msg.roomId && msg.userId) {
          const room = db.rooms.find((r) => r.id === msg.roomId);
          if (!room) return;
          for (const s of room.seats) {
            if (s.userId === msg.userId) {
              s.userId = null;
              s.displayName = null;
              s.avatarUrl = null;
              s.frameId = null;
              s.level = null;
              s.isSpeaking = false;
              s.isMuted = false;
            }
          }
          saveDb();
          broadcastRoom(room.id, 'room:state', sanitizeRoom(room));
          return;
        }

        if (msg.type === 'seat:toggle-mute' && msg.roomId && msg.userId) {
          const room = db.rooms.find((r) => r.id === msg.roomId);
          if (!room) return;
          const seat = room.seats.find((s) => s.userId === msg.userId);
          if (seat) {
            seat.isMuted = typeof msg.isMuted === 'boolean' ? msg.isMuted : !seat.isMuted;
            if (seat.isMuted) seat.isSpeaking = false;
            saveDb();
            broadcastRoom(room.id, 'room:state', sanitizeRoom(room));
          }
          return;
        }

        if (msg.type === 'seat:lock' && msg.roomId && msg.seatIndex !== undefined && msg.userId) {
          const room = db.rooms.find((r) => r.id === msg.roomId);
          const actor = db.users.find((u) => u.id === msg.userId);
          if (!room || !actor) return;
          if (room.hostId !== actor.id && !actor.is_admin) return;
          const seat = room.seats.find((s) => s.seatIndex === msg.seatIndex);
          if (seat) {
            seat.isLocked = typeof msg.isLocked === 'boolean' ? msg.isLocked : !seat.isLocked;
            if (seat.isLocked && seat.userId) {
              seat.userId = null;
              seat.displayName = null;
              seat.avatarUrl = null;
              seat.frameId = null;
              seat.level = null;
              seat.isSpeaking = false;
            }
            saveDb();
            broadcastRoom(room.id, 'room:state', sanitizeRoom(room));
          }
          return;
        }

        if (msg.type === 'audio:speaking' && msg.roomId && msg.userId) {
          const room = db.rooms.find((r) => r.id === msg.roomId);
          if (!room) return;
          const seat = room.seats.find((s) => s.userId === msg.userId);
          if (seat && !seat.isMuted) {
            seat.isSpeaking = Boolean(msg.isSpeaking);
            broadcastRoom(room.id, 'room:state', sanitizeRoom(room));
          }
          return;
        }

        if (msg.type === 'chat:message' && msg.roomId && msg.userId && msg.text) {
          const room = db.rooms.find((r) => r.id === msg.roomId);
          const user = db.users.find((u) => u.id === msg.userId);
          if (!room || !user || user.is_banned) return;
          const cleanText = msg.text.trim().slice(0, 300);
          if (!cleanText) return;
          const chatMsg: RoomMessage = {
            id: `msg_${crypto.randomUUID().slice(0, 8)}`,
            userId: user.id,
            displayName: user.displayName,
            level: user.level,
            isAdmin: user.is_admin,
            vipTier: getVipTierLabel(user.level, user.is_admin),
            hostBadge: user.hostBadge || null,
            femaleVerifiedBadge: user.femaleVerifiedBadge || null,
            text: cleanText,
            type: 'chat',
            timestamp: new Date().toISOString(),
          };
          room.messages.push(chatMsg);
          if (room.messages.length > 80) {
            room.messages = room.messages.slice(-80);
          }
          saveDb();
          broadcastRoom(room.id, 'room:message', chatMsg);
        }
      } catch {
        // Ignore malformed socket frames
      }
    });

    ws.on('close', () => {
      if (meta.roomId) {
        const db = getDb();
        const room = db.rooms.find((r) => r.id === meta.roomId);
        if (room) {
          room.listenersCount = Math.max(0, room.listenersCount - 1);
          if (meta.userId) {
            for (const s of room.seats) {
              if (s.userId === meta.userId) {
                s.userId = null;
                s.displayName = null;
                s.avatarUrl = null;
                s.frameId = null;
                s.level = null;
                s.isSpeaking = false;
                s.isMuted = false;
              }
            }
          }
          saveDb();
          broadcastRoom(room.id, 'room:state', sanitizeRoom(room));
        }
      }
      wsClients.delete(meta);
    });
  });

  // --- AUTHENTICATION & DEVICE UUID ANTI-MULTI-ACCOUNT ---
  app.post('/api/auth/login-or-register', (req, res) => {
    const db = getDb();
    const {
      email: rawEmail,
      password = '',
      displayName = '',
      gender = 'male',
      referralCode: rawReferralCode = '',
      device_uuid: rawDeviceUuid,
      mode = 'auto',
    } = req.body as {
      email?: string;
      password?: string;
      displayName?: string;
      gender?: 'female' | 'male';
      referralCode?: string;
      device_uuid?: string;
      mode?: 'login' | 'register' | 'auto';
    };

    const email = (rawEmail || '').trim().toLowerCase();
    const device_uuid = (rawDeviceUuid || '').trim();

    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'يرجى إدخال بريد إلكتروني صحيح.' });
    }
    if (!device_uuid || device_uuid.length < 8) {
      return res.status(400).json({ error: 'تعذّر التحقق من معرّف الجهاز (Device UUID).' });
    }
    if (!password || password.length < 4) {
      return res.status(400).json({ error: 'كلمة المرور يجب أن لا تقل عن 4 أحرف.' });
    }

    const now = new Date().toISOString();
    const isSuperAdminEmail = email === SUPER_ADMIN_EMAIL;
    const deviceLock = db.deviceLocks[device_uuid];

    if (deviceLock?.isBlocked && !isSuperAdminEmail) {
      return res.status(403).json({
        error: `تم حظر هذا الجهاز من الوصول إلى صَدَى (${deviceLock.blockedReason || 'مخالفة سياسة تعدد الحسابات'}).`,
        code: 'DEVICE_BLOCKED',
      });
    }

    const existingUser = db.users.find((u) => u.email === email);

    if (existingUser) {
      if (mode === 'register') {
        return res.status(409).json({
          error: 'هذا البريد الإلكتروني مسجل مسبقاً. يرجى تسجيل الدخول.',
        });
      }

      const incomingHash = hashPassword(password);
      if (existingUser.passwordHash !== incomingHash) {
        return res.status(401).json({ error: 'كلمة المرور غير صحيحة.' });
      }

      if (existingUser.is_banned && !isSuperAdminEmail) {
        return res.status(403).json({ error: 'تم تعليق هذا الحساب من قبل الإدارة العليا.' });
      }

      // Enforce Super Admin auto-privilege on bahaa.f36@gmail.com
      if (isSuperAdminEmail && !existingUser.is_admin) {
        existingUser.is_admin = true;
        db.securityLogs.unshift({
          id: `sec_${crypto.randomUUID().slice(0, 8)}`,
          type: 'ADMIN_AUTO_PROMOTED',
          email,
          device_uuid,
          details: 'تفعيل صلاحية المدير العام تلقائياً عند تسجيل الدخول.',
          timestamp: now,
        });
      }

      existingUser.lastSeen = now;
      if (!existingUser.referralCode) {
        existingUser.referralCode = `REF-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
      }

      // Bind device lock if not yet bound and not super admin overriding another user's lock
      if (!deviceLock && !isSuperAdminEmail) {
        db.deviceLocks[device_uuid] = {
          device_uuid,
          boundUserId: existingUser.id,
          boundEmail: existingUser.email,
          isBlocked: false,
          blockedReason: null,
          createdAt: now,
          lastAttemptAt: now,
        };
      } else if (deviceLock) {
        deviceLock.lastAttemptAt = now;
      }

      const token = crypto.randomUUID();
      db.sessions[token] = { token, userId: existingUser.id, createdAt: now };
      saveDb();

      return res.json({
        token,
        user: sanitizeUser(existingUser),
        redirectTo: existingUser.is_admin ? '/admin' : '/',
      });
    }

    // Registration path
    if (mode === 'login') {
      return res.status(404).json({
        error: 'لم يتم العثور على حساب بهذا البريد. يمكنك إنشاء حساب جديد من التبويب المجاور.',
      });
    }

    // Anti-Multi-Account Check via Device UUID (Super Admin is exempt so owner can always initialize)
    if (deviceLock && deviceLock.boundEmail !== email && !isSuperAdminEmail) {
      deviceLock.lastAttemptAt = now;
      db.securityLogs.unshift({
        id: `sec_${crypto.randomUUID().slice(0, 8)}`,
        type: 'MULTI_ACCOUNT_BLOCKED',
        email,
        device_uuid,
        details: `محاولة إنشاء حساب ثانٍ (${email}) على جهاز مرتبط مسبقاً بالحساب (${deviceLock.boundEmail}).`,
        timestamp: now,
      });
      saveDb();
      return res.status(403).json({
        error: `تم حظر تعدد الحسابات: هذا الجهاز (${device_uuid.slice(0, 8)}…) مرتبط مسبقاً بحساب (${deviceLock.boundEmail}). يُسمح بحساب واحد فقط لكل جهاز.`,
        code: 'MULTI_ACCOUNT_BLOCKED',
      });
    }

    const cleanName =
      displayName.trim() ||
      (isSuperAdminEmail ? 'بهاء — المدير العام' : email.split('@')[0] || 'عضو ملكي');

    const cleanGender: 'female' | 'male' = gender === 'female' ? 'female' : 'male';
    let myReferralCode = '';
    do {
      myReferralCode = `REF-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
    } while (db.users.some((u) => u.referralCode === myReferralCode));

    const cleanRefInput = rawReferralCode.trim().toUpperCase();
    const referrer = cleanRefInput
      ? db.users.find(
          (u) =>
            (u.referralCode || '').toUpperCase() === cleanRefInput &&
            u.device_uuid !== device_uuid
        )
      : undefined;

    const newUser = {
      id: `user_${crypto.randomUUID().slice(0, 10)}`,
      email,
      passwordHash: hashPassword(password),
      displayName: cleanName.slice(0, 32),
      bio: isSuperAdminEmail
        ? 'المؤسس والمدير العام لمنصة صَدَى الملكية.'
        : 'عضو جديد في مجالس صَدَى الصوتية.',
      avatarUrl: isSuperAdminEmail
        ? 'emblem'
        : cleanGender === 'female'
        ? 'host_female'
        : 'host_male',
      gender: cleanGender,
      femaleVoiceStatus: isSuperAdminEmail
        ? ('verified' as const)
        : cleanGender === 'female'
        ? ('unverified' as const)
        : ('none' as const),
      femaleVerified: isSuperAdminEmail,
      femaleVerifiedBadge: null,
      femaleVoiceNote: null,
      isHost: isSuperAdminEmail,
      referralCode: myReferralCode,
      referredBy: referrer ? referrer.id : null,
      referralCount: 0,
      referralSpins: 0,
      frameId: isSuperAdminEmail ? 'frame_imperial' : 'frame_obsidian',
      unlockedFrames: isSuperAdminEmail
        ? ['frame_obsidian', 'frame_crescent', 'frame_sapphire', 'frame_imperial']
        : ['frame_obsidian'],
      coins: isSuperAdminEmail ? 500000 : 10000,
      diamonds: isSuperAdminEmail ? 50000 : cleanGender === 'female' ? 0 : 250,
      level: isSuperAdminEmail ? 99 : 1,
      xp: isSuperAdminEmail ? 999999 : 0,
      is_admin: isSuperAdminEmail,
      is_banned: false,
      device_uuid,
      createdAt: now,
      lastSeen: now,
    };

    if (referrer) {
      referrer.referralCount = (referrer.referralCount || 0) + 1;
      referrer.referralSpins = (referrer.referralSpins || 0) + 1;
      broadcastToUser(referrer.id, 'referral:spin-earned', {
        invitedName: newUser.displayName,
        referralSpins: referrer.referralSpins,
      });
    }

    db.users.push(newUser);

    if (!isSuperAdminEmail) {
      db.deviceLocks[device_uuid] = {
        device_uuid,
        boundUserId: newUser.id,
        boundEmail: newUser.email,
        isBlocked: false,
        blockedReason: null,
        createdAt: now,
        lastAttemptAt: now,
      };
    } else {
      db.securityLogs.unshift({
        id: `sec_${crypto.randomUUID().slice(0, 8)}`,
        type: 'ADMIN_AUTO_PROMOTED',
        email,
        device_uuid,
        details: 'تسجيل حساب المدير العام ومنح صلاحيات الإدارة العليا تلقائياً (is_admin = true).',
        timestamp: now,
      });
    }

    db.transactions.unshift({
      id: `tx_${crypto.randomUUID().slice(0, 8)}`,
      userId: newUser.id,
      type: 'admin_grant',
      amount: newUser.coins,
      currency: 'coins',
      description: isSuperAdminEmail
        ? 'رصيد التأسيس الملكي للمدير العام'
        : 'هدية الترحيب الملكية عند الانضمام إلى صَدَى',
      timestamp: now,
    });

    const token = crypto.randomUUID();
    db.sessions[token] = { token, userId: newUser.id, createdAt: now };
    saveDb();

    return res.json({
      token,
      user: sanitizeUser(newUser),
      redirectTo: newUser.is_admin ? '/admin' : '/',
    });
  });

  app.get('/api/auth/me', (req, res) => {
    const auth = getAuthUser(req);
    if (!auth) return res.status(401).json({ error: 'غير مصرح بالدخول.' });
    return res.json({ user: sanitizeUser(auth.user) });
  });

  app.post('/api/auth/logout', (req, res) => {
    const auth = getAuthUser(req);
    if (auth) {
      const db = getDb();
      delete db.sessions[auth.token];
      saveDb();
    }
    return res.json({ ok: true });
  });

  // --- PROFILE ---
  app.patch('/api/profile', (req, res) => {
    const auth = getAuthUser(req);
    if (!auth) return res.status(401).json({ error: 'غير مصرح.' });
    const { displayName, bio, avatarUrl, frameId, gender, isHost } = req.body as {
      displayName?: string;
      bio?: string;
      avatarUrl?: string;
      frameId?: string;
      gender?: 'female' | 'male';
      isHost?: boolean;
    };

    if (displayName && displayName.trim().length >= 2) {
      auth.user.displayName = displayName.trim().slice(0, 32);
    }
    if (typeof bio === 'string') {
      auth.user.bio = bio.trim().slice(0, 140);
    }
    if (avatarUrl) {
      auth.user.avatarUrl = avatarUrl;
    }
    if (gender === 'female' || gender === 'male') {
      auth.user.gender = gender;
      if (gender === 'female') {
        if (auth.user.femaleVoiceStatus !== 'verified' && auth.user.femaleVoiceStatus !== 'pending') {
          auth.user.femaleVoiceStatus = auth.user.is_admin ? 'verified' : 'unverified';
          auth.user.femaleVerified = auth.user.is_admin;
          auth.user.femaleVerifiedBadge = null;
        }
      } else {
        auth.user.femaleVoiceStatus = 'none';
        auth.user.femaleVerified = false;
        auth.user.femaleVerifiedBadge = null;
      }
    }
    if (typeof isHost === 'boolean') {
      auth.user.isHost = isHost;
    }
    if (frameId && auth.user.unlockedFrames.includes(frameId)) {
      auth.user.frameId = frameId;
    }
    saveDb();
    return res.json({ user: sanitizeUser(auth.user) });
  });

  // --- VOICE ROOMS ---
  app.get('/api/rooms', (_req, res) => {
    const db = getDb();
    return res.json({
      rooms: db.rooms.filter((r) => r.isActive).map(sanitizeRoom),
      gifts: GIFT_CATALOG,
      frames: FRAME_CATALOG,
    });
  });

  app.post('/api/rooms', (req, res) => {
    const auth = getAuthUser(req);
    if (!auth) return res.status(401).json({ error: 'غير مصرح.' });
    if (auth.user.is_banned) return res.status(403).json({ error: 'حسابك معلق.' });

    const { title, category, description, maxSeats, isPrivate, password } = req.body as {
      title?: string;
      category?: 'مسابقات' | 'شعر وأدب' | 'طرب' | 'حوار';
      description?: string;
      maxSeats?: number;
      isPrivate?: boolean;
      password?: string;
    };

    if (!title || title.trim().length < 3) {
      return res.status(400).json({ error: 'يرجى إدخال عنوان واضح للغرفة (3 أحرف على الأقل).' });
    }

    const seatCount = maxSeats === 6 ? 6 : 8;
    const seats = Array.from({ length: seatCount }, (_, idx) => ({
      seatIndex: idx,
      userId: idx === 0 ? auth.user.id : null,
      displayName: idx === 0 ? auth.user.displayName : null,
      avatarUrl: idx === 0 ? auth.user.avatarUrl : null,
      frameId: idx === 0 ? auth.user.frameId : null,
      level: idx === 0 ? auth.user.level : null,
      isMuted: false,
      isLocked: false,
      isSpeaking: false,
      receivedDiamonds: 0,
    }));

    const db = getDb();
    const newRoom = {
      id: `room_${crypto.randomUUID().slice(0, 8)}`,
      title: title.trim().slice(0, 60),
      category: category || 'حوار',
      description: (description || 'مجلس صوتي مباشر في صَدَى.').trim().slice(0, 140),
      hostId: auth.user.id,
      hostName: auth.user.displayName,
      hostAvatar: auth.user.avatarUrl,
      coverImage: category === 'مسابقات' ? 'competition_crest' : 'royal_stage',
      backgroundImage: 'dragon_dark',
      isPrivate: Boolean(isPrivate),
      password: isPrivate && password ? password.trim() : undefined,
      maxSeats: seatCount,
      seats,
      listenersCount: 1,
      isActive: true,
      totalGiftsCoins: 0,
      createdAt: new Date().toISOString(),
      messages: [
        {
          id: `msg_${crypto.randomUUID().slice(0, 8)}`,
          userId: auth.user.id,
          displayName: auth.user.displayName,
          level: auth.user.level,
          isAdmin: auth.user.is_admin,
          text: `افتتح ${auth.user.displayName} هذه الغرفة الصوتية للتو. أهلاً بالجميع!`,
          type: 'system' as const,
          timestamp: new Date().toISOString(),
        },
      ],
    };

    auth.user.isHost = true;
    db.rooms.unshift(newRoom);
    saveDb();
    const sanitized = sanitizeRoom(newRoom);
    broadcastAll('rooms:created', sanitized);
    return res.json({ room: sanitized });
  });

  app.get('/api/rooms/:id', (req, res) => {
    const db = getDb();
    const room = db.rooms.find((r) => r.id === req.params.id);
    if (!room) return res.status(404).json({ error: 'الغرفة غير موجودة.' });
    let changed = false;
    for (const s of room.seats) {
      if (s.userId) {
        const seatUser = db.users.find((u) => u.id === s.userId);
        if (seatUser && purgeExpiredVisualRewards(seatUser, db)) {
          changed = true;
        }
      }
    }
    if (changed) saveDb();
    return res.json({
      room: sanitizeRoom(room),
      gifts: GIFT_CATALOG,
      frames: FRAME_CATALOG,
      wheelSegments: db.settings.roomWheelSegments,
      wheelCost: db.settings.roomWheelCost,
    });
  });

  app.post('/api/rooms/:id/verify-password', (req, res) => {
    const db = getDb();
    const room = db.rooms.find((r) => r.id === req.params.id);
    if (!room) return res.status(404).json({ error: 'الغرفة غير موجودة.' });
    const { password } = req.body as { password?: string };
    if (!room.password || room.password === (password || '').trim()) {
      return res.json({ ok: true });
    }
    return res.status(403).json({ error: 'كلمة مرور الغرفة غير صحيحة.' });
  });

  app.post('/api/rooms/:id/gift', (req, res) => {
    const auth = getAuthUser(req);
    if (!auth) return res.status(401).json({ error: 'غير مصرح.' });
    const db = getDb();
    const room = db.rooms.find((r) => r.id === req.params.id);
    if (!room) return res.status(404).json({ error: 'الغرفة غير موجودة.' });

    const { giftId, targetUserId } = req.body as { giftId?: string; targetUserId?: string };
    const gift = GIFT_CATALOG.find((g) => g.id === giftId);
    if (!gift) return res.status(400).json({ error: 'الهدية غير متوفرة.' });

    if (auth.user.coins < gift.coinsCost) {
      return res.status(400).json({ error: 'رصيد الكوينز غير كافٍ لإرسال هذه الهدية.' });
    }

    const recipient =
      db.users.find((u) => u.id === targetUserId) ||
      db.users.find((u) => u.id === room.hostId);
    if (!recipient) return res.status(404).json({ error: 'المستلم غير موجود.' });
    if (isFemaleVoiceLocked(recipient)) {
      return res.status(403).json({
        error: 'رصيد الألماس لدى هذا الحساب النسائي مقفل حالياً بانتظار اعتماد التوثيق الصوتي من الإدارة.',
      });
    }

    const now = new Date().toISOString();
    auth.user.coins -= gift.coinsCost;
    auth.user.xp += gift.xpGain;
    auth.user.level = computeLevelFromXp(auth.user.xp);

    let luckyMultiplier: number | null = null;
    let luckyBonusCoins = 0;
    if (gift.category === 'lucky') {
      luckyMultiplier = rollLuckyGiftMultiplier(db.settings.luckyGiftMultipliers);
      luckyBonusCoins = Math.round(gift.coinsCost * luckyMultiplier);
      auth.user.coins += luckyBonusCoins;
    }

    const dynamicDiamonds = Math.max(
      1,
      Math.round(gift.coinsCost * (db.settings.giftDiamondsRatio || 0.75))
    );
    recipient.diamonds += dynamicDiamonds;
    room.totalGiftsCoins += gift.coinsCost;

    const targetSeat = room.seats.find((s) => s.userId === recipient.id);
    if (targetSeat) {
      targetSeat.receivedDiamonds += dynamicDiamonds;
    }

    const giftMessage: RoomMessage = {
      id: `msg_${crypto.randomUUID().slice(0, 8)}`,
      userId: auth.user.id,
      displayName: auth.user.displayName,
      level: auth.user.level,
      isAdmin: auth.user.is_admin,
      vipTier: getVipTierLabel(auth.user.level, auth.user.is_admin),
      femaleVerifiedBadge: auth.user.femaleVerifiedBadge || null,
      text:
        gift.category === 'lucky' && luckyMultiplier
          ? `🎰 أهدى ${auth.user.displayName} ${gift.glyph} ${gift.name} إلى ${recipient.displayName} وفاز بمضاعف الحظ ×${luckyMultiplier} (+${luckyBonusCoins.toLocaleString('en-US')} كوينز)!`
          : `أهدى ${auth.user.displayName} ${gift.glyph} ${gift.name} إلى ${recipient.displayName}`,
      type: 'gift',
      timestamp: now,
    };
    room.messages.push(giftMessage);

    db.transactions.unshift({
      id: `tx_${crypto.randomUUID().slice(0, 8)}`,
      userId: auth.user.id,
      type: 'gift_sent',
      amount: -gift.coinsCost,
      currency: 'coins',
      description: `إرسال ${gift.name} إلى ${recipient.displayName}`,
      timestamp: now,
    });

    if (luckyBonusCoins > 0 && luckyMultiplier) {
      db.transactions.unshift({
        id: `tx_${crypto.randomUUID().slice(0, 8)}`,
        userId: auth.user.id,
        type: 'lucky_gift_bonus',
        amount: luckyBonusCoins,
        currency: 'coins',
        description: `مضاعف هدية الحظ (${gift.name} ×${luckyMultiplier})`,
        timestamp: now,
      });
    }

    db.transactions.unshift({
      id: `tx_${crypto.randomUUID().slice(0, 8)}`,
      userId: recipient.id,
      type: 'gift_received',
      amount: dynamicDiamonds,
      currency: 'diamonds',
      description: `استلام ${gift.name} من ${auth.user.displayName}`,
      timestamp: now,
    });

    applyHostEarningsAndAgencyCommission(db, recipient, dynamicDiamonds, now);

    saveDb();

    broadcastRoom(room.id, 'room:gift', {
      gift,
      luckyMultiplier,
      luckyBonusCoins,
      senderName: auth.user.displayName,
      recipientName: recipient.displayName,
      message: giftMessage,
      room: sanitizeRoom(room),
    });

    return res.json({
      user: sanitizeUser(auth.user),
      room: sanitizeRoom(room),
      gift,
      luckyMultiplier,
      luckyBonusCoins,
    });
  });

  app.post('/api/rooms/:id/lucky-wheel', (req, res) => {
    const auth = getAuthUser(req);
    if (!auth) return res.status(401).json({ error: 'غير مصرح.' });
    const db = getDb();
    const room = db.rooms.find((r) => r.id === req.params.id);
    if (!room) return res.status(404).json({ error: 'الغرفة غير موجودة.' });

    const wheelCost = db.settings.roomWheelCost;
    if (auth.user.coins < wheelCost) {
      return res.status(400).json({
        error: `رصيد الكوينز غير كافٍ. تحتاج إلى ${wheelCost} كوينز لتدوير دولاب الحظ.`,
      });
    }

    const nowDate = new Date();
    const now = nowDate.toISOString();
    auth.user.coins -= wheelCost;

    const segments = db.settings.roomWheelSegments;
    const weights = segments.map((s) => Math.max(1, s.weight || 10));
    const totalW = weights.reduce((a, b) => a + b, 0);
    let roll = Math.random() * totalW;
    let segmentIndex = 0;
    for (let i = 0; i < weights.length; i++) {
      roll -= weights[i];
      if (roll <= 0) {
        segmentIndex = i;
        break;
      }
    }
    const segment = segments[segmentIndex];

    if (segment.rewardType === 'coins' && segment.coinsAmount) {
      auth.user.coins += segment.coinsAmount;
      db.transactions.unshift({
        id: `tx_${crypto.randomUUID().slice(0, 8)}`,
        userId: auth.user.id,
        type: 'prize',
        amount: segment.coinsAmount,
        currency: 'coins',
        description: `جائزة دولاب الحظ في ${room.title}: ${segment.label}`,
        timestamp: now,
      });
    } else if (segment.rewardType === 'frame' && segment.frameId) {
      if (!auth.user.unlockedFrames.includes(segment.frameId)) {
        auth.user.unlockedFrames.push(segment.frameId);
      }
      auth.user.frameId = segment.frameId;
      auth.user.tempFrameExpiresAt = new Date(
        nowDate.getTime() + 24 * 60 * 60 * 1000
      ).toISOString();
      const seated = room.seats.find((s) => s.userId === auth.user.id);
      if (seated) {
        seated.frameId = segment.frameId;
      }
    }

    if (segment.xpAmount) {
      auth.user.xp += segment.xpAmount;
      auth.user.level = computeLevelFromXp(auth.user.xp);
      const seated = room.seats.find((s) => s.userId === auth.user.id);
      if (seated) {
        seated.level = auth.user.level;
      }
    }

    const wheelMessage: RoomMessage = {
      id: `msg_${crypto.randomUUID().slice(0, 8)}`,
      userId: auth.user.id,
      displayName: auth.user.displayName,
      level: auth.user.level,
      isAdmin: auth.user.is_admin,
      text: `🎰 فاز ${auth.user.displayName} في دولاب الحظ بـ ${segment.glyph} ${segment.label}!`,
      type: 'wheel',
      timestamp: now,
    };
    room.messages.push(wheelMessage);
    if (room.messages.length > 80) {
      room.messages = room.messages.slice(-80);
    }

    saveDb();

    const sanitizedRoom = sanitizeRoom(room);
    broadcastRoom(room.id, 'room:wheel-win', {
      segmentIndex,
      segment,
      winnerName: auth.user.displayName,
      message: wheelMessage,
      room: sanitizedRoom,
    });

    return res.json({
      segmentIndex,
      segment,
      user: sanitizeUser(auth.user),
      room: sanitizedRoom,
      message: wheelMessage,
    });
  });

  // --- COMPETITIONS ---
  app.get('/api/competitions', (_req, res) => {
    const db = getDb();
    return res.json({ competitions: db.competitions });
  });

  app.post('/api/competitions/:id/join', (req, res) => {
    const auth = getAuthUser(req);
    if (!auth) return res.status(401).json({ error: 'غير مصرح.' });
    const db = getDb();
    const comp = db.competitions.find((c) => c.id === req.params.id);
    if (!comp) return res.status(404).json({ error: 'المسابقة غير موجودة.' });
    if (comp.status === 'ended') {
      return res.status(400).json({ error: 'انتهت هذه المسابقة بالفعل.' });
    }

    const { performanceTitle } = req.body as { performanceTitle?: string };
    if (!performanceTitle || performanceTitle.trim().length < 3) {
      return res.status(400).json({ error: 'يرجى كتابة عنوان الفقرة الصوتية أو المشاركة.' });
    }

    const already = comp.contestants.find((c) => c.userId === auth.user.id);
    if (already) {
      return res.status(400).json({ error: 'أنت مسجل بالفعل في هذه المسابقة.' });
    }

    comp.contestants.push({
      id: `cont_${crypto.randomUUID().slice(0, 8)}`,
      userId: auth.user.id,
      displayName: auth.user.displayName,
      avatarUrl: auth.user.avatarUrl,
      level: auth.user.level,
      performanceTitle: performanceTitle.trim().slice(0, 60),
      votes: 1,
      giftScore: 0,
    });

    saveDb();
    broadcastAll('competition:updated', comp);
    return res.json({ competition: comp });
  });

  app.post('/api/competitions/:id/vote', (req, res) => {
    const auth = getAuthUser(req);
    if (!auth) return res.status(401).json({ error: 'غير مصرح.' });
    const db = getDb();
    const comp = db.competitions.find((c) => c.id === req.params.id);
    if (!comp) return res.status(404).json({ error: 'المسابقة غير موجودة.' });
    if (comp.status === 'ended') {
      return res.status(400).json({ error: 'المسابقة منتهية.' });
    }

    const { contestantId, boost } = req.body as { contestantId?: string; boost?: boolean };
    const contestant = comp.contestants.find((c) => c.id === contestantId);
    if (!contestant) return res.status(404).json({ error: 'المتسابق غير موجود.' });

    const now = new Date().toISOString();

    if (boost) {
      const cost = 100;
      if (auth.user.coins < cost) {
        return res.status(400).json({ error: 'تحتاج إلى 100 كوينز للتصويت الملكي المضاعف (+10 أصوات).' });
      }
      auth.user.coins -= cost;
      auth.user.xp += 40;
      auth.user.level = computeLevelFromXp(auth.user.xp);
      contestant.votes += 10;
      contestant.giftScore += cost;

      db.transactions.unshift({
        id: `tx_${crypto.randomUUID().slice(0, 8)}`,
        userId: auth.user.id,
        type: 'vote',
        amount: -cost,
        currency: 'coins',
        description: `دعم ملكي (+10 أصوات) للمتسابق ${contestant.displayName}`,
        timestamp: now,
      });
    } else {
      const voteKey = `${comp.id}_${auth.user.id}`;
      if (db.votedKeys[voteKey]) {
        return res.status(400).json({
          error: 'استخدمت صوتك المجاني في هذه المسابقة. يمكنك استخدام التصويت الملكي بالكوينز!',
        });
      }
      db.votedKeys[voteKey] = true;
      contestant.votes += 1;
      auth.user.xp += 15;
      auth.user.level = computeLevelFromXp(auth.user.xp);
    }

    saveDb();
    broadcastAll('competition:updated', comp);
    return res.json({ competition: comp, user: sanitizeUser(auth.user) });
  });

  // --- LIVE CULTURAL CHAMPIONSHIPS (8s ANTI-CHEAT TIMER + XP) ---
  app.post('/api/competitions/quiz/start', (req, res) => {
    const auth = getAuthUser(req);
    if (!auth) return res.status(401).json({ error: 'غير مصرح.' });
    const db = getDb();

    const bank = db.culturalQuestions || [];
    if (bank.length === 0) {
      return res.status(404).json({ error: 'لا توجد أسئلة ثقافية منشورة حالياً.' });
    }
    const q = bank[Math.floor(Math.random() * bank.length)];
    const roundId = `quiz_${crypto.randomUUID().slice(0, 10)}`;
    const expiresAt = Date.now() + 8000;

    db.quizSessions[roundId] = {
      roundId,
      userId: auth.user.id,
      questionId: q.id,
      correctIndex: q.correctIndex,
      xpReward: q.xpReward,
      coinsReward: q.coinsReward,
      expiresAt,
      answered: false,
    };

    // Keep quizSessions bounded
    const keys = Object.keys(db.quizSessions);
    if (keys.length > 200) {
      for (const oldKey of keys.slice(0, keys.length - 100)) {
        delete db.quizSessions[oldKey];
      }
    }
    saveDb();

    return res.json({
      roundId,
      category: q.category,
      question: q.question,
      options: q.options,
      xpReward: q.xpReward,
      coinsReward: q.coinsReward,
      timeLimitSeconds: 8,
      expiresAt,
    });
  });

  app.post('/api/competitions/quiz/answer', (req, res) => {
    const auth = getAuthUser(req);
    if (!auth) return res.status(401).json({ error: 'غير مصرح.' });
    const db = getDb();

    const { roundId, selectedIndex } = req.body as {
      roundId?: string;
      selectedIndex?: number;
    };
    const session = roundId ? db.quizSessions[roundId] : undefined;
    if (!session || session.userId !== auth.user.id) {
      return res.status(404).json({ error: 'جولة المسابقة غير موجودة.' });
    }
    if (session.answered) {
      return res.status(400).json({ error: 'تمت الإجابة على هذا السؤال مسبقاً.' });
    }

    session.answered = true;
    const nowMs = Date.now();
    const timedOut = nowMs > session.expiresAt + 250 || typeof selectedIndex !== 'number';

    if (timedOut) {
      saveDb();
      return res.json({
        isCorrect: false,
        timedOut: true,
        correctIndex: session.correctIndex,
        xpGained: 0,
        coinsGained: 0,
        user: sanitizeUser(auth.user),
      });
    }

    const isCorrect = selectedIndex === session.correctIndex;
    const xpGained = isCorrect ? session.xpReward : 20;
    const coinsGained = isCorrect ? session.coinsReward : 0;

    auth.user.xp += xpGained;
    auth.user.level = computeLevelFromXp(auth.user.xp);

    if (coinsGained > 0) {
      auth.user.coins += coinsGained;
      db.transactions.unshift({
        id: `tx_${crypto.randomUUID().slice(0, 8)}`,
        userId: auth.user.id,
        type: 'quiz_reward',
        amount: coinsGained,
        currency: 'coins',
        description: `جائزة بطولة ثقافية حية (+${xpGained} XP)`,
        timestamp: new Date().toISOString(),
      });
    }

    saveDb();
    return res.json({
      isCorrect,
      timedOut: false,
      correctIndex: session.correctIndex,
      xpGained,
      coinsGained,
      user: sanitizeUser(auth.user),
    });
  });

  // --- REFERRAL WHEEL TIED TO APP PRIZE POOL ---
  app.get('/api/competitions/referral-wheel/overview', (req, res) => {
    const auth = getAuthUser(req);
    if (!auth) return res.status(401).json({ error: 'غير مصرح.' });
    const db = getDb();

    if (!auth.user.referralCode) {
      auth.user.referralCode = `REF-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
      saveDb();
    }

    return res.json({
      referralCode: auth.user.referralCode,
      referralCount: auth.user.referralCount || 0,
      referralSpins: auth.user.referralSpins || 0,
      appPrizePoolCoins: db.appPrizePoolCoins,
      segments: REFERRAL_WHEEL_SEGMENTS,
    });
  });

  app.post('/api/competitions/referral-wheel/spin', (req, res) => {
    const auth = getAuthUser(req);
    if (!auth) return res.status(401).json({ error: 'غير مصرح.' });
    const db = getDb();

    if ((auth.user.referralSpins || 0) < 1) {
      return res.status(400).json({
        error: 'لا تملك لفات مجانية حالياً. ادعُ صديقاً بكود الدعوة الخاص بك للحصول على لفة مجانية!',
      });
    }

    const eligible = REFERRAL_WHEEL_SEGMENTS.filter(
      (s) => s.coinsAmount <= db.appPrizePoolCoins
    );
    const pool = eligible.length > 0 ? eligible : [REFERRAL_WHEEL_SEGMENTS[0]];
    const totalWeight = pool.reduce((sum, s) => sum + s.weight, 0);
    let roll = Math.random() * totalWeight;
    let chosen = pool[0];
    for (const seg of pool) {
      roll -= seg.weight;
      if (roll <= 0) {
        chosen = seg;
        break;
      }
    }

    const segmentIndex = REFERRAL_WHEEL_SEGMENTS.findIndex((s) => s.id === chosen.id);
    auth.user.referralSpins = Math.max(0, (auth.user.referralSpins || 0) - 1);

    if (chosen.coinsAmount > 0) {
      db.appPrizePoolCoins = Math.max(0, db.appPrizePoolCoins - chosen.coinsAmount);
      auth.user.coins += chosen.coinsAmount;
      auth.user.xp += Math.min(500, Math.round(chosen.coinsAmount / 20));
      auth.user.level = computeLevelFromXp(auth.user.xp);

      db.transactions.unshift({
        id: `tx_${crypto.randomUUID().slice(0, 8)}`,
        userId: auth.user.id,
        type: 'referral_wheel',
        amount: chosen.coinsAmount,
        currency: 'coins',
        description: `جائزة دولاب حظ الدعوات: ${chosen.label}`,
        timestamp: new Date().toISOString(),
      });
    }

    saveDb();
    return res.json({
      segmentIndex,
      segment: chosen,
      user: sanitizeUser(auth.user),
      appPrizePoolCoins: db.appPrizePoolCoins,
    });
  });

  // --- WALLET, USDT TRC20 DEPOSITS & WITHDRAWALS, AND REWARD TIERS ---
  app.get('/api/wallet', (req, res) => {
    const auth = getAuthUser(req);
    if (!auth) return res.status(401).json({ error: 'غير مصرح.' });
    const db = getDb();
    const transactions = db.transactions.filter((t) => t.userId === auth.user.id).slice(0, 30);
    const usdtDeposits = db.usdtDeposits
      .filter((d) => d.userId === auth.user.id)
      .slice(0, 20);
    const usdtWithdrawals = db.usdtWithdrawals
      .filter((w) => w.userId === auth.user.id)
      .slice(0, 20);
    const eligibility = isUserEligibleForWithdrawal(auth.user, db);
    return res.json({
      user: sanitizeUser(auth.user),
      transactions,
      packs: TOPUP_PACKS,
      frames: FRAME_CATALOG.filter((f) => !f.isTemporary || auth.user.unlockedFrames.includes(f.id)),
      adminTrc20Address: ADMIN_USDT_TRC20_ADDRESS,
      usdtToCoinsRate: db.settings.usdtToCoinsRate,
      diamondToCoinsRate: db.settings.diamondToCoinsRate,
      rewardTiers: db.settings.rechargeRewardTiers,
      usdtDeposits,
      usdtWithdrawals,
      withdrawalEligibility: {
        eligible: eligibility.eligible,
        roleLabel: eligibility.roleLabel,
        minUsdt: MIN_WITHDRAW_USDT,
        diamondsPerUsdt: db.settings.diamondsPerUsdt,
        coinsPerUsdt: db.settings.coinsPerUsdtWithdraw,
      },
    });
  });

  app.post('/api/wallet/usdt-deposit', (req, res) => {
    const auth = getAuthUser(req);
    if (!auth) return res.status(401).json({ error: 'غير مصرح.' });
    const db = getDb();

    const { amountUsdt, txId, proofImage } = req.body as {
      amountUsdt?: number;
      txId?: string;
      proofImage?: string;
    };

    const cleanAmount = Number(amountUsdt);
    if (!Number.isFinite(cleanAmount) || cleanAmount < 10) {
      return res.status(400).json({ error: 'الحد الأدنى للشحن عبر USDT (TRC20) هو 10 دولار.' });
    }

    const cleanTxId = (txId || '').trim();
    if (cleanTxId.length < 8) {
      return res.status(400).json({ error: 'يرجى إدخال كود الحوالة (TxID) الصحيح (8 أحرف على الأقل).' });
    }

    const duplicate = db.usdtDeposits.some(
      (d) => d.txId.toLowerCase() === cleanTxId.toLowerCase() && d.status !== 'rejected'
    );
    if (duplicate) {
      return res.status(409).json({ error: 'كود الحوالة (TxID) هذا مسجل مسبقاً في طلب آخر.' });
    }

    const cleanProof = (proofImage || '').trim();
    if (!cleanProof || (!cleanProof.startsWith('data:image/') && !cleanProof.startsWith('http'))) {
      return res.status(400).json({ error: 'يرجى إرفاق صورة إثبات التحويل واضحة.' });
    }

    const tier = getRechargeRewardTier(cleanAmount, db.settings.rechargeRewardTiers);
    const baseCoins = Math.round(cleanAmount * db.settings.usdtToCoinsRate);
    const bonusCoins = tier ? Math.round(baseCoins * tier.bonusRate) : 0;
    const coinsCredited = baseCoins + bonusCoins;

    const deposit: UsdtDepositRequest = {
      id: `dep_${crypto.randomUUID().slice(0, 8)}`,
      userId: auth.user.id,
      userEmail: auth.user.email,
      userDisplayName: auth.user.displayName,
      amountUsdt: Math.round(cleanAmount * 100) / 100,
      coinsCredited,
      txId: cleanTxId.slice(0, 128),
      proofImage: cleanProof,
      walletAddress: ADMIN_USDT_TRC20_ADDRESS,
      network: 'TRC20',
      rewardTierLabel: tier ? tier.label : null,
      status: 'pending',
      adminNote: null,
      createdAt: new Date().toISOString(),
      reviewedAt: null,
    };

    db.usdtDeposits.unshift(deposit);
    saveDb();

    return res.json({
      deposit,
      user: sanitizeUser(auth.user),
    });
  });

  app.post('/api/wallet/usdt-withdraw', (req, res) => {
    const auth = getAuthUser(req);
    if (!auth) return res.status(401).json({ error: 'غير مصرح.' });
    const db = getDb();

    const eligibility = isUserEligibleForWithdrawal(auth.user, db);
    if (!eligibility.eligible) {
      return res.status(403).json({
        error: 'سحب الأرباح إلى USDT متاح حصراً للفائزين بالمسابقات والوكلاء والمضيفين المعتمدين.',
      });
    }

    const { sourceCurrency, sourceAmount, trc20Address } = req.body as {
      sourceCurrency?: 'diamonds' | 'coins';
      sourceAmount?: number;
      trc20Address?: string;
    };

    const currency = sourceCurrency === 'coins' ? 'coins' : 'diamonds';
    if (currency === 'diamonds' && isFemaleVoiceLocked(auth.user)) {
      return res.status(403).json({
        error: 'رصيد الألماس مقفل لحين إتمام التوثيق الصوتي واعتماد الإدارة.',
      });
    }
    const cleanSourceAmount = Math.floor(Number(sourceAmount) || 0);
    const cleanAddress = (trc20Address || '').trim();

    if (!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(cleanAddress)) {
      return res.status(400).json({
        error: 'عنوان محفظة USDT (TRC20) غير صالح. يجب أن يبدأ بحرف T ويتكوّن من 34 رمزاً.',
      });
    }

    const rate =
      currency === 'diamonds'
        ? db.settings.diamondsPerUsdt
        : db.settings.coinsPerUsdtWithdraw;
    const minSourceAmount = MIN_WITHDRAW_USDT * rate;
    if (cleanSourceAmount < minSourceAmount) {
      return res.status(400).json({
        error: `الحد الأدنى للسحب هو ${MIN_WITHDRAW_USDT} USDT (${minSourceAmount.toLocaleString('en-US')} ${
          currency === 'diamonds' ? 'ألماسة' : 'كوينز'
        }).`,
      });
    }

    if (auth.user[currency] < cleanSourceAmount) {
      return res.status(400).json({
        error:
          currency === 'diamonds'
            ? 'رصيد الألماس غير كافٍ لإتمام طلب السحب.'
            : 'رصيد الكوينز غير كافٍ لإتمام طلب السحب.',
      });
    }

    const amountUsdt = Math.round((cleanSourceAmount / rate) * 100) / 100;
    const now = new Date().toISOString();
    auth.user[currency] -= cleanSourceAmount;

    const withdrawal: UsdtWithdrawalRequest = {
      id: `wd_${crypto.randomUUID().slice(0, 8)}`,
      userId: auth.user.id,
      userEmail: auth.user.email,
      userDisplayName: auth.user.displayName,
      userRoleLabel: eligibility.roleLabel,
      sourceCurrency: currency,
      sourceAmount: cleanSourceAmount,
      amountUsdt,
      trc20Address: cleanAddress,
      network: 'TRC20',
      status: 'pending',
      adminNote: null,
      createdAt: now,
      reviewedAt: null,
    };

    db.usdtWithdrawals.unshift(withdrawal);
    db.transactions.unshift({
      id: `tx_${crypto.randomUUID().slice(0, 8)}`,
      userId: auth.user.id,
      type: 'usdt_withdrawal',
      amount: -cleanSourceAmount,
      currency,
      description: `طلب سحب ${amountUsdt} USDT (TRC20) إلى ${cleanAddress.slice(0, 8)}…${cleanAddress.slice(-6)}`,
      timestamp: now,
    });

    saveDb();
    return res.json({
      withdrawal,
      user: sanitizeUser(auth.user),
    });
  });

  app.post('/api/wallet/topup', (req, res) => {
    const auth = getAuthUser(req);
    if (!auth) return res.status(401).json({ error: 'غير مصرح.' });
    const { packId } = req.body as { packId?: string };
    const pack = TOPUP_PACKS.find((p) => p.id === packId);
    if (!pack) return res.status(400).json({ error: 'الباقة غير صالحة.' });

    const totalCoins = pack.coins + pack.bonus;
    const now = new Date().toISOString();
    auth.user.coins += totalCoins;
    auth.user.xp += Math.floor(totalCoins / 10);
    auth.user.level = computeLevelFromXp(auth.user.xp);

    const db = getDb();
    db.transactions.unshift({
      id: `tx_${crypto.randomUUID().slice(0, 8)}`,
      userId: auth.user.id,
      type: 'topup',
      amount: totalCoins,
      currency: 'coins',
      description: `شحن ${pack.label} (${pack.coins} + ${pack.bonus} مكافأة)`,
      timestamp: now,
    });
    saveDb();

    return res.json({ user: sanitizeUser(auth.user) });
  });

  app.post('/api/wallet/convert', (req, res) => {
    const auth = getAuthUser(req);
    if (!auth) return res.status(401).json({ error: 'غير مصرح.' });
    const db = getDb();
    if (isFemaleVoiceLocked(auth.user)) {
      return res.status(403).json({
        error: 'رصيد الألماس مقفل لحين إتمام التوثيق الصوتي واعتماد الإدارة.',
      });
    }
    const { diamonds } = req.body as { diamonds?: number };
    const amount = Math.floor(Number(diamonds) || 0);
    if (amount < 10) {
      return res.status(400).json({ error: 'الحد الأدنى للتحويل هو 10 ألماسات.' });
    }
    if (auth.user.diamonds < amount) {
      return res.status(400).json({ error: 'رصيد الألماس غير كافٍ.' });
    }

    const gainedCoins = Math.round(amount * (db.settings.diamondToCoinsRate || 2));
    const now = new Date().toISOString();
    auth.user.diamonds -= amount;
    auth.user.coins += gainedCoins;

    db.transactions.unshift({
      id: `tx_${crypto.randomUUID().slice(0, 8)}`,
      userId: auth.user.id,
      type: 'convert',
      amount: gainedCoins,
      currency: 'coins',
      description: `تحويل ${amount} ألماسة إلى ${gainedCoins} كوينز`,
      timestamp: now,
    });
    saveDb();

    return res.json({ user: sanitizeUser(auth.user) });
  });

  app.post('/api/wallet/purchase-frame', (req, res) => {
    const auth = getAuthUser(req);
    if (!auth) return res.status(401).json({ error: 'غير مصرح.' });
    const { frameId } = req.body as { frameId?: string };
    const frame = FRAME_CATALOG.find((f) => f.id === frameId);
    if (!frame) return res.status(404).json({ error: 'الإطار غير موجود.' });

    if (auth.user.unlockedFrames.includes(frame.id)) {
      auth.user.frameId = frame.id;
      saveDb();
      return res.json({ user: sanitizeUser(auth.user) });
    }

    if (auth.user.coins < frame.priceCoins) {
      return res.status(400).json({ error: 'رصيد الكوينز غير كافٍ لاقتناء هذا الإطار.' });
    }

    auth.user.coins -= frame.priceCoins;
    auth.user.unlockedFrames.push(frame.id);
    auth.user.frameId = frame.id;

    const db = getDb();
    db.transactions.unshift({
      id: `tx_${crypto.randomUUID().slice(0, 8)}`,
      userId: auth.user.id,
      type: 'store_purchase',
      amount: -frame.priceCoins,
      currency: 'coins',
      description: `اقتناء وتفعيل ${frame.name}`,
      timestamp: new Date().toISOString(),
    });
    saveDb();

    return res.json({ user: sanitizeUser(auth.user) });
  });

  // --- GAMES CENTER: 8 DISTINCT SLOT MACHINES ---
  app.post('/api/games/slot-spin', (req, res) => {
    const auth = getAuthUser(req);
    if (!auth) return res.status(401).json({ error: 'غير مصرح.' });
    if (auth.user.is_banned) return res.status(403).json({ error: 'حسابك معلق.' });

    const { gameId, bet } = req.body as {
      gameId?:
        | 'classic_fruits'
        | 'pharaoh_treasures'
        | 'neon_galaxy'
        | 'crown_jewels'
        | 'olympus_gates'
        | 'sea_pirates'
        | 'turbo_racing'
        | 'desert_gold';
      bet?: number;
    };

    const allowedBets = [100, 250, 500, 1000, 2500, 5000];
    const cleanBet = Math.floor(Number(bet) || 0);
    if (!allowedBets.includes(cleanBet)) {
      return res.status(400).json({ error: 'قيمة الرهان غير صالحة.' });
    }
    if (auth.user.coins < cleanBet) {
      return res.status(400).json({ error: 'رصيد الكوينز في محفظتك غير كافٍ لهذه الدورة.' });
    }

    const pickWeighted = <T extends { weight: number }>(pool: T[]): T => {
      const total = pool.reduce((s, x) => s + x.weight, 0);
      let roll = Math.random() * total;
      for (const item of pool) {
        roll -= item.weight;
        if (roll <= 0) return item;
      }
      return pool[0];
    };

    let cols = 3;
    let rows = 3;
    let totalMultiplier = 0;
    const winningCells: Array<[number, number]> = [];
    const rulesTriggered: string[] = [];
    const lightningStrikes: Array<{ row: number; col: number; mult: number }> = [];
    let grid: string[][] = [];

    if (gameId === 'classic_fruits') {
      // 3x3 Classic Fruits with 5 paylines + Center Cherry Pair
      const pool = [
        { s: '🍒', weight: 28, m3: 3 },
        { s: '🍋', weight: 24, m3: 4 },
        { s: '🍇', weight: 20, m3: 6 },
        { s: '🔔', weight: 14, m3: 10 },
        { s: '⭐', weight: 9, m3: 15 },
        { s: '7️⃣', weight: 5, m3: 30 },
      ];
      cols = 3;
      grid = Array.from({ length: rows }, () =>
        Array.from({ length: cols }, () => pickWeighted(pool).s)
      );
      const lines: Array<{ name: string; coords: Array<[number, number]> }> = [
        { name: 'الصف الأوسط', coords: [[1, 0], [1, 1], [1, 2]] },
        { name: 'الصف العلوي', coords: [[0, 0], [0, 1], [0, 2]] },
        { name: 'الصف السفلي', coords: [[2, 0], [2, 1], [2, 2]] },
        { name: 'القطر الرئيسي', coords: [[0, 0], [1, 1], [2, 2]] },
        { name: 'القطر المعاكس', coords: [[2, 0], [1, 1], [0, 2]] },
      ];
      for (const line of lines) {
        const syms = line.coords.map(([r, c]) => grid[r][c]);
        if (syms[0] === syms[1] && syms[1] === syms[2]) {
          const def = pool.find((p) => p.s === syms[0]);
          const mult = def?.m3 || 3;
          totalMultiplier += mult;
          winningCells.push(...line.coords);
          rulesTriggered.push(`${line.name} ${syms[0]} (×${mult})`);
        }
      }
      const centerCherries = grid[1].filter((s) => s === '🍒').length;
      if (centerCherries === 2) {
        totalMultiplier += 1.5;
        grid[1].forEach((s, c) => {
          if (s === '🍒') winningCells.push([1, c]);
        });
        rulesTriggered.push('ثنائي الكرز الذهبي (×1.5)');
      }
    } else if (gameId === 'pharaoh_treasures') {
      // 3x3 Pharaoh Treasures: Horizontal rows + Scarab Scatter anywhere
      const pool = [
        { s: '🏺', weight: 27, m3: 3 },
        { s: '🐍', weight: 23, m3: 6 },
        { s: '⚱️', weight: 19, m3: 9 },
        { s: '☀️', weight: 14, m3: 18 },
        { s: '👁️', weight: 7, m3: 32 },
        { s: '🪲', weight: 10, m3: 15 },
      ];
      cols = 3;
      grid = Array.from({ length: rows }, () =>
        Array.from({ length: cols }, () => pickWeighted(pool).s)
      );
      const rowNames = ['تاج السماء', 'قدس الأقداس', 'معبد النيل'];
      for (let r = 0; r < 3; r++) {
        if (grid[r][0] === grid[r][1] && grid[r][1] === grid[r][2]) {
          const def = pool.find((p) => p.s === grid[r][0]);
          const mult = def?.m3 || 4;
          totalMultiplier += mult;
          winningCells.push([r, 0], [r, 1], [r, 2]);
          rulesTriggered.push(`${rowNames[r]} ${grid[r][0]} (×${mult})`);
        }
      }
      const scarabCoords: Array<[number, number]> = [];
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          if (grid[r][c] === '🪲') scarabCoords.push([r, c]);
        }
      }
      if (scarabCoords.length >= 2) {
        const scatterMult = scarabCoords.length === 2 ? 2.5 : scarabCoords.length === 3 ? 12 : 25;
        totalMultiplier += scatterMult;
        winningCells.push(...scarabCoords);
        rulesTriggered.push(`جعران الحظ المتناثر ×${scarabCoords.length} (×${scatterMult})`);
      }
    } else if (gameId === 'neon_galaxy') {
      // 5x3 Neon Galaxy Matrix with ⚡ Wild (×2 multiplier on line) & 3/4/5 left-to-right matching
      const pool = [
        { s: '👾', weight: 28, m3: 2, m4: 5, m5: 14 },
        { s: '☄️', weight: 24, m3: 3, m4: 8, m5: 20 },
        { s: '🌌', weight: 20, m3: 4, m4: 11, m5: 28 },
        { s: '🪐', weight: 15, m3: 6, m4: 16, m5: 36 },
        { s: '🛸', weight: 7, m3: 10, m4: 25, m5: 50 },
        { s: '⚡', weight: 6, m3: 12, m4: 28, m5: 60 },
      ];
      cols = 5;
      grid = Array.from({ length: rows }, () =>
        Array.from({ length: cols }, () => pickWeighted(pool).s)
      );
      const paylines: Array<{ name: string; rowsIdx: number[] }> = [
        { name: 'مدار النيون الأوسط', rowsIdx: [1, 1, 1, 1, 1] },
        { name: 'مدار النيون العلوي', rowsIdx: [0, 0, 0, 0, 0] },
        { name: 'مدار النيون السفلي', rowsIdx: [2, 2, 2, 2, 2] },
        { name: 'موجة V الكونية', rowsIdx: [0, 1, 2, 1, 0] },
      ];
      for (const line of paylines) {
        const lineSyms = line.rowsIdx.map((r, c) => grid[r][c]);
        const target = lineSyms.find((s) => s !== '⚡') || '⚡';
        let matchLen = 0;
        let hasWild = false;
        for (const sym of lineSyms) {
          if (sym === target || sym === '⚡') {
            if (sym === '⚡' && target !== '⚡') hasWild = true;
            matchLen++;
          } else {
            break;
          }
        }
        if (matchLen >= 3) {
          const def = pool.find((p) => p.s === target) || pool[0];
          const base = matchLen === 5 ? def.m5 : matchLen === 4 ? def.m4 : def.m3;
          const mult = hasWild ? base * 2 : base;
          totalMultiplier += mult;
          for (let c = 0; c < matchLen; c++) {
            winningCells.push([line.rowsIdx[c], c]);
          }
          rulesTriggered.push(
            `${line.name} (${matchLen}× ${target}${hasWild ? ' + ⚡×2' : ''}) = ×${mult}`
          );
        }
      }
    } else if (gameId === 'crown_jewels') {
      // 4x3 Crown Jewels Imperial Vault with 3/4-of-a-kind + Full-Column Royal Match
      const pool = [
        { s: '🔮', weight: 27, m3: 2.5, m4: 8 },
        { s: '⚜️', weight: 23, m3: 3.5, m4: 12 },
        { s: '💍', weight: 20, m3: 5, m4: 18 },
        { s: '🏆', weight: 15, m3: 8, m4: 26 },
        { s: '💎', weight: 10, m3: 12, m4: 38 },
        { s: '👑', weight: 5, m3: 20, m4: 55 },
      ];
      cols = 4;
      grid = Array.from({ length: rows }, () =>
        Array.from({ length: cols }, () => pickWeighted(pool).s)
      );
      for (let r = 0; r < 3; r++) {
        const rowSyms = grid[r];
        if (rowSyms.every((s) => s === rowSyms[0])) {
          const def = pool.find((p) => p.s === rowSyms[0]);
          const mult = def?.m4 || 12;
          totalMultiplier += mult;
          for (let c = 0; c < 4; c++) winningCells.push([r, c]);
          rulesTriggered.push(`تاج رباعي ${rowSyms[0]} (×${mult})`);
        } else if (rowSyms[0] === rowSyms[1] && rowSyms[1] === rowSyms[2]) {
          const def = pool.find((p) => p.s === rowSyms[0]);
          const mult = def?.m3 || 3;
          totalMultiplier += mult;
          winningCells.push([r, 0], [r, 1], [r, 2]);
          rulesTriggered.push(`ثلاثية ملكية ${rowSyms[0]} (×${mult})`);
        } else if (rowSyms[1] === rowSyms[2] && rowSyms[2] === rowSyms[3]) {
          const def = pool.find((p) => p.s === rowSyms[1]);
          const mult = def?.m3 || 3;
          totalMultiplier += mult;
          winningCells.push([r, 1], [r, 2], [r, 3]);
          rulesTriggered.push(`ثلاثية ملكية ${rowSyms[1]} (×${mult})`);
        }
      }
      for (let c = 0; c < 4; c++) {
        if (grid[0][c] === grid[1][c] && grid[1][c] === grid[2][c]) {
          const colSym = grid[0][c];
          const colMult = colSym === '👑' ? 15 : colSym === '💎' ? 10 : 4;
          totalMultiplier += colMult;
          winningCells.push([0, c], [1, c], [2, c]);
          rulesTriggered.push(`عمود التاج #${c + 1} ${colSym} (×${colMult})`);
        }
      }
    } else if (gameId === 'olympus_gates') {
      // 5x4 Legendary Gates of Olympus: Scatter Pays (5+ anywhere) + Zeus Random Lightning Multipliers!
      const pool = [
        { s: '🏛️', weight: 25, base5: 1.5, base7: 4, base9: 12 },
        { s: '⏳', weight: 22, base5: 2, base7: 6, base9: 16 },
        { s: '💍', weight: 20, base5: 2.5, base7: 8, base9: 22 },
        { s: '🏆', weight: 15, base5: 3.5, base7: 11, base9: 30 },
        { s: '👑', weight: 10, base5: 5, base7: 16, base9: 45 },
        { s: '⚡', weight: 8, base5: 0, base7: 0, base9: 0 }, // Zeus Lightning Orb
      ];
      cols = 5;
      rows = 4;
      grid = Array.from({ length: rows }, () =>
        Array.from({ length: cols }, () => pickWeighted(pool).s)
      );

      const counts: Record<string, Array<[number, number]>> = {};
      const lightningPool = [
        { mult: 2, weight: 38 },
        { mult: 3, weight: 25 },
        { mult: 5, weight: 18 },
        { mult: 8, weight: 10 },
        { mult: 15, weight: 6 },
        { mult: 25, weight: 3 },
      ];

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const sym = grid[r][c];
          if (sym === '⚡') {
            const strike = pickWeighted(lightningPool);
            lightningStrikes.push({ row: r, col: c, mult: strike.mult });
          } else {
            if (!counts[sym]) counts[sym] = [];
            counts[sym].push([r, c]);
          }
        }
      }

      let baseScore = 0;
      for (const [sym, coords] of Object.entries(counts)) {
        if (coords.length >= 5) {
          const def = pool.find((p) => p.s === sym);
          if (!def) continue;
          const mult =
            coords.length >= 9 ? def.base9 : coords.length >= 7 ? def.base7 : def.base5;
          baseScore += mult;
          winningCells.push(...coords);
          rulesTriggered.push(`تجمّع ${coords.length}× ${sym} (×${mult})`);
        }
      }

      if (baseScore > 0) {
        const lightningSum = lightningStrikes.reduce((acc, s) => acc + s.mult, 0);
        if (lightningSum > 0) {
          totalMultiplier = baseScore * lightningSum;
          for (const st of lightningStrikes) {
            winningCells.push([st.row, st.col]);
          }
          rulesTriggered.push(
            `⚡ صواعق زيوس العشوائية (${lightningStrikes
              .map((s) => `×${s.mult}`)
              .join(' + ')}) = ×${lightningSum} على كامل الربح!`
          );
        } else {
          totalMultiplier = baseScore;
        }
      }
    } else if (gameId === 'sea_pirates') {
      // 5x3 Sea Pirates: 5 Lines + Treasure Chest Wild + Cannon Bomb Plunder Bonus
      const pool = [
        { s: '⚓', weight: 26, m3: 2, m4: 5, m5: 14 },
        { s: '🧭', weight: 22, m3: 3, m4: 8, m5: 20 },
        { s: '🦜', weight: 19, m3: 4, m4: 11, m5: 28 },
        { s: '🏴‍☠️', weight: 14, m3: 6, m4: 18, m5: 42 },
        { s: '💰', weight: 8, m3: 10, m4: 24, m5: 60 }, // Wild Chest
        { s: '💣', weight: 11, m3: 3, m4: 8, m5: 18 }, // Cannon scatter
      ];
      cols = 5;
      rows = 3;
      grid = Array.from({ length: rows }, () =>
        Array.from({ length: cols }, () => pickWeighted(pool).s)
      );

      const pirateLines: Array<{ name: string; rowsIdx: number[] }> = [
        { name: 'خط الأفق الأوسط', rowsIdx: [1, 1, 1, 1, 1] },
        { name: 'أشرعة القمة', rowsIdx: [0, 0, 0, 0, 0] },
        { name: 'قاع السفينة', rowsIdx: [2, 2, 2, 2, 2] },
        { name: 'مسار القبطان V', rowsIdx: [0, 1, 2, 1, 0] },
        { name: 'موجة العاصفة Λ', rowsIdx: [2, 1, 0, 1, 2] },
      ];

      for (const line of pirateLines) {
        const syms = line.rowsIdx.map((r, c) => grid[r][c]);
        const target = syms.find((s) => s !== '💰') || '💰';
        let matchLen = 0;
        let usedChest = false;
        for (const s of syms) {
          if (s === target || s === '💰') {
            if (s === '💰' && target !== '💰') usedChest = true;
            matchLen++;
          } else {
            break;
          }
        }
        if (matchLen >= 3) {
          const def = pool.find((p) => p.s === target) || pool[0];
          const mult = matchLen === 5 ? def.m5 : matchLen === 4 ? def.m4 : def.m3;
          totalMultiplier += mult;
          for (let c = 0; c < matchLen; c++) winningCells.push([line.rowsIdx[c], c]);
          rulesTriggered.push(
            `${line.name} (${matchLen}× ${target}${usedChest ? ' + 💰' : ''}) = ×${mult}`
          );
        }
      }

      // Cannon Plunder scatter: 3+ 💣 anywhere on deck
      const bombs: Array<[number, number]> = [];
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 5; c++) {
          if (grid[r][c] === '💣') bombs.push([r, c]);
        }
      }
      if (bombs.length >= 3) {
        const plunderMult = bombs.length >= 5 ? 18 : bombs.length === 4 ? 9 : 4;
        totalMultiplier += plunderMult;
        winningCells.push(...bombs);
        rulesTriggered.push(`قصف المدافع 💣×${bombs.length} (+×${plunderMult})`);
      }
    } else if (gameId === 'turbo_racing') {
      // 4x3 Turbo Car Racing: Speed Rows + Nitro Boost 🔥 (+50% per nitro on winning row)
      const pool = [
        { s: '🛞', weight: 26, m3: 2.5, m4: 7 },
        { s: '⛽', weight: 22, m3: 3.5, m4: 10 },
        { s: '🏁', weight: 19, m3: 5, m4: 16 },
        { s: '🏆', weight: 14, m3: 8, m4: 26 },
        { s: '🏎️', weight: 9, m3: 15, m4: 50 },
        { s: '🔥', weight: 10, m3: 6, m4: 20 }, // Nitro Boost
      ];
      cols = 4;
      rows = 3;
      grid = Array.from({ length: rows }, () =>
        Array.from({ length: cols }, () => pickWeighted(pool).s)
      );

      const lanes = ['حارة الانطلاق', 'حارة السرعة', 'حارة التجاوز'];
      for (let r = 0; r < 3; r++) {
        const rowSyms = grid[r];
        const nitrosInRow = rowSyms.filter((s) => s === '🔥').length;
        const nitroBoost = 1 + nitrosInRow * 0.5;
        let rowBase = 0;
        let matchedCols: number[] = [];
        let matchedSym = '';

        if (rowSyms.every((s) => s === rowSyms[0])) {
          const def = pool.find((p) => p.s === rowSyms[0]);
          rowBase = def?.m4 || 10;
          matchedCols = [0, 1, 2, 3];
          matchedSym = rowSyms[0];
        } else if (rowSyms[0] === rowSyms[1] && rowSyms[1] === rowSyms[2]) {
          const def = pool.find((p) => p.s === rowSyms[0]);
          rowBase = def?.m3 || 3;
          matchedCols = [0, 1, 2];
          matchedSym = rowSyms[0];
        } else if (rowSyms[1] === rowSyms[2] && rowSyms[2] === rowSyms[3]) {
          const def = pool.find((p) => p.s === rowSyms[1]);
          rowBase = def?.m3 || 3;
          matchedCols = [1, 2, 3];
          matchedSym = rowSyms[1];
        }

        if (rowBase > 0) {
          const finalRowMult = Math.round(rowBase * nitroBoost * 10) / 10;
          totalMultiplier += finalRowMult;
          matchedCols.forEach((c) => winningCells.push([r, c]));
          if (nitrosInRow > 0) {
            rowSyms.forEach((s, c) => {
              if (s === '🔥') winningCells.push([r, c]);
            });
          }
          rulesTriggered.push(
            `${lanes[r]} ${matchedSym}${
              nitrosInRow > 0 ? ` + نايترو 🔥×${nitrosInRow}` : ''
            } (×${finalRowMult})`
          );
        }
      }

      // Check 3+ 🏎️ anywhere for Grand Prix drift bonus
      const cars: Array<[number, number]> = [];
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 4; c++) {
          if (grid[r][c] === '🏎️') cars.push([r, c]);
        }
      }
      if (cars.length >= 3) {
        const gpMult = cars.length >= 4 ? 14 : 4;
        totalMultiplier += gpMult;
        winningCells.push(...cars);
        rulesTriggered.push(`انطلاقة الجائزة الكبرى 🏎️×${cars.length} (+×${gpMult})`);
      }
    } else if (gameId === 'desert_gold') {
      // 3x3 Desert Gold: 5 Arabian Lines + Coin Scatter + Center Magic Lamp 🪔 ×2
      const pool = [
        { s: '🌴', weight: 27, m3: 3 },
        { s: '🐪', weight: 23, m3: 5 },
        { s: '🗡️', weight: 18, m3: 9 },
        { s: '🏜️', weight: 12, m3: 16 },
        { s: '🪔', weight: 8, m3: 24 },
        { s: '🪙', weight: 12, m3: 32 },
      ];
      cols = 3;
      rows = 3;
      grid = Array.from({ length: rows }, () =>
        Array.from({ length: cols }, () => pickWeighted(pool).s)
      );

      const desertLines: Array<{ name: string; coords: Array<[number, number]> }> = [
        { name: 'كثبان الوسط', coords: [[1, 0], [1, 1], [1, 2]] },
        { name: 'نخيل الواحة', coords: [[0, 0], [0, 1], [0, 2]] },
        { name: 'قافلة الذهب', coords: [[2, 0], [2, 1], [2, 2]] },
        { name: 'مسار السراب ١', coords: [[0, 0], [1, 1], [2, 2]] },
        { name: 'مسار السراب ٢', coords: [[2, 0], [1, 1], [0, 2]] },
      ];

      for (const line of desertLines) {
        const syms = line.coords.map(([r, c]) => grid[r][c]);
        if (syms[0] === syms[1] && syms[1] === syms[2]) {
          const def = pool.find((p) => p.s === syms[0]);
          const mult = def?.m3 || 3;
          totalMultiplier += mult;
          winningCells.push(...line.coords);
          rulesTriggered.push(`${line.name} ${syms[0]} (×${mult})`);
        }
      }

      const coinCoords: Array<[number, number]> = [];
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          if (grid[r][c] === '🪙') coinCoords.push([r, c]);
        }
      }
      if (coinCoords.length >= 3) {
        const coinMult = coinCoords.length >= 4 ? 12 : 3.5;
        totalMultiplier += coinMult;
        winningCells.push(...coinCoords);
        rulesTriggered.push(`كنز الدنانير 🪙×${coinCoords.length} (+×${coinMult})`);
      }

      if (totalMultiplier > 0 && grid[1][1] === '🪔') {
        totalMultiplier = Math.round(totalMultiplier * 2 * 10) / 10;
        winningCells.push([1, 1]);
        rulesTriggered.push('مصباح الواحة الأوسط 🪔 ضاعف الربح ×2!');
      }
    } else {
      return res.status(400).json({ error: 'لعبة السلوت غير معروفة.' });
    }

    const db = getDb();
    const targetSlotsWinRate = db.settings.gameRates?.slotsWinRate ?? 38;
    // Enforce Super Admin profitability rate on slot outcomes cleanly
    if (totalMultiplier > 0 && Math.random() * 100 > targetSlotsWinRate) {
      // Neutralize winning line visually by swapping one cell symbol cleanly
      const allSyms =
        grid.flat().filter((v, i, a) => a.indexOf(v) === i);
      for (const [wr, wc] of winningCells.slice(0, 3)) {
        const current = grid[wr]?.[wc];
        const alt = allSyms.find((s) => s !== current);
        if (alt && grid[wr]) {
          grid[wr][wc] = alt;
        }
      }
      totalMultiplier = 0;
      winningCells.length = 0;
      rulesTriggered.length = 0;
      lightningStrikes.length = 0;
    }

    const payout = Math.round(cleanBet * totalMultiplier);
    const netDelta = payout - cleanBet;
    const now = new Date().toISOString();

    auth.user.coins -= cleanBet;
    if (payout > 0) {
      auth.user.coins += payout;
    }
    const xpGain = Math.max(10, Math.round(cleanBet / 40) + (payout > 0 ? 35 : 0));
    auth.user.xp += xpGain;
    auth.user.level = computeLevelFromXp(auth.user.xp);
    const gameTitles: Record<string, string> = {
      classic_fruits: 'سلوت الفواكه الكلاسيكي',
      pharaoh_treasures: 'كنوز الفراعنة',
      neon_galaxy: 'مجرة النيون',
      crown_jewels: 'جواهر التاج',
      olympus_gates: 'بوابات الأوليمبوس',
      sea_pirates: 'قراصنة البحار',
      turbo_racing: 'سباق السيارات',
      desert_gold: 'ذهب الصحراء',
    };
    const title = gameTitles[gameId] || 'مركز الألعاب';

    if (payout > 0) {
      db.transactions.unshift({
        id: `tx_${crypto.randomUUID().slice(0, 8)}`,
        userId: auth.user.id,
        type: 'slot_win',
        amount: payout,
        currency: 'coins',
        description: `ربح ${title} (×${Math.round(totalMultiplier * 10) / 10} · رهان ${cleanBet.toLocaleString('en-US')})`,
        timestamp: now,
      });
    } else {
      db.transactions.unshift({
        id: `tx_${crypto.randomUUID().slice(0, 8)}`,
        userId: auth.user.id,
        type: 'slot_spin',
        amount: -cleanBet,
        currency: 'coins',
        description: `دورة ${title}`,
        timestamp: now,
      });
    }

    saveDb();

    return res.json({
      gameId,
      bet: cleanBet,
      grid,
      cols,
      rows,
      multiplier: Math.round(totalMultiplier * 10) / 10,
      payout,
      netDelta,
      xpGain,
      winningCells,
      rulesTriggered,
      lightningStrikes,
      jackpotHit: totalMultiplier >= 20,
      user: sanitizeUser(auth.user),
    });
  });

  // --- DICE GAMES (DOUBLE DICE, PREDICTION DICE, SPEED DICE) ---
  app.post('/api/games/dice-play', (req, res) => {
    const auth = getAuthUser(req);
    if (!auth) return res.status(401).json({ error: 'غير مصرح.' });
    if (auth.user.is_banned) return res.status(403).json({ error: 'حسابك معلق.' });

    const { gameId, bet, pick } = req.body as {
      gameId?: 'double_dice' | 'prediction_dice' | 'speed_dice';
      bet?: number;
      pick?: string;
    };

    const allowedBets = [100, 250, 500, 1000, 2500, 5000];
    const cleanBet = Math.floor(Number(bet) || 0);
    if (!allowedBets.includes(cleanBet)) {
      return res.status(400).json({ error: 'قيمة الرهان غير صالحة.' });
    }
    if (auth.user.coins < cleanBet) {
      return res.status(400).json({ error: 'رصيد الكوينز غير كافٍ.' });
    }

    const db = getDb();
    const rates = db.settings.gameRates || {
      slotsWinRate: 38,
      doubleDiceWinRate: 42,
      predictionDiceWinRate: 40,
      ladderDiceWinRate: 58,
      speedDiceWinRate: 44,
      rouletteWinRate: 45,
      mysteryBoxWinRate: 42,
    };

    let dice: number[] = [];
    let multiplier = 0;
    let label = '';
    let won = false;
    const randDie = () => 1 + Math.floor(Math.random() * 6);

    if (gameId === 'double_dice') {
      const choice = pick || 'high';
      const multMap: Record<string, number> = {
        high: 1.95,
        low: 1.95,
        seven: 4.2,
        doubles: 4.8,
      };
      const targetMult = multMap[choice] || 1.95;
      // Scale higher-multiplier bets proportionally against admin doubleDiceWinRate
      const effectiveProb =
        choice === 'doubles' || choice === 'seven'
          ? Math.max(8, Math.round(rates.doubleDiceWinRate * 0.45))
          : rates.doubleDiceWinRate;
      won = Math.random() * 100 < effectiveProb;

      const matchesChoice = (d1: number, d2: number) => {
        const s = d1 + d2;
        if (choice === 'high') return s >= 8;
        if (choice === 'low') return s <= 6;
        if (choice === 'seven') return s === 7;
        if (choice === 'doubles') return d1 === d2;
        return false;
      };

      for (let i = 0; i < 60; i++) {
        const a = randDie();
        const b = randDie();
        if (matchesChoice(a, b) === won) {
          dice = [a, b];
          break;
        }
      }
      if (dice.length === 0) {
        dice = won
          ? choice === 'low'
            ? [2, 3]
            : choice === 'seven'
            ? [3, 4]
            : choice === 'doubles'
            ? [5, 5]
            : [5, 4]
          : choice === 'high'
          ? [1, 3]
          : [4, 5];
      }
      if (won) multiplier = targetMult;
      label = won ? `فوز نرد الحظ المزدوج (المجموع ${dice[0] + dice[1]})` : `خسارة نرد الحظ المزدوج (${dice[0]} + ${dice[1]})`;
    } else if (gameId === 'prediction_dice') {
      const choice = pick || 'even';
      const isExact = choice.startsWith('exact_');
      const exactNum = isExact ? Math.max(1, Math.min(6, Number(choice.split('_')[1]) || 6)) : 0;
      const targetMult = isExact ? 5.2 : 1.92;
      const effectiveProb = isExact
        ? Math.max(8, Math.round(rates.predictionDiceWinRate * 0.42))
        : rates.predictionDiceWinRate;
      won = Math.random() * 100 < effectiveProb;

      const matches = (d: number) => {
        if (isExact) return d === exactNum;
        if (choice === 'even') return d % 2 === 0;
        return d % 2 === 1;
      };

      const candidates = [1, 2, 3, 4, 5, 6].filter((n) => matches(n) === won);
      const picked = candidates[Math.floor(Math.random() * candidates.length)] || 1;
      dice = [picked];
      if (won) multiplier = targetMult;
      label = won ? `توقع صائب! ظهر الرقم ${picked}` : `ظهر الرقم ${picked} — حظاً أوفر`;
    } else if (gameId === 'speed_dice') {
      const choice = pick || 'over_11';
      const multMap: Record<string, number> = {
        under_10: 1.9,
        over_11: 1.9,
        lucky_16: 4.5,
        triple: 12,
      };
      const targetMult = multMap[choice] || 1.9;
      const effectiveProb =
        choice === 'triple'
          ? Math.max(4, Math.round(rates.speedDiceWinRate * 0.22))
          : choice === 'lucky_16'
          ? Math.max(10, Math.round(rates.speedDiceWinRate * 0.45))
          : rates.speedDiceWinRate;
      won = Math.random() * 100 < effectiveProb;

      const matchesSpeed = (a: number, b: number, c: number) => {
        const s = a + b + c;
        if (choice === 'under_10') return s <= 10;
        if (choice === 'over_11') return s >= 11;
        if (choice === 'lucky_16') return s >= 16;
        if (choice === 'triple') return a === b && b === c;
        return false;
      };

      for (let i = 0; i < 80; i++) {
        const a = randDie();
        const b = randDie();
        const c = randDie();
        if (matchesSpeed(a, b, c) === won) {
          dice = [a, b, c];
          break;
        }
      }
      if (dice.length === 0) {
        dice = won
          ? choice === 'under_10'
            ? [2, 3, 4]
            : choice === 'lucky_16'
            ? [5, 6, 5]
            : choice === 'triple'
            ? [6, 6, 6]
            : [4, 5, 4]
          : choice === 'under_10'
          ? [5, 4, 6]
          : [1, 2, 2];
      }
      if (won) multiplier = targetMult;
      label = won
        ? `نرد السرعة الخاطف! المجموع ${dice.reduce((x, y) => x + y, 0)}`
        : `نتيجة نرد السرعة: ${dice.reduce((x, y) => x + y, 0)}`;
    } else {
      return res.status(400).json({ error: 'لعبة النرد غير صالحة.' });
    }

    const payout = Math.round(cleanBet * multiplier);
    const now = new Date().toISOString();
    auth.user.coins -= cleanBet;
    if (payout > 0) auth.user.coins += payout;

    const xpGain = Math.max(10, Math.round(cleanBet / 45) + (won ? 35 : 0));
    auth.user.xp += xpGain;
    auth.user.level = computeLevelFromXp(auth.user.xp);

    db.transactions.unshift({
      id: `tx_${crypto.randomUUID().slice(0, 8)}`,
      userId: auth.user.id,
      type: won ? 'game_win' : 'game_bet',
      amount: won ? payout : -cleanBet,
      currency: 'coins',
      description: label,
      timestamp: now,
    });
    saveDb();

    return res.json({
      gameId,
      bet: cleanBet,
      dice,
      won,
      multiplier,
      payout,
      xpGain,
      label,
      user: sanitizeUser(auth.user),
    });
  });

  // --- LADDER DICE (نرد السلم التفاعلي من 5 درجات) ---
  app.get('/api/games/ladder-state', (req, res) => {
    const auth = getAuthUser(req);
    if (!auth) return res.status(401).json({ error: 'غير مصرح.' });
    const db = getDb();
    const session = db.ladderSessions?.[auth.user.id] || null;
    return res.json({ session });
  });

  app.post('/api/games/ladder-action', (req, res) => {
    const auth = getAuthUser(req);
    if (!auth) return res.status(401).json({ error: 'غير مصرح.' });
    const db = getDb();
    if (!db.ladderSessions) db.ladderSessions = {};

    const { action, bet } = req.body as { action?: 'roll' | 'cashout'; bet?: number };
    const ladderMultipliers = [1, 1.4, 2.2, 3.6, 6.5, 12.0];
    const now = new Date().toISOString();

    if (action === 'cashout') {
      const existing = db.ladderSessions[auth.user.id];
      if (!existing || existing.step <= 0) {
        return res.status(400).json({ error: 'لا توجد جولة سلم نشطة لسحب أرباحها.' });
      }
      const payout = Math.round(existing.bet * existing.currentMultiplier);
      auth.user.coins += payout;
      auth.user.xp += 35;
      auth.user.level = computeLevelFromXp(auth.user.xp);

      db.transactions.unshift({
        id: `tx_${crypto.randomUUID().slice(0, 8)}`,
        userId: auth.user.id,
        type: 'game_win',
        amount: payout,
        currency: 'coins',
        description: `سحب أرباح نرد السلم (الدرجة ${existing.step} · ×${existing.currentMultiplier})`,
        timestamp: now,
      });
      delete db.ladderSessions[auth.user.id];
      saveDb();

      return res.json({
        status: 'cashed_out',
        payout,
        multiplier: existing.currentMultiplier,
        step: existing.step,
        die: 6,
        session: null,
        message: `تم تأمين أرباح السلم عند الدرجة ${existing.step}: +${payout.toLocaleString('en-US')} كوينز!`,
        user: sanitizeUser(auth.user),
      });
    }

    // action === 'roll'
    let session = db.ladderSessions[auth.user.id];
    if (!session) {
      const allowedBets = [100, 250, 500, 1000, 2500, 5000];
      const cleanBet = Math.floor(Number(bet) || 0);
      if (!allowedBets.includes(cleanBet)) {
        return res.status(400).json({ error: 'قيمة الرهان غير صالحة.' });
      }
      if (auth.user.coins < cleanBet) {
        return res.status(400).json({ error: 'رصيد الكوينز غير كافٍ لبدء الصعود.' });
      }
      auth.user.coins -= cleanBet;
      db.transactions.unshift({
        id: `tx_${crypto.randomUUID().slice(0, 8)}`,
        userId: auth.user.id,
        type: 'game_bet',
        amount: -cleanBet,
        currency: 'coins',
        description: `بدء تحدي نرد السلم (${cleanBet.toLocaleString('en-US')} كوينز)`,
        timestamp: now,
      });
      session = { bet: cleanBet, step: 0, currentMultiplier: 1 };
      db.ladderSessions[auth.user.id] = session;
    }

    const ladderRate = db.settings.gameRates?.ladderDiceWinRate ?? 58;
    // Step slightly tightens probability as user climbs higher
    const stepChance = Math.max(18, ladderRate - session.step * 6);
    const climbed = Math.random() * 100 < stepChance;

    if (!climbed) {
      const failDie = Math.random() < 0.5 ? 1 : 2;
      const lostBet = session.bet;
      delete db.ladderSessions[auth.user.id];
      auth.user.xp += 12;
      auth.user.level = computeLevelFromXp(auth.user.xp);
      saveDb();

      return res.json({
        status: 'fell',
        payout: 0,
        multiplier: 0,
        step: 0,
        die: failDie,
        bet: lostBet,
        session: null,
        message: `انزلقت النرد (${failDie}) وسقطت من السلم! حاول مجدداً.`,
        user: sanitizeUser(auth.user),
      });
    }

    const jumpTwo = Math.random() < 0.22 && session.step <= 3;
    const rollDie = jumpTwo ? 6 : 3 + Math.floor(Math.random() * 3);
    const nextStep = Math.min(5, session.step + (jumpTwo ? 2 : 1));
    const nextMult = ladderMultipliers[nextStep];
    session.step = nextStep;
    session.currentMultiplier = nextMult;

    if (nextStep >= 5) {
      const payout = Math.round(session.bet * nextMult);
      auth.user.coins += payout;
      auth.user.xp += 120;
      auth.user.level = computeLevelFromXp(auth.user.xp);
      db.transactions.unshift({
        id: `tx_${crypto.randomUUID().slice(0, 8)}`,
        userId: auth.user.id,
        type: 'game_win',
        amount: payout,
        currency: 'coins',
        description: `قمة نرد السلم الذهبي! (×${nextMult})`,
        timestamp: now,
      });
      delete db.ladderSessions[auth.user.id];
      saveDb();

      return res.json({
        status: 'summit',
        payout,
        multiplier: nextMult,
        step: 5,
        die: rollDie,
        session: null,
        message: `وصلت لقمة السلم الملكي! فوز تلقائي +${payout.toLocaleString('en-US')} كوينز (×${nextMult})`,
        user: sanitizeUser(auth.user),
      });
    }

    saveDb();
    return res.json({
      status: 'climbed',
      payout: 0,
      multiplier: nextMult,
      step: nextStep,
      die: rollDie,
      session,
      message: jumpTwo
        ? `قفزة مزدوجة 🎲 (${rollDie})! صعدت إلى الدرجة ${nextStep} (×${nextMult})`
        : `صعود ناجح 🎲 (${rollDie}) إلى الدرجة ${nextStep} (×${nextMult})`,
      user: sanitizeUser(auth.user),
    });
  });

  // --- ROYAL ROULETTE (37 POCKETS) ---
  const ROULETTE_WHEEL_ORDER = [
    0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16,
    33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
  ];
  const ROULETTE_REDS = new Set([
    1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
  ]);

  app.post('/api/games/roulette-spin', (req, res) => {
    const auth = getAuthUser(req);
    if (!auth) return res.status(401).json({ error: 'غير مصرح.' });
    if (auth.user.is_banned) return res.status(403).json({ error: 'حسابك معلق.' });

    const { bet, betType, targetNumber } = req.body as {
      bet?: number;
      betType?:
        | 'red'
        | 'black'
        | 'even'
        | 'odd'
        | 'dozen_1'
        | 'dozen_2'
        | 'dozen_3'
        | 'zero'
        | 'straight';
      targetNumber?: number;
    };

    const allowedBets = [100, 250, 500, 1000, 2500, 5000];
    const cleanBet = Math.floor(Number(bet) || 0);
    if (!allowedBets.includes(cleanBet)) {
      return res.status(400).json({ error: 'قيمة الرهان غير صالحة.' });
    }
    if (auth.user.coins < cleanBet) {
      return res.status(400).json({ error: 'رصيد الكوينز غير كافٍ.' });
    }

    const db = getDb();
    const rouletteRate = db.settings.gameRates?.rouletteWinRate ?? 45;
    const type = betType || 'red';
    const cleanTarget = Math.max(0, Math.min(36, Math.floor(Number(targetNumber) || 7)));

    const multByType: Record<string, number> = {
      red: 2,
      black: 2,
      even: 2,
      odd: 2,
      dozen_1: 3,
      dozen_2: 3,
      dozen_3: 3,
      zero: 28,
      straight: 32,
    };
    const targetMult = multByType[type] || 2;
    const effectiveProb =
      type === 'straight' || type === 'zero'
        ? Math.max(2, Math.min(12, Math.round(rouletteRate * 0.1)))
        : type.startsWith('dozen')
        ? Math.max(12, Math.round(rouletteRate * 0.65))
        : rouletteRate;

    const won = Math.random() * 100 < effectiveProb;
    const matchesPocket = (n: number): boolean => {
      if (type === 'zero') return n === 0;
      if (type === 'straight') return n === cleanTarget;
      if (n === 0) return false;
      if (type === 'red') return ROULETTE_REDS.has(n);
      if (type === 'black') return !ROULETTE_REDS.has(n);
      if (type === 'even') return n % 2 === 0;
      if (type === 'odd') return n % 2 === 1;
      if (type === 'dozen_1') return n >= 1 && n <= 12;
      if (type === 'dozen_2') return n >= 13 && n <= 24;
      if (type === 'dozen_3') return n >= 25 && n <= 36;
      return false;
    };

    const pool = ROULETTE_WHEEL_ORDER.filter((n) => matchesPocket(n) === won);
    const winningNumber = pool[Math.floor(Math.random() * pool.length)] ?? 0;
    const winningColor =
      winningNumber === 0 ? 'green' : ROULETTE_REDS.has(winningNumber) ? 'red' : 'black';
    const wheelIndex = ROULETTE_WHEEL_ORDER.indexOf(winningNumber);

    const payout = won ? Math.round(cleanBet * targetMult) : 0;
    const now = new Date().toISOString();
    auth.user.coins -= cleanBet;
    if (payout > 0) auth.user.coins += payout;
    const xpGain = Math.max(12, Math.round(cleanBet / 40) + (won ? 45 : 0));
    auth.user.xp += xpGain;
    auth.user.level = computeLevelFromXp(auth.user.xp);

    db.transactions.unshift({
      id: `tx_${crypto.randomUUID().slice(0, 8)}`,
      userId: auth.user.id,
      type: won ? 'game_win' : 'game_bet',
      amount: won ? payout : -cleanBet,
      currency: 'coins',
      description: won
        ? `فوز الروليت الملكية (#${winningNumber} · ×${targetMult})`
        : `دورة الروليت الملكية (#${winningNumber})`,
      timestamp: now,
    });
    saveDb();

    return res.json({
      winningNumber,
      winningColor,
      wheelIndex,
      won,
      multiplier: won ? targetMult : 0,
      payout,
      bet: cleanBet,
      xpGain,
      user: sanitizeUser(auth.user),
    });
  });

  // --- MYSTERY BOXES (9 CLOSED ROYAL CHESTS) ---
  app.post('/api/games/mystery-box', (req, res) => {
    const auth = getAuthUser(req);
    if (!auth) return res.status(401).json({ error: 'غير مصرح.' });
    if (auth.user.is_banned) return res.status(403).json({ error: 'حسابك معلق.' });

    const { bet, boxIndex } = req.body as { bet?: number; boxIndex?: number };
    const allowedBets = [100, 250, 500, 1000, 2500, 5000];
    const cleanBet = Math.floor(Number(bet) || 0);
    if (!allowedBets.includes(cleanBet)) {
      return res.status(400).json({ error: 'قيمة الرهان غير صالحة.' });
    }
    const chosenIndex = Math.max(0, Math.min(8, Math.floor(Number(boxIndex) || 0)));
    if (auth.user.coins < cleanBet) {
      return res.status(400).json({ error: 'رصيد الكوينز غير كافٍ.' });
    }

    const db = getDb();
    const boxRate = db.settings.gameRates?.mysteryBoxWinRate ?? 42;
    const won = Math.random() * 100 < boxRate;

    const winMultipliers = [
      { mult: 1.4, label: 'كنز فضي', weight: 38, glyph: '🪙' },
      { mult: 2.2, label: 'سبائك ذهب', weight: 30, glyph: '💰' },
      { mult: 3.5, label: 'تاج الياقوت', weight: 18, glyph: '👑' },
      { mult: 6.0, label: 'خزنة الملوك', weight: 10, glyph: '💎' },
      { mult: 12.0, label: 'الكنز الأسطوري', weight: 4, glyph: '🏆' },
    ];
    const pickWinPrize = () => {
      const total = winMultipliers.reduce((s, x) => s + x.weight, 0);
      let roll = Math.random() * total;
      for (const item of winMultipliers) {
        roll -= item.weight;
        if (roll <= 0) return item;
      }
      return winMultipliers[0];
    };

    const chosenPrize = won
      ? pickWinPrize()
      : { mult: 0, label: 'صندوق فارغ', glyph: '🕸️' };

    // Build all 9 boxes cleanly ensuring genuine visual distribution
    const boxes = Array.from({ length: 9 }, (_, idx) => {
      if (idx === chosenIndex) {
        return {
          index: idx,
          multiplier: chosenPrize.mult,
          coins: Math.round(cleanBet * chosenPrize.mult),
          label: chosenPrize.label,
          glyph: chosenPrize.glyph,
          isChosen: true,
        };
      }
      const decoyWin = idx % 2 === 0;
      const decoy = decoyWin
        ? pickWinPrize()
        : { mult: 0, label: 'صندوق فارغ', glyph: '🕸️' };
      return {
        index: idx,
        multiplier: decoy.mult,
        coins: Math.round(cleanBet * decoy.mult),
        label: decoy.label,
        glyph: decoy.glyph,
        isChosen: false,
      };
    });

    const payout = Math.round(cleanBet * chosenPrize.mult);
    const now = new Date().toISOString();
    auth.user.coins -= cleanBet;
    if (payout > 0) auth.user.coins += payout;
    const xpGain = Math.max(12, Math.round(cleanBet / 40) + (won ? 40 : 0));
    auth.user.xp += xpGain;
    auth.user.level = computeLevelFromXp(auth.user.xp);

    db.transactions.unshift({
      id: `tx_${crypto.randomUUID().slice(0, 8)}`,
      userId: auth.user.id,
      type: won ? 'game_win' : 'game_bet',
      amount: won ? payout : -cleanBet,
      currency: 'coins',
      description: won
        ? `فتح صندوق الحظ #${chosenIndex + 1} (${chosenPrize.label} · ×${chosenPrize.mult})`
        : `فتح صندوق الحظ #${chosenIndex + 1} (فارغ)`,
      timestamp: now,
    });
    saveDb();

    return res.json({
      chosenIndex,
      boxes,
      won,
      multiplier: chosenPrize.mult,
      payout,
      bet: cleanBet,
      xpGain,
      user: sanitizeUser(auth.user),
    });
  });

  // --- PRIVATE MESSAGES & AUTOMATIC DIAMOND REWARDS ---
  app.get('/api/pm/overview', (req, res) => {
    const auth = getAuthUser(req);
    if (!auth) return res.status(401).json({ error: 'غير مصرح.' });
    const db = getDb();

    const myId = auth.user.id;
    const myMsgs = db.privateMessages.filter(
      (m) => m.senderId === myId || m.recipientId === myId
    );

    const convMap = new Map<string, PrivateMessage[]>();
    for (const m of myMsgs) {
      const list = convMap.get(m.conversationId) || [];
      list.push(m);
      convMap.set(m.conversationId, list);
    }

    const conversations = Array.from(convMap.entries())
      .map(([convId, msgs]) => {
        const sorted = msgs
          .slice()
          .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        const sample = sorted[0];
        const peerId = sample.senderId === myId ? sample.recipientId : sample.senderId;
        const peerUser = db.users.find((u) => u.id === peerId);
        if (!peerUser) return null;
        const pendingDiamondsForMe = sorted
          .filter((m) => m.recipientId === myId && !m.diamondsClaimed && m.diamondsPotential > 0)
          .reduce((sum, m) => sum + m.diamondsPotential, 0);
        return {
          id: convId,
          peer: {
            id: peerUser.id,
            displayName: peerUser.displayName,
            avatarUrl: peerUser.avatarUrl,
            frameId: peerUser.frameId,
            level: peerUser.level,
            gender: peerUser.gender || 'male',
            femaleVerified: Boolean(peerUser.femaleVerified),
            femaleVerifiedBadge: peerUser.femaleVerifiedBadge || null,
            isHost: isFemaleOrHost(peerUser, db),
            is_admin: peerUser.is_admin,
            bio: peerUser.bio,
          },
          messages: sorted,
          pendingDiamondsForMe,
          lastMessage: sorted[sorted.length - 1] || null,
        };
      })
      .filter((c): c is NonNullable<typeof c> => c !== null)
      .sort((a, b) => {
        const ta = a.lastMessage ? new Date(a.lastMessage.createdAt).getTime() : 0;
        const tb = b.lastMessage ? new Date(b.lastMessage.createdAt).getTime() : 0;
        return tb - ta;
      });

    const recipients = db.users
      .filter((u) => u.id !== myId && !u.is_banned && isFemaleOrHost(u, db))
      .map((u) => ({
        id: u.id,
        displayName: u.displayName,
        avatarUrl: u.avatarUrl,
        frameId: u.frameId,
        level: u.level,
        gender: u.gender || 'male',
        femaleVerified: Boolean(u.femaleVerified),
        femaleVerifiedBadge: u.femaleVerifiedBadge || null,
        isHost: isFemaleOrHost(u, db),
        is_admin: u.is_admin,
        bio: u.bio,
      }));

    const pendingDiamondsTotal = conversations.reduce(
      (sum, c) => sum + c.pendingDiamondsForMe,
      0
    );

    return res.json({
      conversations,
      recipients,
      gifts: GIFT_CATALOG,
      pmMessageCost: db.settings.pmMessageCost,
      pmReplyDiamonds: db.settings.pmReplyDiamonds,
      pendingDiamondsTotal,
      canReceivePaidPm: isFemaleOrHost(auth.user, db),
      isFemaleVoiceLocked: isFemaleVoiceLocked(auth.user),
      femaleVoiceStatus:
        auth.user.femaleVoiceStatus ||
        (auth.user.gender === 'female' ? 'unverified' : 'none'),
    });
  });

  app.post('/api/pm/send', (req, res) => {
    const auth = getAuthUser(req);
    if (!auth) return res.status(401).json({ error: 'غير مصرح.' });
    if (auth.user.is_banned) return res.status(403).json({ error: 'حسابك معلق.' });

    const { recipientId, text = '', giftId } = req.body as {
      recipientId?: string;
      text?: string;
      giftId?: string;
    };

    const db = getDb();
    const recipient = db.users.find((u) => u.id === recipientId);
    if (!recipient || recipient.id === auth.user.id) {
      return res.status(404).json({ error: 'المستلم غير موجود.' });
    }
    if (isFemaleVoiceLocked(recipient)) {
      return res.status(403).json({
        error: 'حساب هذه العضوة بانتظار التوثيق الصوتي من الإدارة — استقبال الرسائل المدفوعة والألماس مقفل مؤقتاً.',
      });
    }

    const cleanText = text.trim().slice(0, 400);
    if (!cleanText && !giftId) {
      return res.status(400).json({ error: 'يرجى كتابة رسالة أو اختيار هدية لإرسالها.' });
    }

    const convId = makeConversationId(auth.user.id, recipient.id);
    const now = new Date().toISOString();
    const senderEligibleForDiamonds =
      !isFemaleVoiceLocked(auth.user) && isFemaleOrHost(auth.user, db);
    const recipientEligibleForPaidPm = isFemaleOrHost(recipient, db);

    // Check if sender is replying to unclaimed paid messages from recipient
    const unclaimedIncoming = db.privateMessages.filter(
      (m) =>
        m.conversationId === convId &&
        m.senderId === recipient.id &&
        m.recipientId === auth.user.id &&
        !m.diamondsClaimed &&
        m.diamondsPotential > 0
    );

    let unlockedReplyDiamonds = 0;
    if (senderEligibleForDiamonds && unclaimedIncoming.length > 0 && !giftId) {
      for (const incoming of unclaimedIncoming) {
        incoming.diamondsClaimed = true;
        incoming.diamondsAwarded = incoming.diamondsPotential;
        incoming.repliedAt = now;
        unlockedReplyDiamonds += incoming.diamondsPotential;
      }
      auth.user.diamonds += unlockedReplyDiamonds;
      auth.user.xp += Math.round(unlockedReplyDiamonds * 0.4);
      auth.user.level = computeLevelFromXp(auth.user.xp);

      db.transactions.unshift({
        id: `tx_${crypto.randomUUID().slice(0, 8)}`,
        userId: auth.user.id,
        type: 'pm_reply_diamond',
        amount: unlockedReplyDiamonds,
        currency: 'diamonds',
        description: `مكافأة ألماس تلقائية للرد على رسالة خاصة من ${recipient.displayName}`,
        timestamp: now,
      });

      applyHostEarningsAndAgencyCommission(db, auth.user, unlockedReplyDiamonds, now);
    }

    // Handle private gift if giftId is selected
    let selectedGift = giftId ? GIFT_CATALOG.find((g) => g.id === giftId) : undefined;
    if (giftId && !selectedGift) {
      return res.status(400).json({ error: 'الهدية المختارة غير متوفرة.' });
    }

    let luckyMultiplier: number | null = null;
    let luckyBonusCoins = 0;
    let giftDiamondsAwarded = 0;

    if (selectedGift) {
      if (auth.user.coins < selectedGift.coinsCost) {
        return res.status(400).json({ error: 'رصيد الكوينز غير كافٍ لإرسال هذه الهدية الخاصة.' });
      }
      auth.user.coins -= selectedGift.coinsCost;
      auth.user.xp += selectedGift.xpGain;
      auth.user.level = computeLevelFromXp(auth.user.xp);

      if (selectedGift.category === 'lucky') {
        luckyMultiplier = rollLuckyGiftMultiplier(db.settings.luckyGiftMultipliers);
        luckyBonusCoins = Math.round(selectedGift.coinsCost * luckyMultiplier);
        auth.user.coins += luckyBonusCoins;
      }

      giftDiamondsAwarded = Math.max(
        1,
        Math.round(selectedGift.coinsCost * (db.settings.giftDiamondsRatio || 0.75))
      );
      recipient.diamonds += giftDiamondsAwarded;

      db.transactions.unshift({
        id: `tx_${crypto.randomUUID().slice(0, 8)}`,
        userId: auth.user.id,
        type: 'gift_sent',
        amount: -selectedGift.coinsCost,
        currency: 'coins',
        description: `هدية خاصة (${selectedGift.name}) إلى ${recipient.displayName}`,
        timestamp: now,
      });

      if (luckyBonusCoins > 0 && luckyMultiplier) {
        db.transactions.unshift({
          id: `tx_${crypto.randomUUID().slice(0, 8)}`,
          userId: auth.user.id,
          type: 'lucky_gift_bonus',
          amount: luckyBonusCoins,
          currency: 'coins',
          description: `مضاعف هدية الحظ الخاصة (${selectedGift.name} ×${luckyMultiplier})`,
          timestamp: now,
        });
      }

      db.transactions.unshift({
        id: `tx_${crypto.randomUUID().slice(0, 8)}`,
        userId: recipient.id,
        type: 'gift_received',
        amount: giftDiamondsAwarded,
        currency: 'diamonds',
        description: `استلام هدية خاصة (${selectedGift.name}) من ${auth.user.displayName}`,
        timestamp: now,
      });

      applyHostEarningsAndAgencyCommission(db, recipient, giftDiamondsAwarded, now);

      const pmGift: PrivateMessage = {
        id: `pm_${crypto.randomUUID().slice(0, 10)}`,
        conversationId: convId,
        senderId: auth.user.id,
        recipientId: recipient.id,
        text:
          cleanText ||
          `أرسل لك ${selectedGift.glyph} ${selectedGift.name}${
            luckyMultiplier ? ` (مضاعف حظ ×${luckyMultiplier})` : ''
          }`,
        coinsPaid: selectedGift.coinsCost,
        diamondsPotential: giftDiamondsAwarded,
        diamondsClaimed: true,
        diamondsAwarded: giftDiamondsAwarded,
        isRead: false,
        giftId: selectedGift.id,
        giftName: selectedGift.name,
        giftGlyph: selectedGift.glyph,
        createdAt: now,
        repliedAt: now,
      };
      db.privateMessages.push(pmGift);
      saveDb();

      broadcastToUser(recipient.id, 'pm:message', {
        conversationId: convId,
        message: pmGift,
        diamondsAdded: giftDiamondsAwarded,
      });

      return res.json({
        user: sanitizeUser(auth.user),
        message: pmGift,
        unlockedReplyDiamonds,
        giftDiamondsAwarded,
        luckyMultiplier,
        luckyBonusCoins,
      });
    }

    // Paid PM or free reply
    const isReplyingToExisting = db.privateMessages.some(
      (m) => m.conversationId === convId && m.senderId === recipient.id
    );
    const shouldChargeCoins =
      recipientEligibleForPaidPm && !(senderEligibleForDiamonds && isReplyingToExisting);

    const pmCost = db.settings.pmMessageCost;
    const pmReplyDiamonds = db.settings.pmReplyDiamonds;
    if (shouldChargeCoins && auth.user.coins < pmCost) {
      return res.status(400).json({
        error: `تحتاج إلى ${pmCost} كوينز لإرسال رسالة خاصة مدفوعة.`,
      });
    }

    if (shouldChargeCoins) {
      auth.user.coins -= pmCost;
      auth.user.xp += 35;
      auth.user.level = computeLevelFromXp(auth.user.xp);

      db.transactions.unshift({
        id: `tx_${crypto.randomUUID().slice(0, 8)}`,
        userId: auth.user.id,
        type: 'pm_sent',
        amount: -pmCost,
        currency: 'coins',
        description: `رسالة خاصة مدفوعة إلى ${recipient.displayName}`,
        timestamp: now,
      });
    }

    const pm: PrivateMessage = {
      id: `pm_${crypto.randomUUID().slice(0, 10)}`,
      conversationId: convId,
      senderId: auth.user.id,
      recipientId: recipient.id,
      text: cleanText,
      coinsPaid: shouldChargeCoins ? pmCost : 0,
      diamondsPotential: shouldChargeCoins ? pmReplyDiamonds : 0,
      diamondsClaimed: !shouldChargeCoins,
      diamondsAwarded: 0,
      isRead: false,
      createdAt: now,
      repliedAt: null,
    };
    db.privateMessages.push(pm);
    saveDb();

    broadcastToUser(recipient.id, 'pm:message', {
      conversationId: convId,
      message: pm,
      diamondsAdded: 0,
    });
    if (unlockedReplyDiamonds > 0) {
      broadcastToUser(auth.user.id, 'pm:diamonds', {
        diamondsAdded: unlockedReplyDiamonds,
      });
    }

    return res.json({
      user: sanitizeUser(auth.user),
      message: pm,
      unlockedReplyDiamonds,
      giftDiamondsAwarded: 0,
      luckyMultiplier: null,
      luckyBonusCoins: 0,
    });
  });

  // --- AGENCY & HOST SYSTEM ---
  app.get('/api/agency/overview', (req, res) => {
    const auth = getAuthUser(req);
    if (!auth) return res.status(401).json({ error: 'غير مصرح.' });
    const db = getDb();

    const myOwnedAgency = db.agencies.find((a) => a.ownerId === auth.user.id) || null;
    const myJoinedAgency =
      !myOwnedAgency && auth.user.agencyId
        ? db.agencies.find((a) => a.id === auth.user.agencyId) || null
        : null;

    const mapHosts = (agencyId: string) =>
      db.users
        .filter((u) => u.agencyId === agencyId && u.id !== db.agencies.find((a) => a.id === agencyId)?.ownerId)
        .map((u) => ({
          id: u.id,
          displayName: u.displayName,
          avatarUrl: u.avatarUrl,
          frameId: u.frameId,
          level: u.level,
          gender: u.gender || 'male',
          diamonds: u.diamonds,
          hostDiamondsEarned: u.hostDiamondsEarned || 0,
          hostBadge: u.hostBadge || 'مضيف رسمي ✦',
          lastSeen: u.lastSeen,
        }))
        .sort((a, b) => b.hostDiamondsEarned - a.hostDiamondsEarned);

    const commissionTransactions = db.transactions
      .filter((t) => t.userId === auth.user.id && t.type === 'agency_commission')
      .slice(0, 25);

    const publicAgencies = db.agencies.map((a) => ({
      id: a.id,
      name: a.name,
      description: a.description,
      ownerName: a.ownerName,
      ownerAvatar: a.ownerAvatar,
      commissionRate: a.commissionRate,
      hostCount: a.hostIds.length,
    }));

    return res.json({
      user: sanitizeUser(auth.user),
      myAgency: myOwnedAgency
        ? {
            agency: myOwnedAgency,
            hosts: mapHosts(myOwnedAgency.id),
            commissionTransactions,
          }
        : null,
      joinedAgency: myJoinedAgency,
      publicAgencies,
    });
  });

  app.post('/api/agency/apply', (req, res) => {
    const auth = getAuthUser(req);
    if (!auth) return res.status(401).json({ error: 'غير مصرح.' });
    const db = getDb();

    const existingOwned = db.agencies.find((a) => a.ownerId === auth.user.id);
    if (existingOwned) {
      return res.status(400).json({ error: 'لديك وكالة معتمدة بالفعل.' });
    }

    const { name, description, commissionRate } = req.body as {
      name?: string;
      description?: string;
      commissionRate?: number;
    };

    const cleanName = (name || '').trim();
    if (cleanName.length < 3) {
      return res.status(400).json({ error: 'يرجى إدخال اسم الوكالة (3 أحرف على الأقل).' });
    }

    const rateNum = Number(commissionRate);
    const minRate = db.settings.minAgencyCommissionRate || 0.05;
    const maxRate = db.settings.maxAgencyCommissionRate || 0.35;
    const cleanRate =
      Number.isFinite(rateNum) && rateNum >= minRate && rateNum <= maxRate
        ? rateNum
        : db.settings.defaultAgencyCommissionRate || 0.15;

    let code = '';
    do {
      code = `SADA-${Math.floor(1000 + Math.random() * 9000)}`;
    } while (db.agencies.some((a) => a.code === code));

    const agency = {
      id: `agency_${crypto.randomUUID().slice(0, 8)}`,
      name: cleanName.slice(0, 48),
      description:
        (description || '').trim().slice(0, 160) ||
        'وكالة ملكية معتمدة لإدارة المضيفين وتنمية المواهب الصوتية في صَدَى.',
      code,
      ownerId: auth.user.id,
      ownerName: auth.user.displayName,
      ownerAvatar: auth.user.avatarUrl,
      commissionRate: cleanRate,
      totalCommissionDiamonds: 0,
      totalHostDiamonds: 0,
      hostIds: [],
      status: 'approved' as const,
      createdAt: new Date().toISOString(),
    };

    // If user previously joined another agency as a host, detach cleanly
    if (auth.user.agencyId) {
      const prev = db.agencies.find((a) => a.id === auth.user.agencyId);
      if (prev) {
        prev.hostIds = prev.hostIds.filter((id) => id !== auth.user.id);
      }
    }

    auth.user.isAgent = true;
    auth.user.isHost = true;
    auth.user.agencyId = agency.id;
    auth.user.hostBadge = 'وكيل معتمد ✦';
    auth.user.hostAgencyName = agency.name;

    db.agencies.unshift(agency);
    saveDb();

    return res.json({
      user: sanitizeUser(auth.user),
      agency,
    });
  });

  app.post('/api/agency/join', (req, res) => {
    const auth = getAuthUser(req);
    if (!auth) return res.status(401).json({ error: 'غير مصرح.' });
    const db = getDb();

    const { code } = req.body as { code?: string };
    const cleanCode = (code || '').trim().toUpperCase();
    if (!cleanCode) {
      return res.status(400).json({ error: 'يرجى إدخال كود الوكالة الصحيح.' });
    }

    const agency = db.agencies.find((a) => a.code.toUpperCase() === cleanCode);
    if (!agency) {
      return res.status(404).json({ error: 'كود الوكالة غير صحيح أو غير موجود.' });
    }
    if (agency.ownerId === auth.user.id) {
      return res.status(400).json({ error: 'أنت مالك هذه الوكالة بالفعل.' });
    }

    if (auth.user.agencyId && auth.user.agencyId !== agency.id) {
      const prev = db.agencies.find((a) => a.id === auth.user.agencyId);
      if (prev) {
        prev.hostIds = prev.hostIds.filter((id) => id !== auth.user.id);
      }
    }

    if (!agency.hostIds.includes(auth.user.id)) {
      agency.hostIds.push(auth.user.id);
    }

    auth.user.isHost = true;
    auth.user.agencyId = agency.id;
    auth.user.hostBadge = 'مضيف رسمي ✦';
    auth.user.hostAgencyName = agency.name;
    saveDb();

    return res.json({
      user: sanitizeUser(auth.user),
      agency,
    });
  });

  app.post('/api/agency/leave', (req, res) => {
    const auth = getAuthUser(req);
    if (!auth) return res.status(401).json({ error: 'غير مصرح.' });
    const db = getDb();

    if (auth.user.isAgent) {
      return res.status(400).json({ error: 'لا يمكن لمالك الوكالة مغادرة وكالته.' });
    }

    if (auth.user.agencyId) {
      const agency = db.agencies.find((a) => a.id === auth.user.agencyId);
      if (agency) {
        agency.hostIds = agency.hostIds.filter((id) => id !== auth.user.id);
      }
    }

    auth.user.agencyId = null;
    auth.user.hostBadge = null;
    auth.user.hostAgencyName = null;
    saveDb();

    return res.json({ user: sanitizeUser(auth.user) });
  });

  // --- FEMALE VOICE VERIFICATION (5s VOICE PRINT) ---
  app.get('/api/verification/female-voice/status', (req, res) => {
    const auth = getAuthUser(req);
    if (!auth) return res.status(401).json({ error: 'غير مصرح.' });
    const db = getDb();
    const latestRequest =
      db.femaleVoiceRequests.find((r) => r.userId === auth.user.id) || null;
    return res.json({
      status:
        auth.user.femaleVoiceStatus ||
        (auth.user.gender === 'female' ? 'unverified' : 'none'),
      femaleVerified: Boolean(auth.user.femaleVerified),
      femaleVerifiedBadge: auth.user.femaleVerifiedBadge || null,
      femaleVoiceNote: auth.user.femaleVoiceNote || null,
      isLocked: isFemaleVoiceLocked(auth.user),
      latestRequest,
    });
  });

  app.post('/api/verification/female-voice', (req, res) => {
    const auth = getAuthUser(req);
    if (!auth) return res.status(401).json({ error: 'غير مصرح.' });
    if (auth.user.gender !== 'female') {
      return res.status(400).json({ error: 'التوثيق الصوتي مخصص للحسابات النسائية فقط.' });
    }
    if (auth.user.femaleVoiceStatus === 'verified') {
      return res.status(400).json({ error: 'حسابكِ موثّق صوتياً بالفعل.' });
    }

    const { audioDataUrl, durationSeconds = 5, phrase = 'أهلاً بكم في تطبيق صَدَى' } =
      req.body as {
        audioDataUrl?: string;
        durationSeconds?: number;
        phrase?: string;
      };

    const cleanAudio = (audioDataUrl || '').trim();
    if (!cleanAudio.startsWith('data:audio/') || cleanAudio.length < 120) {
      return res.status(400).json({
        error: 'يرجى تسجيل مقطع صوتي صالح لمدة 5 ثوانٍ قبل إرسال الطلب.',
      });
    }
    if (cleanAudio.length > 4_000_000) {
      return res.status(400).json({ error: 'حجم المقطع الصوتي كبير جداً. يرجى تسجيل 5 ثوانٍ فقط.' });
    }

    const db = getDb();
    if (!Array.isArray(db.femaleVoiceRequests)) db.femaleVoiceRequests = [];

    const requestDoc: FemaleVoiceVerificationRequest = {
      id: `fvr_${crypto.randomUUID().slice(0, 8)}`,
      userId: auth.user.id,
      displayName: auth.user.displayName,
      email: auth.user.email,
      audioDataUrl: cleanAudio,
      durationSeconds: Math.max(1, Math.min(10, Math.round(Number(durationSeconds) || 5))),
      phrase: phrase.trim() || 'أهلاً بكم في تطبيق صَدَى',
      status: 'pending',
      createdAt: new Date().toISOString(),
      reviewedAt: null,
      adminNote: null,
    };

    db.femaleVoiceRequests.unshift(requestDoc);
    auth.user.femaleVoiceStatus = 'pending';
    auth.user.femaleVerified = false;
    auth.user.femaleVoiceNote = null;

    saveDb();
    return res.json({
      request: requestDoc,
      user: sanitizeUser(auth.user),
    });
  });

  // --- SUPER ADMIN ENDPOINTS ---
  app.get('/api/admin/overview', (req, res) => {
    const auth = getAuthUser(req);
    if (!auth || !auth.user.is_admin) {
      return res.status(403).json({ error: 'ممنوع: صلاحية المدير العام مطلوبة.' });
    }
    const db = getDb();
    const pendingDeposits = db.usdtDeposits.filter((d) => d.status === 'pending').length;
    const pendingWithdrawals = db.usdtWithdrawals.filter((w) => w.status === 'pending').length;
    const pendingFemaleVoiceCount = (db.femaleVoiceRequests || []).filter(
      (r) => r.status === 'pending'
    ).length;
    return res.json({
      users: db.users.map(sanitizeUser),
      deviceLocks: Object.values(db.deviceLocks),
      securityLogs: db.securityLogs.slice(0, 50),
      rooms: db.rooms.map(sanitizeRoom),
      competitions: db.competitions,
      agencies: db.agencies,
      culturalQuestions: db.culturalQuestions,
      settings: db.settings,
      usdtDeposits: db.usdtDeposits.slice(0, 50),
      usdtWithdrawals: db.usdtWithdrawals.slice(0, 50),
      femaleVoiceRequests: (db.femaleVoiceRequests || []).slice(0, 80),
      stats: {
        totalUsers: db.users.length,
        activeRooms: db.rooms.filter((r) => r.isActive).length,
        totalCoins: db.users.reduce((acc, u) => acc + u.coins, 0),
        blockedAttempts: db.securityLogs.filter((l) => l.type === 'MULTI_ACCOUNT_BLOCKED').length,
        appPrizePoolCoins: db.appPrizePoolCoins,
        pendingUsdtCount: pendingDeposits + pendingWithdrawals,
        pendingFemaleVoiceCount,
      },
    });
  });

  app.post('/api/admin/usdt/deposits/:id/approve', (req, res) => {
    const auth = getAuthUser(req);
    if (!auth || !auth.user.is_admin) {
      return res.status(403).json({ error: 'ممنوع: صلاحية المدير العام مطلوبة.' });
    }
    const db = getDb();
    const deposit = db.usdtDeposits.find((d) => d.id === req.params.id);
    if (!deposit) return res.status(404).json({ error: 'طلب الإيداع غير موجود.' });
    if (deposit.status !== 'pending') {
      return res.status(400).json({ error: 'تمت معالجة هذا الطلب مسبقاً.' });
    }

    const target = db.users.find((u) => u.id === deposit.userId);
    if (!target) return res.status(404).json({ error: 'المستخدم غير موجود.' });

    const nowDate = new Date();
    const nowIso = nowDate.toISOString();

    deposit.status = 'approved';
    deposit.reviewedAt = nowIso;
    deposit.adminNote = `تم التأكيد ومنح الرصيد والمكافآت بواسطة ${auth.user.displayName}`;

    target.coins += deposit.coinsCredited;
    target.xp += Math.floor(deposit.coinsCredited / 10);
    target.level = computeLevelFromXp(target.xp);

    const tier = getRechargeRewardTier(deposit.amountUsdt, db.settings.rechargeRewardTiers);
    if (tier) {
      const expiresAt = new Date(
        nowDate.getTime() + tier.days * 24 * 60 * 60 * 1000
      ).toISOString();

      const tempIds = new Set(['frame_silver_7d', 'frame_gold_15d', 'frame_royal_30d']);
      if (!tempIds.has(target.frameId)) {
        target.previousPermanentFrameId = target.frameId;
      }

      target.unlockedFrames = target.unlockedFrames.filter((fid) => !tempIds.has(fid));
      target.unlockedFrames.push(tier.frameId);
      target.frameId = tier.frameId;
      target.tempFrameId = tier.frameId;
      target.tempFrameExpiresAt = expiresAt;

      if (tier.entryId && tier.entryName) {
        target.activeEntryId = tier.entryId;
        target.activeEntryName = tier.entryName;
        target.tempEntryExpiresAt = expiresAt;
      }

      // Sync updated frame on any active voice room seat
      for (const room of db.rooms) {
        let updatedRoom = false;
        for (const seat of room.seats) {
          if (seat.userId === target.id) {
            seat.frameId = target.frameId;
            seat.level = target.level;
            updatedRoom = true;
          }
        }
        if (updatedRoom) {
          broadcastRoom(room.id, 'room:state', sanitizeRoom(room));
        }
      }
    }

    db.transactions.unshift({
      id: `tx_${crypto.randomUUID().slice(0, 8)}`,
      userId: target.id,
      type: 'usdt_deposit',
      amount: deposit.coinsCredited,
      currency: 'coins',
      description: `تأكيد إيداع ${deposit.amountUsdt} USDT (TRC20)${
        tier ? ` + ${tier.label}` : ''
      }`,
      timestamp: nowIso,
    });

    saveDb();
    broadcastToUser(target.id, 'wallet:updated', sanitizeUser(target));

    return res.json({ deposit, user: sanitizeUser(target) });
  });

  app.post('/api/admin/usdt/deposits/:id/reject', (req, res) => {
    const auth = getAuthUser(req);
    if (!auth || !auth.user.is_admin) {
      return res.status(403).json({ error: 'ممنوع: صلاحية المدير العام مطلوبة.' });
    }
    const db = getDb();
    const deposit = db.usdtDeposits.find((d) => d.id === req.params.id);
    if (!deposit) return res.status(404).json({ error: 'طلب الإيداع غير موجود.' });
    if (deposit.status !== 'pending') {
      return res.status(400).json({ error: 'تمت معالجة هذا الطلب مسبقاً.' });
    }
    const { reason } = req.body as { reason?: string };
    deposit.status = 'rejected';
    deposit.reviewedAt = new Date().toISOString();
    deposit.adminNote = (reason || 'تعذّر التحقق من الحوالة على شبكة TRC20.').trim();
    saveDb();
    return res.json({ deposit });
  });

  app.post('/api/admin/usdt/withdrawals/:id/approve', (req, res) => {
    const auth = getAuthUser(req);
    if (!auth || !auth.user.is_admin) {
      return res.status(403).json({ error: 'ممنوع: صلاحية المدير العام مطلوبة.' });
    }
    const db = getDb();
    const wd = db.usdtWithdrawals.find((w) => w.id === req.params.id);
    if (!wd) return res.status(404).json({ error: 'طلب السحب غير موجود.' });
    if (wd.status !== 'pending') {
      return res.status(400).json({ error: 'تمت معالجة هذا الطلب مسبقاً.' });
    }
    wd.status = 'approved';
    wd.reviewedAt = new Date().toISOString();
    wd.adminNote = `تم تحويل ${wd.amountUsdt} USDT (TRC20) بنجاح`;
    saveDb();
    return res.json({ withdrawal: wd });
  });

  app.post('/api/admin/usdt/withdrawals/:id/reject', (req, res) => {
    const auth = getAuthUser(req);
    if (!auth || !auth.user.is_admin) {
      return res.status(403).json({ error: 'ممنوع: صلاحية المدير العام مطلوبة.' });
    }
    const db = getDb();
    const wd = db.usdtWithdrawals.find((w) => w.id === req.params.id);
    if (!wd) return res.status(404).json({ error: 'طلب السحب غير موجود.' });
    if (wd.status !== 'pending') {
      return res.status(400).json({ error: 'تمت معالجة هذا الطلب مسبقاً.' });
    }
    const { reason } = req.body as { reason?: string };
    const nowIso = new Date().toISOString();
    wd.status = 'rejected';
    wd.reviewedAt = nowIso;
    wd.adminNote = (reason || 'تم رفض الطلب وإرجاع الرصيد إلى المحفظة.').trim();

    const target = db.users.find((u) => u.id === wd.userId);
    if (target) {
      target[wd.sourceCurrency] += wd.sourceAmount;
      db.transactions.unshift({
        id: `tx_${crypto.randomUUID().slice(0, 8)}`,
        userId: target.id,
        type: 'usdt_withdrawal_refund',
        amount: wd.sourceAmount,
        currency: wd.sourceCurrency,
        description: `استرداد طلب سحب مرفوض (${wd.amountUsdt} USDT)`,
        timestamp: nowIso,
      });
      broadcastToUser(target.id, 'wallet:updated', sanitizeUser(target));
    }

    saveDb();
    return res.json({ withdrawal: wd });
  });

  app.post('/api/admin/female-voice/:id/approve', (req, res) => {
    const auth = getAuthUser(req);
    if (!auth || !auth.user.is_admin) {
      return res.status(403).json({ error: 'ممنوع: صلاحية المدير العام مطلوبة.' });
    }
    const db = getDb();
    const reqDoc = (db.femaleVoiceRequests || []).find((r) => r.id === req.params.id);
    if (!reqDoc) return res.status(404).json({ error: 'طلب التوثيق غير موجود.' });

    const nowIso = new Date().toISOString();
    reqDoc.status = 'approved';
    reqDoc.reviewedAt = nowIso;
    reqDoc.adminNote = 'تم قبول التوثيق الصوتي وتفعيل الألماس والرسائل الخاصة المدفوعة.';

    const target = db.users.find((u) => u.id === reqDoc.userId);
    if (target) {
      target.femaleVoiceStatus = 'verified';
      target.femaleVerified = true;
      target.femaleVerifiedBadge = 'موثّقة ✦';
      target.femaleVoiceNote = reqDoc.adminNote;

      for (const room of db.rooms) {
        let updatedRoom = false;
        for (const seat of room.seats) {
          if (seat.userId === target.id) {
            seat.femaleVerifiedBadge = target.femaleVerifiedBadge;
            updatedRoom = true;
          }
        }
        if (updatedRoom) {
          broadcastRoom(room.id, 'room:state', sanitizeRoom(room));
        }
      }
      broadcastToUser(target.id, 'wallet:updated', sanitizeUser(target));
    }

    saveDb();
    return res.json({ request: reqDoc, user: target ? sanitizeUser(target) : null });
  });

  app.post('/api/admin/female-voice/:id/reject', (req, res) => {
    const auth = getAuthUser(req);
    if (!auth || !auth.user.is_admin) {
      return res.status(403).json({ error: 'ممنوع: صلاحية المدير العام مطلوبة.' });
    }
    const db = getDb();
    const reqDoc = (db.femaleVoiceRequests || []).find((r) => r.id === req.params.id);
    if (!reqDoc) return res.status(404).json({ error: 'طلب التوثيق غير موجود.' });

    const { reason } = req.body as { reason?: string };
    const nowIso = new Date().toISOString();
    reqDoc.status = 'rejected';
    reqDoc.reviewedAt = nowIso;
    reqDoc.adminNote = (
      reason || 'الصوت غير واضح أو لم يطابق العبارة المطلوبة — يرجى إعادة تسجيل بصمة صوتية جديدة.'
    ).trim();

    const target = db.users.find((u) => u.id === reqDoc.userId);
    if (target) {
      target.femaleVoiceStatus = 'rejected';
      target.femaleVerified = false;
      target.femaleVerifiedBadge = null;
      target.femaleVoiceNote = reqDoc.adminNote;
      broadcastToUser(target.id, 'wallet:updated', sanitizeUser(target));
    }

    saveDb();
    return res.json({ request: reqDoc, user: target ? sanitizeUser(target) : null });
  });

  app.post('/api/admin/prize-pool', (req, res) => {
    const auth = getAuthUser(req);
    if (!auth || !auth.user.is_admin) {
      return res.status(403).json({ error: 'ممنوع: صلاحية المدير العام مطلوبة.' });
    }
    const db = getDb();
    const { amount, mode = 'add' } = req.body as {
      amount?: number;
      mode?: 'add' | 'set';
    };
    const cleanAmount = Math.floor(Number(amount) || 0);
    if (mode === 'set') {
      if (cleanAmount < 0) {
        return res.status(400).json({ error: 'يجب أن يكون رصيد المخزون صفراً أو أكبر.' });
      }
      db.appPrizePoolCoins = cleanAmount;
    } else {
      if (cleanAmount <= 0) {
        return res.status(400).json({ error: 'يرجى إدخال مبلغ صحيح أكبر من صفر.' });
      }
      db.appPrizePoolCoins += cleanAmount;
    }
    saveDb();
    return res.json({ appPrizePoolCoins: db.appPrizePoolCoins });
  });

  app.patch('/api/admin/settings', (req, res) => {
    const auth = getAuthUser(req);
    if (!auth || !auth.user.is_admin) {
      return res.status(403).json({ error: 'ممنوع: صلاحية المدير العام مطلوبة.' });
    }
    const db = getDb();
    const body = req.body as Partial<typeof db.settings>;
    const next = { ...db.settings };

    if (typeof body.usdtToCoinsRate === 'number' && body.usdtToCoinsRate >= 100) {
      next.usdtToCoinsRate = Math.round(body.usdtToCoinsRate);
    }
    if (typeof body.coinsPerUsdtWithdraw === 'number' && body.coinsPerUsdtWithdraw >= 100) {
      next.coinsPerUsdtWithdraw = Math.round(body.coinsPerUsdtWithdraw);
    }
    if (typeof body.diamondsPerUsdt === 'number' && body.diamondsPerUsdt >= 10) {
      next.diamondsPerUsdt = Math.round(body.diamondsPerUsdt);
    }
    if (typeof body.diamondToCoinsRate === 'number' && body.diamondToCoinsRate >= 1) {
      next.diamondToCoinsRate = Math.round(body.diamondToCoinsRate * 10) / 10;
    }
    if (
      typeof body.defaultAgencyCommissionRate === 'number' &&
      body.defaultAgencyCommissionRate >= 0.01 &&
      body.defaultAgencyCommissionRate <= 0.5
    ) {
      next.defaultAgencyCommissionRate = body.defaultAgencyCommissionRate;
    }
    if (
      typeof body.minAgencyCommissionRate === 'number' &&
      body.minAgencyCommissionRate >= 0.01 &&
      body.minAgencyCommissionRate <= 0.5
    ) {
      next.minAgencyCommissionRate = body.minAgencyCommissionRate;
    }
    if (
      typeof body.maxAgencyCommissionRate === 'number' &&
      body.maxAgencyCommissionRate >= next.minAgencyCommissionRate &&
      body.maxAgencyCommissionRate <= 0.6
    ) {
      next.maxAgencyCommissionRate = body.maxAgencyCommissionRate;
    }
    if (typeof body.pmMessageCost === 'number' && body.pmMessageCost >= 0) {
      next.pmMessageCost = Math.round(body.pmMessageCost);
    }
    if (typeof body.pmReplyDiamonds === 'number' && body.pmReplyDiamonds >= 0) {
      next.pmReplyDiamonds = Math.round(body.pmReplyDiamonds);
    }
    if (
      typeof body.giftDiamondsRatio === 'number' &&
      body.giftDiamondsRatio >= 0.1 &&
      body.giftDiamondsRatio <= 1
    ) {
      next.giftDiamondsRatio = Math.round(body.giftDiamondsRatio * 100) / 100;
    }
    if (typeof body.roomWheelCost === 'number' && body.roomWheelCost >= 10) {
      next.roomWheelCost = Math.round(body.roomWheelCost);
    }
    if (Array.isArray(body.roomWheelSegments) && body.roomWheelSegments.length === 8) {
      next.roomWheelSegments = body.roomWheelSegments;
    }
    if (Array.isArray(body.luckyGiftMultipliers) && body.luckyGiftMultipliers.length > 0) {
      next.luckyGiftMultipliers = body.luckyGiftMultipliers;
    }
    if (Array.isArray(body.rechargeRewardTiers) && body.rechargeRewardTiers.length > 0) {
      next.rechargeRewardTiers = body.rechargeRewardTiers.map((t) => ({
        ...t,
        label: t.entryName
          ? `${t.frameName} + ${t.entryName} (${t.days} يوماً)`
          : `${t.frameName} (${t.days} أيام)`,
      }));
    }
    if (body.gameRates && typeof body.gameRates === 'object') {
      const clampRate = (v: unknown, fallback: number) => {
        const n = Number(v);
        if (!Number.isFinite(n)) return fallback;
        return Math.max(5, Math.min(90, Math.round(n)));
      };
      const cur = next.gameRates || createDefaultPlatformSettings().gameRates!;
      next.gameRates = {
        slotsWinRate: clampRate(body.gameRates.slotsWinRate, cur.slotsWinRate),
        doubleDiceWinRate: clampRate(body.gameRates.doubleDiceWinRate, cur.doubleDiceWinRate),
        predictionDiceWinRate: clampRate(body.gameRates.predictionDiceWinRate, cur.predictionDiceWinRate),
        ladderDiceWinRate: clampRate(body.gameRates.ladderDiceWinRate, cur.ladderDiceWinRate),
        speedDiceWinRate: clampRate(body.gameRates.speedDiceWinRate, cur.speedDiceWinRate),
        rouletteWinRate: clampRate(body.gameRates.rouletteWinRate, cur.rouletteWinRate),
        mysteryBoxWinRate: clampRate(body.gameRates.mysteryBoxWinRate, cur.mysteryBoxWinRate),
      };
    }

    db.settings = next;
    saveDb();
    return res.json({ settings: db.settings });
  });

  app.patch('/api/admin/agencies/:id', (req, res) => {
    const auth = getAuthUser(req);
    if (!auth || !auth.user.is_admin) {
      return res.status(403).json({ error: 'ممنوع: صلاحية المدير العام مطلوبة.' });
    }
    const db = getDb();
    const agency = db.agencies.find((a) => a.id === req.params.id);
    if (!agency) return res.status(404).json({ error: 'الوكالة غير موجودة.' });

    const { status, commissionRate } = req.body as {
      status?: 'approved' | 'pending' | 'suspended';
      commissionRate?: number;
    };

    if (status === 'approved' || status === 'pending' || status === 'suspended') {
      agency.status = status;
      const owner = db.users.find((u) => u.id === agency.ownerId);
      if (owner) {
        owner.isAgent = status === 'approved';
        owner.hostBadge = status === 'approved' ? 'وكيل معتمد ✦' : null;
      }
    }
    if (typeof commissionRate === 'number' && commissionRate >= 0.01 && commissionRate <= 0.5) {
      agency.commissionRate = Math.round(commissionRate * 100) / 100;
    }

    saveDb();
    return res.json({ agency });
  });

  app.post('/api/admin/users/:id/host-approval', (req, res) => {
    const auth = getAuthUser(req);
    if (!auth || !auth.user.is_admin) {
      return res.status(403).json({ error: 'ممنوع: صلاحية المدير العام مطلوبة.' });
    }
    const db = getDb();
    const target = db.users.find((u) => u.id === req.params.id);
    if (!target) return res.status(404).json({ error: 'المستخدم غير موجود.' });

    const { isHost, isAgent, agencyId } = req.body as {
      isHost?: boolean;
      isAgent?: boolean;
      agencyId?: string | null;
    };

    if (typeof isHost === 'boolean') {
      target.isHost = isHost;
      if (isHost) {
        target.hostBadge = target.isAgent ? 'وكيل معتمد ✦' : 'مضيف رسمي ✦';
      } else {
        target.hostBadge = null;
        if (target.agencyId) {
          const prevAgency = db.agencies.find((a) => a.id === target.agencyId);
          if (prevAgency) {
            prevAgency.hostIds = prevAgency.hostIds.filter((id) => id !== target.id);
          }
          target.agencyId = null;
          target.hostAgencyName = null;
        }
      }
    }

    if (typeof isAgent === 'boolean') {
      target.isAgent = isAgent;
      if (isAgent) {
        target.isHost = true;
        target.hostBadge = 'وكيل معتمد ✦';
      } else if (target.isHost) {
        target.hostBadge = 'مضيف رسمي ✦';
      }
    }

    if (agencyId) {
      const ag = db.agencies.find((a) => a.id === agencyId);
      if (ag) {
        if (target.agencyId && target.agencyId !== ag.id) {
          const oldAg = db.agencies.find((a) => a.id === target.agencyId);
          if (oldAg) oldAg.hostIds = oldAg.hostIds.filter((id) => id !== target.id);
        }
        if (!ag.hostIds.includes(target.id) && ag.ownerId !== target.id) {
          ag.hostIds.push(target.id);
        }
        target.agencyId = ag.id;
        target.hostAgencyName = ag.name;
        target.isHost = true;
        target.hostBadge = ag.ownerId === target.id ? 'وكيل معتمد ✦' : 'مضيف رسمي ✦';
      }
    }

    saveDb();
    return res.json({ user: sanitizeUser(target) });
  });

  app.get('/api/admin/questions/export', (req, res) => {
    const auth = getAuthUser(req);
    if (!auth || !auth.user.is_admin) {
      return res.status(403).json({ error: 'ممنوع: صلاحية المدير العام مطلوبة.' });
    }
    const db = getDb();
    const esc = (val: string | number) => {
      const s = String(val ?? '');
      return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = [
      'category',
      'question',
      'option1',
      'option2',
      'option3',
      'option4',
      'correctIndex',
      'xpReward',
      'coinsReward',
    ].join(',');
    const rows = db.culturalQuestions.map((q) =>
      [
        esc(q.category),
        esc(q.question),
        esc(q.options[0]),
        esc(q.options[1]),
        esc(q.options[2]),
        esc(q.options[3]),
        q.correctIndex + 1,
        q.xpReward,
        q.coinsReward,
      ].join(',')
    );
    const csv = '\uFEFF' + [header, ...rows].join('\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="sada-cultural-questions.csv"'
    );
    return res.send(csv);
  });

  app.post('/api/admin/questions/import', (req, res) => {
    const auth = getAuthUser(req);
    if (!auth || !auth.user.is_admin) {
      return res.status(403).json({ error: 'ممنوع: صلاحية المدير العام مطلوبة.' });
    }
    const db = getDb();
    const { csvText, rows, mode = 'append' } = req.body as {
      csvText?: string;
      rows?: Array<{
        category?: string;
        question?: string;
        option1?: string;
        option2?: string;
        option3?: string;
        option4?: string;
        correctIndex?: number | string;
        xpReward?: number | string;
        coinsReward?: number | string;
      }>;
      mode?: 'append' | 'replace';
    };

    const parseCsvLine = (line: string): string[] => {
      const out: string[] = [];
      let cur = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inQuotes) {
          if (ch === '"' && line[i + 1] === '"') {
            cur += '"';
            i++;
          } else if (ch === '"') {
            inQuotes = false;
          } else {
            cur += ch;
          }
        } else if (ch === '"') {
          inQuotes = true;
        } else if (ch === ',' || ch === ';' || ch === '\t') {
          out.push(cur.trim());
          cur = '';
        } else {
          cur += ch;
        }
      }
      out.push(cur.trim());
      return out;
    };

    let parsedRows = Array.isArray(rows) ? rows : [];
    if (csvText && csvText.trim().length > 0) {
      const cleanCsv = csvText.replace(/^\uFEFF/, '');
      const lines = cleanCsv
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      const startIdx =
        lines[0] &&
        (lines[0].toLowerCase().includes('question') || lines[0].includes('السؤال'))
          ? 1
          : 0;
      parsedRows = lines.slice(startIdx).map((line) => {
        const cols = parseCsvLine(line);
        return {
          category: cols[0],
          question: cols[1],
          option1: cols[2],
          option2: cols[3],
          option3: cols[4],
          option4: cols[5],
          correctIndex: cols[6],
          xpReward: cols[7],
          coinsReward: cols[8],
        };
      });
    }

    const imported = [];
    for (const r of parsedRows) {
      const question = String(r.question || '').trim();
      const opts: [string, string, string, string] = [
        String(r.option1 || '').trim(),
        String(r.option2 || '').trim(),
        String(r.option3 || '').trim(),
        String(r.option4 || '').trim(),
      ];
      if (!question || opts.some((o) => !o)) continue;

      const rawIdx = Number(r.correctIndex ?? 1);
      // Supports both 1-4 (Excel friendly) and 0-3
      let correctIndex = 0;
      if (rawIdx >= 1 && rawIdx <= 4) {
        correctIndex = Math.floor(rawIdx) - 1;
      } else if (rawIdx >= 0 && rawIdx <= 3) {
        correctIndex = Math.floor(rawIdx);
      }

      const xpReward = Math.max(20, Math.floor(Number(r.xpReward) || 140));
      const coinsReward = Math.max(0, Math.floor(Number(r.coinsReward) || 250));
      imported.push({
        id: `cq_${crypto.randomUUID().slice(0, 8)}`,
        category: String(r.category || 'ثقافة عامة').trim(),
        question,
        options: opts,
        correctIndex,
        xpReward,
        coinsReward,
      });
    }

    if (imported.length === 0) {
      return res.status(400).json({
        error: 'لم يتم العثور على أسئلة صالحة في الملف. تأكد من وجود السؤال والـ 4 خيارات.',
      });
    }

    if (mode === 'replace') {
      db.culturalQuestions = imported;
    } else {
      db.culturalQuestions = [...imported, ...db.culturalQuestions];
    }
    saveDb();

    return res.json({
      importedCount: imported.length,
      totalCount: db.culturalQuestions.length,
      culturalQuestions: db.culturalQuestions,
    });
  });

  app.delete('/api/admin/questions/:id', (req, res) => {
    const auth = getAuthUser(req);
    if (!auth || !auth.user.is_admin) {
      return res.status(403).json({ error: 'ممنوع: صلاحية المدير العام مطلوبة.' });
    }
    const db = getDb();
    if (db.culturalQuestions.length <= 1) {
      return res.status(400).json({ error: 'يجب الإبقاء على سؤال واحد على الأقل في بنك المسابقات.' });
    }
    db.culturalQuestions = db.culturalQuestions.filter((q) => q.id !== req.params.id);
    saveDb();
    return res.json({ culturalQuestions: db.culturalQuestions });
  });

  app.patch('/api/admin/users/:id', (req, res) => {
    const auth = getAuthUser(req);
    if (!auth || !auth.user.is_admin) {
      return res.status(403).json({ error: 'ممنوع: صلاحية المدير العام مطلوبة.' });
    }
    const db = getDb();
    const target = db.users.find((u) => u.id === req.params.id);
    if (!target) return res.status(404).json({ error: 'المستخدم غير موجود.' });

    const { coinsDelta, diamondsDelta, is_admin, is_banned } = req.body as {
      coinsDelta?: number;
      diamondsDelta?: number;
      is_admin?: boolean;
      is_banned?: boolean;
    };

    const now = new Date().toISOString();
    if (typeof coinsDelta === 'number' && coinsDelta !== 0) {
      target.coins = Math.max(0, target.coins + coinsDelta);
      db.transactions.unshift({
        id: `tx_${crypto.randomUUID().slice(0, 8)}`,
        userId: target.id,
        type: 'admin_grant',
        amount: coinsDelta,
        currency: 'coins',
        description: `تعديل إداري للكوينز بواسطة ${auth.user.displayName}`,
        timestamp: now,
      });
    }
    if (typeof diamondsDelta === 'number' && diamondsDelta !== 0) {
      target.diamonds = Math.max(0, target.diamonds + diamondsDelta);
      db.transactions.unshift({
        id: `tx_${crypto.randomUUID().slice(0, 8)}`,
        userId: target.id,
        type: 'admin_grant',
        amount: diamondsDelta,
        currency: 'diamonds',
        description: `تعديل إداري للألماس بواسطة ${auth.user.displayName}`,
        timestamp: now,
      });
    }
    if (typeof is_admin === 'boolean' && target.email !== SUPER_ADMIN_EMAIL) {
      target.is_admin = is_admin;
    }
    if (typeof is_banned === 'boolean' && target.email !== SUPER_ADMIN_EMAIL) {
      target.is_banned = is_banned;
      if (is_banned) {
        db.securityLogs.unshift({
          id: `sec_${crypto.randomUUID().slice(0, 8)}`,
          type: 'USER_BANNED',
          email: target.email,
          device_uuid: target.device_uuid,
          details: `تم تعليق الحساب بواسطة المدير العام ${auth.user.email}.`,
          timestamp: now,
        });
      }
    }

    saveDb();
    return res.json({ user: sanitizeUser(target) });
  });

  app.delete('/api/admin/devices/:uuid', (req, res) => {
    const auth = getAuthUser(req);
    if (!auth || !auth.user.is_admin) {
      return res.status(403).json({ error: 'ممنوع.' });
    }
    const db = getDb();
    const uuid = req.params.uuid;
    const lock = db.deviceLocks[uuid];
    if (lock) {
      db.securityLogs.unshift({
        id: `sec_${crypto.randomUUID().slice(0, 8)}`,
        type: 'DEVICE_UNLOCKED',
        email: lock.boundEmail,
        device_uuid: uuid,
        details: `تم فك ارتباط الجهاز بواسطة المدير العام (${auth.user.email}).`,
        timestamp: new Date().toISOString(),
      });
      delete db.deviceLocks[uuid];
      saveDb();
    }
    return res.json({ ok: true });
  });

  app.patch('/api/admin/devices/:uuid/block', (req, res) => {
    const auth = getAuthUser(req);
    if (!auth || !auth.user.is_admin) {
      return res.status(403).json({ error: 'ممنوع.' });
    }
    const db = getDb();
    const uuid = req.params.uuid;
    const lock = db.deviceLocks[uuid];
    if (!lock) return res.status(404).json({ error: 'الجهاز غير مسجل.' });
    const { isBlocked, reason } = req.body as { isBlocked?: boolean; reason?: string };
    lock.isBlocked = Boolean(isBlocked);
    lock.blockedReason = lock.isBlocked ? reason || 'حظر إداري للجهاز' : null;
    db.securityLogs.unshift({
      id: `sec_${crypto.randomUUID().slice(0, 8)}`,
      type: lock.isBlocked ? 'DEVICE_BLOCKED' : 'DEVICE_UNLOCKED',
      email: lock.boundEmail,
      device_uuid: uuid,
      details: lock.isBlocked ? `حظر الجهاز نهائياً: ${lock.blockedReason}` : 'رفع الحظر عن الجهاز.',
      timestamp: new Date().toISOString(),
    });
    saveDb();
    return res.json({ deviceLock: lock });
  });

  app.post('/api/admin/competitions', (req, res) => {
    const auth = getAuthUser(req);
    if (!auth || !auth.user.is_admin) {
      return res.status(403).json({ error: 'ممنوع.' });
    }
    const { title, subtitle, category, prizeCoins, prizeDiamonds } = req.body as {
      title?: string;
      subtitle?: string;
      category?: string;
      prizeCoins?: number;
      prizeDiamonds?: number;
    };
    if (!title || title.trim().length < 3) {
      return res.status(400).json({ error: 'يرجى إدخال عنوان المسابقة.' });
    }
    const db = getDb();
    const newComp = {
      id: `comp_${crypto.randomUUID().slice(0, 8)}`,
      title: title.trim(),
      subtitle: (subtitle || 'بطولة ملكية رسمية برعاية إدارة صَدَى').trim(),
      category: category || 'تحدي الأصوات',
      status: 'live' as const,
      prizeCoins: Number(prizeCoins) || 25000,
      prizeDiamonds: Number(prizeDiamonds) || 10000,
      bannerImage: 'competition_crest',
      endsAt: new Date(Date.now() + 1000 * 60 * 60 * 72).toISOString(),
      winnerId: null,
      contestants: [],
    };
    db.competitions.unshift(newComp);
    saveDb();
    broadcastAll('competition:updated', newComp);
    return res.json({ competition: newComp });
  });

  app.post('/api/admin/competitions/:id/finish', (req, res) => {
    const auth = getAuthUser(req);
    if (!auth || !auth.user.is_admin) {
      return res.status(403).json({ error: 'ممنوع.' });
    }
    const db = getDb();
    const comp = db.competitions.find((c) => c.id === req.params.id);
    if (!comp) return res.status(404).json({ error: 'المسابقة غير موجودة.' });
    if (comp.status === 'ended') return res.status(400).json({ error: 'المسابقة منتهية بالفعل.' });

    const sorted = [...comp.contestants].sort(
      (a, b) => b.votes * 100 + b.giftScore - (a.votes * 100 + a.giftScore)
    );
    const winner = sorted[0];
    comp.status = 'ended';
    comp.winnerId = winner ? winner.userId : null;

    if (winner) {
      const winnerUser = db.users.find((u) => u.id === winner.userId);
      if (winnerUser) {
        winnerUser.coins += comp.prizeCoins;
        winnerUser.diamonds += comp.prizeDiamonds;
        winnerUser.xp += 1000;
        winnerUser.level = computeLevelFromXp(winnerUser.xp);
        db.transactions.unshift({
          id: `tx_${crypto.randomUUID().slice(0, 8)}`,
          userId: winnerUser.id,
          type: 'prize',
          amount: comp.prizeCoins,
          currency: 'coins',
          description: `جائزة المركز الأول في ${comp.title}`,
          timestamp: new Date().toISOString(),
        });
      }
    }

    saveDb();
    broadcastAll('competition:updated', comp);
    return res.json({ competition: comp });
  });

  app.delete('/api/admin/rooms/:id', (req, res) => {
    const auth = getAuthUser(req);
    if (!auth || !auth.user.is_admin) {
      return res.status(403).json({ error: 'ممنوع.' });
    }
    const db = getDb();
    const room = db.rooms.find((r) => r.id === req.params.id);
    if (room) {
      room.isActive = false;
      saveDb();
      broadcastRoom(room.id, 'room:closed', { roomId: room.id });
    }
    return res.json({ ok: true });
  });

  app.get('/api/supabase/status', (_req, res) => {
    return res.json(getSupabaseSyncStatus());
  });

  app.post('/api/supabase/sync', async (_req, res) => {
    const status = await syncNowWithSupabase();
    return res.json(status);
  });

  // --- VITE / STATIC FRONTEND ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: {
          server,
          path: '/vite-hmr',
        },
        watch: process.env.DISABLE_HMR === 'true' ? null : {},
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  await initDatabase();

  if (getSupabaseSyncStatus().schemaMissing) {
    const schemaWatcher = setInterval(async () => {
      if (!getSupabaseSyncStatus().schemaMissing) {
        clearInterval(schemaWatcher);
        return;
      }
      await syncNowWithSupabase();
      if (!getSupabaseSyncStatus().schemaMissing) {
        clearInterval(schemaWatcher);
      }
    }, 20000);
    schemaWatcher.unref();
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`SADA server listening on http://localhost:${PORT}`);
  });
}

startServer();
