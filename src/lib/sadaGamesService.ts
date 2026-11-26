import type { Transaction, User } from '../types';
import { computeLevelFromXp, genId } from './sadaCatalog';
import {
  getPlatformState,
  recordTransaction,
  rowToUser,
  savePlatformState,
  USER_COLUMNS,
} from './sadaMappers';
import { supabase } from './supabase';

export type SlotGameId =
  | 'jungle_hunt'
  | 'classic_fruits'
  | 'pharaoh_treasures'
  | 'neon_galaxy'
  | 'crown_jewels'
  | 'olympus_gates'
  | 'sea_pirates'
  | 'turbo_racing'
  | 'desert_gold';

export type DiceGameId = 'double_dice' | 'prediction_dice' | 'ladder_dice' | 'speed_dice';

export type RouletteBetType =
  | 'red'
  | 'black'
  | 'even'
  | 'odd'
  | 'dozen_1'
  | 'dozen_2'
  | 'dozen_3'
  | 'zero'
  | 'straight';

export type RoomGameKind = 'roulette' | 'dice';
export type RoomStandardDiceGameId = 'double_dice' | 'prediction_dice' | 'speed_dice';
export type RoomGameBetSelection =
  | {
      bets: Array<{
        betType: RouletteBetType;
        targetNumber?: number;
        amount: number;
      }>;
    }
  | { gameId: RoomStandardDiceGameId; pick: string };

export interface RoomGameRoundBet {
  userId: string;
  displayName: string;
  amount: number;
  selection: Record<string, unknown>;
  isWinner: boolean;
  multiplier: number;
  payout: number;
}

export type RoomGameRoundOutcome =
  | { number: number; color: 'red' | 'black' | 'green'; wheelIndex: number }
  | { dice: number[]; sum: number };

export interface RoomGameRoundState {
  roundId: string;
  roundNumber: number;
  startedAt: string;
  bettingEndsAt: string;
  roundEndsAt: string;
  serverNow: string;
  phase: 'betting' | 'revealing';
  result: RoomGameRoundOutcome | null;
  bets: RoomGameRoundBet[];
}

export interface LightningStrike {
  row: number;
  col: number;
  mult: number;
}

export interface SpinResultPayload {
  gameId: SlotGameId;
  bet: number;
  grid: string[][];
  cols: number;
  rows: number;
  multiplier: number;
  payout: number;
  netDelta: number;
  xpGain: number;
  winningCells: Array<[number, number]>;
  rulesTriggered: string[];
  lightningStrikes?: LightningStrike[];
  jackpotHit: boolean;
  user: User;
}

export interface DicePlayResponse {
  gameId: 'double_dice' | 'prediction_dice' | 'speed_dice';
  bet: number;
  dice: number[];
  won: boolean;
  multiplier: number;
  payout: number;
  xpGain: number;
  label: string;
  user: User;
}

export interface LadderSession {
  bet: number;
  step: number;
  currentMultiplier: number;
}

export interface LadderActionResponse {
  status: 'climbed' | 'summit' | 'fell' | 'cashed_out';
  payout: number;
  multiplier: number;
  step: number;
  die: number;
  session: LadderSession | null;
  message: string;
  user: User;
}

export interface RouletteSpinResponse {
  winningNumber: number;
  winningColor: 'red' | 'black' | 'green';
  wheelIndex: number;
  won: boolean;
  multiplier: number;
  payout: number;
  bet: number;
  xpGain: number;
  user: User;
}

export interface MysteryBoxItem {
  index: number;
  multiplier: number;
  coins: number;
  label: string;
  glyph: string;
  isChosen: boolean;
}

export interface MysteryBoxResponse {
  chosenIndex: number;
  boxes: MysteryBoxItem[];
  won: boolean;
  multiplier: number;
  payout: number;
  bet: number;
  xpGain: number;
  user: User;
}

const ROULETTE_WHEEL_ORDER = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16,
  33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
];

const ROULETTE_REDS = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
]);

const LADDER_MULTIPLIERS: Record<number, number> = {
  1: 1.4,
  2: 2.2,
  3: 3.6,
  4: 6.5,
  5: 12.0,
};

interface SlotMachineSpec {
  id: SlotGameId;
  title: string;
  cols: number;
  rows: number;
  symbols: string[];
  weights: number[];
}

const SLOT_SPECS: Record<SlotGameId, SlotMachineSpec> = {
  jungle_hunt: {
    id: 'jungle_hunt',
    title: 'مطاردة الأدغال',
    cols: 5,
    rows: 3,
    symbols: ['10', 'J', 'K', '🐊', '🐘', '🦍', '🦁', 'WILD'],
    weights: [24, 21, 18, 13, 10, 7, 4, 3],
  },
  classic_fruits: {
    id: 'classic_fruits',
    title: 'سلوت الفواكه',
    cols: 5,
    rows: 3,
    symbols: ['🍒', '🍋', '🍇', '🔔', '⭐', '7️⃣'],
    weights: [28, 24, 20, 14, 9, 5],
  },
  pharaoh_treasures: {
    id: 'pharaoh_treasures',
    title: 'سلوت الهرم الملكي',
    cols: 5,
    rows: 3,
    symbols: ['🏺', '🐍', '⚱️', '☀️', '👁️', '🪲'],
    weights: [26, 22, 18, 13, 8, 13],
  },
  neon_galaxy: {
    id: 'neon_galaxy',
    title: 'مجرة النيون',
    cols: 5,
    rows: 3,
    symbols: ['👾', '☄️', '🌌', '🪐', '🛸', '⚡'],
    weights: [26, 22, 18, 14, 10, 10],
  },
  crown_jewels: {
    id: 'crown_jewels',
    title: 'السلوت الملكي 3D',
    cols: 5,
    rows: 3,
    symbols: ['🪙', '⚜️', '🏆', '🦅', '💎', '👑'],
    weights: [28, 22, 18, 14, 11, 7],
  },
  olympus_gates: {
    id: 'olympus_gates',
    title: 'بوابات الأوليمبوس',
    cols: 5,
    rows: 3,
    symbols: ['🏛️', '⏳', '💍', '🏆', '👑', '⚡'],
    weights: [25, 22, 18, 14, 10, 11],
  },
  sea_pirates: {
    id: 'sea_pirates',
    title: 'قراصنة البحار',
    cols: 5,
    rows: 3,
    symbols: ['⚓', '🧭', '🦜', '🏴‍☠️', '💣', '💰'],
    weights: [25, 21, 18, 14, 12, 10],
  },
  turbo_racing: {
    id: 'turbo_racing',
    title: 'سباق التوربو',
    cols: 5,
    rows: 3,
    symbols: ['🛞', '⛽', '🏁', '🏆', '🔥', '🏎️'],
    weights: [26, 22, 18, 14, 11, 9],
  },
  desert_gold: {
    id: 'desert_gold',
    title: 'ذهب الصحراء',
    cols: 5,
    rows: 3,
    symbols: ['🌴', '🐪', '🗡️', '🏜️', '🪔', '🪙'],
    weights: [26, 22, 18, 14, 10, 10],
  },
};

