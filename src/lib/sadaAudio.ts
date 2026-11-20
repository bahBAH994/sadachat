import confetti from 'canvas-confetti';

const EFFECTS_MUTED_STORAGE_KEY = 'sada_effects_muted';

let sharedAudioCtx: AudioContext | null = null;
let audioMuted = false;
let effectsMuted =
  typeof window !== 'undefined' &&
  window.localStorage?.getItem(EFFECTS_MUTED_STORAGE_KEY) === '1';

export function isAudioMuted(): boolean {
  return audioMuted;
}

export function setAudioMuted(muted: boolean): void {
  audioMuted = muted;
}

export function isEffectsMuted(): boolean {
  return audioMuted || effectsMuted;
}

export function getEffectsMutedSetting(): boolean {
  return effectsMuted;
}

export function setEffectsMuted(muted: boolean): void {
  effectsMuted = muted;
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(EFFECTS_MUTED_STORAGE_KEY, muted ? '1' : '0');
    } catch {
      // ignore storage failure
    }
  }
}

function getAudioContext(): AudioContext | null {
  if (audioMuted || effectsMuted || typeof window === 'undefined') return null;
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  if (!sharedAudioCtx) {
    try {
      sharedAudioCtx = new Ctx();
    } catch {
      return null;
    }
  }
  if (sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
}

/** Mechanical casino tick while slot reels are spinning */
export function playSlotSpinTick(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(720 + Math.random() * 140, now);
    osc.frequency.exponentialRampToValueAtTime(220, now + 0.035);
    gain.gain.setValueAtTime(0.045, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.038);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.04);
  } catch {
    // ignore audio failures
  }
}

/** Weighty illuminated latch thunk + bright chime when a cylindrical reel locks */
export function playSlotReelStop(colIndex: number): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    // Low mechanical thud
    const thud = ctx.createOscillator();
    const thudGain = ctx.createGain();
    thud.type = 'sine';
    thud.frequency.setValueAtTime(165, now);
    thud.frequency.exponentialRampToValueAtTime(58, now + 0.09);
    thudGain.gain.setValueAtTime(0.14, now);
    thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.095);
    thud.connect(thudGain);
    thudGain.connect(ctx.destination);
    thud.start(now);
    thud.stop(now + 0.1);

    // Ascending harmonic ping per column
    const pitches = [523.25, 659.25, 783.99, 987.77, 1046.5];
    const ping = ctx.createOscillator();
    const pingGain = ctx.createGain();
    ping.type = 'triangle';
    ping.frequency.setValueAtTime(pitches[colIndex % pitches.length], now);
    pingGain.gain.setValueAtTime(0.075, now);
    pingGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    ping.connect(pingGain);
    pingGain.connect(ctx.destination);
    ping.start(now);
    ping.stop(now + 0.15);
  } catch {
    // ignore
  }
}

/** Mechanical wheel-peg tick synced with physics pointer deflection */
export function playWheelPegTick(speedRatio = 0.6): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    const baseFreq = 620 + Math.min(1, Math.max(0.15, speedRatio)) * 420;
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(190, now + 0.028);
    gain.gain.setValueAtTime(0.055, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.032);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.035);
  } catch {
    // ignore
  }
}

/** Metallic lever pull clack when pulling the 3D slot arm */
export function playSlotLeverPull(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(240, now);
    osc.frequency.exponentialRampToValueAtTime(95, now + 0.11);
    gain.gain.setValueAtTime(0.085, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.13);
  } catch {
    // ignore
  }
}

/** Realistic multi-tap wooden/ivory dice rattle */
export function playDiceTumbleSound(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(340 + Math.random() * 240, now);
    osc.frequency.exponentialRampToValueAtTime(120, now + 0.04);
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(950, now);
    filter.Q.setValueAtTime(3.2, now);
    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.05);
  } catch {
    // ignore
  }
}

/** Velvet table thump when dice land */
export function playDiceLandSound(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(48, now + 0.12);
    gain.gain.setValueAtTime(0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.14);
  } catch {
    // ignore
  }
}

/** Golden coin chimes & celebratory victory fanfare */
export function playCoinWinSound(isJackpot = false): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const notes = isJackpot
      ? [523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98, 2093.0]
      : [659.25, 880, 1046.5, 1318.51, 1567.98];

    notes.forEach((freq, idx) => {
      const start = now + idx * (isJackpot ? 0.075 : 0.065);
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, start);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.015, start + 0.28);
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(isJackpot ? 0.14 : 0.1, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.36);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.38);
    });
  } catch {
    // ignore
  }
}

