/**
 * chellyzLobbyStore.ts
 * PvP lobby lifecycle for Chellyz card games — mirrors lobbyStore.ts but uses
 * NFTData[] decks instead of a single Fighter.
 *
 * Step flow matches lobbyStore.ts exactly:
 *   Creator:  idle → pending → signing → waiting_peer → open
 *   Joiner:   idle → pending → signing → broadcasting → open
 *   Any:      * → error → retry
 *
 * State persisted under 'bow-chellyz-lobby-v1'.
 * Readiness handshake flows through the same /api/lobbies endpoint
 * but POSTs gameType:'chellyz' so public lobby browsers can filter.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { StateChannel } from '../lib/stateChannel';
import type { NFTData } from './bowActivityStore';
import { createPvpChannel, joinPvpChannel, generateInviteCode, settleChannel } from '../lib/channelOpen';

// ─── Peer-readiness polling ───────────────────────────────────────────────────
let _peerPollTimer: ReturnType<typeof setInterval> | null = null;
function stopPeerPolling() {
  if (_peerPollTimer !== null) { clearInterval(_peerPollTimer); _peerPollTimer = null; }
}

interface ChellyzLobbyRecord {
  partyAReady:  boolean;
  partyBReady:  boolean;
  partyBJoined: boolean;
  partyADeck:   NFTData[] | null;
  partyBDeck:   NFTData[] | null;
}
async function fetchLobbyRecord(code: string): Promise<ChellyzLobbyRecord | null> {
  try {
    const r = await fetch(`/api/lobbies?code=${code}`);
    const { lobby } = await r.json();
    return lobby ?? null;
  } catch { return null; }
}
async function patchLobby(code: string, fields: Record<string, unknown>): Promise<ChellyzLobbyRecord | null> {
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

export type ChellyzLobbyStep =
  | 'idle'
  | 'pending'
  | 'signing'
  | 'broadcasting'
  | 'waiting_peer'
  | 'open'
  | 'settling'
  | 'error';

export type ChellyzLobbyRole = 'creator' | 'joiner';

interface ChellyzLobbyStore {
  step:            ChellyzLobbyStep;
  role:            ChellyzLobbyRole | null;
  channel:         StateChannel | null;
  inviteCode:      string | null;
  isPublic:        boolean;
  errorMsg:        string | null;
  lastSeen:        number | null;
  /** Deck this player locked in before signing */
  myDeck:          NFTData[] | null;
  /** Opponent's deck (from Redis after both ready) */
  opponentDeck:    NFTData[] | null;
  /** True once partyB has joined (creator sees this banner) */
  opponentJoined:  boolean;
  /** Settle outcome once channel closed */
  settleOutcome:   'win' | 'loss' | 'draw' | 'forfeit' | null;

  createLobby: (isPublic?: boolean, hostId?: string, hostName?: string) => void;
  joinLobby:   (inviteCode: string) => void;
  confirmReady: (walletAddress: string, session: any, peerId: string, deck: NFTData[] | null) => Promise<void>;
  settlePvpBattle: (session: any, outcome: 'win' | 'loss' | 'draw' | 'forfeit', walletAddress?: string) => Promise<void>;
  exitLobby: () => void;
  reset:     () => void;
}

const RESET_STATE = {
  step:            'idle' as ChellyzLobbyStep,
  role:            null,
  channel:         null,
  inviteCode:      null,
  isPublic:        false,
  errorMsg:        null,
  lastSeen:        null,
  myDeck:          null,
  opponentDeck:    null,
  opponentJoined:  false,
  settleOutcome:   null,
};

// ─── Store ────────────────────────────────────────────────────────────────────