function pickWeightedSymbol(symbols: string[], weights: number[]): string {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < symbols.length; i++) {
    r -= weights[i];
    if (r <= 0) return symbols[i];
  }
  return symbols[0];
}

function generateGrid(spec: SlotMachineSpec): string[][] {
  return Array.from({ length: spec.rows }, () =>
    Array.from({ length: spec.cols }, () => pickWeightedSymbol(spec.symbols, spec.weights))
  );
}

interface SlotEval {
  multiplier: number;
  winningCells: Array<[number, number]>;
  rulesTriggered: string[];
  lightningStrikes?: LightningStrike[];
  jackpotHit: boolean;
}

function addCells(target: Set<string>, coords: Array<[number, number]>) {
  for (const [r, c] of coords) target.add(`${r}-${c}`);
}

function parseCells(set: Set<string>): Array<[number, number]> {
  return Array.from(set).map((k) => {
    const [r, c] = k.split('-').map(Number);
    return [r, c];
  });
}

const PAYLINES_5X3: Array<Array<[number, number]>> = [
  [[1, 0], [1, 1], [1, 2], [1, 3], [1, 4]], // 1. Middle
  [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]], // 2. Top
  [[2, 0], [2, 1], [2, 2], [2, 3], [2, 4]], // 3. Bottom
  [[0, 0], [1, 1], [2, 2], [1, 3], [0, 4]], // 4. V
  [[2, 0], [1, 1], [0, 2], [1, 3], [2, 4]], // 5. Inverted V
  [[0, 0], [0, 1], [1, 2], [2, 3], [2, 4]], // 6. Slope down
  [[2, 0], [2, 1], [1, 2], [0, 3], [0, 4]], // 7. Slope up
  [[1, 0], [0, 1], [0, 2], [0, 3], [1, 4]], // 8. Arch up
  [[1, 0], [2, 1], [2, 2], [2, 3], [1, 4]], // 9. Arch down
  [[0, 0], [1, 1], [1, 2], [1, 3], [0, 4]], // 10. Shallow cup
  [[2, 0], [1, 1], [1, 2], [1, 3], [2, 4]], // 11. Shallow dome
  [[1, 0], [0, 1], [1, 2], [0, 3], [1, 4]], // 12. Zigzag top
  [[1, 0], [2, 1], [1, 2], [2, 3], [1, 4]], // 13. Zigzag bottom
  [[0, 0], [1, 1], [0, 2], [1, 3], [0, 4]], // 14. Wave top
  [[2, 0], [1, 1], [2, 2], [1, 3], [2, 4]], // 15. Wave bottom
];

function evaluate5x3Lines(
  grid: string[][],
  sym3: Record<string, number>,
  sym4: Record<string, number>,
  sym5: Record<string, number>,
  winSet: Set<string>,
  wildSym?: string
): { total: number; hitWild: boolean; jackpotHit: boolean } {
  let total = 0;
  let hitWild = false;
  let jackpotHit = false;
  const maxSym = Object.keys(sym5).pop();

  for (const line of PAYLINES_5X3) {
    const syms = line.map(([r, c]) => grid[r]?.[c] ?? '');
    const baseSym = (wildSym ? syms.find((s) => s !== wildSym) : syms[0]) || syms[0];
    let len = 0;
    let lineHasWild = false;
    for (const s of syms) {
      if (s === baseSym || (wildSym && s === wildSym)) {
        len++;
        if (wildSym && s === wildSym) lineHasWild = true;
      } else {
        break;
      }
    }
    if (len >= 3) {
      let mult =
        len === 5 ? sym5[baseSym] || 15 : len === 4 ? sym4[baseSym] || 6 : sym3[baseSym] || 2;
      if (lineHasWild) {
        mult *= 1.5;
        hitWild = true;
      }
      total += mult;
      addCells(winSet, line.slice(0, len));
      if (len === 5 && baseSym === maxSym) jackpotHit = true;
    }
  }
  return { total, hitWild, jackpotHit };
}