/** Synthesized Dragon Roar + Fireworks crackle for 5s Mega Gift Cinema Stage */
export function playDragonRoarAndFireworks(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;

    // 1) Deep Dragon Roar (dual detuned sawtooth + sub rumble through sweeping lowpass)
    const roarOsc1 = ctx.createOscillator();
    const roarOsc2 = ctx.createOscillator();
    const subOsc = ctx.createOscillator();
    const roarFilter = ctx.createBiquadFilter();
    const roarGain = ctx.createGain();

    roarOsc1.type = 'sawtooth';
    roarOsc2.type = 'sawtooth';
    subOsc.type = 'sine';

    roarOsc1.frequency.setValueAtTime(145, now);
    roarOsc1.frequency.exponentialRampToValueAtTime(54, now + 2.1);

    roarOsc2.frequency.setValueAtTime(151, now);
    roarOsc2.frequency.exponentialRampToValueAtTime(51, now + 2.1);

    subOsc.frequency.setValueAtTime(76, now);
    subOsc.frequency.exponentialRampToValueAtTime(34, now + 2.2);

    roarFilter.type = 'lowpass';
    roarFilter.frequency.setValueAtTime(920, now);
    roarFilter.frequency.exponentialRampToValueAtTime(240, now + 2.2);
    roarFilter.Q.setValueAtTime(4.5, now);

    roarGain.gain.setValueAtTime(0.001, now);
    roarGain.gain.linearRampToValueAtTime(0.22, now + 0.18);
    roarGain.gain.setValueAtTime(0.18, now + 0.8);
    roarGain.gain.exponentialRampToValueAtTime(0.001, now + 2.25);

    roarOsc1.connect(roarFilter);
    roarOsc2.connect(roarFilter);
    subOsc.connect(roarFilter);
    roarFilter.connect(roarGain);
    roarGain.connect(ctx.destination);

    roarOsc1.start(now);
    roarOsc2.start(now);
    subOsc.start(now);
    roarOsc1.stop(now + 2.3);
    roarOsc2.stop(now + 2.3);
    subOsc.stop(now + 2.3);

    // 2) Firework bursts & royal golden sparkles across the 5s window
    const bufferSize = Math.floor(ctx.sampleRate * 0.28);
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.065));
    }

    const burstOffsets = [0.45, 1.15, 1.85, 2.6, 3.4, 4.1];
    burstOffsets.forEach((offset, idx) => {
      const start = now + offset;
      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuffer;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(1600 + (idx % 3) * 700, start);
      bp.Q.setValueAtTime(1.1, start);
      const nGain = ctx.createGain();
      nGain.gain.setValueAtTime(0.16, start);
      nGain.gain.exponentialRampToValueAtTime(0.001, start + 0.26);
      noise.connect(bp);
      bp.connect(nGain);
      nGain.connect(ctx.destination);
      noise.start(start);

      // Shimmer bell alongside burst
      const bell = ctx.createOscillator();
      const bGain = ctx.createGain();
      bell.type = 'sine';
      bell.frequency.setValueAtTime(1046.5 + idx * 140, start + 0.04);
      bGain.gain.setValueAtTime(0.06, start + 0.04);
      bGain.gain.exponentialRampToValueAtTime(0.001, start + 0.34);
      bell.connect(bGain);
      bGain.connect(ctx.destination);
      bell.start(start + 0.04);
      bell.stop(start + 0.36);
    });
  } catch {
    // ignore
  }
}

/** Confetti explosion of golden coins & sapphire gems on game wins */
export function fireGoldCoinConfetti(intensity: 'normal' | 'jackpot' = 'normal'): void {
  if (typeof window === 'undefined') return;
  try {
    const colors = ['#FCE9A6', '#D4AF37', '#F59E0B', '#38BDF8', '#FFFFFF'];
    if (intensity === 'jackpot') {
      confetti({
        particleCount: 95,
        spread: 85,
        origin: { y: 0.65 },
        colors,
        ticks: 240,
        scalar: 1.15,
      });
      window.setTimeout(() => {
        confetti({
          particleCount: 55,
          angle: 60,
          spread: 60,
          origin: { x: 0.12, y: 0.7 },
          colors,
        });
        confetti({
          particleCount: 55,
          angle: 120,
          spread: 60,
          origin: { x: 0.88, y: 0.7 },
          colors,
        });
      }, 220);
    } else {
      confetti({
        particleCount: 48,
        spread: 68,
        origin: { y: 0.72 },
        colors,
        ticks: 180,
      });
    }
  } catch {
    // ignore
  }
}

