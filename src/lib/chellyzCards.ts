/**
 * chellyzCards.ts
 * Card definitions, types, and deck-building for the Chellyz game mode.
 * Completely separate from the BOW battle engine.
 *
 * Layout reminder (player perspective):
 *   [Draw Deck]  [EB Deck]
 *   [Support]  [Active]  [Energy Zone]
 *   [Bench 0]  [Bench 1]  [Bench 2]
 *   ── Hand ──────────────────────────
 */

import type { NFTData } from '../store/bowActivityStore';

// ─── Element types ────────────────────────────────────────────────────────────

export type ChellyzElement =
  | 'Fire' | 'Water' | 'Nature' | 'Electric'
  | 'Shadow' | 'Ice' | 'Spirit' | 'Arcane'
  | 'Corruption' | 'Neutral';

export type CardType =
  | 'chelly_l1' | 'chelly_l2' | 'chelly_l3' | 'universal_chelly'
  | 'memory_artifact' | 'flash_relic' | 'energy_bloom';

export type EvolutionFamily =
  | 'ember' | 'tide' | 'bloom' | 'spark' | 'shade'
  | 'frost' | 'wisp' | 'arcane' | 'void' | 'neutral';

// ─── Card interfaces ──────────────────────────────────────────────────────────

export interface ChellyStats {
  hp:          number;
  maxHp:       number;
  atk:         number;
  def:         number;
  spd:         number;
  specialDmg:  number;  // special attack base damage
  specialCost: number;  // EB required to use special
}

export interface ChellyzCard {
  /** Unique instance ID — every copy gets a fresh UUID */
  instanceId:      string;
  /** Template key shared by copies of the same card */
  definitionKey:   string;
  type:            CardType;
  name:            string;
  element:         ChellyzElement;
  level?:          1 | 2 | 3 | 'universal';
  evolutionFamily?: EvolutionFamily;
  /** Stat block (only Chellyz have stats) */
  stats?:          ChellyStats;
  /** Current HP: carried to active/bench, starts at maxHp */
  currentHp?:      number;
  /** Memory Artifact / Flash Relic effect */
  effectText?:     string;
  /** Flash Relics activate instantly (vs Memory Artifacts that stage) */
  isFlashRelic?:   boolean;
  /** Art URI (NFT image or generated placeholder) */
  imageUri?:       string;
  /** Source NFT ID if card was created from wallet NFT */
  nftId?:          string;
  /** Starter cards are weaker than NFT-sourced cards */
  isStarter?:      boolean;
}

// ─── Card definition templates ────────────────────────────────────────────────

export interface CardDefinition {
  definitionKey:   string;
  type:            CardType;
  name:            string;
  element:         ChellyzElement;
  level?:          1 | 2 | 3 | 'universal';
  evolutionFamily?: EvolutionFamily;
  stats?:          Omit<ChellyStats, 'maxHp'>;  // maxHp = hp
  effectText?:     string;
  isFlashRelic?:   boolean;
}

// ─── Starter card definitions ─────────────────────────────────────────────────

