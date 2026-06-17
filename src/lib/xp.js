export const RANK_NAMES = [
  'Gold Cook', 'Emerald Cook', 'Diamond Cook',
  'Chef', 'Exec Chef', 'Master Chef', 'World Class Chef',
];
export const TIER_NAMES = ['I', 'II', 'III'];

export const RANK_COLORS = {
  'Gold Cook':        '#FFB800',
  'Emerald Cook':     '#00C47A',
  'Diamond Cook':     '#88CCFF',
  'Chef':             '#E8001C',
  'Exec Chef':        '#A855F7',
  'Master Chef':      '#FF6B00',
  'World Class Chef': '#FFFFFF',
};

// Cumulative XP thresholds for each of the 21 levels (7 ranks × 3 tiers)
// ~3/5/10 cook milestones for early ranks; gaps grow ~20% per step; max rank ≈ 1,150 cooks
export const XP_THRESHOLDS = [
  0, 360, 600,             // Gold Cook I, II, III      (3 / 5 cooks)
  1200, 2400, 3800,        // Emerald Cook I, II, III   (10 / 20 / 32 cooks)
  5600, 7800, 10500,       // Diamond Cook I, II, III   (47 / 65 / 87 cooks)
  13500, 17400, 22000,     // Chef I, II, III           (113 / 145 / 183 cooks)
  27500, 34000, 42000,     // Exec Chef I, II, III      (229 / 284 / 350 cooks)
  52000, 63000, 77000,     // Master Chef I, II, III    (430 / 526 / 641 cooks)
  93500, 113500, 137500,   // World Class Chef I, II, III (779 / 945 / 1145 cooks)
];

const MAX_LEVEL = XP_THRESHOLDS.length - 1; // 20

export function rankFromXp(xp) {
  const safe = Math.max(0, xp ?? 0);
  let idx = 0;
  for (let i = 0; i < XP_THRESHOLDS.length; i++) {
    if (safe >= XP_THRESHOLDS[i]) idx = i;
    else break;
  }
  return {
    rank: RANK_NAMES[Math.floor(idx / 3)],
    tier: TIER_NAMES[idx % 3],
    levelIdx: idx,
  };
}

// XP progress within the current level: { current, needed, pct }
export function xpProgress(xp) {
  const safe = Math.max(0, xp ?? 0);
  const { levelIdx } = rankFromXp(safe);
  if (levelIdx === MAX_LEVEL) return { current: 0, needed: 0, pct: 100 };
  const start = XP_THRESHOLDS[levelIdx];
  const end = XP_THRESHOLDS[levelIdx + 1];
  const current = safe - start;
  const needed = end - start;
  return { current, needed, pct: Math.min((current / needed) * 100, 100) };
}

// Estimated cooks remaining to reach the next level
export function cooksToNextLevel(xp, baseXpPerCook = 120) {
  const safe = Math.max(0, xp ?? 0);
  const { levelIdx } = rankFromXp(safe);
  if (levelIdx === MAX_LEVEL) return 0;
  const remaining = XP_THRESHOLDS[levelIdx + 1] - safe;
  return Math.ceil(remaining / baseXpPerCook);
}

export function nextLevelName(xp) {
  const safe = Math.max(0, xp ?? 0);
  const { levelIdx } = rankFromXp(safe);
  if (levelIdx === MAX_LEVEL) return null;
  const nextIdx = levelIdx + 1;
  return `${RANK_NAMES[Math.floor(nextIdx / 3)]} ${TIER_NAMES[nextIdx % 3]}`;
}
