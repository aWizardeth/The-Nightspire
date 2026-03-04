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
import type { Fighter } from '../lib/fighters';
import { createPvpChannel, joinPvpChannel, generateInviteCode, settleChannel } from '../lib/channelOpen';

// ─── Peer-readiness polling (module-level, outside Zustand) ───────────────────
let _peerPollTimer: ReturnType<typeof setInterval> | null = null;
function stopPeerPolling() {
  if (_peerPollTimer !== null) { clearInterval(_peerPollTimer); _peerPollTimer = null; }
}

interface LobbyRecord {
  partyAReady:  boolean;
  partyBReady:  boolean;
  partyBJoined: boolean;
  partyAFighter: Fighter | null;
  partyBFighter: Fighter | null;
}
async function fetchLobbyRecord(code: string): Promise<LobbyRecord | null> {
  try {
    const r = await fetch(`/api/lobbies?code=${code}`);
    const { lobby } = await r.json();
    return lobby ?? null;
  } catch { return null; }
}
async function patchLobby(code: string, fields: Record<string, unknown>): Promise<LobbyRecord | null> {
  try {
    const r = await fetch('/api/lobbies', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, ...fields }),
    });
    const { lobby } = await r.json();
    return lobby ?? null;
  } catch { return null; }
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type LobbyStep =
  | 'idle'
  | 'pending'       // lobby created/joined locally; waiting for ready confirmation
  | 'signing'       // awaiting chip0002_signCoinSpends from Sage wallet
  | 'broadcasting'  // submitting funding bundle to tracker relay (joiner path)
  | 'waiting_peer'  // party_a signed; waiting for party_b to countersign
  | 'open'          // channel locked; battle can begin
  | 'settling'      // waiting for settle/forfeit tx to land
  | 'error';

export type LobbyRole = 'creator' | 'joiner';

interface LobbyStore {
  step:            LobbyStep;
  role:            LobbyRole | null;
  channel:         StateChannel | null;
  inviteCode:      string | null;
  isPublic:        boolean;
  errorMsg:        string | null;
  lastSeen:        number | null;
  /** Fighter this user locked in before signing */
  myFighter:       Fighter | null;
  /** Opponent's locked-in fighter (fetched from Redis after both ready) */
  opponentFighter: Fighter | null;
  /** True once partyB has joined (creator sees this while in waiting_peer) */
  opponentJoined:  boolean;
  /** Settlement outcome once channel is closed */
  settleOutcome:   'win' | 'loss' | 'draw' | 'forfeit' | null;

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
   * Pass the fighter they've locked in — it's shared with the opponent via Redis.
   */
  confirmReady: (walletAddress: string, session: any, peerId: string, fighter: Fighter | null) => Promise<void>;

  /**
   * Settle (battle finished) or forfeit (mid-game leave) the open channel.
   * Signs a REMARK tx recording the outcome, then resets to idle.
   */
  settlePvpBattle: (session: any, outcome: 'win' | 'loss' | 'draw' | 'forfeit', walletAddress?: string) => Promise<void>;

  /** Leave the lobby without signing (returns to idle). */
  exitLobby: () => void;