export const CARD_DEFINITIONS: Record<string, CardDefinition> = {
  // ── EMBER FAMILY (Fire) ────────────────────────────────────
  ember_l1: {
    definitionKey: 'ember_l1',
    type: 'chelly_l1',
    name: 'Emberling',
    element: 'Fire',
    level: 1,
    evolutionFamily: 'ember',
    stats: { hp: 60, atk: 20, def: 10, spd: 14, specialDmg: 35, specialCost: 2 },
  },
  ember_l2: {
    definitionKey: 'ember_l2',
    type: 'chelly_l2',
    name: 'Emberclaw',
    element: 'Fire',
    level: 2,
    evolutionFamily: 'ember',
    stats: { hp: 90, atk: 30, def: 15, spd: 16, specialDmg: 50, specialCost: 3 },
  },
  ember_l3: {
    definitionKey: 'ember_l3',
    type: 'chelly_l3',
    name: 'Emberlord',
    element: 'Fire',
    level: 3,
    evolutionFamily: 'ember',
    stats: { hp: 130, atk: 45, def: 20, spd: 18, specialDmg: 70, specialCost: 3 },
  },

  // ── TIDE FAMILY (Water) ────────────────────────────────────
  tide_l1: {
    definitionKey: 'tide_l1',
    type: 'chelly_l1',
    name: 'Tidekin',
    element: 'Water',
    level: 1,
    evolutionFamily: 'tide',
    stats: { hp: 70, atk: 15, def: 18, spd: 12, specialDmg: 30, specialCost: 2 },
  },
  tide_l2: {
    definitionKey: 'tide_l2',
    type: 'chelly_l2',
    name: 'Tidesworn',
    element: 'Water',
    level: 2,
    evolutionFamily: 'tide',
    stats: { hp: 100, atk: 25, def: 25, spd: 14, specialDmg: 45, specialCost: 3 },
  },
  tide_l3: {
    definitionKey: 'tide_l3',
    type: 'chelly_l3',
    name: 'Tidalwave',
    element: 'Water',
    level: 3,
    evolutionFamily: 'tide',
    stats: { hp: 140, atk: 38, def: 30, spd: 16, specialDmg: 60, specialCost: 3 },
  },

  // ── BLOOM FAMILY (Nature) ──────────────────────────────────
  bloom_l1: {
    definitionKey: 'bloom_l1',
    type: 'chelly_l1',
    name: 'Sproutlet',
    element: 'Nature',
    level: 1,
    evolutionFamily: 'bloom',
    stats: { hp: 80, atk: 14, def: 20, spd: 10, specialDmg: 28, specialCost: 2 },
  },
  bloom_l2: {
    definitionKey: 'bloom_l2',
    type: 'chelly_l2',
    name: 'Bloomwarden',
    element: 'Nature',
    level: 2,
    evolutionFamily: 'bloom',
    stats: { hp: 115, atk: 22, def: 28, spd: 12, specialDmg: 42, specialCost: 3 },
  },
  bloom_l3: {
    definitionKey: 'bloom_l3',
    type: 'chelly_l3',
    name: 'Verdant Titan',
    element: 'Nature',
    level: 3,
    evolutionFamily: 'bloom',
    stats: { hp: 160, atk: 32, def: 38, spd: 14, specialDmg: 55, specialCost: 3 },
  },

  // ── SPARK FAMILY (Electric) ────────────────────────────────
  spark_l1: {
    definitionKey: 'spark_l1',
    type: 'chelly_l1',
    name: 'Sparklet',
    element: 'Electric',
    level: 1,
    evolutionFamily: 'spark',
    stats: { hp: 55, atk: 22, def: 8, spd: 18, specialDmg: 40, specialCost: 2 },
  },
  spark_l2: {
    definitionKey: 'spark_l2',
    type: 'chelly_l2',
    name: 'Sparkcaster',
    element: 'Electric',
    level: 2,
    evolutionFamily: 'spark',
    stats: { hp: 80, atk: 34, def: 12, spd: 20, specialDmg: 55, specialCost: 3 },
  },
  spark_l3: {
    definitionKey: 'spark_l3',
    type: 'chelly_l3',
    name: 'Stormcrown',
    element: 'Electric',
    level: 3,
    evolutionFamily: 'spark',
    stats: { hp: 110, atk: 50, def: 16, spd: 24, specialDmg: 75, specialCost: 3 },
  },

  // ── SHADE FAMILY (Shadow) ──────────────────────────────────
  shade_l1: {
    definitionKey: 'shade_l1',
    type: 'chelly_l1',
    name: 'Shadeling',
    element: 'Shadow',
    level: 1,
    evolutionFamily: 'shade',
    stats: { hp: 60, atk: 24, def: 10, spd: 16, specialDmg: 42, specialCost: 2 },
  },
  shade_l2: {
    definitionKey: 'shade_l2',
    type: 'chelly_l2',
    name: 'Shadeborn',
    element: 'Shadow',
    level: 2,
    evolutionFamily: 'shade',
    stats: { hp: 90, atk: 36, def: 14, spd: 18, specialDmg: 58, specialCost: 3 },
  },
  shade_l3: {
    definitionKey: 'shade_l3',
    type: 'chelly_l3',
    name: 'Void Reaper',
    element: 'Shadow',
    level: 3,
    evolutionFamily: 'shade',
    stats: { hp: 120, atk: 52, def: 18, spd: 20, specialDmg: 78, specialCost: 3 },
  },

  // ── FROST FAMILY (Ice) ─────────────────────────────────────
  frost_l1: {
    definitionKey: 'frost_l1',
    type: 'chelly_l1',
    name: 'Frostling',
    element: 'Ice',
    level: 1,
    evolutionFamily: 'frost',
    stats: { hp: 65, atk: 18, def: 22, spd: 11, specialDmg: 32, specialCost: 2 },
  },
  frost_l2: {
    definitionKey: 'frost_l2',
    type: 'chelly_l2',
    name: 'Frostbound',
    element: 'Ice',
    level: 2,
    evolutionFamily: 'frost',
    stats: { hp: 95, atk: 28, def: 30, spd: 13, specialDmg: 48, specialCost: 3 },
  },
  frost_l3: {
    definitionKey: 'frost_l3',
    type: 'chelly_l3',
    name: 'Glacial Warden',
    element: 'Ice',
    level: 3,
    evolutionFamily: 'frost',
    stats: { hp: 135, atk: 40, def: 40, spd: 15, specialDmg: 62, specialCost: 3 },
  },

  // ── ARCANE FAMILY (Arcane) ─────────────────────────────────
  arcane_l1: {
    definitionKey: 'arcane_l1',
    type: 'chelly_l1',
    name: 'Runesprout',
    element: 'Arcane',
    level: 1,
    evolutionFamily: 'arcane',
    stats: { hp: 58, atk: 26, def: 12, spd: 13, specialDmg: 44, specialCost: 2 },
  },
  arcane_l2: {
    definitionKey: 'arcane_l2',
    type: 'chelly_l2',
    name: 'Runecaster',
    element: 'Arcane',
    level: 2,
    evolutionFamily: 'arcane',
    stats: { hp: 85, atk: 38, def: 18, spd: 15, specialDmg: 60, specialCost: 3 },
  },
  arcane_l3: {
    definitionKey: 'arcane_l3',
    type: 'chelly_l3',
    name: 'Archmage Chelly',
    element: 'Arcane',
    level: 3,
    evolutionFamily: 'arcane',
    stats: { hp: 115, atk: 55, def: 22, spd: 17, specialDmg: 80, specialCost: 3 },
  },

  // ── NEUTRAL ────────────────────────────────────────────────
  neutral_l1: {
    definitionKey: 'neutral_l1',
    type: 'chelly_l1',
    name: 'Wanderling',
    element: 'Neutral',
    level: 1,
    evolutionFamily: 'neutral',
    stats: { hp: 70, atk: 16, def: 16, spd: 13, specialDmg: 30, specialCost: 2 },
  },

  // ── UNIVERSAL CHELLY ───────────────────────────────────────
  universal_chelly: {
    definitionKey: 'universal_chelly',
    type: 'universal_chelly',
    name: 'Bloom Primordial',
    element: 'Neutral',
    level: 'universal',
    stats: { hp: 200, atk: 60, def: 30, spd: 20, specialDmg: 100, specialCost: 3 },
  },

  // ── MEMORY ARTIFACTS ───────────────────────────────────────
  artifact_bloom_salve: {
    definitionKey: 'artifact_bloom_salve',
    type: 'memory_artifact',
    name: 'Bloom Salve',
    element: 'Neutral',
    effectText: 'Next turn: restore 30 HP to your Active Chelly.',
  },
  artifact_power_crystal: {
    definitionKey: 'artifact_power_crystal',
    type: 'memory_artifact',
    name: 'Power Crystal',
    element: 'Neutral',
    effectText: 'Next turn: +15 ATK to your Active Chelly for this turn.',
  },
  artifact_shell_ward: {
    definitionKey: 'artifact_shell_ward',
    type: 'memory_artifact',
    name: 'Shell Ward',
    element: 'Neutral',
    effectText: 'Next turn: +15 DEF to your Active Chelly for this turn.',
  },
  artifact_speed_glyph: {
    definitionKey: 'artifact_speed_glyph',
    type: 'memory_artifact',
    name: 'Speed Glyph',
    element: 'Neutral',
    effectText: 'Next turn: +8 SPD to your Active Chelly for this turn.',
  },
  artifact_evolution_boost: {
    definitionKey: 'artifact_evolution_boost',
    type: 'memory_artifact',
    name: 'Evolution Boost',
    element: 'Neutral',
    effectText: 'Next turn: reduce evolution EB cost by 1 (min 0).',
  },

  // ── FLASH RELICS ───────────────────────────────────────────
  flash_relic_energy_surge: {
    definitionKey: 'flash_relic_energy_surge',
    type: 'flash_relic',
    name: 'Energy Surge',
    element: 'Neutral',
    isFlashRelic: true,
    effectText: 'Instantly draw 2 Energy Bloom Cards (max 7).',
  },
  flash_relic_full_retreat: {
    definitionKey: 'flash_relic_full_retreat',
    type: 'flash_relic',
    name: 'Full Retreat',
    element: 'Neutral',
    isFlashRelic: true,
    effectText: 'Instantly swap Active with any Bench Chelly without ending your turn.',
  },
  flash_relic_disruption: {
    definitionKey: 'flash_relic_disruption',
    type: 'flash_relic',
    name: 'Disruption Field',
    element: 'Neutral',
    isFlashRelic: true,
    effectText: 'Opponent discards 2 energy bloom cards on their next turn.',
  },

  // ── ENERGY BLOOM ───────────────────────────────────────────
  energy_bloom: {
    definitionKey: 'energy_bloom',
    type: 'energy_bloom',
    name: 'Energy Bloom',
    element: 'Neutral',
    effectText: 'Energy resource. Used to pay evolution, special, and piercing roll costs.',
  },
};

