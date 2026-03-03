// ─────────────────────────────────────────────────────────────────────────────
//  Fighter System — NFT-based fighters for Arcane BOW
//
//  Ported from bow-app/app/lib/fighters.ts
//  Extended with full APPROVED_COLLECTIONS registry and element table.
// ─────────────────────────────────────────────────────────────────────────────

// ── Fighter Stats ─────────────────────────────────────────────────────────────

export interface FighterStats {
  hp:  number;
  atk: number;
  def: number;
  spd: number;
}

/** Element type for strength/weakness matching */
export type ElementType =
  | 'Spirit' | 'Exile'   | 'Nature' | 'Fire'
  | 'Water'  | 'Electric'| 'Shadow' | 'Ice'
  | 'Corruption' | 'Arcane' | 'None';

export type RarityTier = 'Common' | 'Uncommon' | 'Rare' | 'Epic' | 'Legendary';

/** A fully resolved fighter ready for battle */
export interface Fighter {
  /** 'user' = default player stats, 'nft' = NFT-based fighter */
  source: 'user' | 'nft';
  name: string;
  stats: FighterStats;
  strength: ElementType;
  weakness: ElementType;
  rarity: RarityTier;
  effect?: string;
  faction?: string;
  nftId?: string;
  collectionId?: string;
  imageUri?: string;
}

// ── Default Fighter ───────────────────────────────────────────────────────────

export const DEFAULT_FIGHTER: Fighter = {
  source:   'user',
  name:     'Wizard',
  stats:    { hp: 100, atk: 15, def: 10, spd: 10 },
  strength: 'None',
  weakness: 'None',
  rarity:   'Common',
};

// ── Element Effectiveness ─────────────────────────────────────────────────────

/**
 * Full element effectiveness table.
 * elementEffectiveness[attacker][defender] = multiplier
 */
export const ELEMENT_EFFECTIVENESS: Record<string, Record<string, number>> = {
  Fire:        { Water: 0.5,  Nature: 2.0,  Ice: 2.0,       Fire: 0.5                          },
  Water:       { Fire: 2.0,   Electric: 0.5, Nature: 0.5,   Water: 0.5                         },
  Nature:      { Water: 2.0,  Fire: 0.5,    Electric: 2.0,  Nature: 0.5                        },
  Electric:    { Water: 2.0,  Nature: 0.5,  Electric: 0.5                                      },
  Shadow:      { Spirit: 2.0, Arcane: 0.5,  Shadow: 0.5,    Corruption: 0.5                    },
  Ice:         { Fire: 0.5,   Water: 2.0,   Ice: 0.5                                           },
  Arcane:      { Shadow: 2.0, Corruption: 2.0, Arcane: 0.5                                     },
  Spirit:      { Shadow: 0.5, Corruption: 2.0, Spirit: 0.5                                     },
  Corruption:  { Spirit: 0.5, Arcane: 0.5,  Corruption: 0.5, Nature: 2.0                       },
  Exile:       { Corruption: 2.0, Shadow: 2.0, Exile: 0.5                                      },
};

export function getElementMultiplier(attackerElement: ElementType, defenderWeakness: ElementType): number {
  if (attackerElement === 'None' || defenderWeakness === 'None') return 1.0;
  return ELEMENT_EFFECTIVENESS[attackerElement]?.[defenderWeakness] ?? 1.0;
}

// ── Approved Collections Registry ─────────────────────────────────────────────

export interface TraitMapping {
  hp:       string;
  atk:      string;
  def:      string;
  spd:      string;
  strength: string;
  weakness: string;
  rarity:   string;
  effect?:  string;
  faction?: string;
  name?:    string;
}

export interface ApprovedCollection {
  collectionId: string;
  name:         string;
  traitMapping: TraitMapping;
  statCaps?:    Partial<FighterStats>;
  minRarity?:   RarityTier;
}

export const APPROVED_COLLECTIONS: ApprovedCollection[] = [
  {
    collectionId: 'col198luy7d64a8zksmseysz9a7mn8dnk590huspz5q8p8p3pglqsn4s6fjpun',
    name:         'Chellyz: Master of Blooms Genesis',
    traitMapping: {
      hp:       'HP',
      atk:      'ATK',
      def:      'DEF',
      spd:      'SPD',
      strength: 'STR',
      weakness: 'WEA',
      rarity:   'Rarity',
      effect:   'Effect',
      faction:  'Faction',
    },
    statCaps: { hp: 150, atk: 40, def: 30, spd: 40 },
  },
  // Add more approved collections here
  // {
  //   collectionId: 'col1...',
  //   name:         'Another Collection',
  //   traitMapping: { hp: 'Health', atk: 'Attack', def: 'Defense', spd: 'Speed', ... },
  // },
];

// ── NFT Data ──────────────────────────────────────────────────────────────────

export interface NftTrait {
  trait_type: string;
  value:      string | number;
}

