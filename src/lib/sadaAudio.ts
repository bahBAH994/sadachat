import confetti from 'canvas-confetti';

let sharedAudioCtx: AudioContext | null = null;
let audioMuted = false;

export function isAudioMuted(): boolean {
  return audioMuted;
}

export function setAudioMuted(muted: boolean): void {
  audioMuted = muted;
}

function getAudioContext(): AudioContext | null {
  if (audioMuted || typeof window === 'undefined') return null;
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