// ─── Element weakness/strength table ─────────────────────────────────────────

/** Returns true if attacker's element is the defender's weakness */
export const ELEMENT_STRENGTH_TABLE: Record<ChellyzElement, ChellyzElement[]> = {
  Fire:       ['Nature', 'Ice'],
  Water:      ['Fire', 'Electric'],
  Nature:     ['Water', 'Electric'],
  Electric:   ['Water', 'Ice'],
  Shadow:     ['Spirit', 'Arcane'],
  Ice:        ['Nature', 'Water'],
  Spirit:     ['Shadow', 'Corruption'],
  Arcane:     ['Shadow', 'Corruption'],
  Corruption: ['Spirit', 'Arcane', 'Nature'],
  Neutral:    [],
};

export function getStrengthBonus(attackerElement: ChellyzElement, defenderElement: ChellyzElement): number {
  return ELEMENT_STRENGTH_TABLE[attackerElement]?.includes(defenderElement) ? 10 : 0;
}

export function getWeaknessBonus(defenderElement: ChellyzElement, attackerElement: ChellyzElement): number {
  // Defender is weak to attacker if attacker is strong vs defender
  return ELEMENT_STRENGTH_TABLE[attackerElement]?.includes(defenderElement) ? 10 : 0;
}

// ─── Deck building utilities ──────────────────────────────────────────────────