/** Multi-salvo fireworks over the 5s Dragon Cinema Stage */
export function fireDragonFireworksBurst(): () => void {
  if (typeof window === 'undefined') return () => {};
  const colors = ['#FDE047', '#F97316', '#EF4444', '#D4AF37', '#FFFBEB'];
  const timers: number[] = [];

  const launch = (x: number, y: number, count: number, angle?: number) => {
    try {
      confetti({
        particleCount: count,
        spread: angle ? 65 : 95,
        angle: angle ?? 90,
        origin: { x, y },
        colors,
        ticks: 220,
        scalar: 1.15,
        zIndex: 60,
      });
    } catch {
      // ignore
    }
  };

  launch(0.5, 0.45, 75);
  timers.push(window.setTimeout(() => launch(0.18, 0.35, 50, 55), 550));
  timers.push(window.setTimeout(() => launch(0.82, 0.35, 50, 125), 950));
  timers.push(window.setTimeout(() => launch(0.5, 0.3, 65), 1850));
  timers.push(window.setTimeout(() => launch(0.25, 0.55, 45, 65), 2750));
  timers.push(window.setTimeout(() => launch(0.75, 0.55, 45, 115), 3450));

  return () => {
    timers.forEach((id) => window.clearTimeout(id));
  };
}

/** Tier 1 (<100 coins): Soft metallic coin chime suitable for rapid Combo taps */
export function playLightGiftCoinChime(comboCount = 1): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const pitchBoost = Math.min(8, Math.max(0, comboCount - 1)) * 35;
    const notes = [987.77 + pitchBoost, 1318.51 + pitchBoost];

    notes.forEach((freq, idx) => {
      const start = now + idx * 0.055;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.02, start + 0.16);
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.075, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.22);
    });
  } catch {
    // ignore
  }
}

/** Tier 2 (100-999 coins): Clear celebratory golden chime & warm chord */
export function playMediumGiftCelebrationSound(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const arpeggio = [587.33, 739.99, 880, 1174.66, 1479.98];

    arpeggio.forEach((freq, idx) => {
      const start = now + idx * 0.068;
      const osc = ctx.createOscillator();
      const harmonic = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      harmonic.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);
      harmonic.frequency.setValueAtTime(freq * 2, start);

      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.11, start + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.45);

      osc.connect(gain);
      harmonic.connect(gain);
      gain.connect(ctx.destination);

      osc.start(start);
      harmonic.start(start);
      osc.stop(start + 0.48);
      harmonic.stop(start + 0.48);
    });
  } catch {
    // ignore
  }
}

