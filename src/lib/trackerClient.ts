/**
 * trackerClient.ts
 * Chia Gaming Tracker client — Koba42Corp protocol.
 *
 * Ported from arcane-battle-protocol/state-channel/tracker.ts
 * Supports BitTorrent-style room announce/discover for PvP matchmaking.
 *
 * State channel lifecycle:
 *   pending → locked → active → settling → settled | cancelled
 *
 * Room expiry: 600s without re-announce.
 * Re-announce interval: 60s.
 */

// ─── Types ─────────────────────────────────────────────────────────────────────

export type RoomStatus        = 'waiting' | 'active' | 'finished' | 'cancelled';
export type ChannelLockStatus = 'pending' | 'locked' | 'active' | 'settling' | 'settled' | 'cancelled';
export type GameType          = 'arcane-battle' | 'rockpaperscissors' | 'calpoker' | 'battleship' | 'tictactoe';
export type SortOrder         = 'newest' | 'oldest' | 'wager_high' | 'wager_low';

export interface RoomRecord {
  roomId:    string;
  gameType:  GameType | null;
  status:    RoomStatus;
  appBaseUrl: string;
  public:    boolean;

  // Player 1
  player1Name:              string;
  player1WalletAddress:     string;   // xch1... or txch1...
  player1WalletPuzzleHash?: string;
  player1PublicKey?:        string;   // BLS G1 hex (48 bytes)
  player1IdentityPublicKey?: string;
  player1PeerId:            string;   // PeerJS peer ID

  // Player 2 (set when joined)
  player2Name?:              string | null;
  player2WalletAddress?:     string | null;
  player2WalletPuzzleHash?:  string | null;
  player2PublicKey?:         string | null;
  player2PeerId?:            string | null;

  // State channel
  stateChannelCoinId?:       string | null;
  stateChannelStatus?:       ChannelLockStatus | null;
  totalLockedAmount?:        number | null;   // mojos
  stateChannelSpacescanUrl?: string | null;
  player1Balance?:           number | null;   // mojos
  player2Balance?:           number | null;

  // Game
  wagerAmount:  number;   // mojos
  activeGameId?: string | null;

  createdAt: number;
  updatedAt: number;
}

export interface AnnounceParams {
  roomId:               string;
  appBaseUrl:           string;
  player1Name:          string;
  player1WalletAddress: string;
  player1PeerId:        string;
  gameType?:            GameType;
  status?:              RoomStatus;
  public?:              boolean;
  wagerAmount?:         number;
  stateChannelCoinId?:  string;
  stateChannelStatus?:  ChannelLockStatus;
  totalLockedAmount?:   number;
  stateChannelSpacescanUrl?: string;
  player1Balance?:      number;
  player2Balance?:      number;
  player1PublicKey?:    string;
  timestamp?:           number;
  nonce?:               string;
  // Player 2 fields (sent when joining)
  player2Name?:          string;
  player2WalletAddress?: string;
  player2PeerId?:        string;
  player2PublicKey?:     string;
  activeGameId?:         string;
}

export interface AnnounceFilter {
  gameType?:       GameType | 'all';
  status?:         RoomStatus | 'all';
  search?:         string;
  minWager?:       number;
  maxWager?:       number;
  sort?:           SortOrder;
  offset?:         number;
  limit?:          number;
  includePrivate?: boolean;
}

export interface TrackerResponse {
  'tracker id':      string;
  interval:          number;
  'min interval':    number;
  complete:          number;
  incomplete:        number;
  rooms?:            RoomRecord[];
  room?:             RoomRecord;
  total?:            number;
  offset?:           number;
  limit?:            number;
  'failure reason'?: string;
}

export interface ScrapeResponse {
  'tracker id': string;
  files: {
    _total:         { complete: number; incomplete: number };
    _by_game_type:  Record<string, number>;
    _by_status:     Record<string, number>;
  };
}

// ─── Battle history ────────────────────────────────────────────────────────────