let _instanceCounter = 0;
export function makeInstanceId(key: string): string {
  return `${key}_${Date.now()}_${++_instanceCounter}`;
}

export function cardFromDef(defKey: string, overrides: Partial<ChellyzCard> = {}): ChellyzCard {
  const def = CARD_DEFINITIONS[defKey];
  if (!def) throw new Error(`Unknown card definition: ${defKey}`);
  const card: ChellyzCard = {
    instanceId:      makeInstanceId(defKey),
    definitionKey:   def.definitionKey,
    type:            def.type,
    name:            def.name,
    element:         def.element,
    level:           def.level,
    evolutionFamily: def.evolutionFamily,
    effectText:      def.effectText,
    isFlashRelic:    def.isFlashRelic,
    isStarter:       true,
    ...overrides,
  };
  if (def.stats) {
    card.stats = { ...def.stats, maxHp: def.stats.hp };
    card.currentHp = def.stats.hp;
  }
  return card;
}

/** Build an Energy Bloom Deck (30 EB cards — always 30, separate from main deck) */
export function buildEnergyBloomDeck(): ChellyzCard[] {
  return Array.from({ length: 30 }, () => cardFromDef('energy_bloom'));
}

/**
 * Build a 50-card starter deck for a player with no NFTs.
 * Contains 2 full evolution chains + extra L1s + Memory Artifacts.
 * Starter cards are weaker but fully playable.
 */
