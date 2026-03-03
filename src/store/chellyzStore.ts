/**
 * chellyzStore.ts
 * Zustand slice for the Chellyz card game mode.
 * Completely separate from bowActivityStore — not persisted.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { ChellyzGameState, PlayerId } from '../lib/chellyzEngine';
import type { NFTData } from './bowActivityStore';
import { enrichGameImages } from '../lib/chellyzImages';
import {
  startGame,
  resolveCoinFlip,
  drawPhase,
  endTurn,
  aiTakeTurn,
  sacrifice,
  evolve,
  retreat,
  benchSwap,
  benchFill,
  playSupport,
  normalAttack,
  specialAttack,
  piercingRoll,
  skipSacrifice,
  skipEvolution,
  skipRetreat,
  skipBenchSwap,
  skipBenchFill,
  skipSupport,
  skipPiercingRoll,
} from '../lib/chellyzEngine';

// ─── Types ────────────────────────────────────────────────────────────────────

export type OpponentType = 'ai' | 'hot_seat';

interface ChellyzState {
  /** Current game state (null if no active game) */
  game:          ChellyzGameState | null;
  /** This client's player ID */
  localPlayerId: PlayerId;
  /** Who the opponent is (AI or local 2P hot seat) */
  opponentType:  OpponentType;
  /** Latest dice roll value (for animation) */
  lastRoll:      number | null;
  /** Coin flip result (for animation) */
  lastCoinFlip:  'heads' | 'tails' | null;
  /** Whether a dice/coin animation is showing */
  showingAnimation: boolean;
}

interface ChellyzActions {
  // Game lifecycle
  startNewGame:   (p1Name: string, p1Nfts: NFTData[] | null, p2Name: string, p2Nfts: NFTData[] | null, mode: OpponentType) => void;
  doFlip:         () => void;
  resetGame:      () => void;

  // Turn phases
  doDrawPhase:    () => void;
  doSacrifice:    (chellyInstanceId: string) => void;
  doSkipSacrifice: () => void;
  doEvolve:       (targetInstanceId: string, evoCardInstanceId: string) => void;
  doSkipEvolution: () => void;
  doRetreat:      (benchSlot: number) => void;
  doSkipRetreat:  () => void;
  doBenchSwap:    (slotA: number, slotB: number) => void;
  doSkipBenchSwap: () => void;
  doBenchFill:    (handCardInstanceId: string, benchSlot: number) => void;
  doSkipBenchFill: () => void;
  doPlaySupport:  (cardInstanceId: string) => void;
  doSkipSupport:  () => void;
  doNormalAttack: () => void;
  doSpecialAttack: () => void;
  doPiercingRoll: () => void;
  doSkipPiercing: () => void;
  doEndTurn:      () => void;

  /** Async: fetch missing card images from MintGarden and patch game state */
  enrichImages:   () => Promise<void>;

  /** Let the AI take a full turn (when opponentType === 'ai') */
  doAiTurn:       () => void;