function evaluateSlotGrid(gameId: SlotGameId, grid: string[][]): SlotEval {
  const winSet = new Set<string>();
  const rulesTriggered: string[] = [];
  let multiplier = 0;
  let jackpotHit = false;
  let lightningStrikes: LightningStrike[] | undefined;

  if (gameId === 'jungle_hunt') {
    const res = evaluate5x3Lines(
      grid,
      { '10': 1.2, J: 1.5, K: 2, '🐊': 3, '🐘': 4, '🦍': 6, '🦁': 10, WILD: 15 },
      { '10': 3, J: 4, K: 5.5, '🐊': 8, '🐘': 12, '🦍': 18, '🦁': 28, WILD: 40 },
      { '10': 8, J: 11, K: 15, '🐊': 22, '🐘': 32, '🦍': 45, '🦁': 75, WILD: 100 },
      winSet,
      'WILD'
    );
    multiplier += res.total;
    if (res.hitWild) rulesTriggered.push('تبديل WILD الأدغال (×1.5)');
    if (res.jackpotHit) jackpotHit = true;
  } else if (gameId === 'classic_fruits') {
    const res = evaluate5x3Lines(
      grid,
      { '🍒': 1.5, '🍋': 2, '🍇': 3, '🔔': 5, '⭐': 8, '7️⃣': 14 },
      { '🍒': 3.5, '🍋': 5, '🍇': 8, '🔔': 14, '⭐': 22, '7️⃣': 35 },
      { '🍒': 9, '🍋': 14, '🍇': 20, '🔔': 32, '⭐': 50, '7️⃣': 85 },
      winSet
    );
    multiplier += res.total;
    if (res.jackpotHit) jackpotHit = true;
    const midCherries: Array<[number, number]> = [];
    for (let c = 0; c < 5; c++) {
      if (grid[1][c] === '🍒') midCherries.push([1, c]);
    }
    if (midCherries.length >= 3) {
      multiplier += 2;
      addCells(winSet, midCherries);
      rulesTriggered.push('ثلاثي الكرز الذهبي (+×2)');
    }
  } else if (gameId === 'pharaoh_treasures') {
    const res = evaluate5x3Lines(
      grid,
      { '🏺': 1.5, '🐍': 2.5, '⚱️': 4, '☀️': 7, '👁️': 12, '🪲': 10 },
      { '🏺': 4, '🐍': 7, '⚱️': 11, '☀️': 18, '👁️': 30, '🪲': 24 },
      { '🏺': 10, '🐍': 16, '⚱️': 25, '☀️': 42, '👁️': 75, '🪲': 55 },
      winSet
    );
    multiplier += res.total;
    if (res.jackpotHit) jackpotHit = true;
    const scarabs: Array<[number, number]> = [];
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 5; c++) {
        if (grid[r][c] === '🪲') scarabs.push([r, c]);
      }
    }
    if (scarabs.length >= 3) {
      const bonus = scarabs.length >= 4 ? 18 : 6;
      multiplier += bonus;
      addCells(winSet, scarabs);
      rulesTriggered.push(`جعران متناثر ×${scarabs.length} (+×${bonus})`);
    }
  } else if (gameId === 'neon_galaxy') {
    const res = evaluate5x3Lines(
      grid,
      { '👾': 1.5, '☄️': 2.5, '🌌': 3.5, '🪐': 5.5, '🛸': 9, '⚡': 12 },
      { '👾': 4, '☄️': 7, '🌌': 10, '🪐': 15, '🛸': 24, '⚡': 30 },
      { '👾': 11, '☄️': 18, '🌌': 26, '🪐': 36, '🛸': 60, '⚡': 75 },
      winSet,
      '⚡'
    );
    multiplier += res.total;
    if (res.hitWild) rulesTriggered.push('مضاعف البرق الكوني ⚡');
    if (res.jackpotHit) jackpotHit = true;
  } else if (gameId === 'crown_jewels') {
    const res = evaluate5x3Lines(
      grid,
      { '🪙': 1.5, '⚜️': 2.5, '🏆': 4, '🦅': 7, '💎': 11, '👑': 18 },
      { '🪙': 4, '⚜️': 7, '🏆': 11, '🦅': 18, '💎': 28, '👑': 45 },
      { '🪙': 10, '⚜️': 16, '🏆': 26, '🦅': 42, '💎': 65, '👑': 100 },
      winSet
    );
    multiplier += res.total;
    if (res.jackpotHit) jackpotHit = true;
    for (let c = 0; c < 5; c++) {
      if (grid[0][c] === grid[1][c] && grid[1][c] === grid[2][c]) {
        const bonus = grid[0][c] === '👑' ? 10 : 3;
        multiplier += bonus;
        addCells(winSet, [[0, c], [1, c], [2, c]]);
        rulesTriggered.push(`عمود إمبراطوري مكتمل (+×${bonus})`);
      }
    }
  } else if (gameId === 'olympus_gates') {
    const counts = new Map<string, Array<[number, number]>>();
    const bolts: Array<[number, number]> = [];
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 5; c++) {
        const s = grid[r][c];
        if (s === '⚡') {
          bolts.push([r, c]);
        } else {
          const list = counts.get(s) || [];
          list.push([r, c]);
          counts.set(s, list);
        }
      }
    }
    const base5: Record<string, number> = { '🏛️': 1.5, '⏳': 2, '💍': 2.5, '🏆': 3.5, '👑': 5 };
    const base7: Record<string, number> = { '🏛️': 4, '⏳': 6, '💍': 8, '🏆': 11, '👑': 16 };
    const base9: Record<string, number> = { '🏛️': 12, '⏳': 16, '💍': 22, '🏆': 30, '👑': 45 };
    let baseWin = 0;
    for (const [sym, coords] of counts.entries()) {
      if (coords.length >= 5) {
        const m =
          coords.length >= 9
            ? base9[sym] || 15
            : coords.length >= 7
            ? base7[sym] || 6
            : base5[sym] || 2;
        baseWin += m;
        addCells(winSet, coords);
        if (coords.length >= 9 && sym === '👑') jackpotHit = true;
      }
    }
    if (baseWin > 0) {
      if (bolts.length > 0) {
        const strikeList: LightningStrike[] = bolts.map(([row, col]) => {
          const choices = [2, 3, 5, 8, 12, 15];
          const mult = choices[Math.floor(Math.random() * choices.length)];
          return { row, col, mult };
        });
        const totalLightning = strikeList.reduce((sum, s) => sum + s.mult, 0);
        multiplier = baseWin * totalLightning;
        lightningStrikes = strikeList;
        addCells(winSet, bolts);
        rulesTriggered.push(`صواعق زيوس ×${totalLightning}`);
      } else {
        multiplier = baseWin;
      }
    }
  } else if (gameId === 'sea_pirates') {
    const res = evaluate5x3Lines(
      grid,
      { '⚓': 1.5, '🧭': 2.5, '🦜': 3.5, '🏴‍☠️': 5.5, '💣': 4.5, '💰': 9 },
      { '⚓': 4, '🧭': 7, '🦜': 10, '🏴‍☠️': 16, '💣': 12, '💰': 24 },
      { '⚓': 12, '🧭': 18, '🦜': 26, '🏴‍☠️': 40, '💣': 28, '💰': 60 },
      winSet,
      '💰'
    );
    multiplier += res.total;
    if (res.jackpotHit) jackpotHit = true;
    const bombs: Array<[number, number]> = [];
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 5; c++) {
        if (grid[r][c] === '💣') bombs.push([r, c]);
      }
    }
    if (bombs.length >= 3) {
      const bonus = bombs.length >= 5 ? 16 : bombs.length === 4 ? 8 : 4;
      multiplier += bonus;
      addCells(winSet, bombs);
      rulesTriggered.push(`قصف المدافع ×${bombs.length} (+×${bonus})`);
    }
  } else if (gameId === 'turbo_racing') {
    const res = evaluate5x3Lines(
      grid,
      { '🛞': 1.5, '⛽': 2.5, '🏁': 4, '🏆': 6.5, '🔥': 5, '🏎️': 12 },
      { '🛞': 4, '⛽': 7, '🏁': 11, '🏆': 18, '🔥': 14, '🏎️': 32 },
      { '🛞': 10, '⛽': 16, '🏁': 25, '🏆': 42, '🔥': 35, '🏎️': 75 },
      winSet
    );
    multiplier += res.total;
    if (res.jackpotHit) jackpotHit = true;
    const cars: Array<[number, number]> = [];
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 5; c++) {
        if (grid[r][c] === '🏎️') cars.push([r, c]);
      }
    }
    if (cars.length >= 3) {
      const bonus = cars.length >= 4 ? 14 : 5;
      multiplier += bonus;
      addCells(winSet, cars);
      rulesTriggered.push(`انطلاقة سيارات متناثرة (+×${bonus})`);
    }
  } else if (gameId === 'desert_gold') {
    const res = evaluate5x3Lines(
      grid,
      { '🌴': 1.5, '🐪': 2.5, '🗡️': 4.5, '🏜️': 8, '🪔': 12, '🪙': 16 },
      { '🌴': 4, '🐪': 7, '🗡️': 12, '🏜️': 20, '🪔': 30, '🪙': 42 },
      { '🌴': 10, '🐪': 18, '🗡️': 28, '🏜️': 45, '🪔': 65, '🪙': 90 },
      winSet
    );
    multiplier += res.total;
    if (res.jackpotHit) jackpotHit = true;
    const coins: Array<[number, number]> = [];
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 5; c++) {
        if (grid[r][c] === '🪙') coins.push([r, c]);
      }
    }
    if (coins.length >= 3) {
      const bonus = coins.length >= 4 ? 12 : 3.5;
      multiplier += bonus;
      addCells(winSet, coins);
      rulesTriggered.push(`كنز الدنانير المتناثر (+×${bonus})`);
    }
    if (multiplier > 0 && grid[1][2] === '🪔') {
      multiplier *= 2;
      winSet.add('1-2');
      rulesTriggered.push('مصباح الواحة الأوسط (×2)');
    }
  }

  return {
    multiplier: Math.round(multiplier * 100) / 100,
    winningCells: parseCells(winSet),
    rulesTriggered,
    lightningStrikes,
    jackpotHit,
  };
}

