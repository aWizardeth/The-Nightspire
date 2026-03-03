/**
 * lobbyStore.ts
 * Zustand store for state channel lobby lifecycle.
 *
 * Step flow:
 *   Gym:  idle → creating → signing → broadcasting → open
 *   PvP:  idle → creating → signing → waiting_peer  (party_a)
 *         idle → signing  → broadcasting → open     (party_b join)
 *   Any:  * → error  (on failure)
 */

import { create } from 'zustand';
import type { StateChannel } from '../lib/stateChannel';
import { openGymChannel, createPvpChannel, joinPvpChannel } from '../lib/channelOpen';
import type { Fighter } from '../lib/fighters';

// ─── Types ────────────────────────────────────────────────────────────────────

export type LobbyStep =
  | 'idle'
  | 'creating'      // generating channel record + keys
  | 'signing'       // awaiting chip0002_signCoinSpends from Sage wallet
  | 'broadcasting'  // submitting funding bundle to gym-server or tracker relay
  | 'waiting_peer'  // PvP party_a: waiting for opponent to countersign
  | 'open'          // channel coin broadcast (or confirmed); battle can begin
  | 'error';

export type LobbyMode = 'gym' | 'pvp';

interface LobbyStore {
  mode:         LobbyMode;
  step:         LobbyStep;
  channel:      StateChannel | null;
  inviteCode:   string | null;
  errorMsg:     string | null;
  selectedTier: number;

  // ── Setters ──────────────────────────────────────────────────────────────
  setMode: (mode: LobbyMode) => void;
  setTier: (tier: number) => void;

  // ── Actions ──────────────────────────────────────────────────────────────

  /**
   * Open a PvE Gym lobby (party_a only, gym-server auto-countersigns).
   * @param walletAddress  xch1... player address
   * @param session        WalletConnect session (bowActivityStore.wallet.session)
   * @param fighter        selected fighter (for UI display; stats stay local)
   */
  openGymLobby: (walletAddress: string, session: any, fighter: Fighter) => Promise<void>;

  /**
   * Create a PvP lobby as party_a.
   * Returns invite code via store.inviteCode for sharing in Discord.
   * @param walletAddress  xch1... player address
   * @param session        WalletConnect session
   * @param peerId         Discord user ID (used as relay identity)
   */
  openPvpLobby: (walletAddress: string, session: any, peerId: string) => Promise<void>;

  /**
   * Join an existing PvP lobby as party_b.
   * @param inviteCode     6-char code from the lobby creator
   * @param walletAddress  xch1... player address
   * @param session        WalletConnect session
   * @param peerId         Discord user ID
   */
  joinPvpLobby: (inviteCode: string, walletAddress: string, session: any, peerId: string) => Promise<void>;

  /** Reset to idle — clears channel, invite code, and error. */
  reset: () => void;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useLobbyStore = create<LobbyStore>()((set, get) => ({
  mode:         'gym',
  step:         'idle',
  channel:      null,
  inviteCode:   null,
  errorMsg:     null,
  selectedTier: 1,

  setMode: (mode) => set({ mode, step: 'idle', channel: null, inviteCode: null, errorMsg: null }),
  setTier: (tier) => set({ selectedTier: tier }),

  openGymLobby: async (walletAddress, session, _fighter) => {
    const { selectedTier } = get();
    set({ step: 'creating', errorMsg: null, channel: null });
    try {
      set({ step: 'signing' });
      const channel = await openGymChannel(walletAddress, session, selectedTier, walletAddress);
      set({ step: 'broadcasting' });
      // openGymChannel already called broadcastFundingBundle; reflect status:
      set({ step: channel.status === 'locked' ? 'open' : 'broadcasting', channel });
    } catch (err) {
      set({ step: 'error', errorMsg: err instanceof Error ? err.message : String(err) });
    }
  },

  openPvpLobby: async (walletAddress, session, peerId) => {
    set({ step: 'creating', errorMsg: null, channel: null });
    try {
      set({ step: 'signing' });
      const { channel, inviteCode } = await createPvpChannel(walletAddress, session, peerId);
      set({ step: 'waiting_peer', channel, inviteCode });
    } catch (err) {
      set({ step: 'error', errorMsg: err instanceof Error ? err.message : String(err) });
    }
  },

  joinPvpLobby: async (inviteCode, walletAddress, session, peerId) => {
    set({ step: 'signing', errorMsg: null, channel: null, inviteCode });
    try {
      const channel = await joinPvpChannel(inviteCode, walletAddress, session, peerId);
      set({
        step:    channel.status === 'locked' ? 'open' : 'broadcasting',
        channel,
        inviteCode,
      });
    } catch (err) {
      set({ step: 'error', errorMsg: err instanceof Error ? err.message : String(err) });
    }
  },

  reset: () => set({ step: 'idle', channel: null, inviteCode: null, errorMsg: null }),
}));

export default useLobbyStore;
