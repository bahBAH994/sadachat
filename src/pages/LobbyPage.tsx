import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Headphones, Lock, Mic, Mic2, Plus, Search, Unlock, Users, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { resolveAsset } from '../lib/assets';
import {
  createRoomInSupabase,
  listActiveRooms,
  verifyRoomPasswordInSupabase,
} from '../lib/sadaRoomsService';
import { supabase } from '../lib/supabase';
import type { Room } from '../types';
import { AvatarWithFrame } from '../components/AvatarWithFrame';
import { FemaleVoiceVerificationCard } from '../components/FemaleVoiceVerificationCard';

const CATEGORIES: Array<'الكل' | Room['category']> = [
  'الكل',
  'مسابقات',
  'شعر وأدب',
  'طرب',
  'حوار',
];

export const LobbyPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<'الكل' | Room['category']>('الكل');
  const [search, setSearch] = useState('');

  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<Room['category']>('حوار');
  const [newDesc, setNewDesc] = useState('');
  const [newSeats, setNewSeats] = useState<6 | 8>(8);
  const [newPrivate, setNewPrivate] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [passwordPromptRoom, setPasswordPromptRoom] = useState<Room | null>(null);
  const [roomPasswordInput, setRoomPasswordInput] = useState('');
  const [roomPasswordError, setRoomPasswordError] = useState<string | null>(null);
  const [micPermission, setMicPermission] = useState<'unknown' | 'granted' | 'denied'>('unknown');

  const requestMicPermission = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setMicPermission('denied');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      setMicPermission('granted');
    } catch {
      setMicPermission('denied');
    }
  };

  const loadRooms = useCallback(async () => {
    try {
      const data = await listActiveRooms();
      setRooms(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRooms();
    const channel = supabase
      .channel('sada-lobby-rooms')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sada_rooms' },
        () => {
          void loadRooms();
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadRooms]);

  const filteredRooms = useMemo(() => {
    return rooms.filter((r) => {
      const matchCat = category === 'الكل' || r.category === category;
      const q = search.trim().toLowerCase();
      const matchSearch =
        !q ||
        r.title.toLowerCase().includes(q) ||
        r.hostName.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q);
      return matchCat && matchSearch;
    });
  }, [rooms, category, search]);

  const featuredRoom = filteredRooms[0] || rooms[0];

  const enterRoom = (room: Room) => {
    if (room.hasPassword) {
      setPasswordPromptRoom(room);
      setRoomPasswordInput('');
      setRoomPasswordError(null);
      return;
    }
    navigate(`/room/${room.id}`);
  };

  const handleVerifyPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordPromptRoom) return;
    setRoomPasswordError(null);
    try {
      await verifyRoomPasswordInSupabase(passwordPromptRoom.id, roomPasswordInput);
      const targetId = passwordPromptRoom.id;
      setPasswordPromptRoom(null);
      navigate(`/room/${targetId}`);
    } catch (err) {
      setRoomPasswordError(
        err instanceof Error ? err.message : 'كلمة المرور غير صحيحة.'
      );
    }
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setCreateError(null);
    setCreating(true);
    try {
      const room = await createRoomInSupabase(user, {
        title: newTitle,
        category: newCategory,
        description: newDesc,
        maxSeats: newSeats,
        isPrivate: newPrivate,
        password: newPrivate ? newPassword : '',
      });
      setShowCreate(false);
      navigate(`/room/${room.id}`);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'تعذّر إنشاء الغرفة.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-5 pb-28 space-y-8">
      <FemaleVoiceVerificationCard />
      {featuredRoom && (
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28 }}
          className="relative rounded-3xl overflow-hidden border border-[#D4AF37]/30 shadow-[0_20px_50px_rgba(0,0,0,0.6)]"
        >
          <img
            src={resolveAsset(featuredRoom.coverImage)}
            alt={featuredRoom.title}
            referrerPolicy="no-referrer"
            className="w-full h-64 sm:h-80 object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#070913] via-[#070913]/70 to-transparent" />

          <div className="absolute inset-x-0 bottom-0 p-5 sm:p-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="space-y-2 max-w-2xl">
              <div className="flex items-center gap-2 text-xs text-[#F3D37A] font-semibold">
                <span>المجلس المميّز</span>
                <span aria-hidden="true">·</span>
                <span>{featuredRoom.category}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono-num">{featuredRoom.listenersCount} مستمع</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white leading-snug [text-wrap:balance]">
                {featuredRoom.title}
              </h1>
              <p className="text-sm text-slate-300 line-clamp-2">
                {featuredRoom.description}
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => enterRoom(featuredRoom)}
                className="gold-btn min-h-[44px] rounded-xl px-6 py-2.5 text-sm whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-2"
              >
                <Mic2 className="w-4 h-4" />
                <span>دخول المجلس الآن</span>
              </button>
              <button
                type="button"
                onClick={() => setShowCreate(true)}
                className="royal-glass min-h-[44px] rounded-xl px-4 py-2.5 text-sm font-bold text-[#F3D37A] hover:border-[#D4AF37]/60 whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>إنشاء غرفة</span>
              </button>
            </div>
          </div>
        </motion.section>
      )}

      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                className={`min-h-[40px] rounded-xl px-4 py-2 text-xs sm:text-sm font-bold transition whitespace-nowrap shrink-0 cursor-pointer ${
                  category === cat
                    ? 'bg-[#D4AF37] text-[#070913] shadow-[0_0_16px_rgba(212,175,55,0.4)]'
                    : 'royal-glass text-slate-300 hover:text-white'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ابحث عن مجلس أو مضيف..."
                className="w-full rounded-xl bg-[#0D1122]/85 border border-[#D4AF37]/25 pr-10 pl-4 py-2.5 text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-[#D4AF37]"
              />
            </div>
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="gold-btn min-h-[42px] rounded-xl px-3.5 py-2 text-xs sm:text-sm whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5 sm:hidden"
            >
              <Plus className="w-4 h-4" />
              <span>غرفة</span>
            </button>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="royal-glass rounded-3xl h-52 animate-pulse opacity-60"
              />
            ))}
          </div>
        ) : filteredRooms.length === 0 ? (
          <div className="royal-glass rounded-3xl p-10 text-center space-y-3">
            <p className="text-base font-bold text-slate-200">
              لا توجد مجالس صوتية مطابقة لبحثك حالياً
            </p>
            <button
              type="button"
              onClick={() => {
                setCategory('الكل');
                setSearch('');
              }}
              className="gold-btn rounded-xl px-5 py-2 text-xs cursor-pointer"
            >
              عرض جميع المجالس
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredRooms.map((room) => {
              const occupiedCount = room.seats.filter((s) => s.userId).length;
              return (
                <article
                  key={room.id}
                  onClick={() => enterRoom(room)}
                  className="royal-glass royal-glass-hover rounded-3xl p-5 flex flex-col justify-between gap-4 cursor-pointer"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <AvatarWithFrame
                          src={room.hostAvatar}
                          alt={room.hostName}
                          size="md"
                          frameId="frame_crescent"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 text-xs text-slate-400">
                            <span className="text-[#F3D37A] font-semibold">{room.category}</span>
                            <span aria-hidden="true">·</span>
                            <span className="truncate">{room.hostName}</span>
                          </div>
                          <h2 className="text-base font-bold text-white truncate mt-0.5">
                            {room.title}
                          </h2>
                        </div>
                      </div>
                      {room.hasPassword && (
                        <Lock className="w-4 h-4 text-[#F3D37A] shrink-0 mt-1" />
                      )}
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed line-clamp-2">
                      {room.description}
                    </p>

                    {/* Mini Interactive Speaker Seats Preview */}
                    <div className="flex items-center gap-1.5 pt-1">
                      {room.seats.slice(0, 6).map((seat) => (
                        <div
                          key={seat.seatIndex}
                          className={`w-7 h-7 rounded-full flex items-center justify-center overflow-hidden border transition ${
                            seat.userId
                              ? seat.isSpeaking && !seat.isMuted
                                ? 'border-[#FCE9A6] shadow-[0_0_12px_rgba(243,211,122,0.85)]'
                                : 'border-[#D4AF37]/50'
                              : 'border-dashed border-[#D4AF37]/25 bg-[#070913]/60'
                          }`}
                          title={seat.displayName || `مايك ${seat.seatIndex + 1}`}
                        >
                          {seat.userId ? (
                            <img
                              src={resolveAsset(seat.avatarUrl)}
                              alt={seat.displayName || 'متحدث'}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Mic className="w-3 h-3 text-[#D4AF37]/55" />
                          )}
                        </div>
                      ))}
                      <span className="text-[11px] text-slate-400 mr-auto">
                        {room.hasPassword ? 'محمية PIN' : 'مفتوحة'}
                      </span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-[#D4AF37]/15 flex items-center justify-between text-xs text-slate-300">
                    <div className="flex items-center gap-4 font-mono-num">
                      <span className="flex items-center gap-1.5">
                        <Headphones className="w-3.5 h-3.5 text-[#D4AF37]" />
                        {room.listenersCount}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-sky-300" />
                        {occupiedCount}/{room.maxSeats}
                      </span>
                    </div>
                    <span className="text-[#FCE9A6] font-bold">انضمام ←</span>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {showCreate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
          onClick={() => setShowCreate(false)}
        >
          <div
            className="royal-glass w-full max-w-md rounded-3xl p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-extrabold gold-gradient-text">
                افتتاح مجلس صوتي جديد
              </h3>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-full text-slate-400 hover:text-white cursor-pointer"
                aria-label="إغلاق"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {createError && (
              <div className="rounded-xl border border-rose-500/40 bg-rose-950/50 px-3 py-2 text-xs text-rose-200">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateRoom} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  عنوان المجلس
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="مثال: سهرة الشعر العربي الأصيل"
                  className="w-full rounded-xl bg-[#070913]/85 border border-[#D4AF37]/25 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    التصنيف
                  </label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as Room['category'])}
                    className="w-full rounded-xl bg-[#070913]/85 border border-[#D4AF37]/25 px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#D4AF37]"
                  >
                    <option value="حوار">حوار</option>
                    <option value="مسابقات">مسابقات</option>
                    <option value="شعر وأدب">شعر وأدب</option>
                    <option value="طرب">طرب</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    عدد مقاعد المايك
                  </label>
                  <select
                    value={newSeats}
                    onChange={(e) => setNewSeats(Number(e.target.value) as 6 | 8)}
                    className="w-full rounded-xl bg-[#070913]/85 border border-[#D4AF37]/25 px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#D4AF37]"
                  >
                    <option value={8}>8 مقاعد</option>
                    <option value={6}>6 مقاعد</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  وصف مختصر
                </label>
                <textarea
                  rows={2}
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="اكتب نبذة ترحيبية للضيوف..."
                  className="w-full rounded-xl bg-[#070913]/85 border border-[#D4AF37]/25 px-3.5 py-2 text-sm text-white focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-300">
                  خصوصية الغرفة
                </label>
                <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-[#070913]/85 border border-[#D4AF37]/20">
                  <button
                    type="button"
                    onClick={() => setNewPrivate(false)}
                    className={`min-h-[38px] rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition ${
                      !newPrivate
                        ? 'bg-[#D4AF37] text-[#070913]'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    <Unlock className="w-3.5 h-3.5" />
                    <span>غرفة عامة</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewPrivate(true)}
                    className={`min-h-[38px] rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition ${
                      newPrivate
                        ? 'bg-[#D4AF37] text-[#070913]'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>محمية برمز PIN</span>
                  </button>
                </div>
              </div>

              {newPrivate && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    الرمز السري للغرفة (PIN)
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    required
                    maxLength={8}
                    dir="ltr"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="4820"
                    className="w-full rounded-xl bg-[#070913]/85 border border-[#D4AF37]/25 px-3.5 py-2.5 text-sm text-white text-left font-mono-num focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>
              )}

              <div className="flex items-center justify-between gap-2 rounded-xl bg-[#070913]/65 border border-[#D4AF37]/20 px-3.5 py-2.5">
                <span className="text-xs text-slate-300">
                  {micPermission === 'granted'
                    ? 'إذن المايكروفون مفعّل وجاهز'
                    : micPermission === 'denied'
                    ? 'تعذّر الوصول للمايكروفون من المتصفح'
                    : 'تفعيل إذن المايكروفون قبل البث'}
                </span>
                <button
                  type="button"
                  onClick={requestMicPermission}
                  className="text-xs font-bold text-[#FCE9A6] hover:underline whitespace-nowrap cursor-pointer"
                >
                  {micPermission === 'granted' ? 'مُفعّل ✓' : 'تفعيل المايك'}
                </button>
              </div>

              <button
                type="submit"
                disabled={creating}
                className="gold-btn w-full min-h-[46px] rounded-xl py-2.5 text-sm cursor-pointer disabled:opacity-60"
              >
                {creating ? 'جارٍ افتتاح المجلس...' : 'بدء البث الصوتي الآن'}
              </button>
            </form>
          </div>
        </div>
      )}

      {passwordPromptRoom && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
          onClick={() => setPasswordPromptRoom(null)}
        >
          <div
            className="royal-glass w-full max-w-sm rounded-3xl p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-[#F3D37A]">
              غرفة محمية برمز سري (PIN)
            </h3>
            <p className="text-xs text-slate-300">{passwordPromptRoom.title}</p>
            {roomPasswordError && (
              <div className="rounded-xl bg-rose-950/60 border border-rose-500/40 px-3 py-2 text-xs text-rose-200">
                {roomPasswordError}
              </div>
            )}
            <form onSubmit={handleVerifyPassword} className="space-y-3">
              <input
                type="password"
                inputMode="numeric"
                required
                dir="ltr"
                value={roomPasswordInput}
                onChange={(e) => setRoomPasswordInput(e.target.value)}
                placeholder="أدخل الرمز السري PIN"
                className="w-full rounded-xl bg-[#070913]/85 border border-[#D4AF37]/25 px-3.5 py-2.5 text-sm text-white text-left font-mono-num focus:outline-none focus:border-[#D4AF37]"
              />
              <button
                type="submit"
                className="gold-btn w-full min-h-[44px] rounded-xl py-2 text-sm cursor-pointer"
              >
                تحقق ودخول
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