function forceWinningGrid(gameId: SlotGameId, spec: SlotMachineSpec): string[][] {
  const g = generateGrid(spec);
  const sym = spec.symbols[Math.floor(Math.random() * Math.min(4, spec.symbols.length))];
  if (gameId === 'olympus_gates') {
    for (let c = 0; c < 5; c++) g[1][c] = sym;
  } else {
    for (let c = 0; c < 3; c++) g[1][c] = sym;
  }
  return g;
}

function forceLosingGrid(gameId: SlotGameId, spec: SlotMachineSpec): string[][] {
  const syms = spec.symbols.filter((s) => s !== '🪲' && s !== '💣' && s !== '🪙' && s !== '🏎️' && s !== '⚡' && s !== '💰');
  const pool = syms.length >= 3 ? syms : spec.symbols;
  return Array.from({ length: spec.rows }, (_, r) =>
    Array.from({ length: spec.cols }, (__, c) => pool[(r * 3 + c * 2 + (r === c ? 1 : 0)) % pool.length])
  );
}

async function fetchFreshUser(userId: string): Promise<User> {
  const { data, error } = await supabase
    .from('sada_users')
    .select(USER_COLUMNS)
    .eq('id', userId)
    .maybeSingle();
  if (error || !data) throw new Error('تعذّر تحميل رصيد العضو من Supabase.');
  return rowToUser(data);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseRoomGameRoundState(value: unknown): RoomGameRoundState {
  if (!isRecord(value) || !Array.isArray(value.bets)) {
    throw new Error('استجابة الجولة المشتركة غير صالحة.');
  }

  const isFiniteNumber = (item: unknown): item is number =>
    typeof item === 'number' && Number.isFinite(item);
  const resultValue = value.result;
  let result: RoomGameRoundOutcome | null = null;
  if (resultValue !== null) {
    if (
      isRecord(resultValue) &&
      isFiniteNumber(resultValue.number) &&
      (resultValue.color === 'red' || resultValue.color === 'black' || resultValue.color === 'green') &&
      isFiniteNumber(resultValue.wheel_index)
    ) {
      result = {
        number: resultValue.number,
        color: resultValue.color,
        wheelIndex: resultValue.wheel_index,
      };
    } else if (
      isRecord(resultValue) &&
      Array.isArray(resultValue.dice) &&
      resultValue.dice.every(isFiniteNumber) &&
      isFiniteNumber(resultValue.sum)
    ) {
      result = { dice: resultValue.dice, sum: resultValue.sum };
    } else {
      throw new Error('نتيجة الجولة المشتركة غير صالحة.');
    }
  }

  const bets = value.bets.map((betValue): RoomGameRoundBet => {
    if (!isRecord(betValue) || !isRecord(betValue.selection)) {
      throw new Error('بيانات رهان الجولة غير صالحة.');
    }
    const selection: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(betValue.selection)) {
      selection[key] = item;
    }
    if (
      typeof betValue.user_id !== 'string' ||
      typeof betValue.display_name !== 'string' ||
      !isFiniteNumber(betValue.amount) ||
      typeof betValue.is_winner !== 'boolean' ||
      !isFiniteNumber(betValue.multiplier) ||
      !isFiniteNumber(betValue.payout)
    ) {
      throw new Error('بيانات رهان الجولة غير صالحة.');
    }
    return {
      userId: betValue.user_id,
      displayName: betValue.display_name,
      amount: betValue.amount,
      selection,
      isWinner: betValue.is_winner,
      multiplier: betValue.multiplier,
      payout: betValue.payout,
    };
  });

  if (
    typeof value.round_id !== 'string' ||
    !isFiniteNumber(value.round_number) ||
    typeof value.started_at !== 'string' ||
    typeof value.betting_ends_at !== 'string' ||
    typeof value.round_ends_at !== 'string' ||
    typeof value.server_now !== 'string' ||
    (value.phase !== 'betting' && value.phase !== 'revealing')
  ) {
    throw new Error('بيانات الجولة المشتركة غير مكتملة.');
  }

  return {
    roundId: value.round_id,
    roundNumber: value.round_number,
    startedAt: value.started_at,
    bettingEndsAt: value.betting_ends_at,
    roundEndsAt: value.round_ends_at,
    serverNow: value.server_now,
    phase: value.phase,
    result,
    bets,
  };
}

export async function placeRoomGameBetInSupabase(
  roomId: string,
  gameKind: RoomGameKind,
  roundNumber: number,
  userId: string,
  amount: number,
  selection: RoomGameBetSelection
): Promise<RoomGameRoundState> {
  const { data, error } = await supabase.rpc('sada_place_room_game_bet', {
    p_room_id: roomId,
    p_game_kind: gameKind,
    p_round_number: roundNumber,
    p_user_id: userId,
    p_amount: amount,
    p_selection: selection,
  });
  if (error) {
    const message = `${error.code || ''} ${error.message || ''}`.toLowerCase();
    const missingFunction =
      message.includes('pgrst202') ||
      message.includes('schema cache') ||
      message.includes('could not find the function');
    if (!missingFunction) throw new Error(error.message || 'تعذّر تسجيل رهان الجولة.');
    return placeRoomGameBetFallback(
      roomId,
      gameKind,
      roundNumber,
      userId,
      amount,
      selection
    );
  }
  return parseRoomGameRoundState(data);
}

export async function getRoomGameRoundFromSupabase(
  roomId: string,
  gameKind: RoomGameKind,
  userId: string
): Promise<RoomGameRoundState> {
  const { data, error } = await supabase.rpc('sada_get_room_game_round', {
    p_room_id: roomId,
    p_game_kind: gameKind,
    p_user_id: userId,
  });
  if (error) throw new Error(error.message || 'تعذّر تحميل نتيجة جولة الغرفة.');
  return parseRoomGameRoundState(data);
}

export async function revealRoomGameRoundInSupabase(
  roomId: string,
  gameKind: RoomGameKind,
  roundNumber: number,
  userId: string
): Promise<void> {
  const { error } = await supabase.rpc('sada_reveal_room_game_round', {
    p_room_id: roomId,
    p_game_kind: gameKind,
    p_round_number: roundNumber,
    p_user_id: userId,
  });
  if (error) throw new Error(error.message || 'تعذّر إتمام تسوية جولة الغرفة.');
}

