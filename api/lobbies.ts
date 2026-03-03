import { type VercelRequest, type VercelResponse } from '@vercel/node';

/**
 * /api/lobbies — Public PvP Lobby Registry
 *
 * Keeps an in-memory list of public lobbies. Vercel keeps function instances
 * warm during active use, so this is good enough for a Discord Activity where
 * lobbies are short-lived (30 min TTL auto-cleanup).
 *
 * GET  /api/lobbies          → { lobbies: PublicLobby[] }
 * POST /api/lobbies          → { ok: true }  body: { code, hostId, hostName? }
 * DELETE /api/lobbies?code=  → { ok: true }
 */

interface PublicLobby {
  code:       string;
  hostId:     string;
  hostName:   string;
  createdAt:  number;
}

// In-memory store — shared within a warm Vercel instance (or cold-start fresh)
const publicLobbies = new Map<string, PublicLobby>();
const TTL_MS = 30 * 60 * 1000; // 30 minutes

function evictExpired() {
  const now = Date.now();
  for (const [code, lobby] of publicLobbies.entries()) {
    if (now - lobby.createdAt > TTL_MS) publicLobbies.delete(code);
  }
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();

  evictExpired();

  if (req.method === 'GET') {
    const lobbies = Array.from(publicLobbies.values())
      .sort((a, b) => b.createdAt - a.createdAt);
    return res.status(200).json({ lobbies });
  }

  if (req.method === 'POST') {
    const { code, hostId, hostName = 'Anonymous Wizard' } = req.body ?? {};
    if (!code || typeof code !== 'string' || code.length !== 6) {
      return res.status(400).json({ error: 'Invalid lobby code' });
    }
    if (!hostId || typeof hostId !== 'string') {
      return res.status(400).json({ error: 'hostId required' });
    }
    publicLobbies.set(code.toUpperCase(), {
      code: code.toUpperCase(),
      hostId,
      hostName: String(hostName).slice(0, 32),
      createdAt: Date.now(),
    });
    console.log(`[aWizard Lobbies] Registered public lobby ${code} by ${hostId}`);
    return res.status(200).json({ ok: true });
  }

  if (req.method === 'DELETE') {
    const code = String(req.query.code ?? '').toUpperCase();
    if (publicLobbies.has(code)) {
      publicLobbies.delete(code);
      console.log(`[aWizard Lobbies] Removed public lobby ${code}`);
    }
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