/** Tier 3 (>=1000 coins): Cinematic Supercar Engine Rev, Dragon Roar, or Royal Victory Fanfare */
export function playRoyalGiftCinematicSound(giftGlyph?: string): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const glyph = (giftGlyph || '').trim();
    const isVehicle = ['🏎️', '🚘', '🚗', '🚀', '🚁'].includes(glyph);
    const isDragonOrFalcon = ['🐉', '🦅'].includes(glyph);

    if (isVehicle) {
      // Supercar / Jet Engine Rev + Turbo Whoosh
      const eng1 = ctx.createOscillator();
      const eng2 = ctx.createOscillator();
      const sub = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const engGain = ctx.createGain();

      eng1.type = 'sawtooth';
      eng2.type = 'sawtooth';
      sub.type = 'triangle';

      eng1.frequency.setValueAtTime(68, now);
      eng1.frequency.exponentialRampToValueAtTime(195, now + 0.45);
      eng1.frequency.exponentialRampToValueAtTime(135, now + 0.72);
      eng1.frequency.exponentialRampToValueAtTime(285, now + 1.45);
      eng1.frequency.exponentialRampToValueAtTime(95, now + 2.1);

      eng2.frequency.setValueAtTime(71, now);
      eng2.frequency.exponentialRampToValueAtTime(201, now + 0.45);
      eng2.frequency.exponentialRampToValueAtTime(139, now + 0.72);
      eng2.frequency.exponentialRampToValueAtTime(292, now + 1.45);
      eng2.frequency.exponentialRampToValueAtTime(98, now + 2.1);

      sub.frequency.setValueAtTime(48, now);
      sub.frequency.exponentialRampToValueAtTime(125, now + 1.45);
      sub.frequency.exponentialRampToValueAtTime(55, now + 2.1);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(420, now);
      filter.frequency.exponentialRampToValueAtTime(1850, now + 1.45);
      filter.frequency.exponentialRampToValueAtTime(520, now + 2.15);
      filter.Q.setValueAtTime(3.6, now);

      engGain.gain.setValueAtTime(0.001, now);
      engGain.gain.linearRampToValueAtTime(0.18, now + 0.14);
      engGain.gain.setValueAtTime(0.16, now + 1.35);
      engGain.gain.exponentialRampToValueAtTime(0.001, now + 2.2);

      eng1.connect(filter);
      eng2.connect(filter);
      sub.connect(filter);
      filter.connect(engGain);
      engGain.connect(ctx.destination);

      eng1.start(now);
      eng2.start(now);
      sub.start(now);
      eng1.stop(now + 2.25);
      eng2.stop(now + 2.25);
      sub.stop(now + 2.25);
    } else if (isDragonOrFalcon) {
      playDragonRoarAndFireworks();
    }

    // Grand Royal Brass Victory Fanfare + Golden Shimmer across all Tier 3 gifts
    const fanfareStart = isVehicle ? now + 0.65 : now;
    const brassSequence: Array<{ freq: number; offset: number; dur: number }> = [
      { freq: 523.25, offset: 0.0, dur: 0.22 }, // C5
      { freq: 523.25, offset: 0.2, dur: 0.18 }, // C5
      { freq: 659.25, offset: 0.36, dur: 0.24 }, // E5
      { freq: 783.99, offset: 0.58, dur: 0.42 }, // G5
      { freq: 1046.5, offset: 0.96, dur: 1.25 }, // C6
    ];

    brassSequence.forEach(({ freq, offset, dur }) => {
      const start = fanfareStart + offset;
      const brass = ctx.createOscillator();
      const fifth = ctx.createOscillator();
      const lp = ctx.createBiquadFilter();
      const bGain = ctx.createGain();

      brass.type = 'sawtooth';
      fifth.type = 'triangle';
      brass.frequency.setValueAtTime(freq, start);
      fifth.frequency.setValueAtTime(freq * 1.5, start);

      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(2100, start);
      lp.frequency.exponentialRampToValueAtTime(950, start + dur);

      bGain.gain.setValueAtTime(0.001, start);
      bGain.gain.linearRampToValueAtTime(0.11, start + 0.03);
      bGain.gain.setValueAtTime(0.09, start + dur * 0.65);
      bGain.gain.exponentialRampToValueAtTime(0.001, start + dur);

      brass.connect(lp);
      fifth.connect(lp);
      lp.connect(bGain);
      bGain.connect(ctx.destination);

      brass.start(start);
      fifth.start(start);
      brass.stop(start + dur + 0.04);
      fifth.stop(start + dur + 0.04);
    });

    // Cascading Golden Chimes during the 4.5s window
    const chimes = [1046.5, 1318.51, 1567.98, 2093.0, 2637.02];
    chimes.forEach((freq, i) => {
      const start = now + 1.15 + i * 0.24;
      const bell = ctx.createOscillator();
      const gain = ctx.createGain();
      bell.type = 'sine';
      bell.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.07, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.45);
      bell.connect(gain);
      gain.connect(ctx.destination);
      bell.start(start);
      bell.stop(start + 0.48);
    });
  } catch {
    // ignore
  }
}

/** 4.5-Second Multi-Salvo Gold Rain Confetti for Tier 3 Royal Gifts */
export function fireRoyalGiftConfettiBurst(): () => void {
  if (typeof window === 'undefined') return () => {};
  const colors = ['#FEF08A', '#FDE047', '#D4AF37', '#F59E0B', '#FFFFFF'];
  const timers: number[] = [];

  const launch = (x: number, y: number, count: number, angle?: number) => {
    try {
      confetti({
        particleCount: count,
        spread: angle ? 68 : 100,
        angle: angle ?? 90,
        origin: { x, y },
        colors,
        ticks: 210,
        scalar: 1.15,
        zIndex: 62,
      });
    } catch {
      // ignore
    }
  };

  launch(0.5, 0.42, 70);
  timers.push(window.setTimeout(() => launch(0.16, 0.35, 45, 58), 420));
  timers.push(window.setTimeout(() => launch(0.84, 0.35, 45, 122), 780));
  timers.push(window.setTimeout(() => launch(0.5, 0.28, 55), 1650));
  timers.push(window.setTimeout(() => launch(0.24, 0.52, 40, 68), 2550));
  timers.push(window.setTimeout(() => launch(0.76, 0.52, 40, 112), 3250));

  return () => {
    timers.forEach((id) => window.clearTimeout(id));
  };
}