async function placeRoomGameBetFallback(
  roomId: string,
  gameKind: RoomGameKind,
  roundNumber: number,
  userId: string,
  amount: number,
  selection: RoomGameBetSelection
): Promise<RoomGameRoundState> {
  if (!Number.isInteger(amount) || amount < 10 || amount > 1_000_000) {
    throw new Error('قيمة الرهان يجب أن تكون بين 10 و1,000,000 كوين.');
  }
  const nowMs = Date.now();
  const startedAtMs = roundNumber * 20_000;
  const bettingEndsAtMs = startedAtMs + 15_000;
  if (nowMs >= bettingEndsAtMs || nowMs < startedAtMs) {
    throw new Error('انتهى وقت الرهان؛ انتظر الجولة التالية.');
  }

  const roundId = `${roomId}:${gameKind}:${roundNumber}`;
  const { data: existingRound, error: existingRoundError } = await supabase
    .from('sada_room_game_rounds')
    .select('id, started_at, betting_ends_at, round_ends_at, result')
    .eq('room_id', roomId)
    .eq('game_kind', gameKind)
    .eq('round_number', roundNumber)
    .maybeSingle();
  if (existingRoundError) throw new Error(existingRoundError.message);

  let round = existingRound;
  if (!round) {
    const { data: insertedRound, error: insertRoundError } = await supabase
      .from('sada_room_game_rounds')
      .upsert(
        {
          id: roundId,
          room_id: roomId,
          game_kind: gameKind,
          round_number: roundNumber,
          started_at: new Date(startedAtMs).toISOString(),
          betting_ends_at: new Date(bettingEndsAtMs).toISOString(),
          round_ends_at: new Date(startedAtMs + 20_000).toISOString(),
        },
        { onConflict: 'room_id,game_kind,round_number', ignoreDuplicates: true }
      )
      .select('id, started_at, betting_ends_at, round_ends_at, result')
      .maybeSingle();
    if (insertRoundError) throw new Error(insertRoundError.message);
    round = insertedRound;
  }
  if (!round || round.result !== null || Date.parse(round.betting_ends_at) <= nowMs) {
    throw new Error('انتهى وقت الرهان؛ انتظر الجولة التالية.');
  }

  const { data: userRow, error: userError } = await supabase
    .from('sada_users')
    .select('coins, display_name')
    .eq('id', userId)
    .single();
  if (userError || !userRow) {
    throw new Error(userError?.message || 'تعذّر تحميل رصيدك.');
  }
  const currentCoins = Number(userRow.coins);
  if (currentCoins < amount) throw new Error('رصيد الكوينز غير كافٍ.');

  const { data: updatedUser, error: balanceError } = await supabase
    .from('sada_users')
    .update({ coins: currentCoins - amount })
    .eq('id', userId)
    .eq('coins', currentCoins)
    .select('id')
    .maybeSingle();
  if (balanceError || !updatedUser) {
    throw new Error(balanceError?.message || 'تغيّر رصيدك؛ حدّثه ثم أعد المحاولة.');
  }

  const { error: insertBetError } = await supabase.from('sada_room_game_bets').insert({
    id: `room_bet_fallback_${roundId}_${userId}`,
    round_id: round.id,
    room_id: roomId,
    user_id: userId,
    display_name: String(userRow.display_name),
    amount,
    selection,
  });
  if (insertBetError) {
    const { error: refundError } = await supabase
      .from('sada_users')
      .update({ coins: currentCoins })
      .eq('id', userId)
      .eq('coins', currentCoins - amount);
    if (refundError) {
      throw new Error(
        `تعذّر تسجيل الرهان أو استعادة الرصيد تلقائياً: ${insertBetError.message}; ${refundError.message}`
      );
    }
    throw new Error(insertBetError.message || 'تعذّر تسجيل رهان الجولة.');
  }

  const { error: transactionError } = await supabase.from('sada_transactions').insert({
    id: `room_bet_fallback_tx_${roundId}_${userId}`,
    user_id: userId,
    type: 'game_bet',
    amount: -amount,
    currency: 'coins',
    description: `رهان جولة ألعاب الغرفة (${gameKind})`,
  });
  if (transactionError) {
    throw new Error(`تم تسجيل الرهان، لكن تعذّر تسجيل حركته المالية: ${transactionError.message}`);
  }

  const { data: bets, error: betsError } = await supabase
    .from('sada_room_game_bets')
    .select('user_id, display_name, amount, selection, is_winner, multiplier, payout')
    .eq('round_id', round.id)
    .order('created_at', { ascending: true });
  if (betsError) throw new Error(betsError.message);

  return parseRoomGameRoundState({
    round_id: round.id,
    round_number: roundNumber,
    started_at: round.started_at,
    betting_ends_at: round.betting_ends_at,
    round_ends_at: round.round_ends_at,
    server_now: new Date().toISOString(),
    phase: 'betting',
    result: null,
    bets: bets || [],
  });
}

export async function refreshGameUserFromSupabase(userId: string): Promise<User> {
  return fetchFreshUser(userId);
}

async function applyGameBalance(
  user: User,
  bet: number,
  payout: number,
  xpGain: number,
  betType: Transaction['type'],
  winType: Transaction['type'],
  betDesc: string,
  winDesc: string
): Promise<User> {
  const nextCoins = Math.max(0, user.coins - bet + payout);
  const nextXp = user.xp + xpGain;
  const nextLevel = computeLevelFromXp(nextXp);
  const now = new Date().toISOString();

  const { data: updated, error } = await supabase
    .from('sada_users')
    .update({
      coins: nextCoins,
      xp: nextXp,
      level: nextLevel,
      last_seen: now,
    })
    .eq('id', user.id)
    .select(USER_COLUMNS)
    .single();

  if (error || !updated) {
    throw new Error('تعذّر تحديث رصيدك في قاعدة البيانات.');
  }

  await recordTransaction({
    userId: user.id,
    type: betType,
    amount: -bet,
    currency: 'coins',
    description: betDesc,
    timestamp: now,
  });

  if (payout > 0) {
    await recordTransaction({
      userId: user.id,
      type: winType,
      amount: payout,
      currency: 'coins',
      description: winDesc,
      timestamp: now,
    });
  }

  return rowToUser(updated);
}

export async function settleGamePayoutInSupabase(
  userId: string,
  payout: number,
  winDesc: string,
  winType: Transaction['type'] = 'game_win'
): Promise<User> {
  if (!Number.isSafeInteger(payout) || payout < 0) {
    throw new Error('قيمة الجائزة غير صالحة.');
  }
  if (payout === 0) return fetchFreshUser(userId);

  const freshUser = await fetchFreshUser(userId);
  const now = new Date().toISOString();
  const { data: updated, error } = await supabase
    .from('sada_users')
    .update({ coins: freshUser.coins + payout, last_seen: now })
    .eq('id', userId)
    .select(USER_COLUMNS)
    .single();

  if (error || !updated) {
    throw new Error('توقفت الحركة، لكن تعذّر إضافة الجائزة إلى رصيدك.');
  }

  await recordTransaction({
    userId,
    type: winType,
    amount: payout,
    currency: 'coins',
    description: winDesc,
    timestamp: now,
  });

  return rowToUser(updated);
}

