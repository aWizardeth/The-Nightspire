/**
 * nftToFighter.ts
 * Maps a raw WalletNft (chip0002_getNFTs response) → NFTData + Fighter
 * for use in the Battle tab fighter selector.
 *
 * BOW NFT attributes schema (from arcane-battle-protocol/nft/nft_schema.ts):
 *   tier, wins, losses, arcane_power_score, strength, weakness, effect
 * Falls back to reasonable defaults for non-BOW NFTs.
 */

import type { WalletNft } from '../providers/WalletConnectProvider';
import type { Fighter, NFTData } from '../store/bowActivityStore';

// ─── Constants ────────────────────────────────────────────────────────────────

type Element = Fighter['strength'];
type Rarity  = Fighter['rarity'];

const ELEMENTS: Element[] = [
  'Arcane', 'Fire', 'Water', 'Nature', 'Electric',
  'Shadow', 'Ice', 'Spirit', 'Corruption',
];

const ELEMENT_WEAKNESSES: Record<Element, Element> = {
  Fire:        'Water',
  Water:       'Nature',
  Nature:      'Fire',
  Electric:    'Shadow',
  Shadow:      'Arcane',
  Arcane:      'Corruption',
  Corruption:  'Spirit',
  Spirit:      'Shadow',
  Ice:         'Fire',
};

const TIER_RARITY: Record<string, Rarity> = {
  'Initiate':    'Common',
  'Adept':       'Uncommon',
  'Archmage':    'Rare',
  'Grand Wizard':'Legendary',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function attr(nft: WalletNft, key: string): string | number | undefined {
  if (nft.attributes) {
    const hit = nft.attributes.find(
      (a) => a.trait_type?.toLowerCase() === key.toLowerCase(),
    );
    if (hit) return hit.value;
  }
  // Also check top-level metadata blob (some wallets nest attributes there)
  if (nft.metadata && typeof nft.metadata === 'object') {
    const meta = nft.metadata as Record<string, unknown>;
    if (Array.isArray(meta.attributes)) {
      const hit = (meta.attributes as { trait_type: string; value: unknown }[]).find(
        (a) => a.trait_type?.toLowerCase() === key.toLowerCase(),
      );
      if (hit) return hit.value as string | number;
    }
  }
  return undefined;
}

function attrStr(nft: WalletNft, key: string): string | undefined {
  const v = attr(nft, key);
  return v !== undefined ? String(v) : undefined;
}

function attrNum(nft: WalletNft, key: string): number | undefined {
  const v = attr(nft, key);
  if (v === undefined) return undefined;
  const n = Number(v);
  return isNaN(n) ? undefined : n;
}

/** Deterministic element from NFT id so non-BOW NFTs still get an element */
function elementFromId(id: string): Element {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return ELEMENTS[h % ELEMENTS.length];
}

/** Scale APS (0-100+) into stat range [base, base+range] */
function scaleStat(aps: number, base: number, range: number): number {
  const t = Math.min(1, aps / 100);
  return Math.round(base + t * range);
}

// ─── Main mapper ─────────────────────────────────────────────────────────────

export function nftToFighterData(nft: WalletNft, index: number): NFTData {
  const id = nft.nftId ?? nft.launcherId ?? nft.encodedId ?? `nft-${index}`;
  const displayName =
    attrStr(nft, 'name') ?? (nft.name as string | undefined) ?? `Wizard #${index + 1}`;

  // ── Tier / APS ──────────────────────────────────────────────────
  const tierRaw = attrStr(nft, 'tier') ?? attrStr(nft, 'Tier');
  const wins    = attrNum(nft, 'wins')   ?? 0;
  const losses  = attrNum(nft, 'losses') ?? 0;
  const aps     = attrNum(nft, 'arcane_power_score') ?? attrNum(nft, 'aps') ?? Math.max(0, wins * 3 - losses * 2);

  const rarity: Rarity =
    (tierRaw && TIER_RARITY[tierRaw]) ? TIER_RARITY[tierRaw] :
    aps >= 50 ? 'Legendary' :
    aps >= 25 ? 'Rare' :
    aps >= 10 ? 'Uncommon' : 'Common';

  // ── Element ─────────────────────────────────────────────────────
  const rawStrength = attrStr(nft, 'strength') ?? attrStr(nft, 'element') ?? attrStr(nft, 'type');
  const strength: Element = (rawStrength && ELEMENTS.includes(rawStrength as Element))
    ? (rawStrength as Element)
    : elementFromId(id);

  const rawWeakness = attrStr(nft, 'weakness');
  const weakness: Element = (rawWeakness && ELEMENTS.includes(rawWeakness as Element))
    ? (rawWeakness as Element)
    : ELEMENT_WEAKNESSES[strength];

  // ── Stats (scale with APS) ──────────────────────────────────────
  const hp  = attrNum(nft, 'hp')  ?? scaleStat(aps, 80,  120);
  const atk = attrNum(nft, 'atk') ?? scaleStat(aps, 10,  40);
  const def = attrNum(nft, 'def') ?? scaleStat(aps, 8,   32);
  const spd = attrNum(nft, 'spd') ?? scaleStat(aps, 8,   24);

  const effect = attrStr(nft, 'effect') ?? attrStr(nft, 'special') ?? attrStr(nft, 'ability');

  const fighter: Fighter = {
    source:   'user',
    name:     displayName,
    stats:    { hp, atk, def, spd },
    strength,
    weakness,
    rarity,
    ...(effect ? { effect } : {}),
  };

  // ── Image ───────────────────────────────────────────────────────
  const image =
    (nft.thumbnailUri as string | undefined) ??
    (nft.imageUri    as string | undefined)  ??
    (Array.isArray(nft.dataUris) ? (nft.dataUris[0] as string) : undefined);

  const attributes: NFTData['attributes'] = [
    { trait_type: 'tier',   value: tierRaw ?? rarity },
    { trait_type: 'wins',   value: wins },
    { trait_type: 'losses', value: losses },
    { trait_type: 'aps',    value: aps },
    ...(nft.attributes ?? []),
  ];

  return { id, tokenId: id, name: displayName, image, attributes, fighter };
}

export function parseWalletNfts(nfts: WalletNft[]): NFTData[] {
  return nfts.map((n, i) => nftToFighterData(n, i));
}