export function buildStarterDeck(): ChellyzCard[] {
  const deck: ChellyzCard[] = [];

  // 2 full evolution chains (ember + tide) = 6 evolution cards
  const chains = ['ember', 'tide'] as const;
  for (const chain of chains) {
    deck.push(cardFromDef(`${chain}_l1`));
    deck.push(cardFromDef(`${chain}_l1`));
    deck.push(cardFromDef(`${chain}_l1`));
    deck.push(cardFromDef(`${chain}_l2`));
    deck.push(cardFromDef(`${chain}_l2`));
    deck.push(cardFromDef(`${chain}_l3`));
  }

  // 14 Level 1s across all elements for bench depth
  const l1Pool = ['bloom_l1', 'spark_l1', 'shade_l1', 'frost_l1', 'arcane_l1', 'neutral_l1', 'ember_l1', 'tide_l1'] as const;
  for (let i = 0; i < 14; i++) {
    deck.push(cardFromDef(l1Pool[i % l1Pool.length]));
  }

  // 10 Memory Artifacts
  const artifacts = [
    'artifact_bloom_salve', 'artifact_bloom_salve',
    'artifact_power_crystal', 'artifact_power_crystal',
    'artifact_shell_ward', 'artifact_shell_ward',
    'artifact_speed_glyph',
    'artifact_evolution_boost', 'artifact_evolution_boost',
    'artifact_bloom_salve',
  ] as const;
  for (const a of artifacts) deck.push(cardFromDef(a));

  // 3 Flash Relics
  deck.push(cardFromDef('flash_relic_energy_surge'));
  deck.push(cardFromDef('flash_relic_full_retreat'));
  deck.push(cardFromDef('flash_relic_disruption'));

  // Pad to 50 with neutral L1s
  while (deck.length < 50) {
    deck.push(cardFromDef('neutral_l1'));
  }

  return shuffle(deck).slice(0, 50);
}

/**
 * Attempt to build a deck from a player's NFTs.
 * NFTs are sorted into L1/L2/L3 by their rarity tier.
 * If fewer than 50 cards, pad with starter cards.
 */
export function buildNftDeck(nfts: NFTData[]): { deck: ChellyzCard[]; isNftDeck: boolean } {
  const nftCards: ChellyzCard[] = [];

  for (const nft of nfts) {
    if (!nft.fighter) continue;
    const { rarity, strength, stats, name } = nft.fighter;

    // Map rarity → level
    const level: 1 | 2 | 3 = rarity === 'Legendary' || rarity === 'Epic' ? 3
      : rarity === 'Rare' || rarity === 'Uncommon' ? 2
      : 1;

    // Map element
    const elementMap: Record<string, ChellyzElement> = {
      Fire: 'Fire', Water: 'Water', Nature: 'Nature', Electric: 'Electric',
      Shadow: 'Shadow', Ice: 'Ice', Spirit: 'Spirit', Arcane: 'Arcane',
      Corruption: 'Corruption',
    };
    const element: ChellyzElement = elementMap[strength] ?? 'Neutral';

    // Scale stats: NFT Chellyz are stronger than starters
    const hpScale   = level === 3 ? 1.4 : level === 2 ? 1.15 : 1.0;
    const atkScale  = level === 3 ? 1.5 : level === 2 ? 1.2  : 1.0;
    const defScale  = level === 3 ? 1.4 : level === 2 ? 1.15 : 1.0;
    const spdScale  = 1.0;

    const hp         = Math.round(stats.hp  * hpScale);
    const atk        = Math.round(stats.atk * atkScale);
    const def        = Math.round(stats.def * defScale);
    const spd        = Math.round(stats.spd * spdScale);
    const specialDmg = Math.round(atk * 1.8);
    const specialCost = level === 3 ? 3 : level === 2 ? 3 : 2;

    // Build a shared evolution family from name slug
    const familySlug = nft.name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10) as EvolutionFamily;

    const card: ChellyzCard = {
      instanceId:      makeInstanceId(`nft-${nft.id}`),
      definitionKey:   `nft-${nft.id}`,
      type:            `chelly_l${level}` as CardType,
      name,
      element,
      level,
      evolutionFamily: familySlug,
      stats:           { hp, maxHp: hp, atk, def, spd, specialDmg, specialCost },
      currentHp:       hp,
      imageUri:        resolveImageUri(nft.image),
      nftId:           nft.id,
      isStarter:       false,
    };
    nftCards.push(card);
  }

  const isNftDeck = nftCards.length >= 10; // meaningful NFT deck minimum

  // Fill up to 50 with starter cards if needed
  if (nftCards.length < 50) {
    const starter = buildStarterDeck();
    // Only take what we need
    const padding = starter.slice(0, 50 - nftCards.length);
    return { deck: shuffle([...nftCards, ...padding]).slice(0, 50), isNftDeck };
  }

  return { deck: shuffle(nftCards).slice(0, 50), isNftDeck };
}