export async function spinSlotMachineInSupabase(
  userId: string,
  gameId: SlotGameId,
  betInput: number
): Promise<SpinResultPayload> {
  const bet = Math.floor(Number(betInput) || 0);
  if (bet < 10) throw new Error('الحد الأدنى للرهان 10 كوينز.');

  const spec = SLOT_SPECS[gameId];
  if (!spec) throw new Error('لعبة السلوت المطلوبة غير موجودة.');

  const freshUser = await fetchFreshUser(userId);
  if (freshUser.coins < bet) {
    throw new Error('رصيد الكوينز غير كافٍ لهذه الدورة.');
  }

  const roll = Math.random() * 100;
  const chosenGrid =
    roll < 72 ? forceLosingGrid(gameId, spec) : forceWinningGrid(gameId, spec);
  const evaluatedGrid = evaluateSlotGrid(gameId, chosenGrid);
  const multiplier =
    roll < 72
      ? 0
      : roll < 92
      ? 1.2 + Math.random() * 0.3
      : roll < 99
      ? 2 + Math.random()
      : 5 + Math.random() * 3;
  const chosenEval: SlotEval = {
    ...evaluatedGrid,
    multiplier,
    jackpotHit: roll >= 99,
    winningCells: multiplier > 0 ? evaluatedGrid.winningCells : [],
  };

  const payout = Math.round(bet * chosenEval.multiplier);
  const xpGain = Math.max(10, Math.round(bet * 0.08) + (payout > 0 ? 25 : 0));

  const updatedUser = await applyGameBalance(
    freshUser,
    bet,
    0,
    xpGain,
    'slot_spin',
    'slot_win',
    `رهان ${spec.title}`,
    `ربح ${spec.title} (×${chosenEval.multiplier})`
  );

  return {
    gameId,
    bet,
    grid: chosenGrid,
    cols: spec.cols,
    rows: spec.rows,
    multiplier: chosenEval.multiplier,
    payout,
    netDelta: payout - bet,
    xpGain,
    winningCells: chosenEval.winningCells,
    rulesTriggered: chosenEval.rulesTriggered,
    lightningStrikes: chosenEval.lightningStrikes,
    jackpotHit: chosenEval.jackpotHit,
    user: updatedUser,
  };
}

export async function playStandardDiceInSupabase(
  userId: string,
  gameId: 'double_dice' | 'prediction_dice' | 'speed_dice',
  betInput: number,
  pick: string
): Promise<DicePlayResponse> {
  const bet = Math.floor(Number(betInput) || 0);
  if (bet < 10) throw new Error('الحد الأدنى للرهان 10 كوينز.');

  const freshUser = await fetchFreshUser(userId);
  if (freshUser.coins < bet) throw new Error('رصيد الكوينز غير كافٍ.');

  const diceCount = gameId === 'double_dice' ? 2 : gameId === 'prediction_dice' ? 1 : 3;

  const evalDice = (dice: number[]): { won: boolean; multiplier: number; label: string } => {
    const sum = dice.reduce((a, b) => a + b, 0);
    if (gameId === 'double_dice') {
      if (pick === 'high') {
        const won = sum >= 8;
        return { won, multiplier: won ? 1.46 : 0, label: `مجموع النردين ${sum} (${won ? 'عالي ✓' : 'أقل من 8'})` };
      }
      if (pick === 'low') {
        const won = sum <= 6;
        return { won, multiplier: won ? 1.46 : 0, label: `مجموع النردين ${sum} (${won ? 'منخفض ✓' : 'أعلى من 6'})` };
      }
      if (pick === 'seven') {
        const won = sum === 7;
        return { won, multiplier: won ? 3.15 : 0, label: `مجموع النردين ${sum} (${won ? 'السبعة الذهبية ✓' : 'لم تصب 7'})` };
      }
      const won = dice[0] === dice[1];
      return { won, multiplier: won ? 3.6 : 0, label: won ? `تطابق رائع (${dice[0]}-${dice[1]})!` : `النردان (${dice[0]}-${dice[1]})` };
    }
    if (gameId === 'prediction_dice') {
      const val = dice[0];
      if (pick === 'even') {
        const won = val % 2 === 0;
        return { won, multiplier: won ? 1.75 : 0, label: `النتيجة ${val} (${val % 2 === 0 ? 'زوجي' : 'فردي'})` };
      }
      if (pick === 'odd') {
        const won = val % 2 === 1;
        return { won, multiplier: won ? 1.75 : 0, label: `النتيجة ${val} (${val % 2 === 1 ? 'فردي' : 'زوجي'})` };
      }
      const target = Number(pick.replace('exact_', '')) || 6;
      const won = val === target;
      return { won, multiplier: won ? 3.9 : 0, label: `ظهر الرقم ${val} (توقعك: ${target})` };
    }
    // speed_dice
    if (pick === 'under_10') {
      const won = sum <= 10;
      return { won, multiplier: won ? 1.43 : 0, label: `مجموع السرعة ${sum}` };
    }
    if (pick === 'over_11') {
      const won = sum >= 11;
      return { won, multiplier: won ? 1.43 : 0, label: `مجموع السرعة ${sum}` };
    }
    if (pick === 'lucky_16') {
      const won = sum >= 16;
      return { won, multiplier: won ? 3.38 : 0, label: `مجموع السرعة ${sum}` };
    }
    const won = dice[0] === dice[1] && dice[1] === dice[2];
    return { won, multiplier: won ? 9 : 0, label: won ? `ثلاثية متطابقة (${dice[0]})!` : `النتائج ${dice.join(' - ')}` };
  };

  const chosenDice = Array.from({ length: diceCount }, () => 1 + Math.floor(Math.random() * 6));
  const outcome = evalDice(chosenDice);

  const payout = Math.round(bet * outcome.multiplier);
  const xpGain = Math.max(8, Math.round(bet * 0.06) + (outcome.won ? 20 : 0));

  const titleMap: Record<string, string> = {
    double_dice: 'نرد الحظ المزدوج',
    prediction_dice: 'نرد التوقعات',
    speed_dice: 'نرد السرعة',
  };

  const updatedUser = await applyGameBalance(
    freshUser,
    bet,
    0,
    xpGain,
    'game_bet',
    'game_win',
    `رهان ${titleMap[gameId]}`,
    `فوز ${titleMap[gameId]} (×${outcome.multiplier})`
  );

  return {
    gameId,
    bet,
    dice: chosenDice,
    won: outcome.won,
    multiplier: outcome.multiplier,
    payout,
    xpGain,
    label: outcome.label,
    user: updatedUser,
  };
}

export async function getLadderStateFromSupabase(
  userId: string
): Promise<LadderSession | null> {
  const state = await getPlatformState();
  return state.ladderSessions[userId] || null;
}