export interface NftData {
  nftId:        string;
  name:         string;
  collectionId: string;
  traits:       NftTrait[];
  imageUri?:    string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function getApprovedCollection(collectionId: string): ApprovedCollection | undefined {
  return APPROVED_COLLECTIONS.find(c => c.collectionId === collectionId);
}

function getTrait(traits: NftTrait[], traitType: string): string | undefined {
  const t = traits.find(t => t.trait_type === traitType);
  return t ? String(t.value) : undefined;
}

function getNumericTrait(traits: NftTrait[], traitType: string, fallback: number): number {
  const raw = getTrait(traits, traitType);
  if (raw === undefined) return fallback;
  const n = Number(raw);
  return isNaN(n) ? fallback : n;
}

function clampStat(value: number, cap?: number): number {
  return cap !== undefined ? Math.min(value, cap) : value;
}

export function parseElement(raw?: string): ElementType {
  if (!raw) return 'None';
  const known: ElementType[] = [
    'Spirit', 'Exile', 'Nature', 'Fire', 'Water',
    'Electric', 'Shadow', 'Ice', 'Corruption', 'Arcane',
  ];
  return known.find(e => e.toLowerCase() === raw.trim().toLowerCase()) ?? 'None';
}

export function parseRarity(raw?: string): RarityTier {
  if (!raw) return 'Common';
  const n = raw.trim().toLowerCase();
  if (n.includes('legendary')) return 'Legendary';
  if (n.includes('epic'))      return 'Epic';
  if (n.includes('rare'))      return 'Rare';
  if (n.includes('uncommon'))  return 'Uncommon';
  return 'Common';
}

// ── NFT → Fighter ─────────────────────────────────────────────────────────────

/**
 * Convert an NFT from an approved collection into a Fighter.
 * Returns null if the collection is not in APPROVED_COLLECTIONS.
 */
export function nftToFighter(nft: NftData): Fighter | null {
  const collection = getApprovedCollection(nft.collectionId);
  if (!collection) return null;

  const { traitMapping, statCaps } = collection;
  const stats: FighterStats = {
    hp:  clampStat(getNumericTrait(nft.traits, traitMapping.hp,  100), statCaps?.hp),
    atk: clampStat(getNumericTrait(nft.traits, traitMapping.atk, 15),  statCaps?.atk),
    def: clampStat(getNumericTrait(nft.traits, traitMapping.def, 10),  statCaps?.def),
    spd: clampStat(getNumericTrait(nft.traits, traitMapping.spd, 10),  statCaps?.spd),
  };

  return {
    source:       'nft',
    name:         (traitMapping.name ? getTrait(nft.traits, traitMapping.name) : undefined) ?? nft.name,
    stats,
    strength:     parseElement(getTrait(nft.traits, traitMapping.strength)),
    weakness:     parseElement(getTrait(nft.traits, traitMapping.weakness)),
    rarity:       parseRarity(getTrait(nft.traits, traitMapping.rarity)),
    effect:       traitMapping.effect  ? getTrait(nft.traits, traitMapping.effect)  : undefined,
    faction:      traitMapping.faction ? getTrait(nft.traits, traitMapping.faction) : undefined,
    nftId:        nft.nftId,
    collectionId: nft.collectionId,
    imageUri:     nft.imageUri,
  };
}

// ── Damage Calculation ────────────────────────────────────────────────────────

/**
 * Calculate effective damage with ATK/DEF scaling, element matching, and rarity bonus.
 * Used by battleEngine.ts — authoritative damage formula for Arcane BOW.
 *
 * Formula:
 *   base × atkMod × defMod × elementMult × rarityMult
 *   - atkMod  = 1 + (atk - 15) / 100
 *   - defMod  = 1 - (def - 10) / 200
 *   - element = +25% if attacker.strength === defender.weakness
 *              -15% if attacker.weakness === defender.strength
 *   - rarity  = Common 1.0 → Legendary 1.15
 */
export function calculateFighterDamage(
  baseDamage: number,
  attacker: Fighter,
  defender: Fighter,
): number {
  const atkMod = 1 + (attacker.stats.atk - 15) / 100;
  const defMod = 1 - (defender.stats.def - 10) / 200;

  let damage = baseDamage * atkMod * defMod;

  // Elemental matching
  if (attacker.strength !== 'None' && attacker.strength === defender.weakness) {
    damage *= 1.25;
  }
  if (attacker.weakness !== 'None' && attacker.weakness === defender.strength) {
    damage *= 0.85;
  }

  // Rarity scaling
  const rarityBonus: Record<RarityTier, number> = {
    Common:    1.00,
    Uncommon:  1.05,
    Rare:      1.10,
    Epic:      1.12,
    Legendary: 1.15,
  };
  damage *= rarityBonus[attacker.rarity] ?? 1.0;

  return Math.max(1, Math.round(damage));
}

/**
 * Determine turn order based on SPD. Higher SPD goes first.
 * Tie: attacker (player) goes first.
 */
export function resolveTurnOrder(
  playerFighter: Fighter,
  opponentFighter: Fighter,
): 'player-first' | 'opponent-first' {
  return playerFighter.stats.spd >= opponentFighter.stats.spd ? 'player-first' : 'opponent-first';
}

/**
 * Calculate APS (Arcane Power Score) change after a battle.
 * Win: +25 base, Loss: -15 base — modified by relative rarity.
 */
export function calculateAPSChange(
  result: 'win' | 'loss' | 'draw',
  myFighter: Fighter,
  opponentFighter: Fighter,
): number {
  if (result === 'draw') return 0;

  let base = result === 'win' ? 25 : -15;

  const rarityValues: Record<RarityTier, number> = {
    Common: 1, Uncommon: 2, Rare: 3, Epic: 4, Legendary: 5,
  };
  const myVal  = rarityValues[myFighter.rarity]       ?? 1;
  const oppVal = rarityValues[opponentFighter.rarity] ?? 1;

  if (myVal > oppVal) base = Math.floor(base * 0.8);   // less APS beating a weaker foe
  if (myVal < oppVal) base = Math.floor(base * 1.3);   // more APS beating a stronger foe

  return base;
}
