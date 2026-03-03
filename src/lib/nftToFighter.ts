/**
 * nftToFighter.ts
 * Maps a raw WalletNft (chia_getNfts response) → NFTData + Fighter
 * for use in the Battle tab fighter selector.
 *
 * NOTE: chia_getNfts does NOT return trait attributes inline.
 * Traits must be fetched from metadataUris[0] separately (see TODO: metadata fetch quest).
 *
 * BOW NFT attributes schema (from arcane-battle-protocol/nft/nft_schema.ts):
 *   tier, wins, losses, arcane_power_score, strength, weakness, effect
 * Falls back to reasonable defaults for non-BOW NFTs.
 */

import type { WalletNft } from '../providers/WalletConnectProvider';
import type { Fighter, NFTData } from '../store/bowActivityStore';
import {
  nftToFighter    as collectionNftToFighter,
  getApprovedCollection,
  type NftData     as CollectionNftData,
} from './fighters';

// ─── Constants ────────────────────────────────────────────────────────────────

type Element = Fighter['strength'];
type Rarity  = Fighter['rarity'];

const ELEMENTS: Element[] = [
  'Arcane', 'Fire', 'Water', 'Nature', 'Electric',
  'Shadow', 'Ice', 'Spirit', 'Corruption', 'Exile',
  // 'None' intentionally excluded — not assigned randomly
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
  Exile:       'Corruption',
  None:        'None',
};

const TIER_RARITY: Record<string, Rarity> = {
  'Initiate':    'Common',
  'Adept':       'Uncommon',
  'Archmage':    'Rare',
  'Grand Wizard':'Legendary',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

type AttrArray = { trait_type: string; value: string | number }[];

function attr(nft: WalletNft, key: string): string | number | undefined {
  // chia_getNfts does NOT return attributes inline.
  // This function is kept for future use when metadata is fetched from metadataUris.
  const rawAttrs = nft.attributes;
  if (Array.isArray(rawAttrs)) {
    const hit = (rawAttrs as AttrArray).find(
      (a) => a.trait_type?.toLowerCase() === key.toLowerCase(),
    );
    if (hit) return hit.value;
  }
  // Also check top-level metadata blob (populated after fetching metadataUris)
  const rawMeta = nft.metadata;
  if (rawMeta && typeof rawMeta === 'object') {
    const meta = rawMeta as Record<string, unknown>;
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
  // chia_getNfts uses launcherId as the primary NFT identifier
  const id = nft.launcherId ?? nft.coinId ?? `nft-${index}`;
  const displayName = (nft.name as string | undefined) ?? `Wizard #${index + 1}`;

  // ── Approved-collection fast path ──────────────────────────────
  // collectionId is a first-class field in chia_getNfts response
  const rawCollectionId: string | undefined = nft.collectionId ?? undefined;

  if (rawCollectionId && getApprovedCollection(rawCollectionId)) {
    // dataUris[0] is the primary image/data URI in chia_getNfts
    // Also check metadata.image if metadata was pre-fetched
    const metaImg = (nft.metadata as Record<string, unknown> | undefined)?.image;
    const image =
      (typeof metaImg === 'string' ? metaImg : undefined) ??
      (Array.isArray(nft.dataUris) ? (nft.dataUris[0] as string) : undefined);

    const rawAttrsForCollection = Array.isArray(nft.attributes) ? (nft.attributes as AttrArray) : [];
    const collectionNft: CollectionNftData = {
      nftId:        id,
      name:         displayName,
      collectionId: rawCollectionId,
      traits:       rawAttrsForCollection.map(a => ({
        trait_type: a.trait_type ?? '',
        value:      a.value ?? '',
      })),
      imageUri: image,
    };

    const fighter = collectionNftToFighter(collectionNft);
    if (fighter) {
      return {
        id,
        tokenId: id,
        name:    displayName,
        image,
        attributes: collectionNft.traits,
        fighter:    fighter as unknown as Fighter,
      };
    }
  }

  // ── Generic fallback path ───────────────────────────────────────
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
  // dataUris[0] is the primary data/image URI from chia_getNfts
  const image = Array.isArray(nft.dataUris) ? (nft.dataUris[0] as string) : undefined;

  const rawAttrs = Array.isArray(nft.attributes) ? (nft.attributes as AttrArray) : [];
  const attributes: NFTData['attributes'] = [
    { trait_type: 'tier',   value: tierRaw ?? rarity },
    { trait_type: 'wins',   value: wins },
    { trait_type: 'losses', value: losses },
    { trait_type: 'aps',    value: aps },
    ...rawAttrs,
  ];

  return { id, tokenId: id, name: displayName, image, attributes, fighter };
}

export function parseWalletNfts(nfts: WalletNft[]): NFTData[] {
  return nfts.map((n, i) => nftToFighterData(n, i));
}

/**
 * Fetch metadataUris[0] for each NFT and attach the parsed JSON as nft.metadata.
 * Handles IPFS URIs by proxying through a public gateway.
 * Safe — failures are silently skipped (the NFT still renders with fallback data).
 */
export async function fetchNftMetadata(nfts: WalletNft[]): Promise<WalletNft[]> {
  const resolveUri = (uri: string): string => {
    if (uri.startsWith('ipfs://')) {
      return 'https://ipfs.io/ipfs/' + uri.slice(7);
    }
    return uri;
  };

  const enriched = await Promise.all(
    nfts.map(async (nft) => {
      const uri = nft.metadataUris?.[0];
      if (!uri || typeof uri !== 'string') return nft;
      try {
        const res = await fetch(resolveUri(uri), { signal: AbortSignal.timeout(8000) });
        if (!res.ok) return nft;
        const meta = await res.json() as Record<string, unknown>;
        return { ...nft, metadata: meta };
      } catch {
        return nft; // timeout / CORS / parse error — use nft as-is
      }
    }),
  );

  return enriched;
}
