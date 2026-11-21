import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import {
  Ban,
  Building2,
  CheckCircle2,
  Coins,
  Download,
  FileSpreadsheet,
  Gamepad2,
  Gem,
  Gift,
  Mic,
  Percent,
  Pin,
  PinOff,
  Plus,
  Radio,
  RefreshCw,
  Save,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  Trophy,
  Unlock,
  Upload,
  UserCheck,
  Users,
} from 'lucide-react';
import { useActiveRoom } from '../context/ActiveRoomContext';
import { useAuth } from '../context/AuthContext';
import {
  AdminGiftsAnnouncementsTab,
} from '../components/admin/AdminGiftsAnnouncementsTab';
import {
  AdminUsersTab,
  type AdminUserRoleChoice,
} from '../components/admin/AdminUsersTab';
import { resolveAsset } from '../lib/assets';
import { isSuperAdminUser } from '../lib/sadaCatalog';
import {
  approveFemaleVoiceInSupabase,
  approveUsdtDepositInSupabase,
  approveUsdtWithdrawalInSupabase,
  blockDeviceInSupabase,
  buildQuestionsCsvText,
  closeRoomInSupabase,
  createCompetitionInSupabase,
  createCustomGiftInSupabase,
  deleteCustomGiftInSupabase,
  deleteQuestionInSupabase,
  finishCompetitionInSupabase,
  getAdminOverviewFromSupabase,
  importQuestionsInSupabase,
  payoutAgencyCommissionInSupabase,
  rejectFemaleVoiceInSupabase,
  rejectUsdtDepositInSupabase,
  rejectUsdtWithdrawalInSupabase,
  reviewHostJoinApplicationInSupabase,
  resetApplicationDataInSupabase,
  savePlatformSettingsInSupabase,
  sendGlobalAdminAnnouncementInSupabase,
  togglePinRoomInSupabase,
  unlockDeviceInSupabase,
  updateAdminUserInSupabase,
  updateAgencyInSupabase,
  updateHostApprovalInSupabase,
  updatePrizePoolInSupabase,
} from '../lib/sadaAdminService';
import type {
  Agency,
  Competition,
  CulturalQuestionAdminItem,
  DeviceLock,
  FemaleVoiceVerificationRequest,
  HostJoinApplication,
  PlatformSettings,
  Room,
  SecurityLog,
  UsdtDepositRequest,
  UsdtWithdrawalRequest,
  User,
} from '../types';

interface AdminOverview {
  users: User[];
  deviceLocks: DeviceLock[];
  securityLogs: SecurityLog[];
  rooms: Room[];
  competitions: Competition[];
  agencies: Agency[];
  culturalQuestions: CulturalQuestionAdminItem[];
  settings: PlatformSettings;
  usdtDeposits: UsdtDepositRequest[];
  usdtWithdrawals: UsdtWithdrawalRequest[];
  femaleVoiceRequests: FemaleVoiceVerificationRequest[];
  hostJoinApplications?: HostJoinApplication[];
  stats: {
    totalUsers: number;
    activeRooms: number;
    totalCoins: number;
    blockedAttempts: number;
    appPrizePoolCoins?: number;
    pendingUsdtCount?: number;
    pendingFemaleVoiceCount?: number;
  };
}

type AdminTab =
  | 'overview'
  | 'users'
  | 'female_voice'
  | 'rooms_agencies'
  | 'gifts_announcements'
  | 'usdt'
  | 'competitions'
  | 'questions'
  | 'settings'
  | 'devices';