export async function playLadderActionInSupabase(
  userId: string,
  action: 'roll' | 'cashout',
  betInput: number
): Promise<LadderActionResponse> {
  const [freshUser, state] = await Promise.all([
    fetchFreshUser(userId),
    getPlatformState(),
  ]);
  const ladderSessions = { ...(state.ladderSessions || {}) };
  let session = ladderSessions[userId] || null;

  if (action === 'cashout') {
    if (!session || session.step <= 0) {
      throw new Error('لا توجد جولة سلم نشطة لسحب أرباحها.');
    }
    const payout = Math.round(session.bet * session.currentMultiplier);
    const mult = session.currentMultiplier;
    const step = session.step;
    delete ladderSessions[userId];
    await savePlatformState({ ladderSessions });

    const nextCoins = freshUser.coins + payout;
    const nextXp = freshUser.xp + 25;
    const { data: updated } = await supabase
      .from('sada_users')
      .update({
        coins: nextCoins,
        xp: nextXp,
        level: computeLevelFromXp(nextXp),
      })
      .eq('id', userId)
      .select(USER_COLUMNS)
      .single();

    await recordTransaction({
      userId,
      type: 'game_win',
      amount: payout,
      currency: 'coins',
      description: `تأمين وسحب أرباح نرد السلم (الدرجة ${step} ×${mult})`,
    });

    return {
      status: 'cashed_out',
      payout,
      multiplier: mult,
      step,
      die: 6,
      session: null,
      message: `تم تأمين أرباحك وسحب +${payout.toLocaleString('en-US')} كوينز بنجاح!`,
      user: updated ? rowToUser(updated) : { ...freshUser, coins: nextCoins },
    };
  }

  // Action === 'roll'
  let workingUser = freshUser;
  if (!session) {
    const bet = Math.floor(Number(betInput) || 0);
    if (bet < 10) throw new Error('الحد الأدنى للرهان 10 كوينز.');
    if (freshUser.coins < bet) throw new Error('رصيد الكوينز غير كافٍ.');

    const nextCoins = freshUser.coins - bet;
    const { data: deducted } = await supabase
      .from('sada_users')
      .update({ coins: nextCoins })
      .eq('id', userId)
      .select(USER_COLUMNS)
      .single();
    if (deducted) workingUser = rowToUser(deducted);
    await recordTransaction({
      userId,
      type: 'game_bet',
      amount: -bet,
      currency: 'coins',
      description: 'بدء تحدي نرد السلم التفاعلي',
    });
    session = { bet, step: 0, currentMultiplier: 1 };
  }

  const winRate = Math.max(15, Math.min(92, Number(state.settings.gameRates?.ladderDiceWinRate ?? 58)));
  const safeClimb = Math.random() * 100 < winRate;
  const die = safeClimb ? 2 + Math.floor(Math.random() * 5) : 1;

  if (die === 1) {
    delete ladderSessions[userId];
    await savePlatformState({ ladderSessions });
    return {
      status: 'fell',
      payout: 0,
      multiplier: 0,
      step: 0,
      die,
      session: null,
      message: 'ظهر الرقم 1! سقطت من السلم — يمكنك بدء جولة جديدة.',
      user: workingUser,
    };
  }

  const jump = die === 6 ? 2 : 1;
  const nextStep = Math.min(5, session.step + jump);
  const nextMult = LADDER_MULTIPLIERS[nextStep] || 12;

  if (nextStep >= 5) {
    const payout = Math.round(session.bet * 12);
    delete ladderSessions[userId];
    await savePlatformState({ ladderSessions });

    const nextCoins = workingUser.coins + payout;
    const nextXp = workingUser.xp + 60;
    const { data: updated } = await supabase
      .from('sada_users')
      .update({
        coins: nextCoins,
        xp: nextXp,
        level: computeLevelFromXp(nextXp),
      })
      .eq('id', userId)
      .select(USER_COLUMNS)
      .single();

    await recordTransaction({
      userId,
      type: 'game_win',
      amount: payout,
      currency: 'coins',
      description: 'بلوغ قمة نرد السلم التفاعلي (×12)',
    });

    return {
      status: 'summit',
      payout,
      multiplier: 12,
      step: 5,
      die,
      session: null,
      message: `القمة الملكية! وصلت للدرجة 5 وربحت +${payout.toLocaleString('en-US')} كوينز!`,
      user: updated ? rowToUser(updated) : { ...workingUser, coins: nextCoins },
    };
  }

  const nextSession: LadderSession = {
    bet: session.bet,
    step: nextStep,
    currentMultiplier: nextMult,
  };
  ladderSessions[userId] = nextSession;
  await savePlatformState({ ladderSessions });

  return {
    status: 'climbed',
    payout: 0,
    multiplier: nextMult,
    step: nextStep,
    die,
    session: nextSession,
    message:
      die === 6
        ? `قفزة مزدوجة بالرقم 6! وصلت للدرجة ${nextStep} (×${nextMult}).`
        : `صعدت للدرجة ${nextStep} بنجاح! المضاعف الحالي ×${nextMult}.`,
    user: workingUser,
  };
}

export async function spinRouletteInSupabase(
  userId: string,
  betInput: number,
  selections: Array<{ betType: RouletteBetType; targetNumber?: number }>
): Promise<RouletteSpinResponse> {
  const amountPerSelection = Math.floor(Number(betInput) || 0);
  if (amountPerSelection < 10) throw new Error('الحد الأدنى للرهان 10 كوينز.');
  if (selections.length === 0) throw new Error('اختر رهاناً واحداً على الأقل.');
  const bet = amountPerSelection * selections.length;

  const freshUser = await fetchFreshUser(userId);
  if (freshUser.coins < bet) throw new Error('رصيد الكوينز غير كافٍ.');

  const payoutForNumber = (n: number): number =>
    selections.reduce((total, selection) => {
      let multiplier = 0;
      if (selection.betType === 'zero' && n === 0) multiplier = 21;
      else if (
        selection.betType === 'straight' &&
        n === Math.max(1, Math.min(36, Math.floor(Number(selection.targetNumber) || 7)))
      ) multiplier = 28;
      else if (n !== 0 && selection.betType === 'red' && ROULETTE_REDS.has(n)) multiplier = 1.75;
      else if (n !== 0 && selection.betType === 'black' && !ROULETTE_REDS.has(n)) multiplier = 1.75;
      else if (n !== 0 && selection.betType === 'even' && n % 2 === 0) multiplier = 1.75;
      else if (n !== 0 && selection.betType === 'odd' && n % 2 === 1) multiplier = 1.75;
      else if (selection.betType === 'dozen_1' && n >= 1 && n <= 12) multiplier = 2.25;
      else if (selection.betType === 'dozen_2' && n >= 13 && n <= 24) multiplier = 2.25;
      else if (selection.betType === 'dozen_3' && n >= 25 && n <= 36) multiplier = 2.25;
      return total + Math.round(amountPerSelection * multiplier);
    }, 0);

  const payouts = ROULETTE_WHEEL_ORDER.map((number) => ({
    number,
    payout: payoutForNumber(number),
  }));
  const winningNumber = payouts[Math.floor(Math.random() * payouts.length)].number;
  const wheelIndex = ROULETTE_WHEEL_ORDER.indexOf(winningNumber);
  const winningColor: 'red' | 'black' | 'green' =
    winningNumber === 0 ? 'green' : ROULETTE_REDS.has(winningNumber) ? 'red' : 'black';

  const payout = payoutForNumber(winningNumber);
  const evalRes = { won: payout > 0, multiplier: payout / bet };
  const xpGain = Math.max(10, Math.round(bet * 0.07) + (evalRes.won ? 25 : 0));

  const updatedUser = await applyGameBalance(
    freshUser,
    bet,
    0,
    xpGain,
    'game_bet',
    'game_win',
    `رهانات الروليت الملكية (${selections.length} خيارات)`,
    `ربح الروليت الملكية #${winningNumber} (×${evalRes.multiplier})`
  );

  return {
    winningNumber,
    winningColor,
    wheelIndex,
    won: evalRes.won,
    multiplier: evalRes.multiplier,
    payout,
    bet,
    xpGain,
    user: updatedUser,
  };
}