  clearAnimation: () => void;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useChellyzStore = create<ChellyzState & ChellyzActions>()(
  devtools(
    (set, get) => ({
      // ── Initial state ──────────────────────────────────────────────────────
      game:             null,
      localPlayerId:    'player1',
      opponentType:     'ai',
      lastRoll:         null,
      lastCoinFlip:     null,
      showingAnimation: false,

      // ── Lifecycle ──────────────────────────────────────────────────────────
      startNewGame: (p1Name, p1Nfts, p2Name, p2Nfts, mode) => {
        const game = startGame(
          'player1', p1Name, p1Nfts,
          'player2', p2Name, p2Nfts,
        );
        set({ game, localPlayerId: 'player1', opponentType: mode, lastRoll: null, lastCoinFlip: null });
      },

      doFlip: () => {
        const { game } = get();
        if (!game) return;
        const { newState, result } = resolveCoinFlip(game);
        set({ game: newState, lastCoinFlip: result, showingAnimation: true });
      },

      resetGame: () => set({ game: null, lastRoll: null, lastCoinFlip: null }),

      // ── Helpers ────────────────────────────────────────────────────────────

      // ── Phase actions ──────────────────────────────────────────────────────
      doDrawPhase: () => {
        const { game } = get();
        if (!game) return;
        set({ game: drawPhase(game) });
      },

      doSacrifice: (chellyInstanceId) => {
        const { game, localPlayerId } = get();
        if (!game) return;
        set({ game: sacrifice(game, localPlayerId, chellyInstanceId) });
      },

      doSkipSacrifice: () => {
        const { game } = get();
        if (!game) return;
        set({ game: skipSacrifice(game) });
      },

      doEvolve: (targetInstanceId, evoCardInstanceId) => {
        const { game, localPlayerId } = get();
        if (!game) return;
        set({ game: evolve(game, localPlayerId, targetInstanceId, evoCardInstanceId) });
      },

      doSkipEvolution: () => {
        const { game } = get();
        if (!game) return;
        set({ game: skipEvolution(game) });
      },

      doRetreat: (benchSlot) => {
        const { game, localPlayerId } = get();
        if (!game) return;
        set({ game: retreat(game, localPlayerId, benchSlot) });
      },

      doSkipRetreat: () => {
        const { game } = get();
        if (!game) return;
        set({ game: skipRetreat(game) });
      },

      doBenchSwap: (slotA, slotB) => {
        const { game, localPlayerId } = get();
        if (!game) return;
        set({ game: benchSwap(game, localPlayerId, slotA, slotB) });
      },

      doSkipBenchSwap: () => {
        const { game } = get();
        if (!game) return;
        set({ game: skipBenchSwap(game) });
      },

      doBenchFill: (handCardInstanceId, benchSlot) => {
        const { game, localPlayerId } = get();
        if (!game) return;
        set({ game: benchFill(game, localPlayerId, handCardInstanceId, benchSlot) });
      },

      doSkipBenchFill: () => {
        const { game } = get();
        if (!game) return;
        set({ game: skipBenchFill(game) });
      },

      doPlaySupport: (cardInstanceId) => {
        const { game, localPlayerId } = get();
        if (!game) return;
        set({ game: playSupport(game, localPlayerId, cardInstanceId) });
      },

      doSkipSupport: () => {
        const { game } = get();
        if (!game) return;
        set({ game: skipSupport(game) });
      },

      doNormalAttack: () => {
        const { game, localPlayerId } = get();
        if (!game) return;
        set({ game: normalAttack(game, localPlayerId) });
      },

      doSpecialAttack: () => {
        const { game, localPlayerId } = get();
        if (!game) return;
        set({ game: specialAttack(game, localPlayerId) });
      },

      doPiercingRoll: () => {
        const { game, localPlayerId } = get();
        if (!game) return;
        const { newState, roll } = piercingRoll(game, localPlayerId);
        set({ game: newState, lastRoll: roll, showingAnimation: true });
      },

      doSkipPiercing: () => {
        const { game } = get();
        if (!game) return;
        set({ game: skipPiercingRoll(game) });
      },

      doEndTurn: () => {
        const { game, localPlayerId } = get();
        if (!game) return;
        set({ game: endTurn(game, localPlayerId) });
      },

      doAiTurn: () => {
        const { game, opponentType } = get();
        if (!game || opponentType !== 'ai') return;
        // AI is always player2 in single-player mode
        const aiState = aiTakeTurn(game, 'player2');
        set({ game: aiState });
      },

      enrichImages: async () => {
        const { game } = get();
        if (!game) return;
        const enriched = await enrichGameImages(game);
        set({ game: enriched });
      },

      clearAnimation: () => set({ showingAnimation: false }),
    }),
    { name: 'chellyz-store' },
  ),
);

// ─── Selectors ────────────────────────────────────────────────────────────────

export const selectGame        = (s: ChellyzState) => s.game;
export const selectLocalPlayer = (s: ChellyzState & ChellyzActions) =>
  s.game?.players[s.localPlayerId] ?? null;
export const selectOpponent    = (s: ChellyzState & ChellyzActions) =>
  s.game?.players[s.localPlayerId === 'player1' ? 'player2' : 'player1'] ?? null;
export const selectIsMyTurn    = (s: ChellyzState & ChellyzActions) =>
  s.game?.currentTurn === s.localPlayerId;
export const selectPhase       = (s: ChellyzState) => s.game?.phase ?? null;
export const selectWinner      = (s: ChellyzState) => s.game?.winner ?? null;
export const selectLog         = (s: ChellyzState) => s.game?.log ?? [];