// ─── Utilities ────────────────────────────────────────────────────────────────

/**
 * Convert any IPFS-scheme URI to a proxied HTTPS URL via /api/img.
 *
 * Discord Activities run in a sandboxed iframe — direct requests to
 * nftstorage.link / ipfs.io can be blocked by Discord's CSP.
 * Routing through /api/img (Vercel edge) keeps all image requests
 * on the same origin and bypasses the restriction.
 */
export function resolveImageUri(uri: string | undefined): string | undefined {
  if (!uri) return undefined;

  // Determine the canonical HTTPS URL
  let httpsUrl: string;
  if (uri.startsWith('ipfs://')) {
    httpsUrl = 'https://nftstorage.link/ipfs/' + uri.slice(7);
  } else if (uri.startsWith('https://ipfs.io/ipfs/')) {
    httpsUrl = uri.replace('https://ipfs.io/ipfs/', 'https://nftstorage.link/ipfs/');
  } else if (uri.startsWith('https://')) {
    // Already a valid HTTPS URL — proxy it if it's an IPFS gateway or CDN
    httpsUrl = uri;
  } else {
    return undefined; // unknown scheme — drop it
  }

  // Route through server-side proxy so Discord iframe CSP doesn't block it
  return '/api/img?url=' + encodeURIComponent(httpsUrl);
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function rollD6(): number {
  return Math.floor(Math.random() * 6) + 1;
}

export function coinFlip(): 'heads' | 'tails' {
  return Math.random() < 0.5 ? 'heads' : 'tails';
}

/** Get all Level 1 Chelly cards from a hand */
export function getL1ChellysInHand(hand: ChellyzCard[]): ChellyzCard[] {
  return hand.filter((c) => c.type === 'chelly_l1');
}

/** Get the evolution of a Chelly card (next level in the same family) */
export function getEvolutionCard(
  card: ChellyzCard,
  hand: ChellyzCard[]
): ChellyzCard | null {
  if (!card.evolutionFamily || !card.level || card.level === 3 || card.level === 'universal') return null;
  const nextLevel = (card.level as number) + 1;
  return hand.find(
    (c) => c.evolutionFamily === card.evolutionFamily && c.level === nextLevel,
  ) ?? null;
}

/** Damage formula from rulebook:
 *  (ATK + strength_bonus(+10) - weakness_penalty(-10) - defenderDEF) min 0
 */
export function calculateChellyDamage(
  attackerCard: ChellyzCard,
  defenderCard: ChellyzCard,
  isSpecial: boolean,
  defOverride?: number,   // from piercing roll
  artifactAtkBonus = 0,
  artifactDefBonus = 0,
): number {
  if (!attackerCard.stats || !defenderCard.stats) return 0;
  const atk     = (isSpecial ? attackerCard.stats.specialDmg : attackerCard.stats.atk) + artifactAtkBonus;
  const def     = Math.max(0, (defOverride ?? defenderCard.stats.def) + artifactDefBonus);
  const bonus   = getStrengthBonus(attackerCard.element, defenderCard.element);
  const penalty = getWeaknessBonus(defenderCard.element, attackerCard.element);
  return Math.max(0, atk + bonus - penalty - def);
}

/** Resolved evolution cost in EB (minus artifact bonus) */
export function evolutionCost(fromLevel: number, artifactEvoDiscount = 0): number {
  const base = fromLevel === 1 ? 1 : fromLevel === 2 ? 2 : 3;
  return Math.max(0, base - artifactEvoDiscount);
}