export async function openMysteryBoxInSupabase(
  userId: string,
  betInput: number,
  boxIndexInput: number
): Promise<MysteryBoxResponse> {
  const bet = Math.floor(Number(betInput) || 0);
  const chosenIndex = Math.max(0, Math.min(8, Math.floor(Number(boxIndexInput) || 0)));
  if (bet < 10) throw new Error('الحد الأدنى للرهان 10 كوينز.');

  const [freshUser, state] = await Promise.all([
    fetchFreshUser(userId),
    getPlatformState(),
  ]);
  if (freshUser.coins < bet) throw new Error('رصيد الكوينز غير كافٍ.');

  const winRatePct = Math.max(
    5,
    Math.min(95, Number(state.settings.gameRates?.mysteryBoxWinRate ?? 42))
  );
  const wantWin = Math.random() * 100 < winRatePct;

  const prizeTiers = [
    { multiplier: 12, label: 'التاج الأعظم', glyph: '👑' },
    { multiplier: 5, label: 'جوهرة القصر', glyph: '💎' },
    { multiplier: 3, label: 'سبائك الذهب', glyph: '🏆' },
    { multiplier: 2, label: 'حقيبة الكوينز', glyph: '💰' },
    { multiplier: 1.5, label: 'بريق السعد', glyph: '✨' },
    { multiplier: 0, label: 'صندوق فارغ', glyph: '💨' },
    { multiplier: 0, label: 'صندوق فارغ', glyph: '💨' },
    { multiplier: 0, label: 'صندوق فارغ', glyph: '💨' },
    { multiplier: 0, label: 'صندوق فارغ', glyph: '💨' },
  ];

  // Shuffle display items
  const shuffled = [...prizeTiers].sort(() => Math.random() - 0.5);
  const chosenSlot = shuffled[chosenIndex];
  if (wantWin && chosenSlot.multiplier === 0) {
    const winIdx = shuffled.findIndex((p) => p.multiplier > 0);
    if (winIdx !== -1) {
      [shuffled[chosenIndex], shuffled[winIdx]] = [shuffled[winIdx], shuffled[chosenIndex]];
    }
  } else if (!wantWin && chosenSlot.multiplier > 0) {
    const loseIdx = shuffled.findIndex((p) => p.multiplier === 0);
    if (loseIdx !== -1) {
      [shuffled[chosenIndex], shuffled[loseIdx]] = [shuffled[loseIdx], shuffled[chosenIndex]];
    }
  }

  const boxes: MysteryBoxItem[] = shuffled.map((p, idx) => ({
    index: idx,
    multiplier: p.multiplier,
    coins: Math.round(bet * p.multiplier),
    label: p.label,
    glyph: p.glyph,
    isChosen: idx === chosenIndex,
  }));

  const chosen = boxes[chosenIndex];
  const won = chosen.multiplier > 0;
  const payout = chosen.coins;
  const xpGain = Math.max(8, Math.round(bet * 0.06) + (won ? 20 : 0));

  const updatedUser = await applyGameBalance(
    freshUser,
    bet,
    payout,
    xpGain,
    'game_bet',
    'game_win',
    `فتح صندوق الحظ #${chosenIndex + 1}`,
    `كنز صندوق الحظ #${chosenIndex + 1} (×${chosen.multiplier})`
  );

  return {
    chosenIndex,
    boxes,
    won,
    multiplier: chosen.multiplier,
    payout,
    bet,
    xpGain,
    user: updatedUser,
  };
}

export function genGameLogId(): string {
  return genId('game');
}

export async function getRealJackpotPoolFromSupabase(): Promise<number> {
  const state = await getPlatformState();
  return Math.max(0, Number(state.appPrizePoolCoins || 0));
}

export type RpsMove = 'rock' | 'paper' | 'scissors';

export interface RpsPlayResponse {
  playerMove: RpsMove;
  botMove: RpsMove;
  outcome: 'win' | 'draw' | 'lose';
  multiplier: number;
  bet: number;
  payout: number;
  xpGain: number;
  user: User;
}

const RPS_WIN_MAP: Record<RpsMove, RpsMove> = {
  rock: 'scissors',
  paper: 'rock',
  scissors: 'paper',
};

export async function playRpsInSupabase(
  userId: string,
  betInput: number,
  playerMove: RpsMove
): Promise<RpsPlayResponse> {
  const bet = Math.floor(Number(betInput) || 0);
  if (bet < 10) throw new Error('الحد الأدنى للرهان 10 كوينز.');

  const freshUser = await fetchFreshUser(userId);
  if (freshUser.coins < bet) throw new Error('رصيد الكوينز غير كافٍ.');

  const moves: RpsMove[] = ['rock', 'paper', 'scissors'];
  const botMove = moves[Math.floor(Math.random() * moves.length)];
  const outcome =
    botMove === playerMove
      ? 'draw'
      : botMove === RPS_WIN_MAP[playerMove]
      ? 'win'
      : 'lose';

  const multiplier = outcome === 'win' ? 1.8 : outcome === 'draw' ? 1 : 0;
  const payout = Math.round(bet * multiplier);
  const xpGain = Math.max(8, Math.round(bet * 0.06) + (outcome === 'win' ? 20 : 0));

  const updatedUser = await applyGameBalance(
    freshUser,
    bet,
    0,
    xpGain,
    'game_bet',
    'game_win',
    'رهان حجر ورقة مقص 3D',
    outcome === 'win'
      ? `فوز حجر ورقة مقص 3D (×${multiplier})`
      : 'تعادل حجر ورقة مقص 3D (استرداد الرهان)'
  );

  return {
    playerMove,
    botMove,
    outcome,
    multiplier,
    bet,
    payout,
    xpGain,
    user: updatedUser,
  };
}

export async function getHallOfFameFromSupabase(): Promise<User[]> {
  const { data, error } = await supabase
    .from('sada_users')
    .select(USER_COLUMNS)
    .order('xp', { ascending: false })
    .limit(12);
  if (error || !data) return [];
  return data.map((row) => rowToUser(row));
}