  /** Reset to idle. */
  reset: () => void;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useLobbyStore = create<LobbyStore>()(
  persist(
    (set, get) => ({
      step:            'idle',
      role:            null,
      channel:         null,
      inviteCode:      null,
      isPublic:        false,
      errorMsg:        null,
      lastSeen:        null,
      myFighter:       null,
      opponentFighter: null,
      opponentJoined:  false,
      settleOutcome:   null,

      createLobby: (isPublic = false, hostId = '', hostName = 'Anonymous Wizard') => {
        const code = generateInviteCode();
        console.log(`[aWizard] PvP lobby created (code: ${code}, public: ${isPublic})`);
        set({ step: 'pending', role: 'creator', inviteCode: code, isPublic, channel: null, errorMsg: null, lastSeen: Date.now() });
        // Always register in Redis so the readiness handshake works.
        // Private lobbies are stored but not added to the public index.
        fetch('/api/lobbies', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, hostId: hostId || 'private', hostName, isPublic }),
        }).catch((e) => console.warn('[aWizard] Could not register lobby in Redis:', e));
      },

      joinLobby: (inviteCode) => {
        console.log(`[aWizard] Joining PvP lobby (code: ${inviteCode})`);
        set({ step: 'pending', role: 'joiner', inviteCode, channel: null, errorMsg: null, lastSeen: Date.now(), opponentJoined: false });
        // Signal to the creator that someone has joined
        patchLobby(inviteCode, { partyBJoined: true }).catch(() => {});
      },

      confirmReady: async (walletAddress, session, peerId, fighter) => {
        const { role, inviteCode } = get();
        set({ step: 'signing', errorMsg: null, lastSeen: Date.now(), myFighter: fighter ?? null });
        try {
          if (role === 'creator') {
            const { channel, inviteCode: confirmedCode } = await createPvpChannel(
              walletAddress, session, peerId, undefined, inviteCode ?? undefined,
            );
            set({ step: 'waiting_peer', channel, inviteCode: confirmedCode, lastSeen: Date.now() });

            // Mark partyA ready + share fighter in Redis, then poll for partyB
            if (confirmedCode) {
              const updated = await patchLobby(confirmedCode, {
                partyAReady: true,
                ...(fighter ? { partyAFighter: fighter } : {}),
              });
              if (updated?.partyBReady) {
                stopPeerPolling();
                set({
                  step: 'open',
                  opponentFighter: (updated.partyBFighter as Fighter) ?? null,
                  lastSeen: Date.now(),
                });
              } else {
                stopPeerPolling();
                _peerPollTimer = setInterval(async () => {
                  const lobby = await fetchLobbyRecord(confirmedCode);
                  if (!lobby) return;
                  // Show joined banner even before they sign
                  if (lobby.partyBJoined) set({ opponentJoined: true });
                  if (lobby.partyBReady) {
                    stopPeerPolling();
                    set({
                      step: 'open',
                      opponentFighter: (lobby.partyBFighter as Fighter) ?? null,
                      lastSeen: Date.now(),
                    });
                  }
                }, 3000);
              }
            }
          } else {
            if (!inviteCode) throw new Error('No invite code — rejoin the lobby');
            const channel = await joinPvpChannel(inviteCode, walletAddress, session, peerId);

            // Mark partyB ready + share fighter; check if partyA already ready
            let opponentFighter: Fighter | null = null;
            let bothReady = channel.status === 'locked';
            if (!bothReady) {
              const updated = await patchLobby(inviteCode, {
                partyBReady: true,
                ...(fighter ? { partyBFighter: fighter } : {}),
              });
              bothReady = updated?.partyAReady === true;
              opponentFighter = (updated?.partyAFighter as Fighter) ?? null;
            }

            if (bothReady) {
              stopPeerPolling();
              set({ step: 'open', channel, opponentFighter, lastSeen: Date.now() });
            } else {
              set({ step: 'broadcasting', channel, lastSeen: Date.now() });
              stopPeerPolling();
              _peerPollTimer = setInterval(async () => {
                const lobby = await fetchLobbyRecord(inviteCode);
                if (lobby?.partyAReady) {
                  stopPeerPolling();
                  set({
                    step: 'open',
                    opponentFighter: (lobby.partyAFighter as Fighter) ?? null,
                    lastSeen: Date.now(),
                  });
                }
              }, 3000);
            }
          }
        } catch (err) {
          // WalletConnect rejection arrives as a plain object { code, message },
          // not an Error instance — extract .message so we don't get [object Object]
          let msg: string;
          if (err instanceof Error) {
            msg = err.message;
          } else if (typeof err === 'object' && err !== null) {
            const e = err as Record<string, unknown>;
            msg = typeof e.message === 'string' ? e.message
                : typeof e.error   === 'string' ? e.error
                : JSON.stringify(err);
          } else {
            msg = String(err);
          }
          set({ step: 'error', errorMsg: msg });
        }
      },

      exitLobby: () => {
        stopPeerPolling();
        const { inviteCode, isPublic } = get();
        if (isPublic && inviteCode) {
          fetch(`/api/lobbies?code=${inviteCode}`, { method: 'DELETE' })
            .catch((e) => console.warn('[aWizard] Could not remove public lobby:', e));
        }
        set({ step: 'idle', role: null, channel: null, inviteCode: null, isPublic: false, errorMsg: null, lastSeen: null, myFighter: null, opponentFighter: null, opponentJoined: false, settleOutcome: null });
      },
      reset: () => { stopPeerPolling(); set({ step: 'idle', role: null, channel: null, inviteCode: null, isPublic: false, errorMsg: null, lastSeen: null, myFighter: null, opponentFighter: null, opponentJoined: false, settleOutcome: null }); },

      settlePvpBattle: async (session, outcome, walletAddress) => {
        const { channel, inviteCode, isPublic } = get();
        set({ step: 'settling', errorMsg: null, lastSeen: Date.now() });
        try {
          const channelId = channel?.channelId ?? inviteCode ?? 'unknown';
          await settleChannel(session, channelId, outcome, walletAddress);
          set({ settleOutcome: outcome, lastSeen: Date.now() });
          // Remove from public index
          if (isPublic && inviteCode) {
            fetch(`/api/lobbies?code=${inviteCode}`, { method: 'DELETE' }).catch(() => {});
          }
          // Brief delay so user sees the outcome, then back to idle
          setTimeout(() => get().reset(), 3500);
        } catch (err) {
          let msg: string;
          if (err instanceof Error) msg = err.message;
          else if (typeof err === 'object' && err !== null) {
            const e = err as Record<string, unknown>;
            msg = typeof e.message === 'string' ? e.message : JSON.stringify(err);
          } else msg = String(err);
          set({ step: 'error', errorMsg: msg });
        }
      },
    }),
    {
      name: 'bow-lobby-v1',
      // Only persist the fields needed to resume — never persist runtime errors
      partialize: (state) => ({
        step:            state.step,
        role:            state.role,
        channel:         state.channel,
        inviteCode:      state.inviteCode,
        isPublic:        state.isPublic,
        lastSeen:        state.lastSeen,
        myFighter:       state.myFighter,
        opponentFighter: state.opponentFighter,
        settleOutcome:   state.settleOutcome,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        // Signing was mid-flight when the page closed — revert to pending so the user
        // can see the lobby and click "I'm Ready" again. The invite code is preserved.
        if (state.step === 'signing' || state.step === 'broadcasting') {
          state.step = 'pending';
        }
        // Settlement was in-progress — revert to open so they can retry
        if (state.step === 'settling') {
          state.step = 'open';
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
