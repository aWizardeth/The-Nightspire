// ─────────────────────────────────────────────────────────────────────────────
//  Tier System — 5-tier PvE gym progression for Arcane BOW
//  Ported from bow-app/app/lib/tiers.ts
// ─────────────────────────────────────────────────────────────────────────────

export interface TierInfo {
  tier:           number;
  name:           string;
  title:          string;
  bossName:       string;
  description:    string;
  requiredBadge:  string | null;
  bossStats:      { hp: number; atk: number; def: number; spd: number };
  bossStrength:   string;
  bossWeakness:   string;
  bossRarity:     string;
  bossEffect?:    string;
  playerStatCaps: { hp: number; atk: number; def: number; spd: number };
  aiDifficulty:   string;
  badge:          { name: string; tier: number; imageUri: string; description: string };
  color:          string;
  emoji:          string;
}

export const TIERS: TierInfo[] = [
  {
    tier: 1, name: 'Apprentice', title: 'Apprentice Guardian',
    bossName:    'Grimshaw the Flicker',
    description: 'A timid conjurer who barely controls his own sparks. Perfect for newcomers.',
    requiredBadge: null,
    bossStats:     { hp: 80, atk: 10, def: 8, spd: 8 },
    bossStrength:  'Fire', bossWeakness: 'Water', bossRarity: 'Common',
    playerStatCaps: { hp: 120, atk: 20, def: 15, spd: 20 },
    aiDifficulty: 'easy',
    badge: { name: 'Apprentice Badge', tier: 1, imageUri: '/badges/tier1.png', description: 'Defeated Grimshaw the Flicker.' },
    color: 'from-slate-400 to-slate-600', emoji: '🥉',
  },
  {
    tier: 2, name: 'Adept', title: 'Adept Spellbinder',
    bossName:    'Vyrenna Shadowveil',
    description: 'A cunning sorceress who weaves shadow and illusion. Bring your wits.',
    requiredBadge: 'tier-1-badge',
    bossStats:     { hp: 100, atk: 15, def: 12, spd: 14 },
    bossStrength:  'Shadow', bossWeakness: 'Spirit', bossRarity: 'Uncommon',
    playerStatCaps: { hp: 130, atk: 25, def: 20, spd: 25 },
    aiDifficulty: 'medium',
    badge: { name: 'Adept Badge', tier: 2, imageUri: '/badges/tier2.png', description: 'Defeated Vyrenna Shadowveil.' },
    color: 'from-green-400 to-green-700', emoji: '🥈',
  },
  {
    tier: 3, name: 'Master', title: 'Master Warden',
    bossName:    'Thalrok Ironhex',
    description: "An ancient battle-mage encased in arcane armor. Brute force won't cut it.",
    requiredBadge: 'tier-2-badge',
    bossStats:     { hp: 120, atk: 18, def: 18, spd: 12 },
    bossStrength:  'Corruption', bossWeakness: 'Nature', bossRarity: 'Rare',
    playerStatCaps: { hp: 140, atk: 30, def: 25, spd: 30 },
    aiDifficulty: 'hard',
    badge: { name: 'Master Badge', tier: 3, imageUri: '/badges/tier3.png', description: 'Defeated Thalrok Ironhex.' },
    color: 'from-blue-400 to-blue-700', emoji: '🥇',
  },
  {
    tier: 4, name: 'Archmage', title: 'Archmage of the Void',
    bossName:    'Xelaris the Unbound',
    description: 'Reality bends around Xelaris. Every move is a gamble against fate itself.',
    requiredBadge: 'tier-3-badge',
    bossStats:     { hp: 130, atk: 22, def: 15, spd: 20 },
    bossStrength:  'Exile', bossWeakness: 'Corruption', bossRarity: 'Rare',
    bossEffect:    'Void Rift — 10% chance to nullify incoming damage',
    playerStatCaps: { hp: 145, atk: 35, def: 28, spd: 35 },
    aiDifficulty: 'brutal',
    badge: { name: 'Archmage Badge', tier: 4, imageUri: '/badges/tier4.png', description: 'Defeated Xelaris the Unbound.' },
    color: 'from-purple-400 to-purple-700', emoji: '👑',
  },
  {
    tier: 5, name: 'Overlord', title: 'Overlord of Ashes',
    bossName:    'Malachar, the Ashen King',
    description: 'The final boss. Malachar has conquered death itself. Legends are forged here.',
    requiredBadge: 'tier-4-badge',
    bossStats:     { hp: 150, atk: 28, def: 20, spd: 18 },
    bossStrength:  'Corruption', bossWeakness: 'Spirit', bossRarity: 'Legendary',
    bossEffect:    'Ashen Rebirth — once per battle, revives with 20 HP on lethal damage',
    playerStatCaps: { hp: 150, atk: 40, def: 30, spd: 40 },
    aiDifficulty: 'nightmare',
    badge: { name: 'Overlord Badge', tier: 5, imageUri: '/badges/tier5.png', description: 'Defeated Malachar, the Ashen King.' },
    color: 'from-red-500 to-yellow-600', emoji: '🔥',
  },
];

export function getTierInfo(tier: number): TierInfo | undefined {
  return TIERS.find(t => t.tier === tier);
}

export const DIFFICULTY_LABELS: Record<string, { label: string; color: string }> = {
  easy:      { label: 'Easy',      color: '#4caf50' },
  medium:    { label: 'Medium',    color: '#ffd600' },
  hard:      { label: 'Hard',      color: '#ff9800' },
  brutal:    { label: 'Brutal',    color: '#f44336' },
  nightmare: { label: 'Nightmare', color: '#9c27b0' },
};