export const AdminPage: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const { broadcastAdminAnnouncement } = useActiveRoom();
  const [data, setData] = useState<AdminOverview | null>(null);
  const [tab, setTab] = useState<AdminTab>('overview');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [hostSearch, setHostSearch] = useState('');
  const [voiceFilter, setVoiceFilter] = useState<'pending' | 'all'>('pending');
  const [notice, setNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [previewProof, setPreviewProof] = useState<string | null>(null);
  const [resetPhrase, setResetPhrase] = useState('');
  const [resettingApplication, setResettingApplication] = useState(false);
  const adminScrollRef = useRef<HTMLDivElement | null>(null);
  const navScrollRef = useRef<HTMLElement | null>(null);
  const loadingOverviewRef = useRef(false);
  const pendingSilentReloadRef = useRef(false);

  // Prize pool editor
  const [poolInput, setPoolInput] = useState('100000');

  // Competitions
  const [compTitle, setCompTitle] = useState('');
  const [compSub, setCompSub] = useState('');
  const [compCoins, setCompCoins] = useState('25000');
  const [compDiamonds, setCompDiamonds] = useState('10000');

  // Agencies & Host management
  const [agencyRateDrafts, setAgencyRateDrafts] = useState<Record<string, string>>({});
  const [agencyPayoutDrafts, setAgencyPayoutDrafts] = useState<Record<string, string>>({});
  const [hostAgencyDrafts, setHostAgencyDrafts] = useState<Record<string, string>>({});

  // Questions CSV/Excel import
  const [importMode, setImportMode] = useState<'append' | 'replace'>('append');
  const [csvPaste, setCsvPaste] = useState('');
  const [importingQuestions, setImportingQuestions] = useState(false);
  const questionFileRef = useRef<HTMLInputElement | null>(null);

  // Economy Settings Draft
  const [settingsDraft, setSettingsDraft] = useState<PlatformSettings | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);

  const isSuperAdmin = isSuperAdminUser(user);

  const loadOverview = useCallback(
    async (mode: boolean | 'silent' = false) => {
      if (!isSuperAdmin) {
        setLoading(false);
        return;
      }
      if (loadingOverviewRef.current) {
        if (mode === 'silent') {
          pendingSilentReloadRef.current = true;
        }
        return;
      }

      loadingOverviewRef.current = true;
      const showRefreshing = mode === true;
      const isSilentBackground = mode === 'silent';
      if (showRefreshing) setRefreshing(true);

      try {
        const res = await getAdminOverviewFromSupabase();
        setData(res);
        setSettingsDraft(res.settings);
        const rates: Record<string, string> = {};
        const payouts: Record<string, string> = {};
        for (const ag of res.agencies || []) {
          rates[ag.id] = String(Math.round((ag.commissionRate || 0) * 100));
          const pending = Math.max(
            0,
            Math.round((ag.totalHostDiamonds || 0) * (ag.commissionRate || 0)) -
              (ag.totalCommissionDiamonds || 0)
          );
          payouts[ag.id] = String(pending);
        }
        setAgencyRateDrafts(rates);
        setAgencyPayoutDrafts(payouts);
        const userAgencies: Record<string, string> = {};
        for (const u of res.users || []) {
          if (u.agencyId) userAgencies[u.id] = u.agencyId;
        }
        setHostAgencyDrafts(userAgencies);
      } catch (err) {
        if (!isSilentBackground) {
          setNotice({
            type: 'err',
            text: err instanceof Error ? err.message : 'تعذّر تحميل بيانات لوحة الإدارة.',
          });
        }
      } finally {
        loadingOverviewRef.current = false;
        setLoading(false);
        if (showRefreshing) setRefreshing(false);
        if (pendingSilentReloadRef.current) {
          pendingSilentReloadRef.current = false;
          void loadOverview('silent');
        }
      }
    },
    [isSuperAdmin]
  );

  useEffect(() => {
    void loadOverview(false);
  }, [loadOverview]);

  const showOk = (text: string) => setNotice({ type: 'ok', text });
  const showErr = (err: unknown, fallback: string) =>
    setNotice({
      type: 'err',
      text: err instanceof Error ? err.message : fallback,
    });

  const handleApplicationReset = async () => {
    const confirmationPhrase = 'تصفير شامل للتطبيق';
    if (resetPhrase.trim() !== confirmationPhrase) {
      showErr(new Error(`اكتب «${confirmationPhrase}» لتأكيد العملية.`), '');
      return;
    }
    if (
      !window.confirm(
        'تحذير نهائي: سيُحذف كل مستخدمي وبيانات التطبيق من Supabase مع الإبقاء على حساب الإدارة فقط. لا يمكن التراجع عن ذلك.'
      )
    ) {
      return;
    }

    setResettingApplication(true);
    setNotice(null);
    try {
      await resetApplicationDataInSupabase();
    } catch (err) {
      showErr(err, 'تعذّر تصفير بيانات التطبيق.');
      setResettingApplication(false);
      return;
    }

    try {
      window.localStorage.clear();
      window.sessionStorage.clear();
    } catch {
      showErr(
        new Error('تم تصفير Supabase، لكن تعذّر مسح التخزين المحلي لهذا المتصفح.'),
        ''
      );
      setResettingApplication(false);
      return;
    }

    window.location.assign(
      `${window.location.origin}${window.location.pathname}#/login`
    );
  };

  // --- USERS & DEVICES ---
  const handleCoinsAdjust = async (targetId: string, delta: number) => {
    try {
      const updatedUser = await updateAdminUserInSupabase(targetId, { coinsDelta: delta });
      setData((prev) => {
        if (!prev) return prev;
        const nextUsers = prev.users.map((u) => (u.id === targetId ? updatedUser : u));
        return {
          ...prev,
          users: nextUsers,
          stats: {
            ...prev.stats,
            totalCoins: nextUsers.reduce((sum, u) => sum + (u.coins || 0), 0),
          },
        };
      });
      showOk(
        delta > 0
          ? `تم شحن +${delta.toLocaleString('en-US')} كوينز للعضو وحفظه في قاعدة البيانات.`
          : `تم خصم ${Math.abs(delta).toLocaleString('en-US')} كوينز من العضو وحفظه في قاعدة البيانات.`
      );
      if (targetId === user?.id) {
        void refreshUser();
      }
      void loadOverview('silent');
    } catch (err) {
      showErr(err, 'تعذّر تعديل رصيد الكوينز.');
    }
  };

  const handleRoleChange = async (target: User, roleChoice: AdminUserRoleChoice) => {
    try {
      const updatedUser =
        roleChoice === 'admin'
          ? await updateAdminUserInSupabase(target.id, { is_admin: true })
          : roleChoice === 'user'
            ? await updateAdminUserInSupabase(target.id, { is_admin: false, vipLevel: 'none' })
            : await updateAdminUserInSupabase(target.id, {
                is_admin: false,
                vipLevel: roleChoice,
              });

      setData((prev) => {
        if (!prev) return prev;
        const nextUsers = prev.users.map((u) => (u.id === target.id ? updatedUser : u));
        const nextOverrides = { ...(prev.settings.userVipOverrides || {}) };
        if (roleChoice !== 'admin') {
          nextOverrides[target.id] = roleChoice === 'user' ? 'none' : roleChoice;
        }
        return {
          ...prev,
          users: nextUsers,
          settings: {
            ...prev.settings,
            userVipOverrides: nextOverrides,
          },
        };
      });
      showOk(`تم تحديث رتبة "${target.displayName}" وحفظها فوراً في قاعدة البيانات.`);
      if (target.id === user?.id) {
        void refreshUser();
      }
      void loadOverview('silent');
    } catch (err) {
      showErr(err, 'تعذّر تغيير رتبة العضو.');
    }
  };

  const handleToggleBan = async (target: User) => {
    try {
      const updatedUser = await updateAdminUserInSupabase(target.id, {
        is_banned: !target.is_banned,
      });
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          users: prev.users.map((u) => (u.id === target.id ? updatedUser : u)),
        };
      });
      showOk(
        target.is_banned
          ? `تم تفعيل حساب "${target.displayName}" ورفع الحظر بنجاح.`
          : `تم حظر حساب "${target.displayName}" وحفظ التغيير فوراً.`
      );
      void loadOverview('silent');
    } catch (err) {
      showErr(err, 'تعذّر تحديث حالة الحساب.');
    }
  };

  const handleUnlockDevice = async (uuid: string) => {
    try {
      await unlockDeviceInSupabase(uuid);
      showOk('تم فك ارتباط الجهاز بنجاح.');
      void loadOverview('silent');
    } catch (err) {
      showErr(err, 'تعذّر فك الارتباط.');
    }
  };

  const handleBlockDevice = async (lock: DeviceLock) => {
    try {
      await blockDeviceInSupabase(lock.device_uuid, !lock.isBlocked, 'قرار من الإدارة العليا');
      showOk(lock.isBlocked ? 'تم إلغاء حظر الجهاز.' : 'تم حظر الجهاز بالكامل.');
      void loadOverview('silent');
    } catch (err) {
      showErr(err, 'تعذّر تعديل حالة الجهاز.');
    }
  };

  // --- ROOMS & PINNING ---
  const handleTogglePinRoom = async (room: Room, isCurrentlyPinned: boolean) => {
    try {
      await togglePinRoomInSupabase(room.id);
      showOk(
        isCurrentlyPinned
          ? `تم إلغاء تثبيت غرفة "${room.title}" من مقدمة تبويب "حفلة".`
          : `تم تثبيت غرفة "${room.title}" في مقدمة تبويب "حفلة" 📌`
      );
      void loadOverview('silent');
    } catch (err) {
      showErr(err, 'تعذّر تحديث تثبيت الغرفة.');
    }
  };

  const handleCloseRoom = async (roomId: string) => {
    try {
      await closeRoomInSupabase(roomId);
      showOk('تم إغلاق الغرفة الصوتية بنجاح.');
      void loadOverview('silent');
    } catch (err) {
      showErr(err, 'تعذّر إغلاق الغرفة.');
    }
  };

  // --- GIFTS & ANNOUNCEMENTS ---
  const handleCreateCustomGift = async (payload: {
    name: string;
    coinsCost: number;
    glyph?: string;
    imageUrl?: string;
    category: 'fixed' | 'lucky';
  }) => {
    await createCustomGiftInSupabase(payload);
    showOk(`تمت إضافة هدية "${payload.name}" بنجاح وتفعيلها داخل الغرف والرسائل!`);
    void loadOverview('silent');
  };

  const handleDeleteCustomGift = async (giftId: string) => {
    try {
      await deleteCustomGiftInSupabase(giftId);
      showOk('تم حذف الهدية المخصصة.');
      void loadOverview('silent');
    } catch (err) {
      showErr(err, 'تعذّر حذف الهدية.');
    }
  };

  const handleSendGlobalAnnouncement = async (payload: { title?: string; message: string }) => {
    const ann = await sendGlobalAdminAnnouncementInSupabase({
      title: payload.title,
      message: payload.message,
      senderName: user?.displayName || 'الإدارة العليا',
    });
    await broadcastAdminAnnouncement(ann);
    showOk('تم نشر وبث الإعلان العام كشريط علوي لجميع المستخدمين بنجاح!');
    void loadOverview('silent');
  };

  // --- COMPETITIONS ---
  const handleCreateCompetition = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createCompetitionInSupabase({
        title: compTitle,
        subtitle: compSub,
        prizeCoins: Number(compCoins),
        prizeDiamonds: Number(compDiamonds),
      });
      setCompTitle('');
      setCompSub('');
      showOk('تم إطلاق المسابقة الملكية الجديدة!');
      void loadOverview('silent');
    } catch (err) {
      showErr(err, 'تعذّر إنشاء المسابقة.');
    }
  };

  const handleFinishCompetition = async (compId: string) => {
    try {
      await finishCompetitionInSupabase(compId);
      showOk('تم تتويج الفائز وتوزيع الجوائز تلقائياً!');
      void loadOverview('silent');
    } catch (err) {
      showErr(err, 'تعذّر إنهاء المسابقة.');
    }
  };

  // --- PRIZE POOL ---
  const handlePrizePoolUpdate = async (mode: 'add' | 'set', explicitAmount?: number) => {
    try {
      const amount = explicitAmount ?? Math.floor(Number(poolInput) || 0);
      const appPrizePoolCoins = await updatePrizePoolInSupabase(amount, mode);
      showOk(
        mode === 'set'
          ? `تم تعيين مخزون جوائز دولاب الدعوات إلى ${appPrizePoolCoins.toLocaleString('en-US')} كوينز.`
          : `تمت تعبئة المخزون بمقدار +${amount.toLocaleString('en-US')} كوينز ليصبح ${appPrizePoolCoins.toLocaleString('en-US')} كوينز.`
      );
      void loadOverview('silent');
    } catch (err) {
      showErr(err, 'تعذّر تحديث مخزون الجوائز.');
    }
  };

  // --- USDT DEPOSITS & WITHDRAWALS ---
  const handleApproveDeposit = async (depositId: string) => {
    try {
      await approveUsdtDepositInSupabase(depositId);
      showOk('تم تأكيد إيداع USDT ومنح الكوينز والإطار/الدخولية المؤقتة للعضو تلقائياً!');
      void loadOverview('silent');
      void refreshUser();
    } catch (err) {
      showErr(err, 'تعذّر تأكيد الإيداع.');
    }
  };

  const handleRejectDeposit = async (depositId: string) => {
    try {
      await rejectUsdtDepositInSupabase(depositId, 'لم يتم التحقق من الحوالة على شبكة TRC20');
      showOk('تم رفض طلب الإيداع.');
      void loadOverview('silent');
    } catch (err) {
      showErr(err, 'تعذّر رفض الإيداع.');
    }
  };

  const handleApproveWithdrawal = async (wdId: string) => {
    try {
      await approveUsdtWithdrawalInSupabase(wdId);
      showOk('تم تأكيد تحويل أرباح USDT بنجاح!');
      void loadOverview('silent');
    } catch (err) {
      showErr(err, 'تعذّر تأكيد السحب.');
    }
  };

  const handleRejectWithdrawal = async (wdId: string) => {
    try {
      await rejectUsdtWithdrawalInSupabase(wdId, 'بيانات محفظة TRC20 غير مكتملة');
      showOk('تم رفض طلب السحب وإرجاع الرصيد إلى محفظة العضو.');
      void loadOverview('silent');
    } catch (err) {
      showErr(err, 'تعذّر رفض السحب.');
    }
  };

  // --- FEMALE VOICE VERIFICATION ---
  const handleApproveFemaleVoice = async (requestId: string) => {
    try {
      await approveFemaleVoiceInSupabase(requestId);
      showOk('تمت الموافقة ومنح شارة التوثيق النسائي وتفعيل الألماس للعضوة بنجاح!');
      void loadOverview('silent');
    } catch (err) {
      showErr(err, 'تعذّر اعتماد طلب التوثيق.');
    }
  };

  const handleRejectFemaleVoice = async (requestId: string) => {
    try {
      await rejectFemaleVoiceInSupabase(
        requestId,
        'الصوت غير واضح أو لم يطابق العبارة المطلوبة — يرجى إعادة تسجيل بصمة صوتية جديدة.'
      );
      showOk('تم رفض طلب التوثيق الصوتي مع السماح للعضوة بإعادة التسجيل.');
      void loadOverview('silent');
    } catch (err) {
      showErr(err, 'تعذّر رفض الطلب.');
    }
  };

  // --- AGENCIES & HOSTS ---
  const handleUpdateAgency = async (
    agencyId: string,
    payload: { status?: 'approved' | 'pending' | 'suspended'; commissionRate?: number }
  ) => {
    try {
      await updateAgencyInSupabase(agencyId, payload);
      showOk('تم تحديث بيانات الوكالة ونسبة العمولة بنجاح.');
      void loadOverview('silent');
    } catch (err) {
      showErr(err, 'تعذّر تحديث الوكالة.');
    }
  };

  const handlePayoutAgencyCommission = async (agencyId: string) => {
    try {
      const raw = agencyPayoutDrafts[agencyId];
      const parsed = raw !== undefined && raw.trim() !== '' ? Number(raw) : undefined;
      const res = await payoutAgencyCommissionInSupabase(agencyId, parsed);
      showOk(
        `تم صرف عمولة الوكيل بنجاح (+${res.paidDiamonds.toLocaleString('en-US')} 💎) وإضافتها إلى محفظته.`
      );
      void loadOverview('silent');
      void refreshUser();
    } catch (err) {
      showErr(err, 'تعذّر صرف عمولة الوكيل.');
    }
  };

  const handleHostApproval = async (
    targetId: string,
    payload: { isHost?: boolean; isAgent?: boolean; agencyId?: string | null }
  ) => {
    try {
      await updateHostApprovalInSupabase(targetId, payload);
      showOk('تم تحديث اعتماد المضيف/الوكيل بنجاح.');
      void loadOverview('silent');
    } catch (err) {
      showErr(err, 'تعذّر تحديث اعتماد المضيف.');
    }
  };

  const handleReviewHostApp = async (appId: string, decision: 'approved' | 'rejected') => {
    try {
      await reviewHostJoinApplicationInSupabase(appId, decision);
      showOk(
        decision === 'approved'
          ? 'تم قبول الطلب وربط المضيف بالوكالة بنجاح!'
          : 'تم رفض طلب الانضمام للوكالة.'
      );
      void loadOverview('silent');
    } catch (err) {
      showErr(err, 'تعذّر مراجعة طلب الانضمام.');
    }
  };

  // --- QUESTIONS CSV / EXCEL ---
  const handleExportExcel = async () => {
    const XLSX = await import('xlsx');
    const questions = data?.culturalQuestions || [];
    const exportRows = questions.map((q) => ({
      category: q.category,
      question: q.question,
      option1: q.options[0],
      option2: q.options[1],
      option3: q.options[2],
      option4: q.options[3],
      correctIndex: q.correctIndex + 1,
      xpReward: q.xpReward,
      coinsReward: q.coinsReward,
    }));
    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'CulturalQuestions');
    XLSX.writeFile(wb, 'sada-cultural-questions.xlsx');
    showOk(`تم تصدير ${questions.length} سؤالاً بصيغة Excel (.xlsx) بنجاح.`);
  };

  const handleExportCsv = async () => {
    try {
      const csvText = buildQuestionsCsvText(data?.culturalQuestions || []);
      const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'sada-cultural-questions.csv';
      a.click();
      URL.revokeObjectURL(url);
      showOk('تم تنزيل ملف الأسئلة بصيغة CSV متوافقة مع Excel.');
    } catch (err) {
      showErr(err, 'تعذّر تصدير ملف CSV.');
    }
  };

  const handleDownloadTemplate = async () => {
    const XLSX = await import('xlsx');
    const sample = [
      {
        category: 'أدب وشعر',
        question: 'من الشاعر الملقب بأمير الشعراء؟',
        option1: 'أحمد شوقي',
        option2: 'حافظ إبراهيم',
        option3: 'المتنبي',
        option4: 'محمود درويش',
        correctIndex: 1,
        xpReward: 120,
        coinsReward: 350,
      },
    ];
    const ws = XLSX.utils.json_to_sheet(sample);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, 'sada-questions-template.xlsx');
    showOk('تم تنزيل قالب Excel الجاهز لاستيراد الأسئلة.');
  };

  const handleQuestionFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportingQuestions(true);
    try {
      const XLSX = await import('xlsx');
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const sheetName = wb.SheetNames[0];
      const sheet = wb.Sheets[sheetName];
      const matrix = XLSX.utils.sheet_to_json<(string | number | undefined)[]>(sheet, {
        header: 1,
      });

      const cleanMatrix = matrix.filter(
        (row) => Array.isArray(row) && row.some((cell) => String(cell ?? '').trim() !== '')
      );
      if (cleanMatrix.length === 0) {
        throw new Error('الملف المرفوع فارغ.');
      }

      const firstRowText = cleanMatrix[0].map((c) => String(c ?? '').toLowerCase()).join(' ');
      const hasHeader =
        firstRowText.includes('question') ||
        firstRowText.includes('category') ||
        firstRowText.includes('السؤال');

      const dataRows = (hasHeader ? cleanMatrix.slice(1) : cleanMatrix).map((cols) => ({
        category: String(cols[0] ?? 'ثقافة عامة').trim(),
        question: String(cols[1] ?? '').trim(),
        option1: String(cols[2] ?? '').trim(),
        option2: String(cols[3] ?? '').trim(),
        option3: String(cols[4] ?? '').trim(),
        option4: String(cols[5] ?? '').trim(),
        correctIndex: cols[6] ?? 1,
        xpReward: cols[7] ?? 120,
        coinsReward: cols[8] ?? 350,
      }));

      const res = await importQuestionsInSupabase({ rows: dataRows, mode: importMode });
      showOk(
        `تم استيراد ${res.importedCount} سؤالاً بنجاح (${importMode === 'replace' ? 'استبدال' : 'إضافة'}). إجمالي بنك الأسئلة الآن: ${res.totalCount}.`
      );
      if (questionFileRef.current) questionFileRef.current.value = '';
      void loadOverview('silent');
    } catch (err) {
      showErr(err, 'تعذّر قراءة ملف Excel/CSV.');
    } finally {
      setImportingQuestions(false);
    }
  };

  const handleImportCsvPaste = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvPaste.trim()) return;
    setImportingQuestions(true);
    try {
      const res = await importQuestionsInSupabase({ csvText: csvPaste, mode: importMode });
      setCsvPaste('');
      showOk(
        `تم استيراد ${res.importedCount} سؤالاً من النص بنجاح! إجمالي الأسئلة: ${res.totalCount}.`
      );
      void loadOverview('silent');
    } catch (err) {
      showErr(err, 'تعذّر استيراد الأسئلة من النص.');
    } finally {
      setImportingQuestions(false);
    }
  };

  const handleDeleteQuestion = async (qId: string) => {
    try {
      const remaining = await deleteQuestionInSupabase(qId);
      showOk(`تم حذف السؤال. المتبقي في البنك: ${remaining.length} سؤالاً.`);
      void loadOverview('silent');
    } catch (err) {
      showErr(err, 'تعذّر حذف السؤال.');
    }
  };

  // --- ECONOMY SETTINGS ---
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settingsDraft) return;
    setSavingSettings(true);
    try {
      const saved = await savePlatformSettingsInSupabase(settingsDraft);
      setSettingsDraft(saved);
      showOk('تم حفظ وتطبيق كافة الإعدادات الاقتصادية والمكافآت فورياً على المنصة!');
      void loadOverview('silent');
    } catch (err) {
      showErr(err, 'تعذّر حفظ الإعدادات.');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleQuickPmCostPreset = async (cost: number) => {
    if (!settingsDraft) return;
    setSavingSettings(true);
    try {
      const updated = {
        ...settingsDraft,
        pmMessageCost: cost,
        pmReplyDiamonds: Math.round(cost * (settingsDraft.giftDiamondsRatio || 0.75)),
      };
      const saved = await savePlatformSettingsInSupabase(updated);
      setSettingsDraft(saved);
      showOk(`تم تعديل وحفظ سعر الرسالة الخاصة إلى ${cost} كوين فورياً!`);
      void loadOverview('silent');
    } catch (err) {
      showErr(err, 'تعذّر حفظ السعر السريع.');
    } finally {
      setSavingSettings(false);
    }
  };

  const activeRooms = useMemo(
    () => (data?.rooms || []).filter((r) => r.isActive),
    [data?.rooms]
  );

  const pinnedSet = useMemo(
    () => new Set(data?.settings.pinnedRoomIds || []),
    [data?.settings.pinnedRoomIds]
  );

  const sortedActiveRooms = useMemo(() => {
    return [...activeRooms].sort((a, b) => {
      const aPin = pinnedSet.has(a.id) ? 1 : 0;
      const bPin = pinnedSet.has(b.id) ? 1 : 0;
      if (aPin !== bPin) return bPin - aPin;
      return b.listenersCount - a.listenersCount;
    });
  }, [activeRooms, pinnedSet]);

  const filteredHostUsers = useMemo(() => {
    const q = hostSearch.trim().toLowerCase();
    return (data?.users || []).filter(
      (u) =>
        !q ||
        u.displayName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q)
    );
  }, [data?.users, hostSearch]);

  const voiceRequestsToDisplay = useMemo(() => {
    const list = data?.femaleVoiceRequests || [];
    if (voiceFilter === 'pending') {
      return list.filter((r) => r.status === 'pending');
    }
    return list;
  }, [data?.femaleVoiceRequests, voiceFilter]);

  if (!isSuperAdmin) {
    return <Navigate to="/" replace />;
  }

  const pendingHostAppsCount =
    data?.hostJoinApplications?.filter((a) => a.status === 'pending').length || 0;
  const pendingVoiceCount = data?.stats.pendingFemaleVoiceCount || 0;
  const pendingUsdtCount = data?.stats.pendingUsdtCount || 0;

  const tabs: Array<{ id: AdminTab; label: string; badge?: number }> = [
    { id: 'overview', label: 'نظرة عامة' },
    { id: 'users', label: 'المستخدمون' },
    { id: 'female_voice', label: 'التوثيق الصوتي', badge: pendingVoiceCount },
    {
      id: 'rooms_agencies',
      label: 'الغرف والوكالات',
      badge: pendingHostAppsCount,
    },
    { id: 'gifts_announcements', label: 'الهدايا والإعلانات' },
    { id: 'usdt', label: 'طلبات USDT', badge: pendingUsdtCount },
    { id: 'competitions', label: 'المسابقات' },
    { id: 'questions', label: 'بنك الأسئلة' },
    { id: 'settings', label: 'الإعدادات المالية' },
    { id: 'devices', label: 'حماية UUID' },
  ];

  const handleAdminKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement | null;
    const tag = target?.tagName?.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || target?.isContentEditable) {
      return;
    }

    const stepY = 120;
    const stepX = 120;
    const mainScroller = adminScrollRef.current?.closest('main') as HTMLElement | null;

    if (e.key === 'ArrowDown' || e.key === 'PageDown') {
      const amount = e.key === 'PageDown' ? 380 : stepY;
      if (mainScroller) {
        mainScroller.scrollBy({ top: amount, behavior: 'smooth' });
      }
      e.preventDefault();
    } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
      const amount = e.key === 'PageUp' ? -380 : -stepY;
      if (mainScroller) {
        mainScroller.scrollBy({ top: amount, behavior: 'smooth' });
      }
      e.preventDefault();
    } else if (e.key === 'ArrowRight') {
      if (navScrollRef.current && navScrollRef.current.scrollWidth > navScrollRef.current.clientWidth) {
        navScrollRef.current.scrollBy({ left: stepX, behavior: 'smooth' });
      }
      e.preventDefault();
    } else if (e.key === 'ArrowLeft') {
      if (navScrollRef.current && navScrollRef.current.scrollWidth > navScrollRef.current.clientWidth) {
        navScrollRef.current.scrollBy({ left: -stepX, behavior: 'smooth' });
      }
      e.preventDefault();
    }
  };

  return (
    <div
      ref={adminScrollRef}
      tabIndex={0}
      onKeyDown={handleAdminKeyDown}
      className="w-full min-h-full focus:outline-none"
    >
      {/* Top Sticky Responsive Header & Organized Tabs */}
      <header className="sticky top-0 z-30 border-b border-[#D4AF37]/20 bg-[#070913]/92 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[#FCE9A6]">
                <ShieldCheck className="w-6 h-6 text-[#D4AF37] shrink-0" />
                <h1 className="text-lg sm:text-2xl font-extrabold gold-gradient-text truncate">
                  لوحة التحكم العليا — صَدَى
                </h1>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-300 mt-0.5 truncate">
                إدارة شاملة ومباشرة من الهاتف واللابتوب لبيانات Supabase الحية
              </p>
            </div>

            <button
              type="button"
              disabled={refreshing}
              onClick={() => void loadOverview(true)}
              className="min-h-[40px] rounded-xl bg-[#0B0F20] border border-[#D4AF37]/35 px-3 text-xs font-bold text-[#FCE9A6] hover:bg-[#D4AF37]/15 flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">تحديث البيانات</span>
            </button>
          </div>

          {/* Horizontal Touch & Keyboard Scrollable Top Tabs */}
          <nav
            ref={navScrollRef}
            tabIndex={0}
            aria-label="أقسام لوحة الإدارة"
            className="flex items-center gap-1.5 overflow-x-auto touch-pan-x scroll-smooth pb-1 focus:outline-none"
          >
            {tabs.map((t) => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={`min-h-[42px] rounded-xl px-3.5 py-2 text-xs font-extrabold whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer transition ${
                    active
                      ? 'bg-gradient-to-r from-[#D4AF37] to-[#B58922] text-[#070913] shadow-[0_0_16px_rgba(212,175,55,0.35)]'
                      : 'royal-glass text-slate-200 hover:text-white border border-white/10'
                  }`}
                >
                  <span>{t.label}</span>
                  {(t.badge || 0) > 0 && (
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-mono-num font-black leading-none ${
                        active
                          ? 'bg-[#070913] text-[#FCE9A6]'
                          : 'bg-rose-500 text-white'
                      }`}
                    >
                      {t.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-5 space-y-5">
        {notice && (
          <div
            className={`rounded-2xl border px-4 py-3 text-xs sm:text-sm flex items-center justify-between gap-3 ${
              notice.type === 'ok'
                ? 'border-[#D4AF37]/45 bg-[#D4AF37]/12 text-[#FCE9A6]'
                : 'border-rose-500/45 bg-rose-950/60 text-rose-200'
            }`}
          >
            <span>{notice.text}</span>
            <button
              type="button"
              onClick={() => setNotice(null)}
              className="text-xs font-bold opacity-75 hover:opacity-100 cursor-pointer shrink-0"
            >
              إغلاق
            </button>
          </div>
        )}

        {loading || !data ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="royal-glass rounded-3xl h-28 animate-pulse opacity-60" />
            ))}
          </div>
        ) : (
          <>
            {/* TAB 1: OVERVIEW ("نظرة عامة") */}
            {tab === 'overview' && (
              <section className="space-y-5">
                {/* 4 Live Supabase KPI Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                  <button
                    type="button"
                    onClick={() => setTab('users')}
                    className="royal-glass rounded-3xl p-4 sm:p-5 text-right space-y-1.5 border border-[#D4AF37]/25 hover:border-[#D4AF37]/60 transition cursor-pointer"
                  >
                    <div className="flex items-center justify-between text-xs text-slate-300">
                      <span>عدد المستخدمين</span>
                      <Users className="w-4 h-4 text-[#D4AF37]" />
                    </div>
                    <div className="text-2xl sm:text-3xl font-extrabold font-mono-num text-white">
                      {data.stats.totalUsers.toLocaleString('en-US')}
                    </div>
                    <p className="text-[11px] text-[#FCE9A6]/80">إدارة الأعضاء والرتب ←</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTab('rooms_agencies')}
                    className="royal-glass rounded-3xl p-4 sm:p-5 text-right space-y-1.5 border border-emerald-500/25 hover:border-emerald-400/60 transition cursor-pointer"
                  >
                    <div className="flex items-center justify-between text-xs text-slate-300">
                      <span>الغرف النشطة</span>
                      <Radio className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div className="text-2xl sm:text-3xl font-extrabold font-mono-num text-emerald-300">
                      {data.stats.activeRooms.toLocaleString('en-US')}
                    </div>
                    <p className="text-[11px] text-emerald-200/80">تثبيت وإدارة الغرف ←</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTab('settings')}
                    className="royal-glass rounded-3xl p-4 sm:p-5 text-right space-y-1.5 border border-[#F3D37A]/25 hover:border-[#F3D37A]/60 transition cursor-pointer"
                  >
                    <div className="flex items-center justify-between text-xs text-slate-300">
                      <span>إجمالي العملات</span>
                      <Coins className="w-4 h-4 text-[#F3D37A]" />
                    </div>
                    <div className="text-2xl sm:text-3xl font-extrabold font-mono-num text-[#FCE9A6]">
                      {data.stats.totalCoins.toLocaleString('en-US')}
                    </div>
                    <p className="text-[11px] text-slate-300">السيولة المتداولة بالأرصدة</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTab('female_voice')}
                    className={`royal-glass rounded-3xl p-4 sm:p-5 text-right space-y-1.5 border transition cursor-pointer ${
                      pendingVoiceCount > 0
                        ? 'border-pink-400/55 bg-pink-950/20'
                        : 'border-white/15 hover:border-pink-400/45'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs text-slate-300">
                      <span>طلبات التوثيق المعلقة</span>
                      <Mic className="w-4 h-4 text-pink-300" />
                    </div>
                    <div className="text-2xl sm:text-3xl font-extrabold font-mono-num text-pink-200">
                      {pendingVoiceCount.toLocaleString('en-US')}
                    </div>
                    <p className="text-[11px] text-pink-200/80">مراجعة التسجيلات الصوتية ←</p>
                  </button>
                </div>

                {/* Quick Operations Bar */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <button
                    type="button"
                    onClick={() => setTab('usdt')}
                    className="royal-glass rounded-2xl p-4 flex items-center justify-between border border-white/10 hover:border-[#D4AF37]/45 cursor-pointer"
                  >
                    <div className="text-right">
                      <span className="block text-xs text-slate-400">طلبات USDT المعلقة</span>
                      <span className="text-lg font-extrabold font-mono-num text-[#FCE9A6]">
                        {pendingUsdtCount}
                      </span>
                    </div>
                    <Coins className="w-5 h-5 text-[#D4AF37]" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setTab('rooms_agencies')}
                    className="royal-glass rounded-2xl p-4 flex items-center justify-between border border-white/10 hover:border-[#D4AF37]/45 cursor-pointer"
                  >
                    <div className="text-right">
                      <span className="block text-xs text-slate-400">طلبات انضمام المضيفين</span>
                      <span className="text-lg font-extrabold font-mono-num text-emerald-300">
                        {pendingHostAppsCount}
                      </span>
                    </div>
                    <UserCheck className="w-5 h-5 text-emerald-400" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setTab('gifts_announcements')}
                    className="royal-glass rounded-2xl p-4 flex items-center justify-between border border-white/10 hover:border-[#D4AF37]/45 cursor-pointer"
                  >
                    <div className="text-right">
                      <span className="block text-xs text-slate-400">هدايا الإدارة المخصصة</span>
                      <span className="text-lg font-extrabold font-mono-num text-amber-200">
                        {data.settings.customGifts?.length || 0}
                      </span>
                    </div>
                    <Gift className="w-5 h-5 text-amber-300" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setTab('devices')}
                    className="royal-glass rounded-2xl p-4 flex items-center justify-between border border-white/10 hover:border-[#D4AF37]/45 cursor-pointer"
                  >
                    <div className="text-right">
                      <span className="block text-xs text-slate-400">محاولات تعدد محظورة</span>
                      <span className="text-lg font-extrabold font-mono-num text-rose-300">
                        {data.stats.blockedAttempts}
                      </span>
                    </div>
                    <ShieldAlert className="w-5 h-5 text-rose-400" />
                  </button>
                </div>

                {/* Prize Pool Management */}
                <div className="royal-glass rounded-3xl p-5 sm:p-6 space-y-4">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div>
                      <span className="text-xs text-[#F3D37A] font-bold">
                        مخزون جوائز التطبيق (دولاب حظ الدعوات)
                      </span>
                      <p className="text-2xl sm:text-3xl font-extrabold font-mono-num text-emerald-300 mt-1">
                        {(data.stats.appPrizePoolCoins ?? 0).toLocaleString('en-US')} كوينز
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        يمنع النظام تلقائياً فوز أي عضو بجائزة تتجاوز الرصيد المتاح في هذا المخزون.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        value={poolInput}
                        onChange={(e) => setPoolInput(e.target.value)}
                        dir="ltr"
                        className="w-36 min-h-[42px] rounded-xl bg-[#070913]/85 border border-[#D4AF37]/30 px-3 text-sm text-white font-mono-num text-left focus:outline-none focus:border-[#D4AF37]"
                      />
                      <button
                        type="button"
                        onClick={() => handlePrizePoolUpdate('add')}
                        className="gold-btn min-h-[42px] rounded-xl px-4 text-xs font-bold cursor-pointer"
                      >
                        تعبئة المخزون (+)
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePrizePoolUpdate('set')}
                        className="min-h-[42px] rounded-xl px-4 text-xs font-bold bg-[#070913]/85 border border-[#D4AF37]/40 text-[#FCE9A6] hover:bg-[#D4AF37]/15 cursor-pointer"
                      >
                        تعيين الرصيد الدقيق
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePrizePoolUpdate('add', 100000)}
                        className="min-h-[42px] rounded-xl px-3.5 text-xs font-bold bg-emerald-950/60 border border-emerald-400/40 text-emerald-200 hover:bg-emerald-900/60 cursor-pointer"
                      >
                        +100,000 سريع
                      </button>
                    </div>
                  </div>
                </div>

                {/* Active Rooms Snapshot */}
                <div className="royal-glass rounded-3xl p-5 sm:p-6 space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-base font-extrabold text-[#F3D37A]">
                      أبرز الغرف النشطة حالياً ({sortedActiveRooms.length})
                    </h2>
                    <button
                      type="button"
                      onClick={() => setTab('rooms_agencies')}
                      className="text-xs font-bold text-[#FCE9A6] hover:underline cursor-pointer"
                    >
                      عرض الكل والتثبيت ←
                    </button>
                  </div>
                  {sortedActiveRooms.length === 0 ? (
                    <p className="text-xs text-slate-400 py-4 text-center">
                      لا توجد غرف نشطة حالياً.
                    </p>
                  ) : (
                    <div className="divide-y divide-[#D4AF37]/15">
                      {sortedActiveRooms.slice(0, 5).map((r) => {
                        const isPinned = pinnedSet.has(r.id);
                        return (
                          <div
                            key={r.id}
                            className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                          >
                            <div className="min-w-0 space-y-0.5">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-bold text-white truncate">{r.title}</p>
                                {isPinned && (
                                  <span className="rounded-lg bg-[#D4AF37]/20 border border-[#D4AF37]/50 px-2 py-0.5 text-[10px] font-extrabold text-[#FCE9A6]">
                                    مثبتة في حفلة 📌
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-400 font-mono-num">
                                المضيف: {r.hostName} · {r.listenersCount} مستمع ·{' '}
                                {r.totalGiftsCoins.toLocaleString('en-US')} كوينز هدايا
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() => void handleTogglePinRoom(r, isPinned)}
                                className={`min-h-[38px] rounded-xl px-3 text-xs font-bold border flex items-center gap-1.5 cursor-pointer ${
                                  isPinned
                                    ? 'bg-[#D4AF37] text-[#070913] border-[#FCE9A6]'
                                    : 'bg-white/5 border-[#D4AF37]/35 text-[#FCE9A6]'
                                }`}
                              >
                                {isPinned ? (
                                  <>
                                    <PinOff className="w-3.5 h-3.5" />
                                    <span>إلغاء التثبيت</span>
                                  </>
                                ) : (
                                  <>
                                    <Pin className="w-3.5 h-3.5" />
                                    <span>تثبيت في حفلة</span>
                                  </>
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleCloseRoom(r.id)}
                                className="min-h-[38px] rounded-xl px-3 text-xs font-bold bg-rose-950/60 border border-rose-500/40 text-rose-200 hover:bg-rose-900/60 cursor-pointer flex items-center gap-1"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>إغلاق</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <section className="rounded-3xl border border-rose-500/45 bg-rose-950/25 p-5 sm:p-6 space-y-4">
                  <div className="flex items-start gap-3">
                    <ShieldAlert className="w-5 h-5 mt-0.5 shrink-0 text-rose-300" />
                    <div className="space-y-1">
                      <h2 className="text-base font-extrabold text-rose-200">
                        منطقة التصفير الشامل
                      </h2>
                      <p className="text-xs leading-relaxed text-rose-100/80">
                        يحذف الحسابات غير الإدارية وكل الغرف والرسائل والوكالات
                        والمعاملات والمسابقات وبيانات المستخدمين من Supabase.
                        يبقى حساب الإدارة وكتالوج الهدايا الأساسي فقط. ستُمسح
                        بيانات التخزين المحلي وسيُطلب تسجيل الدخول مجدداً.
                      </p>
                    </div>
                  </div>
                  <label className="block space-y-1.5">
                    <span className="text-xs font-bold text-rose-100">
                      اكتب «تصفير شامل للتطبيق» لتفعيل الزر
                    </span>
                    <input
                      value={resetPhrase}
                      onChange={(event) => setResetPhrase(event.target.value)}
                      autoComplete="off"
                      className="w-full min-h-[44px] rounded-xl border border-rose-400/40 bg-black/35 px-3 text-sm text-white focus:outline-none focus:border-rose-300"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={
                      resettingApplication ||
                      resetPhrase.trim() !== 'تصفير شامل للتطبيق'
                    }
                    onClick={() => void handleApplicationReset()}
                    className="min-h-[46px] rounded-xl bg-rose-700 px-5 text-sm font-extrabold text-white shadow-lg transition hover:bg-rose-600 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {resettingApplication ? 'جارٍ تصفير البيانات...' : 'تصفير شامل للتطبيق'}
                  </button>
                </section>
              </section>
            )}

            {/* TAB 2: USERS ("المستخدمون") */}
            {tab === 'users' && (
              <AdminUsersTab
                users={data.users}
                search={search}
                onSearchChange={setSearch}
                onCoinsAdjust={handleCoinsAdjust}
                onRoleChange={handleRoleChange}
                onToggleBan={handleToggleBan}
              />
            )}

            {/* TAB 3: FEMALE VOICE VERIFICATION ("التوثيق الصوتي") */}
            {tab === 'female_voice' && (
              <section className="royal-glass rounded-3xl p-5 sm:p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-[#FCE9A6]">
                    <Mic className="w-5 h-5 text-pink-300" />
                    <div>
                      <h2 className="text-base sm:text-lg font-extrabold">
                        طلبات التوثيق الصوتي للحسابات النسائية ({voiceRequestsToDisplay.length})
                      </h2>
                      <p className="text-xs text-slate-300">
                        استمع للتسجيل الصوتي ثم وافق لمنح شارة التوثيق أو ارفض الطلب
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setVoiceFilter('pending')}
                      className={`min-h-[38px] rounded-xl px-3.5 text-xs font-bold border cursor-pointer ${
                        voiceFilter === 'pending'
                          ? 'bg-pink-500 border-pink-300 text-white'
                          : 'bg-[#070913]/80 border-white/10 text-slate-300'
                      }`}
                    >
                      المعلقة فقط ({pendingVoiceCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setVoiceFilter('all')}
                      className={`min-h-[38px] rounded-xl px-3.5 text-xs font-bold border cursor-pointer ${
                        voiceFilter === 'all'
                          ? 'bg-[#D4AF37] border-[#FCE9A6] text-[#070913]'
                          : 'bg-[#070913]/80 border-white/10 text-slate-300'
                      }`}
                    >
                      جميع الطلبات ({data.femaleVoiceRequests?.length || 0})
                    </button>
                  </div>
                </div>

                {voiceRequestsToDisplay.length === 0 ? (
                  <p className="text-xs sm:text-sm text-slate-400 py-10 text-center">
                    {voiceFilter === 'pending'
                      ? 'لا توجد طلبات توثيق صوتي معلّقة حالياً.'
                      : 'لا توجد طلبات توثيق صوتي مسجلة حالياً.'}
                  </p>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {voiceRequestsToDisplay.map((reqItem) => (
                      <div
                        key={reqItem.id}
                        className="rounded-3xl bg-[#070913]/85 border border-[#D4AF37]/30 p-4 sm:p-5 space-y-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h3 className="text-sm sm:text-base font-extrabold text-white truncate">
                              {reqItem.displayName}
                            </h3>
                            <p className="text-xs text-slate-300 truncate" dir="ltr">
                              {reqItem.email}
                            </p>
                            <p className="text-[11px] text-slate-400 mt-1">
                              العبارة: «{reqItem.phrase}» · المدة: {reqItem.durationSeconds} ث
                            </p>
                          </div>

                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold shrink-0 border ${
                              reqItem.status === 'approved'
                                ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200'
                                : reqItem.status === 'rejected'
                                ? 'bg-rose-500/20 border-rose-400/50 text-rose-200'
                                : 'bg-amber-500/20 border-[#D4AF37]/50 text-[#FCE9A6]'
                            }`}
                          >
                            {reqItem.status === 'approved'
                              ? 'موثّقة 🌸'
                              : reqItem.status === 'rejected'
                              ? 'مرفوض'
                              : 'معلق للمراجعة'}
                          </span>
                        </div>

                        <div className="rounded-2xl bg-[#0B0F20] border border-[#D4AF37]/25 p-2.5">
                          <audio controls src={reqItem.audioDataUrl} className="w-full h-11" />
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                          <span className="text-[11px] text-slate-400 font-mono-num">
                            {new Date(reqItem.createdAt).toLocaleString('ar-EG')}
                          </span>

                          {reqItem.status === 'pending' ? (
                            <div className="flex items-center gap-2 w-full sm:w-auto">
                              <button
                                type="button"
                                onClick={() => void handleApproveFemaleVoice(reqItem.id)}
                                className="flex-1 sm:flex-initial min-h-[42px] rounded-xl bg-emerald-600 hover:bg-emerald-500 border border-emerald-400/60 px-4 text-xs font-extrabold text-white cursor-pointer transition flex items-center justify-center gap-1.5"
                              >
                                <CheckCircle2 className="w-4 h-4" />
                                <span>موافقة (منح الشارة)</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleRejectFemaleVoice(reqItem.id)}
                                className="flex-1 sm:flex-initial min-h-[42px] rounded-xl bg-rose-700 hover:bg-rose-600 border border-rose-400/60 px-4 text-xs font-extrabold text-white cursor-pointer transition flex items-center justify-center gap-1.5"
                              >
                                <Ban className="w-4 h-4" />
                                <span>رفض</span>
                              </button>
                            </div>
                          ) : (
                            reqItem.adminNote && (
                              <span className="text-[11px] text-slate-300">{reqItem.adminNote}</span>
                            )
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* TAB 4: ROOMS & AGENCIES ("الغرف والوكالات") */}
            {tab === 'rooms_agencies' && (
              <div className="space-y-5">
                {/* Active Rooms with Pin to top of Party Tab & Close */}
                <section className="royal-glass rounded-3xl p-5 sm:p-6 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-[#FCE9A6]">
                      <Radio className="w-5 h-5 text-emerald-400" />
                      <div>
                        <h2 className="text-base sm:text-lg font-extrabold">
                          الغرف النشطة حالياً ({sortedActiveRooms.length})
                        </h2>
                        <p className="text-xs text-slate-300">
                          ثبّت الغرف المميزة في مقدمة تبويب «حفلة» أو أغلق أي غرفة فوراً
                        </p>
                      </div>
                    </div>
                  </div>

                  {sortedActiveRooms.length === 0 ? (
                    <p className="text-xs text-slate-400 py-6 text-center">
                      لا توجد غرف صوتية نشطة في الوقت الحالي.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
                      {sortedActiveRooms.map((r) => {
                        const isPinned = pinnedSet.has(r.id);
                        return (
                          <div
                            key={r.id}
                            className={`rounded-3xl p-4 flex flex-col justify-between gap-3 border ${
                              isPinned
                                ? 'bg-[#1a1405]/90 border-[#D4AF37]/60 shadow-[0_0_20px_rgba(212,175,55,0.18)]'
                                : 'bg-[#070913]/85 border-white/10'
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <img
                                src={resolveAsset(r.coverImage)}
                                alt={r.title}
                                loading="lazy"
                                decoding="async"
                                className="w-16 h-16 rounded-2xl object-cover border border-[#D4AF37]/30 shrink-0"
                              />
                              <div className="min-w-0 flex-1 space-y-1">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <h3 className="text-sm font-extrabold text-white truncate">
                                    {r.title}
                                  </h3>
                                  {isPinned && (
                                    <span className="rounded-lg bg-[#D4AF37] text-[#070913] px-2 py-0.5 text-[10px] font-black">
                                      مثبتة في حفلة 📌
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-slate-300 truncate">
                                  المضيف: <span className="text-[#FCE9A6] font-bold">{r.hostName}</span> ·{' '}
                                  <span className="text-slate-400">{r.category}</span>
                                </p>
                                <p className="text-[11px] font-mono-num text-slate-400">
                                  المستمعون: {r.listenersCount} · الهدايا:{' '}
                                  {r.totalGiftsCoins.toLocaleString('en-US')} كوينز
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => void handleTogglePinRoom(r, isPinned)}
                                className={`flex-1 min-h-[42px] rounded-xl px-3.5 text-xs font-extrabold border flex items-center justify-center gap-1.5 cursor-pointer transition ${
                                  isPinned
                                    ? 'bg-[#D4AF37] text-[#070913] border-[#FCE9A6]'
                                    : 'bg-[#D4AF37]/15 text-[#FCE9A6] border-[#D4AF37]/45 hover:bg-[#D4AF37]/25'
                                }`}
                              >
                                {isPinned ? (
                                  <>
                                    <PinOff className="w-4 h-4" />
                                    <span>إلغاء التثبيت من حفلة</span>
                                  </>
                                ) : (
                                  <>
                                    <Pin className="w-4 h-4" />
                                    <span>تثبيت في مقدمة «حفلة»</span>
                                  </>
                                )}
                              </button>

                              <button
                                type="button"
                                onClick={() => void handleCloseRoom(r.id)}
                                className="min-h-[42px] rounded-xl px-4 text-xs font-extrabold bg-rose-950/75 hover:bg-rose-900 border border-rose-500/45 text-rose-200 flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                              >
                                <Trash2 className="w-4 h-4" />
                                <span>إغلاق الغرفة</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>

                {/* Pending Host Join Applications */}
                <section className="royal-glass rounded-3xl p-5 sm:p-6 space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-[#FCE9A6]">
                      <UserCheck className="w-5 h-5 text-emerald-300" />
                      <h2 className="text-base font-bold">
                        طلبات انضمام المضيفين للوكالات ({data.hostJoinApplications?.length || 0})
                      </h2>
                    </div>
                    <span className="text-xs text-slate-300">بانتظار موافقة الإدارة</span>
                  </div>

                  {!data.hostJoinApplications || data.hostJoinApplications.length === 0 ? (
                    <p className="text-xs text-slate-400 py-4 text-center">
                      لا توجد طلبات انضمام مضيفين للوكالات حالياً.
                    </p>
                  ) : (
                    <div className="divide-y divide-[#D4AF37]/15">
                      {data.hostJoinApplications.map((app) => (
                        <div
                          key={app.id}
                          className="py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3"
                        >
                          <div className="space-y-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-extrabold text-white">
                                {app.displayName}
                              </span>
                              <span className="text-xs font-bold text-[#FCE9A6]">
                                ← وكالة: {app.agencyName}
                              </span>
                              <span
                                className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold border ${
                                  app.status === 'approved'
                                    ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200'
                                    : app.status === 'rejected'
                                    ? 'bg-rose-500/20 border-rose-400/50 text-rose-200'
                                    : 'bg-amber-500/20 border-[#D4AF37]/50 text-[#FCE9A6]'
                                }`}
                              >
                                {app.status === 'approved'
                                  ? 'معتمد ✓'
                                  : app.status === 'rejected'
                                  ? 'مرفوض'
                                  : 'بانتظار موافقة الإدارة'}
                              </span>
                            </div>
                            <p className="text-xs text-slate-300">{app.bio}</p>
                            <p className="text-[11px] text-slate-400 font-mono-num">
                              {new Date(app.createdAt).toLocaleString('ar-EG')}
                            </p>
                          </div>

                          {app.status === 'pending' && (
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() => void handleReviewHostApp(app.id, 'approved')}
                                className="min-h-[40px] rounded-xl bg-emerald-600 hover:bg-emerald-500 border border-emerald-400/60 px-4 py-1.5 text-xs font-extrabold text-white cursor-pointer"
                              >
                                قبول واعتماد كمضيف
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleReviewHostApp(app.id, 'rejected')}
                                className="min-h-[40px] rounded-xl bg-rose-700 hover:bg-rose-600 border border-rose-400/60 px-4 py-1.5 text-xs font-extrabold text-white cursor-pointer"
                              >
                                رفض
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {/* Agencies Approvals & Commission Payouts */}
                <section className="royal-glass rounded-3xl p-5 sm:p-6 space-y-4">
                  <div className="flex items-center gap-2 text-[#F3D37A]">
                    <Building2 className="w-5 h-5" />
                    <h2 className="text-base font-bold">
                      اعتماد الوكالات وتعديل نسب العمولة ({data.agencies.length})
                    </h2>
                  </div>

                  {data.agencies.length === 0 ? (
                    <p className="text-xs text-slate-400 py-4 text-center">
                      لا توجد وكالات مسجلة حالياً.
                    </p>
                  ) : (
                    <div className="divide-y divide-[#D4AF37]/15">
                      {data.agencies.map((ag) => {
                        const status = ag.status || 'approved';
                        const pctDraft =
                          agencyRateDrafts[ag.id] ??
                          String(Math.round((ag.commissionRate || 0) * 100));
                        const suggestedPending = Math.max(
                          0,
                          Math.round((ag.totalHostDiamonds || 0) * (ag.commissionRate || 0)) -
                            (ag.totalCommissionDiamonds || 0)
                        );
                        const payoutDraft =
                          agencyPayoutDrafts[ag.id] ?? String(suggestedPending);
                        return (
                          <div
                            key={ag.id}
                            className="py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3"
                          >
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-extrabold text-white">
                                  {ag.name}
                                </span>
                                <span className="text-xs font-mono-num text-[#FCE9A6]">
                                  ({ag.code})
                                </span>
                                <span
                                  className={`text-[11px] font-bold ${
                                    status === 'approved'
                                      ? 'text-emerald-300'
                                      : status === 'suspended'
                                      ? 'text-rose-300'
                                      : 'text-amber-300'
                                  }`}
                                >
                                  ·{' '}
                                  {status === 'approved'
                                    ? 'معتمدة ✓'
                                    : status === 'suspended'
                                    ? 'معلّقة'
                                    : 'قيد المراجعة'}
                                </span>
                              </div>
                              <p className="text-xs text-slate-300 font-mono-num">
                                الوكيل: {ag.ownerName} · المضيفون: {ag.hostIds.length} · ألماس
                                المضيفين: {ag.totalHostDiamonds.toLocaleString('en-US')} 💎 · عمولة
                                منصرفة: {ag.totalCommissionDiamonds.toLocaleString('en-US')} 💎 ·
                                مستحق مقترح:{' '}
                                <span className="text-emerald-300 font-bold">
                                  {suggestedPending.toLocaleString('en-US')} 💎
                                </span>
                              </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              <div className="flex items-center gap-1.5 bg-[#070913]/85 border border-[#D4AF37]/25 rounded-xl px-2.5 py-1.5">
                                <span className="text-[11px] text-slate-400">العمولة %</span>
                                <input
                                  type="number"
                                  min={0}
                                  max={50}
                                  value={pctDraft}
                                  onChange={(e) =>
                                    setAgencyRateDrafts((prev) => ({
                                      ...prev,
                                      [ag.id]: e.target.value,
                                    }))
                                  }
                                  dir="ltr"
                                  className="w-14 bg-transparent text-xs text-[#FCE9A6] font-mono-num text-center focus:outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    void handleUpdateAgency(ag.id, {
                                      commissionRate:
                                        Math.max(0, Math.min(50, Number(pctDraft) || 0)) / 100,
                                    })
                                  }
                                  className="text-[11px] font-bold text-[#F3D37A] hover:text-white px-1.5 cursor-pointer"
                                >
                                  حفظ
                                </button>
                              </div>

                              <div className="flex items-center gap-1.5 bg-[#070913]/85 border border-emerald-500/35 rounded-xl px-2.5 py-1.5">
                                <span className="text-[11px] text-emerald-300">💎</span>
                                <input
                                  type="number"
                                  min={0}
                                  value={payoutDraft}
                                  onChange={(e) =>
                                    setAgencyPayoutDrafts((prev) => ({
                                      ...prev,
                                      [ag.id]: e.target.value,
                                    }))
                                  }
                                  dir="ltr"
                                  className="w-20 bg-transparent text-xs text-emerald-200 font-mono-num text-center focus:outline-none"
                                />
                                <button
                                  type="button"
                                  disabled={Number(payoutDraft) <= 0}
                                  onClick={() => void handlePayoutAgencyCommission(ag.id)}
                                  className="rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-45 px-2.5 py-1 text-[11px] font-extrabold text-white cursor-pointer"
                                >
                                  صرف عمولة الوكيل
                                </button>
                              </div>

                              {status !== 'approved' ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    void handleUpdateAgency(ag.id, { status: 'approved' })
                                  }
                                  className="gold-btn min-h-[38px] rounded-xl px-3.5 text-xs font-bold cursor-pointer"
                                >
                                  اعتماد الوكالة
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() =>
                                    void handleUpdateAgency(ag.id, { status: 'suspended' })
                                  }
                                  className="min-h-[38px] rounded-xl px-3.5 text-xs font-bold bg-rose-950/60 border border-rose-500/40 text-rose-200 cursor-pointer"
                                >
                                  تعليق الوكالة
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>

                {/* Host & Agent Assignment */}
                <section className="royal-glass rounded-3xl p-5 sm:p-6 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-[#F3D37A]">
                      <UserCheck className="w-5 h-5" />
                      <h2 className="text-base font-bold">اعتماد المضيفين والوكلاء وتعيين الوكالة</h2>
                    </div>
                    <input
                      type="text"
                      value={hostSearch}
                      onChange={(e) => setHostSearch(e.target.value)}
                      placeholder="بحث عن عضو بالاسم أو البريد..."
                      className="sm:w-64 min-h-[40px] rounded-xl bg-[#070913]/85 border border-[#D4AF37]/25 px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#D4AF37]"
                    />
                  </div>

                  <div className="divide-y divide-[#D4AF37]/15">
                    {filteredHostUsers.map((u) => (
                      <div
                        key={u.id}
                        className="py-4 flex flex-col xl:flex-row xl:items-center justify-between gap-3"
                      >
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-white">
                            <span>{u.displayName}</span>
                            {u.hostBadge && (
                              <span className="text-xs text-[#FCE9A6]">· {u.hostBadge}</span>
                            )}
                            {u.hostAgencyName && (
                              <span className="text-xs text-emerald-300">
                                · {u.hostAgencyName}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 font-mono-num" dir="ltr">
                            {u.email} · ألماس المضيف:{' '}
                            {(u.hostDiamondsEarned || 0).toLocaleString('en-US')} 💎
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <select
                            value={hostAgencyDrafts[u.id] || ''}
                            onChange={(e) =>
                              setHostAgencyDrafts((prev) => ({
                                ...prev,
                                [u.id]: e.target.value,
                              }))
                            }
                            className="min-h-[38px] rounded-xl bg-[#070913]/85 border border-[#D4AF37]/25 px-3 text-xs text-white focus:outline-none focus:border-[#D4AF37]"
                          >
                            <option value="">اختر وكالة لربط المضيف...</option>
                            {data.agencies.map((ag) => (
                              <option key={ag.id} value={ag.id}>
                                {ag.name} ({ag.code})
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            disabled={!hostAgencyDrafts[u.id]}
                            onClick={() =>
                              void handleHostApproval(u.id, {
                                isHost: true,
                                agencyId: hostAgencyDrafts[u.id] || null,
                              })
                            }
                            className="min-h-[38px] rounded-xl px-3 text-xs font-bold bg-[#D4AF37]/18 border border-[#D4AF37]/40 text-[#FCE9A6] cursor-pointer disabled:opacity-45"
                          >
                            ربط بالوكالة
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleHostApproval(u.id, { isHost: !u.isHost })}
                            className={`min-h-[38px] rounded-xl px-3 text-xs font-bold border cursor-pointer ${
                              u.isHost
                                ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-200'
                                : 'bg-white/5 border-white/15 text-slate-200'
                            }`}
                          >
                            {u.isHost ? 'مضيف معتمد ✓ (إلغاء)' : 'اعتماد كمضيف رسمي'}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              void handleHostApproval(u.id, { isAgent: !u.isAgent })
                            }
                            className={`min-h-[38px] rounded-xl px-3 text-xs font-bold border cursor-pointer ${
                              u.isAgent
                                ? 'bg-[#D4AF37] text-[#070913] border-[#FCE9A6]'
                                : 'bg-white/5 border-[#D4AF37]/30 text-[#FCE9A6]'
                            }`}
                          >
                            {u.isAgent ? 'وكيل معتمد ✓ (إلغاء)' : 'اعتماد كوكيل'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            )}

            {/* TAB 5: GIFTS & ANNOUNCEMENTS ("الهدايا والإعلانات") */}
            {tab === 'gifts_announcements' && (
              <AdminGiftsAnnouncementsTab
                customGifts={data.settings.customGifts || []}
                latestAnnouncement={data.settings.latestAdminAnnouncement}
                onCreateGift={handleCreateCustomGift}
                onDeleteGift={handleDeleteCustomGift}
                onSendAnnouncement={handleSendGlobalAnnouncement}
              />
            )}

            {/* TAB 6: USDT DEPOSITS & WITHDRAWALS */}
            {tab === 'usdt' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <section className="royal-glass rounded-3xl p-5 sm:p-6 space-y-4">
                  <h2 className="text-base font-bold text-[#F3D37A]">
                    طلبات إيداع USDT TRC20 ({data.usdtDeposits.length})
                  </h2>
                  {data.usdtDeposits.length === 0 ? (
                    <p className="text-xs text-slate-400 py-4 text-center">
                      لا توجد طلبات إيداع حالياً.
                    </p>
                  ) : (
                    <div className="divide-y divide-[#D4AF37]/15">
                      {data.usdtDeposits.map((dep) => (
                        <div key={dep.id} className="py-4 space-y-2.5 text-xs">
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1 min-w-0">
                              <p className="font-bold text-white text-sm">
                                {dep.userDisplayName} ·{' '}
                                <span className="text-[#FCE9A6] font-mono-num">
                                  ${dep.amountUsdt} USDT
                                </span>
                              </p>
                              <p className="text-slate-300 font-mono-num">
                                +{dep.coinsCredited.toLocaleString('en-US')} كوينز
                                {dep.rewardTierLabel ? ` · ${dep.rewardTierLabel}` : ''}
                              </p>
                              <p
                                className="text-[11px] text-slate-400 font-mono-num truncate"
                                dir="ltr"
                              >
                                TxID: {dep.txId}
                              </p>
                            </div>
                            {dep.proofImage && (
                              <button
                                type="button"
                                onClick={() => setPreviewProof(dep.proofImage)}
                                className="shrink-0 rounded-xl border border-[#D4AF37]/40 overflow-hidden cursor-pointer"
                              >
                                <img
                                  src={dep.proofImage}
                                  alt="إثبات الحوالة"
                                  loading="lazy"
                                  decoding="async"
                                  className="w-14 h-14 object-cover"
                                />
                              </button>
                            )}
                          </div>

                          {dep.status === 'pending' ? (
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() => void handleApproveDeposit(dep.id)}
                                className="gold-btn min-h-[38px] rounded-xl px-3.5 py-1.5 text-xs font-bold cursor-pointer"
                              >
                                تأكيد الشحن ومنح المكافآت
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleRejectDeposit(dep.id)}
                                className="min-h-[38px] rounded-xl px-3.5 py-1.5 text-xs font-bold bg-rose-950/60 border border-rose-500/40 text-rose-200 cursor-pointer"
                              >
                                رفض
                              </button>
                            </div>
                          ) : (
                            <p
                              className={`font-bold ${
                                dep.status === 'approved' ? 'text-emerald-300' : 'text-rose-300'
                              }`}
                            >
                              {dep.status === 'approved' ? 'مؤكد وممنوح ✓' : 'مرفوض'}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <section className="royal-glass rounded-3xl p-5 sm:p-6 space-y-4">
                  <h2 className="text-base font-bold text-[#F3D37A]">
                    طلبات سحب أرباح USDT ({data.usdtWithdrawals.length})
                  </h2>
                  {data.usdtWithdrawals.length === 0 ? (
                    <p className="text-xs text-slate-400 py-4 text-center">
                      لا توجد طلبات سحب حالياً.
                    </p>
                  ) : (
                    <div className="divide-y divide-[#D4AF37]/15">
                      {data.usdtWithdrawals.map((wd) => (
                        <div key={wd.id} className="py-4 space-y-2.5 text-xs">
                          <div className="space-y-1">
                            <p className="font-bold text-white text-sm">
                              {wd.userDisplayName} ({wd.userRoleLabel}) ·{' '}
                              <span className="text-emerald-300 font-mono-num">
                                {wd.amountUsdt} USDT
                              </span>
                            </p>
                            <p className="text-slate-300 font-mono-num">
                              {wd.sourceAmount.toLocaleString('en-US')}{' '}
                              {wd.sourceCurrency === 'diamonds' ? 'ألماسة 💎' : 'كوينز'}
                            </p>
                            <p
                              className="text-[11px] text-[#FCE9A6] font-mono-num break-all"
                              dir="ltr"
                            >
                              TRC20: {wd.trc20Address}
                            </p>
                          </div>

                          {wd.status === 'pending' ? (
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() => void handleApproveWithdrawal(wd.id)}
                                className="gold-btn min-h-[38px] rounded-xl px-3.5 py-1.5 text-xs font-bold cursor-pointer"
                              >
                                تأكيد التحويل
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleRejectWithdrawal(wd.id)}
                                className="min-h-[38px] rounded-xl px-3.5 py-1.5 text-xs font-bold bg-rose-950/60 border border-rose-500/40 text-rose-200 cursor-pointer"
                              >
                                رفض وإرجاع الرصيد
                              </button>
                            </div>
                          ) : (
                            <p
                              className={`font-bold ${
                                wd.status === 'approved' ? 'text-emerald-300' : 'text-rose-300'
                              }`}
                            >
                              {wd.status === 'approved' ? 'تم التحويل ✓' : 'مرفوض (تم الاسترداد)'}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            )}

            {/* TAB 7: COMPETITIONS */}
            {tab === 'competitions' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                <form
                  onSubmit={handleCreateCompetition}
                  className="lg:col-span-5 royal-glass rounded-3xl p-5 sm:p-6 space-y-4"
                >
                  <h2 className="text-base font-bold text-[#F3D37A] flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    <span>إطلاق مسابقة ملكية جديدة</span>
                  </h2>
                  <input
                    type="text"
                    required
                    value={compTitle}
                    onChange={(e) => setCompTitle(e.target.value)}
                    placeholder="عنوان المسابقة"
                    className="w-full min-h-[42px] rounded-xl bg-[#070913]/85 border border-[#D4AF37]/25 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#D4AF37]"
                  />
                  <input
                    type="text"
                    value={compSub}
                    onChange={(e) => setCompSub(e.target.value)}
                    placeholder="وصف البطولة"
                    className="w-full min-h-[42px] rounded-xl bg-[#070913]/85 border border-[#D4AF37]/25 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#D4AF37]"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">
                        جائزة الكوينز
                      </label>
                      <input
                        type="number"
                        value={compCoins}
                        onChange={(e) => setCompCoins(e.target.value)}
                        dir="ltr"
                        className="w-full min-h-[40px] rounded-xl bg-[#070913]/85 border border-[#D4AF37]/25 px-3 py-2 text-sm text-white font-mono-num text-left"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">
                        جائزة الألماس
                      </label>
                      <input
                        type="number"
                        value={compDiamonds}
                        onChange={(e) => setCompDiamonds(e.target.value)}
                        dir="ltr"
                        className="w-full min-h-[40px] rounded-xl bg-[#070913]/85 border border-[#D4AF37]/25 px-3 py-2 text-sm text-white font-mono-num text-left"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="gold-btn w-full min-h-[44px] rounded-xl py-2.5 text-sm cursor-pointer"
                  >
                    نشر المسابقة للجمهور
                  </button>
                </form>

                <section className="lg:col-span-7 royal-glass rounded-3xl p-5 sm:p-6 space-y-4">
                  <h2 className="text-base font-bold text-[#F3D37A] flex items-center gap-2">
                    <Trophy className="w-4 h-4" />
                    <span>المسابقات الحالية</span>
                  </h2>
                  <div className="divide-y divide-[#D4AF37]/15">
                    {data.competitions.map((comp) => (
                      <div
                        key={comp.id}
                        className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div>
                          <p className="text-sm font-bold text-white">{comp.title}</p>
                          <p className="text-xs text-slate-400 font-mono-num">
                            المتسابقون: {comp.contestants.length} · الحالة:{' '}
                            {comp.status === 'live' ? 'جارية' : 'منتهية'}
                          </p>
                        </div>
                        {comp.status === 'live' && (
                          <button
                            type="button"
                            onClick={() => void handleFinishCompetition(comp.id)}
                            className="gold-btn min-h-[38px] rounded-xl px-4 py-1.5 text-xs cursor-pointer self-start sm:self-auto"
                          >
                            تتويج الفائز وتوزيع الجائزة
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            )}

            {/* TAB 8: QUESTIONS CSV / EXCEL */}
            {tab === 'questions' && (
              <div className="space-y-5">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                  <section className="lg:col-span-5 royal-glass rounded-3xl p-5 sm:p-6 space-y-4">
                    <div className="flex items-center gap-2 text-[#F3D37A]">
                      <FileSpreadsheet className="w-5 h-5" />
                      <h2 className="text-base font-bold">استيراد وتصدير الأسئلة (CSV / Excel)</h2>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      صدّر بنك أسئلة البطولات الثقافية الحية إلى ملف Excel (.xlsx) أو CSV، أو ارفع
                      ملفاً جديداً بترتيب الأعمدة:
                      <span
                        className="block font-mono-num text-[11px] text-[#FCE9A6] mt-1"
                        dir="ltr"
                      >
                        category, question, option1, option2, option3, option4, correctIndex (1-4),
                        xpReward, coinsReward
                      </span>
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={handleExportExcel}
                        className="gold-btn min-h-[40px] rounded-xl px-3 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>تصدير Excel</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleExportCsv}
                        className="min-h-[40px] rounded-xl px-3 text-xs font-bold bg-[#070913]/85 border border-[#D4AF37]/35 text-[#FCE9A6] flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>تصدير CSV</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleDownloadTemplate}
                        className="min-h-[40px] rounded-xl px-3 text-xs font-bold bg-white/5 border border-white/15 text-slate-200 flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5" />
                        <span>قالب فارغ</span>
                      </button>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-[#D4AF37]/15">
                      <label className="block text-xs font-bold text-slate-300">
                        وضع الاستيراد
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setImportMode('append')}
                          className={`min-h-[38px] rounded-xl text-xs font-bold border cursor-pointer ${
                            importMode === 'append'
                              ? 'bg-[#D4AF37] text-[#070913] border-[#FCE9A6]'
                              : 'bg-[#070913]/80 border-[#D4AF37]/25 text-slate-300'
                          }`}
                        >
                          إضافة للبنك الحالي
                        </button>
                        <button
                          type="button"
                          onClick={() => setImportMode('replace')}
                          className={`min-h-[38px] rounded-xl text-xs font-bold border cursor-pointer ${
                            importMode === 'replace'
                              ? 'bg-rose-500 text-white border-rose-300'
                              : 'bg-[#070913]/80 border-[#D4AF37]/25 text-slate-300'
                          }`}
                        >
                          استبدال البنك بالكامل
                        </button>
                      </div>
                    </div>

                    <div>
                      <input
                        ref={questionFileRef}
                        id="questions-xlsx-upload"
                        type="file"
                        accept=".xlsx,.xls,.csv"
                        onChange={handleQuestionFileUpload}
                        className="hidden"
                      />
                      <label
                        htmlFor="questions-xlsx-upload"
                        className="min-h-[84px] rounded-2xl border border-dashed border-[#D4AF37]/45 bg-[#070913]/70 hover:bg-[#D4AF37]/8 flex flex-col items-center justify-center gap-1.5 p-4 text-center cursor-pointer transition"
                      >
                        <Upload className="w-5 h-5 text-[#D4AF37]" />
                        <span className="text-xs font-bold text-[#FCE9A6]">
                          {importingQuestions
                            ? 'جارٍ معالجة الملف...'
                            : 'رفع ملف Excel (.xlsx / .xls) أو CSV'}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          تُفعّل الأسئلة فوراً في جولات البطولات الثقافية الحية
                        </span>
                      </label>
                    </div>

                    <form onSubmit={handleImportCsvPaste} className="space-y-2.5">
                      <label className="block text-xs font-bold text-slate-300">
                        أو الصق أسطر CSV مباشرة:
                      </label>
                      <textarea
                        rows={4}
                        value={csvPaste}
                        onChange={(e) => setCsvPaste(e.target.value)}
                        placeholder="ثقافة عامة,ما عاصمة المملكة الأردنية الهاشمية؟,عمّان,إربد,العقبة,السلط,1,120,350"
                        className="w-full rounded-xl bg-[#070913]/85 border border-[#D4AF37]/25 p-3 text-xs text-white focus:outline-none focus:border-[#D4AF37]"
                      />
                      <button
                        type="submit"
                        disabled={importingQuestions || !csvPaste.trim()}
                        className="gold-btn w-full min-h-[40px] rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50"
                      >
                        استيراد من النص المباشر
                      </button>
                    </form>
                  </section>

                  <section className="lg:col-span-7 royal-glass rounded-3xl p-5 sm:p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <h2 className="text-base font-bold text-[#F3D37A]">
                        بنك الأسئلة الحالي ({data.culturalQuestions.length})
                      </h2>
                      <span className="text-xs text-slate-400">مؤقت 8 ثوانٍ لمنع الغش</span>
                    </div>
                    <div className="divide-y divide-[#D4AF37]/15 max-h-[640px] overflow-y-auto no-scrollbar">
                      {data.culturalQuestions.map((q) => (
                        <div key={q.id} className="py-3.5 space-y-2 text-xs">
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1">
                              <span className="text-[11px] font-bold text-[#FCE9A6]">
                                {q.category} · +{q.xpReward} XP · +{q.coinsReward} كوينز
                              </span>
                              <p className="text-sm font-bold text-white">{q.question}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => void handleDeleteQuestion(q.id)}
                              className="min-h-[34px] min-w-[34px] rounded-xl bg-rose-950/60 border border-rose-500/35 text-rose-200 flex items-center justify-center shrink-0 cursor-pointer"
                              aria-label="حذف السؤال"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                            {q.options.map((opt, idx) => (
                              <div
                                key={idx}
                                className={`rounded-lg px-2.5 py-1.5 border text-[11px] truncate ${
                                  idx === q.correctIndex
                                    ? 'border-emerald-400/50 bg-emerald-950/50 text-emerald-200 font-bold'
                                    : 'border-white/10 bg-white/5 text-slate-300'
                                }`}
                              >
                                {idx + 1}. {opt}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>
              </div>
            )}

            {/* TAB 9: GLOBAL PLATFORM ECONOMY SETTINGS */}
            {tab === 'settings' && settingsDraft && (
              <form onSubmit={handleSaveSettings} className="space-y-5">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <section className="royal-glass rounded-3xl p-5 space-y-3.5">
                    <div className="flex items-center gap-2 text-[#FCE9A6]">
                      <Coins className="w-5 h-5 text-[#D4AF37]" />
                      <h2 className="text-sm font-extrabold">أسعار صرف الكوينز والألماس</h2>
                    </div>

                    <div className="space-y-2.5 text-xs">
                      <div>
                        <label className="block text-slate-300 mb-1">
                          سعر شحن 1 USDT → كوينز
                        </label>
                        <input
                          type="number"
                          min={100}
                          value={settingsDraft.usdtToCoinsRate}
                          onChange={(e) =>
                            setSettingsDraft({
                              ...settingsDraft,
                              usdtToCoinsRate: Number(e.target.value) || 1000,
                            })
                          }
                          dir="ltr"
                          className="w-full rounded-xl bg-[#070913]/85 border border-[#D4AF37]/25 px-3 py-2 text-white font-mono-num text-left"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-300 mb-1">
                          كوينز مطلوبة لسحب 1 USDT
                        </label>
                        <input
                          type="number"
                          min={100}
                          value={settingsDraft.coinsPerUsdtWithdraw}
                          onChange={(e) =>
                            setSettingsDraft({
                              ...settingsDraft,
                              coinsPerUsdtWithdraw: Number(e.target.value) || 1000,
                            })
                          }
                          dir="ltr"
                          className="w-full rounded-xl bg-[#070913]/85 border border-[#D4AF37]/25 px-3 py-2 text-white font-mono-num text-left"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-300 mb-1">
                          ألماس مطلوب لسحب 1 USDT
                        </label>
                        <input
                          type="number"
                          min={10}
                          value={settingsDraft.diamondsPerUsdt}
                          onChange={(e) =>
                            setSettingsDraft({
                              ...settingsDraft,
                              diamondsPerUsdt: Number(e.target.value) || 100,
                            })
                          }
                          dir="ltr"
                          className="w-full rounded-xl bg-[#070913]/85 border border-[#D4AF37]/25 px-3 py-2 text-white font-mono-num text-left"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-300 mb-1">
                          تحويل 1 ألماسة → كوينز
                        </label>
                        <input
                          type="number"
                          min={1}
                          step="0.5"
                          value={settingsDraft.diamondToCoinsRate}
                          onChange={(e) =>
                            setSettingsDraft({
                              ...settingsDraft,
                              diamondToCoinsRate: Number(e.target.value) || 2,
                            })
                          }
                          dir="ltr"
                          className="w-full rounded-xl bg-[#070913]/85 border border-[#D4AF37]/25 px-3 py-2 text-white font-mono-num text-left"
                        />
                      </div>
                    </div>
                  </section>

                  <section className="royal-glass rounded-3xl p-5 space-y-3.5">
                    <div className="flex items-center gap-2 text-[#FCE9A6]">
                      <Percent className="w-5 h-5 text-emerald-400" />
                      <h2 className="text-sm font-extrabold">نسب عمولة الوكلاء</h2>
                    </div>

                    <div className="space-y-2.5 text-xs">
                      <div>
                        <label className="block text-slate-300 mb-1">
                          العمولة الافتراضية للوكيل (%)
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={50}
                          value={Math.round(settingsDraft.defaultAgencyCommissionRate * 100)}
                          onChange={(e) =>
                            setSettingsDraft({
                              ...settingsDraft,
                              defaultAgencyCommissionRate:
                                Math.max(1, Math.min(50, Number(e.target.value) || 15)) / 100,
                            })
                          }
                          dir="ltr"
                          className="w-full rounded-xl bg-[#070913]/85 border border-[#D4AF37]/25 px-3 py-2 text-white font-mono-num text-left"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-300 mb-1">
                          الحد الأدنى لعمولة الوكيل (%)
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={50}
                          value={Math.round(settingsDraft.minAgencyCommissionRate * 100)}
                          onChange={(e) =>
                            setSettingsDraft({
                              ...settingsDraft,
                              minAgencyCommissionRate:
                                Math.max(1, Math.min(50, Number(e.target.value) || 5)) / 100,
                            })
                          }
                          dir="ltr"
                          className="w-full rounded-xl bg-[#070913]/85 border border-[#D4AF37]/25 px-3 py-2 text-white font-mono-num text-left"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-300 mb-1">
                          الحد الأعلى لعمولة الوكيل (%)
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={60}
                          value={Math.round(settingsDraft.maxAgencyCommissionRate * 100)}
                          onChange={(e) =>
                            setSettingsDraft({
                              ...settingsDraft,
                              maxAgencyCommissionRate:
                                Math.max(1, Math.min(60, Number(e.target.value) || 35)) / 100,
                            })
                          }
                          dir="ltr"
                          className="w-full rounded-xl bg-[#070913]/85 border border-[#D4AF37]/25 px-3 py-2 text-white font-mono-num text-left"
                        />
                      </div>
                    </div>
                  </section>

                  <section className="royal-glass rounded-3xl p-5 space-y-3.5">
                    <div className="flex items-center gap-2 text-[#FCE9A6]">
                      <Gem className="w-5 h-5 text-sky-400" />
                      <h2 className="text-sm font-extrabold">إعدادات الألماس والخاص ودولاب الغرف</h2>
                    </div>

                    <div className="space-y-2.5 text-xs">
                      <div>
                        <label className="block text-slate-300 mb-1">
                          نسبة تحويل الهدايا إلى ألماس للمستلم (%)
                        </label>
                        <input
                          type="number"
                          min={10}
                          max={100}
                          value={Math.round(settingsDraft.giftDiamondsRatio * 100)}
                          onChange={(e) =>
                            setSettingsDraft({
                              ...settingsDraft,
                              giftDiamondsRatio:
                                Math.max(10, Math.min(100, Number(e.target.value) || 75)) / 100,
                            })
                          }
                          dir="ltr"
                          className="w-full rounded-xl bg-[#070913]/85 border border-[#D4AF37]/25 px-3 py-2 text-white font-mono-num text-left"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-300 mb-1">
                          تكلفة الرسالة الخاصة المدفوعة (كوينز) — قبل المتابعة المتبادلة
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={settingsDraft.pmMessageCost}
                          onChange={(e) =>
                            setSettingsDraft({
                              ...settingsDraft,
                              pmMessageCost: Math.max(0, Number(e.target.value) || 0),
                            })
                          }
                          dir="ltr"
                          className="w-full rounded-xl bg-[#070913]/85 border border-[#D4AF37]/25 px-3 py-2 text-white font-mono-num text-left"
                        />
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <span className="text-[11px] text-slate-400">تطبيق سريع:</span>
                          {[20, 50, 100].map((preset) => (
                            <button
                              key={preset}
                              type="button"
                              disabled={savingSettings}
                              onClick={() => void handleQuickPmCostPreset(preset)}
                              className={`rounded-lg px-2.5 py-1 text-[11px] font-bold font-mono-num border cursor-pointer transition ${
                                settingsDraft.pmMessageCost === preset
                                  ? 'bg-[#D4AF37] border-[#D4AF37] text-[#070913]'
                                  : 'bg-[#070913]/80 border-[#D4AF37]/30 text-[#FCE9A6] hover:bg-[#D4AF37]/15'
                              }`}
                            >
                              {preset} كوين
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="block text-slate-300 mb-1">
                          ألماس مكافأة الرد على الرسالة الخاصة
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={settingsDraft.pmReplyDiamonds}
                          onChange={(e) =>
                            setSettingsDraft({
                              ...settingsDraft,
                              pmReplyDiamonds: Math.max(0, Number(e.target.value) || 0),
                            })
                          }
                          dir="ltr"
                          className="w-full rounded-xl bg-[#070913]/85 border border-[#D4AF37]/25 px-3 py-2 text-white font-mono-num text-left"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-300 mb-1">
                          تكلفة تدوير دولاب الحظ داخل الغرف (كوينز)
                        </label>
                        <input
                          type="number"
                          min={10}
                          value={settingsDraft.roomWheelCost}
                          onChange={(e) =>
                            setSettingsDraft({
                              ...settingsDraft,
                              roomWheelCost: Math.max(10, Number(e.target.value) || 500),
                            })
                          }
                          dir="ltr"
                          className="w-full rounded-xl bg-[#070913]/85 border border-[#D4AF37]/25 px-3 py-2 text-white font-mono-num text-left"
                        />
                      </div>
                    </div>
                  </section>
                </div>

                {/* Lucky Gifts Multipliers & Recharge Reward Tiers */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <section className="royal-glass rounded-3xl p-5 space-y-3.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-[#FCE9A6]">
                        <Sparkles className="w-5 h-5 text-[#D4AF37]" />
                        <h2 className="text-sm font-extrabold">مضاعفات هدايا الحظ وأوزان الاحتمال</h2>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setSettingsDraft({
                            ...settingsDraft,
                            luckyGiftMultipliers: [
                              ...settingsDraft.luckyGiftMultipliers,
                              { multiplier: 2, weight: 10 },
                            ],
                          })
                        }
                        className="min-h-[32px] rounded-lg px-2.5 text-xs font-bold bg-[#D4AF37]/20 border border-[#D4AF37]/40 text-[#FCE9A6] cursor-pointer"
                      >
                        + إضافة مضاعف
                      </button>
                    </div>
                    <div className="space-y-2 text-xs">
                      {settingsDraft.luckyGiftMultipliers.map((item, idx) => (
                        <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                          <div className="col-span-5">
                            <label className="block text-[10px] text-slate-400">المضاعف (×)</label>
                            <input
                              type="number"
                              min={0.5}
                              step="0.5"
                              value={item.multiplier}
                              onChange={(e) => {
                                const next = [...settingsDraft.luckyGiftMultipliers];
                                next[idx] = { ...item, multiplier: Number(e.target.value) || 1 };
                                setSettingsDraft({ ...settingsDraft, luckyGiftMultipliers: next });
                              }}
                              dir="ltr"
                              className="w-full rounded-lg bg-[#070913]/85 border border-[#D4AF37]/25 px-2.5 py-1.5 text-white font-mono-num text-left"
                            />
                          </div>
                          <div className="col-span-5">
                            <label className="block text-[10px] text-slate-400">الوزن الاحتمالي</label>
                            <input
                              type="number"
                              min={1}
                              value={item.weight}
                              onChange={(e) => {
                                const next = [...settingsDraft.luckyGiftMultipliers];
                                next[idx] = {
                                  ...item,
                                  weight: Math.max(1, Number(e.target.value) || 1),
                                };
                                setSettingsDraft({ ...settingsDraft, luckyGiftMultipliers: next });
                              }}
                              dir="ltr"
                              className="w-full rounded-lg bg-[#070913]/85 border border-[#D4AF37]/25 px-2.5 py-1.5 text-white font-mono-num text-left"
                            />
                          </div>
                          <div className="col-span-2 pt-3 flex justify-end">
                            {settingsDraft.luckyGiftMultipliers.length > 1 && (
                              <button
                                type="button"
                                onClick={() => {
                                  const next = settingsDraft.luckyGiftMultipliers.filter(
                                    (_, i) => i !== idx
                                  );
                                  setSettingsDraft({
                                    ...settingsDraft,
                                    luckyGiftMultipliers: next,
                                  });
                                }}
                                className="min-h-[32px] min-w-[32px] rounded-lg bg-rose-950/60 border border-rose-500/35 text-rose-200 flex items-center justify-center cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="royal-glass rounded-3xl p-5 space-y-3.5">
                    <div className="flex items-center gap-2 text-[#FCE9A6]">
                      <Settings className="w-5 h-5 text-[#D4AF37]" />
                      <h2 className="text-sm font-extrabold">فئات مكافآت الشحن المؤقتة (USDT)</h2>
                    </div>
                    <div className="space-y-3 text-xs">
                      {settingsDraft.rechargeRewardTiers.map((tier, idx) => (
                        <div
                          key={tier.id}
                          className="rounded-2xl bg-[#070913]/75 border border-[#D4AF37]/25 p-3 space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-[#FCE9A6]">
                              {tier.frameName}
                              {tier.entryName ? ` + ${tier.entryName}` : ''}
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <label className="block text-[10px] text-slate-400">
                                الحد الأدنى ($)
                              </label>
                              <input
                                type="number"
                                min={1}
                                value={tier.minUsdt}
                                onChange={(e) => {
                                  const next = [...settingsDraft.rechargeRewardTiers];
                                  next[idx] = {
                                    ...tier,
                                    minUsdt: Math.max(1, Number(e.target.value) || 10),
                                  };
                                  setSettingsDraft({
                                    ...settingsDraft,
                                    rechargeRewardTiers: next,
                                  });
                                }}
                                dir="ltr"
                                className="w-full rounded-lg bg-[#0B0F20] border border-[#D4AF37]/25 px-2.5 py-1.5 text-white font-mono-num text-left"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] text-slate-400">
                                المدة (أيام)
                              </label>
                              <input
                                type="number"
                                min={1}
                                value={tier.days}
                                onChange={(e) => {
                                  const next = [...settingsDraft.rechargeRewardTiers];
                                  next[idx] = {
                                    ...tier,
                                    days: Math.max(1, Number(e.target.value) || 7),
                                  };
                                  setSettingsDraft({
                                    ...settingsDraft,
                                    rechargeRewardTiers: next,
                                  });
                                }}
                                dir="ltr"
                                className="w-full rounded-lg bg-[#0B0F20] border border-[#D4AF37]/25 px-2.5 py-1.5 text-white font-mono-num text-left"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] text-slate-400">
                                بونص كوينز (%)
                              </label>
                              <input
                                type="number"
                                min={0}
                                max={100}
                                value={Math.round(tier.bonusRate * 100)}
                                onChange={(e) => {
                                  const next = [...settingsDraft.rechargeRewardTiers];
                                  next[idx] = {
                                    ...tier,
                                    bonusRate:
                                      Math.max(0, Math.min(100, Number(e.target.value) || 0)) / 100,
                                  };
                                  setSettingsDraft({
                                    ...settingsDraft,
                                    rechargeRewardTiers: next,
                                  });
                                }}
                                dir="ltr"
                                className="w-full rounded-lg bg-[#0B0F20] border border-[#D4AF37]/25 px-2.5 py-1.5 text-white font-mono-num text-left"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>

                {/* In-Room Lucky Wheel 8 Segments */}
                <section className="royal-glass rounded-3xl p-5 space-y-3.5">
                  <h2 className="text-sm font-extrabold text-[#FCE9A6]">
                    خانات دولاب الحظ داخل الغرف (8 خانات)
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                    {settingsDraft.roomWheelSegments.map((seg, idx) => (
                      <div
                        key={seg.id}
                        className="rounded-2xl bg-[#070913]/75 border border-[#D4AF37]/25 p-3 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-[#F3D37A]">
                            {seg.glyph} خانة #{idx + 1}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {seg.rewardType === 'coins'
                              ? 'كوينز'
                              : seg.rewardType === 'frame'
                              ? 'إطار'
                              : 'XP'}
                          </span>
                        </div>
                        <input
                          type="text"
                          value={seg.shortLabel}
                          onChange={(e) => {
                            const next = [...settingsDraft.roomWheelSegments];
                            next[idx] = {
                              ...seg,
                              shortLabel: e.target.value,
                              label: e.target.value,
                            };
                            setSettingsDraft({ ...settingsDraft, roomWheelSegments: next });
                          }}
                          className="w-full rounded-lg bg-[#0B0F20] border border-[#D4AF37]/25 px-2.5 py-1.5 text-white"
                        />
                        <div className="grid grid-cols-3 gap-1.5">
                          <div>
                            <label className="block text-[10px] text-slate-400">كوينز</label>
                            <input
                              type="number"
                              min={0}
                              value={seg.coinsAmount || 0}
                              onChange={(e) => {
                                const next = [...settingsDraft.roomWheelSegments];
                                next[idx] = {
                                  ...seg,
                                  coinsAmount: Math.max(0, Number(e.target.value) || 0),
                                };
                                setSettingsDraft({ ...settingsDraft, roomWheelSegments: next });
                              }}
                              dir="ltr"
                              className="w-full rounded-lg bg-[#0B0F20] border border-[#D4AF37]/25 px-2 py-1 text-white font-mono-num text-left"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-400">XP</label>
                            <input
                              type="number"
                              min={0}
                              value={seg.xpAmount || 0}
                              onChange={(e) => {
                                const next = [...settingsDraft.roomWheelSegments];
                                next[idx] = {
                                  ...seg,
                                  xpAmount: Math.max(0, Number(e.target.value) || 0),
                                };
                                setSettingsDraft({ ...settingsDraft, roomWheelSegments: next });
                              }}
                              dir="ltr"
                              className="w-full rounded-lg bg-[#0B0F20] border border-[#D4AF37]/25 px-2 py-1 text-white font-mono-num text-left"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-400">الوزن</label>
                            <input
                              type="number"
                              min={1}
                              value={seg.weight}
                              onChange={(e) => {
                                const next = [...settingsDraft.roomWheelSegments];
                                next[idx] = {
                                  ...seg,
                                  weight: Math.max(1, Number(e.target.value) || 1),
                                };
                                setSettingsDraft({ ...settingsDraft, roomWheelSegments: next });
                              }}
                              dir="ltr"
                              className="w-full rounded-lg bg-[#0B0F20] border border-[#D4AF37]/25 px-2 py-1 text-white font-mono-num text-left"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Games Center Win/Profit Governance */}
                <section className="royal-glass rounded-3xl p-5 space-y-4 border border-[#D4AF37]/30">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-[#FCE9A6]">
                      <Gamepad2 className="w-5 h-5 text-[#D4AF37]" />
                      <h2 className="text-sm font-extrabold">
                        نسب الفوز والربح لألعاب مركز الألعاب (ضمان ربحية التطبيق)
                      </h2>
                    </div>
                    <span className="text-[11px] text-slate-300">
                      النسبة المئوية تحدد احتمال فوز اللاعب (%) لكل لعبة (من 5% حتى 90%)
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                    {(
                      [
                        { key: 'slotsWinRate', label: 'ماكينات السلوت (8 ألعاب)', defaultVal: 38 },
                        { key: 'doubleDiceWinRate', label: 'نرد الحظ المزدوج', defaultVal: 42 },
                        { key: 'predictionDiceWinRate', label: 'نرد التوقعات', defaultVal: 40 },
                        { key: 'ladderDiceWinRate', label: 'نرد السلم التفاعلي', defaultVal: 58 },
                        { key: 'speedDiceWinRate', label: 'نرد السرعة', defaultVal: 44 },
                        { key: 'rouletteWinRate', label: 'الروليت الملكية', defaultVal: 45 },
                        { key: 'mysteryBoxWinRate', label: 'صناديق الحظ (9 صناديق)', defaultVal: 42 },
                      ] as const
                    ).map((item) => {
                      const currentRates = settingsDraft.gameRates || {
                        slotsWinRate: 38,
                        doubleDiceWinRate: 42,
                        predictionDiceWinRate: 40,
                        ladderDiceWinRate: 58,
                        speedDiceWinRate: 44,
                        rouletteWinRate: 45,
                        mysteryBoxWinRate: 42,
                      };
                      const val = currentRates[item.key] ?? item.defaultVal;
                      const houseMargin = Math.max(0, 100 - val);
                      return (
                        <div
                          key={item.key}
                          className="rounded-2xl bg-[#070913]/80 border border-[#D4AF37]/25 p-3 space-y-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-[#FCE9A6]">{item.label}</span>
                            <span className="text-[10px] font-mono-num text-emerald-300">
                              هامش التطبيق {houseMargin}%
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min={5}
                              max={90}
                              value={val}
                              onChange={(e) => {
                                const clamped = Math.max(
                                  5,
                                  Math.min(
                                    90,
                                    Math.round(Number(e.target.value) || item.defaultVal)
                                  )
                                );
                                setSettingsDraft({
                                  ...settingsDraft,
                                  gameRates: {
                                    ...currentRates,
                                    [item.key]: clamped,
                                  },
                                });
                              }}
                              dir="ltr"
                              className="w-full rounded-xl bg-[#0B0F20] border border-[#D4AF37]/30 px-3 py-2 text-sm text-white font-mono-num text-left focus:outline-none focus:border-[#D4AF37]"
                            />
                            <span className="text-xs font-extrabold text-[#F3D37A] font-mono-num">
                              %
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>

                <button
                  type="submit"
                  disabled={savingSettings}
                  className="gold-btn w-full sm:w-auto min-h-[46px] rounded-2xl px-8 py-3 text-sm font-extrabold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>
                    {savingSettings ? 'جارٍ الحفظ...' : 'حفظ وتطبيق كافة الإعدادات المالية'}
                  </span>
                </button>
              </form>
            )}

            {/* TAB 10: DEVICE UUID PROTECTION */}
            {tab === 'devices' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <section className="royal-glass rounded-3xl p-5 sm:p-6 space-y-4">
                  <h2 className="text-base font-bold text-[#F3D37A]">
                    الأجهزة المرتبطة (Device UUID)
                  </h2>
                  <div className="divide-y divide-[#D4AF37]/15">
                    {data.deviceLocks.map((lock) => (
                      <div
                        key={lock.device_uuid}
                        className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white truncate" dir="ltr">
                            {lock.boundEmail}
                          </p>
                          <p
                            className="text-[11px] text-slate-400 font-mono-num truncate"
                            dir="ltr"
                          >
                            UUID: {lock.device_uuid}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => void handleUnlockDevice(lock.device_uuid)}
                            className="min-h-[38px] rounded-xl px-3 py-1.5 text-xs font-bold bg-white/5 border border-[#D4AF37]/30 text-[#FCE9A6] hover:bg-white/10 cursor-pointer flex items-center gap-1"
                          >
                            <Unlock className="w-3.5 h-3.5" />
                            <span>فك الارتباط</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleBlockDevice(lock)}
                            className={`min-h-[38px] rounded-xl px-3 py-1.5 text-xs font-bold border cursor-pointer ${
                              lock.isBlocked
                                ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-200'
                                : 'bg-rose-950/60 border-rose-500/40 text-rose-200'
                            }`}
                          >
                            {lock.isBlocked ? 'إلغاء الحظر' : 'حظر الجهاز'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="royal-glass rounded-3xl p-5 sm:p-6 space-y-4">
                  <h2 className="text-base font-bold text-[#F3D37A]">
                    سجل الأمان ومحاولات التعدد
                  </h2>
                  {data.securityLogs.length === 0 ? (
                    <p className="text-xs text-slate-400 py-4 text-center">
                      لا توجد تنبيهات أمنية مسجلة حتى الآن.
                    </p>
                  ) : (
                    <div className="divide-y divide-[#D4AF37]/15">
                      {data.securityLogs.map((log) => (
                        <div key={log.id} className="py-3 space-y-1 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-amber-300">{log.type}</span>
                            <span className="text-[11px] text-slate-500 font-mono-num">
                              {new Date(log.timestamp).toLocaleString('ar-EG')}
                            </span>
                          </div>
                          <p className="text-slate-200">{log.details}</p>
                          <p className="text-[11px] text-slate-400 font-mono-num" dir="ltr">
                            {log.device_uuid}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            )}
          </>
        )}

        {previewProof && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4"
            onClick={() => setPreviewProof(null)}
          >
            <div
              className="royal-glass rounded-3xl p-4 max-w-lg w-full space-y-3"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={previewProof}
                alt="إثبات التحويل"
                loading="lazy"
                decoding="async"
                className="w-full max-h-[70vh] object-contain rounded-2xl bg-[#070913]"
              />
              <button
                type="button"
                onClick={() => setPreviewProof(null)}
                className="gold-btn w-full min-h-[42px] rounded-xl text-xs font-bold cursor-pointer"
              >
                إغلاق المعاينة
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