export const useChellyzLobbyStore = create<ChellyzLobbyStore>()(
  persist(
    (set, get) => ({
      ...RESET_STATE,

      createLobby: (isPublic = false, hostId = '', hostName = 'Anonymous Wizard') => {
        const code = generateInviteCode();
        console.log(`[aWizard] Chellyz lobby created (code: ${code}, public: ${isPublic})`);
        set({ step: 'pending', role: 'creator', inviteCode: code, isPublic, channel: null, errorMsg: null, lastSeen: Date.now() });
        fetch('/api/lobbies', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, hostId: hostId || 'private', hostName, isPublic, gameType: 'chellyz' }),
        }).catch((e) => console.warn('[aWizard] Could not register Chellyz lobby:', e));
      },

      joinLobby: (inviteCode) => {
        console.log(`[aWizard] Joining Chellyz lobby (code: ${inviteCode})`);
        set({ step: 'pending', role: 'joiner', inviteCode, channel: null, errorMsg: null, lastSeen: Date.now(), opponentJoined: false });
        patchLobby(inviteCode, { partyBJoined: true }).catch(() => {});
      },

      confirmReady: async (walletAddress, session, peerId, deck) => {
        const { role, inviteCode } = get();
        set({ step: 'signing', errorMsg: null, lastSeen: Date.now(), myDeck: deck ?? null });
        try {
          if (role === 'creator') {
            const { channel, inviteCode: confirmedCode } = await createPvpChannel(
              walletAddress, session, peerId, undefined, inviteCode ?? undefined,
            );
            set({ step: 'waiting_peer', channel, inviteCode: confirmedCode, lastSeen: Date.now() });

            if (confirmedCode) {
              const updated = await patchLobby(confirmedCode, {
                partyAReady: true,
                ...(deck ? { partyADeck: deck } : {}),
              });
              if (updated?.partyBReady) {
                stopPeerPolling();
                set({ step: 'open', opponentDeck: (updated.partyBDeck as NFTData[]) ?? null, lastSeen: Date.now() });
              } else {
                stopPeerPolling();
                _peerPollTimer = setInterval(async () => {
                  const lobby = await fetchLobbyRecord(confirmedCode);
                  if (!lobby) return;
                  if (lobby.partyBJoined) set({ opponentJoined: true });
                  if (lobby.partyBReady) {
                    stopPeerPolling();
                    set({ step: 'open', opponentDeck: (lobby.partyBDeck as NFTData[]) ?? null, lastSeen: Date.now() });
                  }
                }, 3000);
              }
            }
          } else {
            // joiner path
            if (!inviteCode) throw new Error('No invite code — rejoin the lobby');
            const channel = await joinPvpChannel(inviteCode, walletAddress, session, peerId);

            let opponentDeck: NFTData[] | null = null;
            let bothReady = channel.status === 'locked';
            if (!bothReady) {
              const updated = await patchLobby(inviteCode, {
                partyBReady: true,
                ...(deck ? { partyBDeck: deck } : {}),
              });
              bothReady = updated?.partyAReady === true;
              opponentDeck = (updated?.partyADeck as NFTData[]) ?? null;
            }

            if (bothReady) {
              stopPeerPolling();
              set({ step: 'open', channel, opponentDeck, lastSeen: Date.now() });
            } else {
              set({ step: 'broadcasting', channel, lastSeen: Date.now() });
              stopPeerPolling();
              _peerPollTimer = setInterval(async () => {
                const lobby = await fetchLobbyRecord(inviteCode);
                if (lobby?.partyAReady) {
                  stopPeerPolling();
                  set({ step: 'open', opponentDeck: (lobby.partyADeck as NFTData[]) ?? null, lastSeen: Date.now() });
                }
              }, 3000);
            }
          }
        } catch (err) {
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
          fetch(`/api/lobbies?code=${inviteCode}`, { method: 'DELETE' }).catch(() => {});
        }
        set(RESET_STATE);
      },

      reset: () => { stopPeerPolling(); set(RESET_STATE); },

      settlePvpBattle: async (session, outcome, walletAddress) => {
        const { channel, inviteCode, isPublic } = get();
        set({ step: 'settling', errorMsg: null, lastSeen: Date.now() });
        try {
          const channelId = channel?.channelId ?? inviteCode ?? 'unknown';
          await settleChannel(session, channelId, outcome, walletAddress);
          set({ settleOutcome: outcome, lastSeen: Date.now() });
          if (isPublic && inviteCode) {
            fetch(`/api/lobbies?code=${inviteCode}`, { method: 'DELETE' }).catch(() => {});
          }
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
      name: 'bow-chellyz-lobby-v1',
      partialize: (state) => ({
        step:         state.step,
        role:         state.role,
        channel:      state.channel,
        inviteCode:   state.inviteCode,
        isPublic:     state.isPublic,
        lastSeen:     state.lastSeen,
        myDeck:       state.myDeck,
        opponentDeck: state.opponentDeck,
        settleOutcome: state.settleOutcome,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        if (state.step === 'signing' || state.step === 'broadcasting') state.step = 'pending';
        if (state.step === 'settling') state.step = 'open';
        state.errorMsg = null;
        if (state.step !== 'idle') {
          console.log(`[aWizard] Chellyz lobby restored: step=${state.step} code=${state.inviteCode}`);
        }
      },
    },
  ),
);

export default useChellyzLobbyStore;
