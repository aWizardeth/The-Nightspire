/**
 * lobbyStore.ts
 * PvP lobby lifecycle — deferred signing, persisted across reconnects.
 *
 * Step flow:
 *   Creator:  idle → pending → signing → waiting_peer → open
 *   Joiner:   idle → pending → signing → broadcasting → open
 *   Any:      * → error
 *
 * createLobby / joinLobby are synchronous — they just set local state.
 * confirmReady is async — triggers wallet signature + state channel open.
 *
 * State is persisted to localStorage (key: 'bow-lobby-v1') so a user who
 * disconnects can reopen the Activity and resume their pending channel.
 * If signing was interrupted mid-flow, the step reverts to 'pending' on
 * rehydration so the user can retry without re-entering the lobby.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { StateChannel } from '../lib/stateChannel';
import { createPvpChannel, joinPvpChannel, generateInviteCode } from '../lib/channelOpen';

// ─── Types ────────────────────────────────────────────────────────────────────

export type LobbyStep =
  | 'idle'
  | 'pending'       // lobby created/joined locally; waiting for ready confirmation
  | 'signing'       // awaiting chip0002_signCoinSpends from Sage wallet
  | 'broadcasting'  // submitting funding bundle to tracker relay (joiner path)
  | 'waiting_peer'  // party_a signed; waiting for party_b to countersign
  | 'open'          // channel locked; battle can begin
  | 'error';

export type LobbyRole = 'creator' | 'joiner';

interface LobbyStore {
  step:       LobbyStep;
  role:       LobbyRole | null;
  channel:    StateChannel | null;
  inviteCode: string | null;
  isPublic:   boolean;
  errorMsg:   string | null;
  /** Unix ms timestamp of the last meaningful state change — for future timeout logic. */
  lastSeen:   number | null;

  /**
   * Create a new PvP lobby locally — generates invite code, no wallet yet.
   * Pass isPublic=true to list the lobby in the public browser;
   * hostId / hostName are used for display in the public list.
   */
  createLobby: (isPublic?: boolean, hostId?: string, hostName?: string) => void;

  /** Join an existing PvP lobby by invite code — no signing yet. */
  joinLobby: (inviteCode: string) => void;

  /**
   * Confirm ready → wallet signature → open state channel on-chain.
   * Both parties call this independently when ready to lock funds.
   */
  confirmReady: (walletAddress: string, session: any, peerId: string) => Promise<void>;

  /** Leave the lobby without signing (returns to idle). */
  exitLobby: () => void;

  /** Reset to idle. */
  reset: () => void;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useLobbyStore = create<LobbyStore>()(
  persist(
    (set, get) => ({
      step:       'idle',
      role:       null,
      channel:    null,
      inviteCode: null,
      isPublic:   false,
      errorMsg:   null,
      lastSeen:   null,

      createLobby: (isPublic = false, hostId = '', hostName = 'Anonymous Wizard') => {
        const code = generateInviteCode();
        console.log(`[aWizard] PvP lobby created (code: ${code}, public: ${isPublic})`);
        set({ step: 'pending', role: 'creator', inviteCode: code, isPublic, channel: null, errorMsg: null, lastSeen: Date.now() });
        if (isPublic && hostId) {
          fetch('/api/lobbies', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, hostId, hostName }),
          }).catch((e) => console.warn('[aWizard] Could not register public lobby:', e));
        }
      },

      joinLobby: (inviteCode) => {
        console.log(`[aWizard] Joining PvP lobby (code: ${inviteCode})`);
        set({ step: 'pending', role: 'joiner', inviteCode, channel: null, errorMsg: null, lastSeen: Date.now() });
      },

      confirmReady: async (walletAddress, session, peerId) => {
        const { role, inviteCode } = get();
        set({ step: 'signing', errorMsg: null, lastSeen: Date.now() });
        try {
          if (role === 'creator') {
            const { channel, inviteCode: confirmedCode } = await createPvpChannel(
              walletAddress, session, peerId, undefined, inviteCode ?? undefined,
            );
            set({ step: 'waiting_peer', channel, inviteCode: confirmedCode, lastSeen: Date.now() });
          } else {
            if (!inviteCode) throw new Error('No invite code — rejoin the lobby');
            const channel = await joinPvpChannel(inviteCode, walletAddress, session, peerId);
            set({
              step:     channel.status === 'locked' ? 'open' : 'broadcasting',
              channel,
              lastSeen: Date.now(),
            });
          }
        } catch (err) {
          set({ step: 'error', errorMsg: err instanceof Error ? err.message : String(err) });
        }
      },

      exitLobby: () => {
        const { inviteCode, isPublic } = get();
        if (isPublic && inviteCode) {
          fetch(`/api/lobbies?code=${inviteCode}`, { method: 'DELETE' })
            .catch((e) => console.warn('[aWizard] Could not remove public lobby:', e));
        }
        set({ step: 'idle', role: null, channel: null, inviteCode: null, isPublic: false, errorMsg: null, lastSeen: null });
      },
      reset: () => set({ step: 'idle', role: null, channel: null, inviteCode: null, isPublic: false, errorMsg: null, lastSeen: null }),
    }),
    {
      name: 'bow-lobby-v1',
      // Only persist the fields needed to resume — never persist runtime errors
      partialize: (state) => ({
        step:       state.step,
        role:       state.role,
        channel:    state.channel,
        inviteCode: state.inviteCode,
        isPublic:   state.isPublic,
        lastSeen:   state.lastSeen,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        // Signing was mid-flight when the page closed — revert to pending so the user
        // can see the lobby and click "I'm Ready" again. The invite code is preserved.
        if (state.step === 'signing' || state.step === 'broadcasting') {
          state.step = 'pending';
        }
        // Never restore a stale error
        state.errorMsg = null;
        if (state.step !== 'idle') {
          console.log(`[aWizard] Lobby restored from storage: step=${state.step} code=${state.inviteCode}`);
        }
      },
    },
  ),
);

export default useLobbyStore;
