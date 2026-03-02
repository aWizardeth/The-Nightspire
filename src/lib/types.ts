// ─────────────────────────────────────────────────────────────────
//  Shared types for the aWizard GUI
// ─────────────────────────────────────────────────────────────────

/** A simplified battle record shown on the dashboard */
export interface BattleRecord {
  id: string;
  status: 'active' | 'complete' | 'abandoned';
  opponent: string;
  tier: number;
  playerHp: number;
  opponentHp: number;
  turns: number;
  result?: 'win' | 'loss' | 'draw';
  timestamp: number;
}

/** Leaderboard entry */
export interface LeaderboardEntry {
  rank: number;
  wallet: string;
  displayName?: string;
  aps: number;
  wins: number;
  losses: number;
}

/** NFT display data */
export interface NftDisplay {
  nftId: string;
  name: string;
  tier: number;
  element: string;
  aps: number;
  imageUrl?: string;
  metadata: Record<string, unknown>;
}
