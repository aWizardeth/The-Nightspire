/**
 * chellyzImages.ts
 * Async image enrichment for Chellyz card decks.
 *
 * After deck creation, NFT cards that still have no imageUri are supplemented
 * by a MintGarden API lookup via the /api/nft Vercel proxy (CORS-safe).
 *
 * MintGarden response shape (relevant fields):
 *   data.preview_url     — direct CDN image URL (preferred)
 *   data.thumbnail_uri   — smaller thumbnail
 *   data.metadata_json.image — raw metadata image (may be ipfs://)
 */

import type { ChellyzCard } from './chellyzCards';
import { resolveImageUri } from './chellyzCards';
import type { ChellyzGameState, PlayerState } from './chellyzEngine';

// ─── MintGarden lookup ────────────────────────────────────────────────────────

interface MintGardenNft {
  data?: {
    preview_url?:   string;
    thumbnail_uri?: string;
    metadata_json?: {
      image?: string;
    };
  };
  preview_url?:   string;
  thumbnail_uri?: string;
}

async function fetchMintGardenImage(nftId: string): Promise<string | null> {
  try {
    const res = await fetch(`/api/nft?id=${encodeURIComponent(nftId)}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const raw: MintGardenNft = await res.json();
    const uri =
      raw.data?.preview_url ??
      raw.preview_url ??
      raw.data?.thumbnail_uri ??
      raw.thumbnail_uri ??
      raw.data?.metadata_json?.image;
    return resolveImageUri(uri) ?? null;
  } catch {
    return null;
  }
}

// ─── Bulk card enrichment ─────────────────────────────────────────────────────

/**
 * Given a flat list of cards, fetches MintGarden images for any NFT card that
 * is still missing an imageUri. Returns a nftId → imageUri map.
 */
export async function buildImageMap(allCards: ChellyzCard[]): Promise<Map<string, string>> {
  // Deduplicate: only query each nftId once
  const needsFetch = new Map<string, true>();
  for (const card of allCards) {
    if (!card.imageUri && card.nftId && !card.isStarter) {
      needsFetch.set(card.nftId, true);
    }
  }

  if (needsFetch.size === 0) return new Map();

  // Fetch in parallel (max 6 concurrent to avoid flooding)
  const ids = [...needsFetch.keys()];
  const CHUNK = 6;
  const map = new Map<string, string>();

  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    const results = await Promise.all(
      chunk.map(async (id) => ({ id, img: await fetchMintGardenImage(id) })),
    );
    for (const { id, img } of results) {
      if (img) map.set(id, img);
    }
  }

  return map;
}

/** Apply an imageUri map to all cards in a PlayerState */
function applyImageMapToPlayer(player: PlayerState, map: Map<string, string>): PlayerState {
  const patch = (card: ChellyzCard | null): ChellyzCard | null => {
    if (!card) return null;
    if (card.imageUri || !card.nftId) return card;
    const img = map.get(card.nftId);
    return img ? { ...card, imageUri: img } : card;
  };

  return {
    ...player,
    active: patch(player.active) ?? null,
    bench:  player.bench.map(patch) as (ChellyzCard | null)[],
    hand:   player.hand.map((c) => patch(c) ?? c),
    deck:   player.deck.map((c) => patch(c) ?? c),
    discard: player.discard.map((c) => patch(c) ?? c),
  };
}

/**
 * Walk the full game state, fetch missing images from MintGarden,
 * and return an updated game state with imageUris filled in.
 */
export async function enrichGameImages(state: ChellyzGameState): Promise<ChellyzGameState> {
  // Collect all cards from both players
  const allCards: ChellyzCard[] = [];
  for (const pid of ['player1', 'player2'] as const) {
    const p = state.players[pid];
    if (p.active) allCards.push(p.active);
    allCards.push(...p.bench.filter(Boolean) as ChellyzCard[]);
    allCards.push(...p.hand, ...p.deck, ...p.discard);
  }

  const map = await buildImageMap(allCards);
  if (map.size === 0) return state; // nothing to patch

  return {
    ...state,
    players: {
      player1: applyImageMapToPlayer(state.players.player1, map),
      player2: applyImageMapToPlayer(state.players.player2, map),
    },
  };
}