/** Automatic VIP Room Entrance Audio (VIP 2 Silver, VIP 3 Royal Gold, SVIP Imperial) */
export function playVipEntranceSound(vipLevel: 'vip2' | 'vip3' | 'svip'): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;

    if (vipLevel === 'vip2') {
      // Bright Silver Star Chime
      const silverNotes = [783.99, 987.77, 1318.51, 1567.98];
      silverNotes.forEach((freq, idx) => {
        const start = now + idx * 0.075;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(0.09, start + 0.018);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.42);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.45);
      });
      return;
    }

    if (vipLevel === 'vip3') {
      // Luxurious Royal Gold Entrance Chord + Golden Sparkle
      const goldChime = [523.25, 659.25, 783.99, 1046.5, 1318.51];
      goldChime.forEach((freq, idx) => {
        const start = now + idx * 0.08;
        const osc = ctx.createOscillator();
        const overtone = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        overtone.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);
        overtone.frequency.setValueAtTime(freq * 1.5, start);
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(0.11, start + 0.025);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.58);
        osc.connect(gain);
        overtone.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        overtone.start(start);
        osc.stop(start + 0.6);
        overtone.stop(start + 0.6);
      });
      return;
    }

    // SVIP Imperial Entrance: Sub Bass Imperial Drum + Royal Brass Fanfare + Diamond Cascade
    const drum = ctx.createOscillator();
    const drumGain = ctx.createGain();
    drum.type = 'sine';
    drum.frequency.setValueAtTime(125, now);
    drum.frequency.exponentialRampToValueAtTime(42, now + 0.42);
    drumGain.gain.setValueAtTime(0.24, now);
    drumGain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    drum.connect(drumGain);
    drumGain.connect(ctx.destination);
    drum.start(now);
    drum.stop(now + 0.48);

    const imperialNotes = [
      { freq: 523.25, offset: 0.06, dur: 0.22 },
      { freq: 659.25, offset: 0.24, dur: 0.22 },
      { freq: 783.99, offset: 0.42, dur: 0.26 },
      { freq: 1046.5, offset: 0.64, dur: 0.95 },
      { freq: 1318.51, offset: 0.92, dur: 1.05 },
    ];
    imperialNotes.forEach(({ freq, offset, dur }) => {
      const start = now + offset;
      const brass = ctx.createOscillator();
      const harm = ctx.createOscillator();
      const lp = ctx.createBiquadFilter();
      const g = ctx.createGain();
      brass.type = 'sawtooth';
      harm.type = 'triangle';
      brass.frequency.setValueAtTime(freq, start);
      harm.frequency.setValueAtTime(freq * 1.5, start);
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(2200, start);
      lp.frequency.exponentialRampToValueAtTime(950, start + dur);
      g.gain.setValueAtTime(0.001, start);
      g.gain.linearRampToValueAtTime(0.11, start + 0.03);
      g.gain.setValueAtTime(0.09, start + dur * 0.65);
      g.gain.exponentialRampToValueAtTime(0.001, start + dur);
      brass.connect(lp);
      harm.connect(lp);
      lp.connect(g);
      g.connect(ctx.destination);
      brass.start(start);
      harm.start(start);
      brass.stop(start + dur + 0.04);
      harm.stop(start + dur + 0.04);
    });
  } catch {
    // ignore
  }
}

/** Imperial 3.5s Diamond & Gold Confetti Salvo for SVIP Entrance */
export function fireSvipEntranceConfetti(): () => void {
  if (typeof window === 'undefined') return () => {};
  const colors = ['#FEF08A', '#F59E0B', '#38BDF8', '#EF4444', '#FFFFFF'];
  const timers: number[] = [];

  const fire = (x: number, y: number, count: number, angle?: number) => {
    try {
      confetti({
        particleCount: count,
        spread: angle ? 64 : 96,
        angle: angle ?? 90,
        origin: { x, y },
        colors,
        ticks: 190,
        scalar: 1.1,
        zIndex: 65,
      });
    } catch {
      // ignore
    }
  };

  fire(0.5, 0.36, 65);
  timers.push(window.setTimeout(() => fire(0.18, 0.32, 42, 55), 350));
  timers.push(window.setTimeout(() => fire(0.82, 0.32, 42, 125), 650));
  timers.push(window.setTimeout(() => fire(0.5, 0.28, 48), 1450));

  return () => {
    timers.forEach((id) => window.clearTimeout(id));
  };
}

/** Gentle Royal Herald Chime for 5,000+ Coins Cross-Room Global Announcement Ticker */
export function playGlobalRoyalAnnouncementChime(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const notes = [880, 1174.66, 1760];
    notes.forEach((freq, idx) => {
      const start = now + idx * 0.085;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.075, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.36);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.38);
    });
  } catch {
    // ignore
  }
}