export interface BattleRecord {
  id:                   string;
  playerFingerprint:    string;
  opponentFingerprint:  string;
  opponentType:         'gym' | 'pvp';
  result:               'win' | 'loss' | 'draw' | 'forfeit';
  wagerAmount:          number;
  playerHpFinal:        number;
  opponentHpFinal:      number;
  settleTxId:           string | null;
  settledAt:            number;
}

export interface BattleStats {
  fingerprint: string;
  wins:        number;
  losses:      number;
  draws:       number;
  total:       number;
  winRate:     number;
  recent:      BattleRecord[];
}

// ─── TrackerClient ─────────────────────────────────────────────────────────────

export class TrackerClient {
  private baseUrl: string;
  private announceInterval: ReturnType<typeof setInterval> | null = null;
  private readonly ANNOUNCE_INTERVAL_MS = 60_000;

  constructor(baseUrl = 'https://relay.crate.ink') {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  /** Announce or update a room (create + update share the same endpoint). */
  async announceRoom(params: AnnounceParams): Promise<RoomRecord> {
    const payload = {
      ...params,
      timestamp: params.timestamp ?? Date.now(),
      nonce:     params.nonce     ?? crypto.randomUUID().replace(/-/g, ''),
    };
    const res = await fetch(`${this.baseUrl}/announce`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });
    const data: TrackerResponse = await res.json();
    if (data['failure reason']) throw new Error(`Tracker: ${data['failure reason']}`);
    return data.room!;
  }

  /** List available rooms. */
  async listRooms(filter: AnnounceFilter = {}): Promise<RoomRecord[]> {
    const p = new URLSearchParams();
    if (filter.gameType && filter.gameType !== 'all') p.set('gameType', filter.gameType);
    if (filter.status   && filter.status   !== 'all') p.set('status',   filter.status);
    if (filter.search)         p.set('search',         filter.search);
    if (filter.minWager)       p.set('minWager',        String(filter.minWager));
    if (filter.maxWager)       p.set('maxWager',        String(filter.maxWager));
    if (filter.sort)           p.set('sort',            filter.sort);
    if (filter.offset)         p.set('offset',          String(filter.offset));
    if (filter.limit)          p.set('limit',           String(filter.limit));
    if (filter.includePrivate) p.set('includePrivate',  'true');

    const res = await fetch(`${this.baseUrl}/announce?${p}`);
    const data: TrackerResponse = await res.json();
    if (data['failure reason']) throw new Error(`Tracker: ${data['failure reason']}`);
    return data.rooms ?? [];
  }

  /** Get a single room by ID. */
  async getRoom(roomId: string): Promise<RoomRecord | null> {
    try {
      const res = await fetch(`${this.baseUrl}/announce/${roomId}`);
      if (res.status === 404) return null;
      const data: TrackerResponse = await res.json();
      return data.room ?? null;
    } catch { return null; }
  }

  /** Scrape tracker statistics. */
  async scrape(): Promise<ScrapeResponse> {
    const res = await fetch(`${this.baseUrl}/scrape`);
    return res.json();
  }

  /** Health check. */
  async health(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/health`);
      return res.ok;
    } catch { return false; }
  }

  /**
   * Start auto-reannounce. Keeps the room alive in the tracker.
   * Call stopAutoReannounce() when the room closes.
   */
  startAutoReannounce(params: AnnounceParams): void {
    this.stopAutoReannounce();
    this.announceInterval = setInterval(async () => {
      try { await this.announceRoom(params); } catch (e) {
        console.warn('[Tracker] Re-announce failed:', e);
      }
    }, this.ANNOUNCE_INTERVAL_MS);
  }

  stopAutoReannounce(): void {
    if (this.announceInterval) {
      clearInterval(this.announceInterval);
      this.announceInterval = null;
    }
  }
}

/** Singleton tracker pointing at crate.ink (community tracker). */
export const tracker = new TrackerClient('https://relay.crate.ink');
