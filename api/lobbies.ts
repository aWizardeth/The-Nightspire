import { type VercelRequest, type VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';

/**
 * /api/lobbies — Public PvP Lobby Registry (Upstash Redis backend)
 *
 * Lobbies are stored as JSON strings in Redis with a 30-minute TTL.
 * Key pattern: bow:lobby:<CODE>
 * Index key:   bow:lobbies  (Redis Set of active codes, for fast listing)
 *
 * Fully serverless-safe — survives cold starts and shared across all
 * Vercel function instances. Ready for multi-relay federation.
 *
 * GET    /api/lobbies             → { lobbies: PublicLobby[] }
 * GET    /api/lobbies?code=XXXX   → { lobby: PublicLobby | null }
 * POST   /api/lobbies             → { ok: true }  body: { code, hostId, hostName? }
 * PATCH  /api/lobbies             → { ok: true }  body: { code, partyAReady?, partyBReady? }
 * DELETE /api/lobbies?code=       → { ok: true }
 *
 * Env vars required:
 *   UPSTASH_REDIS_REST_URL
 *   UPSTASH_REDIS_REST_TOKEN
 */

const TTL_SECONDS = 30 * 60; // 30 minutes
const LOBBY_KEY   = (code: string) => `bow:lobby:${code}`;
const INDEX_KEY   = 'bow:lobbies';

interface PublicLobby {
  code:         string;
  hostId:       string;
  hostName:     string;
  createdAt:    number;
  partyAReady:  boolean;
  partyBReady:  boolean;
  partyBJoined: boolean;
  /** Identifies the game mode — defaults to 'battle' for backwards compat */
  gameType?:    'battle' | 'chellyz';
  /** Serialised Fighter object chosen by each party before signing (battle mode) */
  partyAFighter: unknown | null;
  partyBFighter: unknown | null;
  /** Serialised NFTData[] deck chosen by each party (chellyz mode) */
  partyADeck?: unknown | null;
  partyBDeck?: unknown | null;
}

let redis: Redis | null = null;
function getRedis(): Redis | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }
  if (!redis) {
    redis = new Redis({
      url:   process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
  return redis;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();

  const db = getRedis();

  // Redis not configured — return empty lobbies gracefully instead of crashing
  if (!db) {
    console.warn('[aWizard Lobbies] Redis env vars not configured — running in no-persistence mode');
    if (req.method === 'GET') return res.status(200).json({ lobbies: [] });
    return res.status(200).json({ ok: true });
  }

  try {

  // ── GET — list all lobbies, or fetch one by ?code= ───────────────────────
  if (req.method === 'GET') {
    const codeParam = String(req.query.code ?? '').toUpperCase();

    // Single-lobby lookup (used for readiness polling)
    if (codeParam.length === 6) {
      const lobby = await db.get<PublicLobby>(LOBBY_KEY(codeParam));
      return res.status(200).json({ lobby: lobby ?? null });
    }

    // Full list
    const codes = await db.smembers(INDEX_KEY);
    if (codes.length === 0) return res.status(200).json({ lobbies: [] });

    const entries = await Promise.all(
      codes.map((code) => db.get<PublicLobby>(LOBBY_KEY(code))),
    );
    // Filter nulls (expired TTL but index not yet cleaned)
    const lobbies = (entries.filter(Boolean) as PublicLobby[])
      .sort((a, b) => b.createdAt - a.createdAt);

    // Prune stale codes from index (expired keys returned null)
    const stale = codes.filter((_, i) => entries[i] === null);
    if (stale.length) await db.srem(INDEX_KEY, ...stale);

    return res.status(200).json({ lobbies });
  }

  // ── POST — register a new public lobby ──────────────────────────────────
  if (req.method === 'POST') {
    const { code, hostId, hostName = 'Anonymous Wizard', isPublic = false, gameType = 'battle' } = req.body ?? {};
    if (!code || typeof code !== 'string' || code.length !== 6) {
      return res.status(400).json({ error: 'Invalid lobby code' });
    }
    if (!hostId || typeof hostId !== 'string') {
      return res.status(400).json({ error: 'hostId required' });
    }
    const lobby: PublicLobby = {
      code:         code.toUpperCase(),
      hostId,
      hostName:     String(hostName).slice(0, 32),
      createdAt:    Date.now(),
      gameType:     gameType === 'chellyz' ? 'chellyz' : 'battle',
      partyAReady:  false,
      partyBReady:  false,
      partyBJoined: false,
      partyAFighter: null,
      partyBFighter: null,
      partyADeck:   null,
      partyBDeck:   null,
    };
    await db.set(LOBBY_KEY(lobby.code), lobby, { ex: TTL_SECONDS });
    // Only add to the public index if explicitly public — private lobbies are
    // stored for the readiness handshake but won't appear in the lobby browser.
    if (isPublic) await db.sadd(INDEX_KEY, lobby.code);
    console.log(`[aWizard Lobbies] Registered ${isPublic ? 'public' : 'private'} lobby ${lobby.code} by ${hostId}`);
    return res.status(200).json({ ok: true });
  }

  // ── PATCH — mark a party as ready ─────────────────────────────────────────
  if (req.method === 'PATCH') {
    const { code, partyAReady, partyBReady, partyBJoined, partyAFighter, partyBFighter, partyADeck, partyBDeck } = req.body ?? {};
    if (!code || typeof code !== 'string' || code.length !== 6) {
      return res.status(400).json({ error: 'Invalid lobby code' });
    }
    const key   = LOBBY_KEY(code.toUpperCase());
    const lobby = await db.get<PublicLobby>(key);
    if (!lobby) return res.status(404).json({ error: 'Lobby not found' });
    const updated: PublicLobby = {
      ...lobby,
      ...(partyAReady  !== undefined ? { partyAReady:  Boolean(partyAReady)  } : {}),
      ...(partyBReady  !== undefined ? { partyBReady:  Boolean(partyBReady)  } : {}),
      ...(partyBJoined !== undefined ? { partyBJoined: Boolean(partyBJoined) } : {}),
      ...(partyAFighter !== undefined ? { partyAFighter } : {}),
      ...(partyBFighter !== undefined ? { partyBFighter } : {}),
      ...(partyADeck !== undefined ? { partyADeck } : {}),
      ...(partyBDeck !== undefined ? { partyBDeck } : {}),
    };
    await db.set(key, updated, { ex: TTL_SECONDS });
    console.log(`[aWizard Lobbies] PATCH ${code.toUpperCase()} joined=${updated.partyBJoined} A=${updated.partyAReady} B=${updated.partyBReady}`);
    return res.status(200).json({ ok: true, lobby: updated });
  }

  // ── DELETE — remove a lobby (host exited) ───────────────────────────────
  if (req.method === 'DELETE') {
    const code = String(req.query.code ?? '').toUpperCase();
    if (code.length === 6) {
      await db.del(LOBBY_KEY(code));
      await db.srem(INDEX_KEY, code);
      console.log(`[aWizard Lobbies] Removed public lobby ${code}`);
    }
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('[aWizard Lobbies] Handler error:', err);
    if (req.method === 'GET') return res.status(200).json({ lobbies: [] });
    return res.status(500).json({ error: 'Internal server error' });
  }
}
