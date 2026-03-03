/**
 * chellyzEngine.ts
 * Pure-function game-state machine for the Chellyz card game.
 * No React, no side effects — fully serializable for hot-seat + future network play.
 *
 * Turn order (per rulebook):
 *  1. Draw Phase         — draw 1 card
 *  2. Sacrifice Phase    — discard 1 Chelly → +1 EB (max 2/turn)
 *  3. Evolution Phase    — evolve Active or Bench Chelly
 *  4. Retreat Phase      — swap Active ↔ Bench (ends turn)
 *  5. Bench Swap Phase   — rearrange bench card to another slot (once)
 *  6. Bench Fill Phase   — play L1 Chelly from hand onto empty bench
 *  7. Support Prep Phase — stage a Memory Artifact (activates next turn)
 *  8. Action Phase       — Normal Attack or Special Attack
 *  9. Piercing Roll      — spend 1 EB, roll d6, reduce opponent DEF (optional)
 *
 * Win: first player to score 4 KOs wins.
 */

import {
  type ChellyzCard,
  buildEnergyBloomDeck,
  buildStarterDeck,
  calculateChellyDamage,
  coinFlip as _coinFlip,
  evolutionCost,
  getEvolutionCard,
  rollD6 as _rollD6,
} from './chellyzCards';
import type { NFTData } from '../store/bowActivityStore';
import { buildNftDeck } from './chellyzCards';

export { rollD6 as rollDie, coinFlip } from './chellyzCards';

// ─── Types ────────────────────────────────────────────────────────────────────

export type PlayerId = 'player1' | 'player2';

export type TurnPhase =
  | 'draw'
  | 'sacrifice'
  | 'evolution'
  | 'retreat'
  | 'bench_swap'
  | 'bench_fill'
  | 'support_prep'
  | 'action'
  | 'piercing_roll'
  | 'end'
  | 'coin_flip'
  | 'finished';

export type PenaltyState = 'none' | 'partial' | 'full';

/** Active artifact effects applied at start of attacker's turn */
export interface ArtifactEffects {
  hpRestore:      number;  // HP restored to active
  atkBonus:       number;  // ATK boost for this turn
  defBonus:       number;  // DEF boost for this turn
  spdBonus:       number;  // SPD boost for this turn
  evoDiscount:    number;  // EB discount on evolution
  opponentDiscardEB: number;  // opponent loses N EB this turn
}

export interface PlayerState {
  id:              string;
  name:            string;
  active:          ChellyzCard | null;
  bench:           (ChellyzCard | null)[];   // exactly 3 slots
  support:         ChellyzCard | null;       // staged Memory Artifact
  energy:          ChellyzCard[];            // EB in play, max 7
  hand:            ChellyzCard[];
  deck:            ChellyzCard[];
  ebDeck:          ChellyzCard[];
  discard:         ChellyzCard[];
  kos:             number;                   // KOs scored
  penaltyState:    PenaltyState;
  isNftDeck:       boolean;
  /** Pending effect from a staged Memory Artifact (activates on this player's turn) */
  pendingArtifact: ArtifactEffects | null;
  /** DEF override from piercing roll this turn */
  piercingDefOverride: number | null;
}

export interface TurnFlags {
  sacrificesThisTurn:       number;   // max 2
  hasAttackedThisTurn:      boolean;
  hasPiercingRolled:        boolean;
  hasRetreated:             boolean;  // retreat ends the turn
  hasBenchSwapped:          boolean;
  hasBenchFilled:           boolean;
  hasStagedSupport:         boolean;
  artifactActiveThisTurn:   ArtifactEffects | null;
}

export interface ChellyzGameState {
  gameId:      string;
  turnNumber:  number;
  currentTurn: PlayerId;
  phase:       TurnPhase;
  players:     { player1: PlayerState; player2: PlayerState };
  turnFlags:   TurnFlags;
  status:      'setup' | 'coin_flip' | 'active' | 'penalty' | 'finished';
  winner:      PlayerId | null;
  firstPlayer: PlayerId | null;
  log:         string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function opponent(id: PlayerId): PlayerId {
  return id === 'player1' ? 'player2' : 'player1';
}

function log(state: ChellyzGameState, msg: string): ChellyzGameState {
  return { ...state, log: [...state.log, msg] };
}

function initArtifactEffects(): ArtifactEffects {
  return { hpRestore: 0, atkBonus: 0, defBonus: 0, spdBonus: 0, evoDiscount: 0, opponentDiscardEB: 0 };
}

function initTurnFlags(): TurnFlags {
  return {
    sacrificesThisTurn:     0,
    hasAttackedThisTurn:    false,
    hasPiercingRolled:      false,
    hasRetreated:           false,
    hasBenchSwapped:        false,
    hasBenchFilled:         false,
    hasStagedSupport:       false,
    artifactActiveThisTurn: null,
  };
}

function initPlayer(id: string, name: string, deck: ChellyzCard[], ebDeck: ChellyzCard[], isNftDeck: boolean): PlayerState {
  // Deal 7 cards
  const hand = deck.slice(0, 7);
  const restDeck = deck.slice(7);
  return {
    id, name,
    active:              null,
    bench:               [null, null, null],
    support:             null,
    energy:              [],
    hand,
    deck:                restDeck,
    ebDeck,
    discard:             [],
    kos:                 0,
    penaltyState:        'none',
    isNftDeck,
    pendingArtifact:     null,
    piercingDefOverride: null,
  };
}

function getPlayer(state: ChellyzGameState, id: PlayerId): PlayerState {
  return state.players[id];
}

function setPlayer(state: ChellyzGameState, id: PlayerId, p: PlayerState): ChellyzGameState {
  return { ...state, players: { ...state.players, [id]: p } };
}

function drawCard(player: PlayerState): PlayerState {
  if (player.deck.length === 0) return player; // deck empty — no draw
  const [card, ...rest] = player.deck;
  return { ...player, hand: [...player.hand, card], deck: rest };
}

function drawEBCard(player: PlayerState, count = 1): PlayerState {
  let p = player;
  for (let i = 0; i < count; i++) {
    if (p.ebDeck.length === 0 || p.energy.length >= 7) break;
    // Draw from EB deck → immediately add to energy zone
    const [card, ...rest] = p.ebDeck;
    p = { ...p, energy: [...p.energy, card], ebDeck: rest };
  }
  return p;
}

function spendEB(player: PlayerState, amount: number): PlayerState | null {
  if (player.energy.length < amount) return null;
  return { ...player, energy: player.energy.slice(amount) };
}

function checkWin(state: ChellyzGameState): ChellyzGameState {
  for (const id of (['player1', 'player2'] as PlayerId[])) {
    if (state.players[id].kos >= 4) {
      return { ...state, status: 'finished', winner: id, phase: 'finished' };
    }
  }
  return state;
}

/** Called when a Chelly's HP hits 0: remove it, attacker scores KO, promote bench */
function recordKO(state: ChellyzGameState, loser: PlayerId): ChellyzGameState {
  let s = state;
  const scorer = opponent(loser);
  let loserPlayer = getPlayer(s, loser);
  let scorerPlayer = getPlayer(s, scorer);

  // Move Active to discard
  if (loserPlayer.active) {
    loserPlayer = { ...loserPlayer, active: null, discard: [...loserPlayer.discard, loserPlayer.active] };
  }

  // Scorer gains KO
  scorerPlayer = { ...scorerPlayer, kos: scorerPlayer.kos + 1 };

  s = setPlayer(s, loser, loserPlayer);
  s = setPlayer(s, scorer, scorerPlayer);
  s = log(s, `${scorerPlayer.name} scored a KO! (${scorerPlayer.kos}/4)`);

  // Check win first
  s = checkWin(s);
  if (s.status === 'finished') return s;

  // Promote bench for loser
  const firstBench = loserPlayer.bench.findIndex((b) => b !== null);
  if (firstBench !== -1) {
    const newActive = loserPlayer.bench[firstBench]!;
    const newBench = [...loserPlayer.bench] as (ChellyzCard | null)[];
    newBench[firstBench] = null;
    loserPlayer = { ...loserPlayer, active: newActive, bench: newBench };
    s = setPlayer(s, loser, loserPlayer);
    s = log(s, `${loserPlayer.name}'s ${newActive.name} enters the field!`);
  } else {
    // No bench available
    const hand = loserPlayer.hand;
    const l1InHand = hand.findIndex((c) => c.type === 'chelly_l1');
    if (l1InHand !== -1) {
      // Auto-promote from hand (partial penalty: they lose next sacrifice)
      const newActive = hand[l1InHand];
      const newHand = hand.filter((_, i) => i !== l1InHand);
      loserPlayer = {
        ...loserPlayer,
        active: newActive,
        hand: newHand,
        penaltyState: 'partial',
      };
      s = setPlayer(s, loser, loserPlayer);
      s = log(s, `${loserPlayer.name} has no bench — ${newActive.name} called from hand (penalty!)`);
    } else {
      // Full bench-out penalty
      loserPlayer = { ...loserPlayer, penaltyState: 'full' };
      s = setPlayer(s, loser, loserPlayer);
      s = log(s, `${loserPlayer.name} has no bench or L1 Chelly — full penalty state!`);
      // Full penalty: lose 1 EB and skip draw next turn (enforced in startTurn)
    }
  }

  return s;
}

// ─── GAME INIT ────────────────────────────────────────────────────────────────

export function startGame(
  p1Id: string, p1Name: string, p1Nfts: NFTData[] | null,
  p2Id: string, p2Name: string, p2Nfts: NFTData[] | null,
): ChellyzGameState {
  const { deck: d1, isNftDeck: n1 } = p1Nfts?.length
    ? buildNftDeck(p1Nfts)
    : { deck: buildStarterDeck(), isNftDeck: false };

  const { deck: d2, isNftDeck: n2 } = p2Nfts?.length
    ? buildNftDeck(p2Nfts)
    : { deck: buildStarterDeck(), isNftDeck: false };

  const eb1 = buildEnergyBloomDeck();
  const eb2 = buildEnergyBloomDeck();

  const p1 = initPlayer(p1Id, p1Name, d1, eb1, n1);
  const p2 = initPlayer(p2Id, p2Name, d2, eb2, n2);

  // Deal initial L1 Chelly as Active (auto-fill from hand)
  function autoSetActive(p: PlayerState): PlayerState {
    const idx = p.hand.findIndex((c) => c.type === 'chelly_l1');
    if (idx === -1) return p;
    const card = p.hand[idx];
    const hand = p.hand.filter((_, i) => i !== idx);
    return { ...p, active: card, hand };
  }

  let state: ChellyzGameState = {
    gameId:      `chellyz_${Date.now()}`,
    turnNumber:  1,
    currentTurn: 'player1',
    phase:       'coin_flip',
    players: { player1: autoSetActive(p1), player2: autoSetActive(p2) },
    turnFlags:   initTurnFlags(),
    status:      'coin_flip',
    winner:      null,
    firstPlayer: null,
    log:         [],
  };

  // Initial EB draw for each player (2 each)
  state = setPlayer(state, 'player1', drawEBCard(state.players.player1, 2));
  state = setPlayer(state, 'player2', drawEBCard(state.players.player2, 2));

  state = log(state, `Game started! ${p1Name}${n1 ? ' (NFT Deck)' : ' (Starter Deck)'} vs ${p2Name}${n2 ? ' (NFT Deck)' : ' (Starter Deck)'}`);
  return state;
}

/** Resolve the coin flip to determine who goes first */
export function resolveCoinFlip(state: ChellyzGameState): { newState: ChellyzGameState; result: 'heads' | 'tails' } {
  const result = _coinFlip();
  const first: PlayerId = result === 'heads' ? 'player1' : 'player2';
  let s: ChellyzGameState = { ...state, firstPlayer: first, currentTurn: first, status: 'active', phase: 'draw' };
  s = log(s, `Coin flip: ${result.toUpperCase()}! ${s.players[first].name} goes first.`);
  return { newState: s, result };
}

// ─── TURN START ───────────────────────────────────────────────────────────────

/** Called at the beginning of each turn — applies artifacts, handles penalties */
export function startTurn(state: ChellyzGameState): ChellyzGameState {
  let s = { ...state, turnFlags: initTurnFlags(), phase: 'draw' as TurnPhase };
  const pid = s.currentTurn;
  let player = getPlayer(s, pid);

  // Clear piercing override from previous turn on defender side
  const oppId = opponent(pid);
  let opp = getPlayer(s, oppId);
  opp = { ...opp, piercingDefOverride: null };
  s = setPlayer(s, oppId, opp);

  // Apply pending artifact from last turn
  if (player.pendingArtifact) {
    const fx = player.pendingArtifact;
    // HP Restore
    if (fx.hpRestore > 0 && player.active?.stats) {
      const currentHp = player.active.currentHp ?? 0;
      const newHp = Math.min(player.active.stats.maxHp, currentHp + fx.hpRestore);
      player = {
        ...player,
        active: { ...player.active, currentHp: newHp },
      };
      s = log(s, `${player.name}'s artifact restores ${fx.hpRestore} HP!`);
    }
    // Apply artifact bonuses to TurnFlags
    s = {
      ...s,
      turnFlags: {
        ...s.turnFlags,
        artifactActiveThisTurn: fx,
      },
    };
    player = { ...player, pendingArtifact: null };
  }

  // Full penalty: skip draw, lose 1 EB
  if (player.penaltyState === 'full') {
    const spent = spendEB(player, 1);
    if (spent) player = spent;
    player = { ...player, penaltyState: 'none' };
    s = log(s, `${player.name} is in full penalty — loses 1 EB, skips draw.`);
    s = setPlayer(s, pid, player);
    s = { ...s, phase: 'sacrifice' }; // skip draw phase
    return s;
  }

  // Handle opponent disruption relic (from flash relic)
  if (s.turnFlags.artifactActiveThisTurn?.opponentDiscardEB) {
    const amount = s.turnFlags.artifactActiveThisTurn.opponentDiscardEB;
    const oppUpdated = spendEB(opp, Math.min(amount, opp.energy.length));
    if (oppUpdated) {
      s = setPlayer(s, oppId, oppUpdated);
      s = log(s, `Disruption Field! ${opp.name} loses ${amount} EB.`);
    }
  }

  s = setPlayer(s, pid, player);
  return s;
}

// ─── PHASE ACTIONS ────────────────────────────────────────────────────────────

/** Draw Phase: draw 1 card from deck */
export function drawPhase(state: ChellyzGameState): ChellyzGameState {
  const pid = state.currentTurn;
  let player = drawCard(getPlayer(state, pid));
  // Also draw 1 EB card if under 7
  player = drawEBCard(player, 1);
  let s = setPlayer(state, pid, player);
  s = log(s, `${player.name} draws a card.`);
  s = { ...s, phase: 'sacrifice' };
  return s;
}

/** Sacrifice Phase: discard a Chelly from hand → gain 1 EB (max 2 per turn) */
export function sacrifice(
  state: ChellyzGameState,
  playerId: PlayerId,
  chellyInstanceId: string,
): ChellyzGameState {
  let s = state;
  const flags = s.turnFlags;
  if (flags.sacrificesThisTurn >= 2) return log(s, 'Cannot sacrifice more than 2 Chellyz per turn.');

  let player = getPlayer(s, playerId);
  const cardIdx = player.hand.findIndex((c) => c.instanceId === chellyInstanceId);
  if (cardIdx === -1) return log(s, 'Sacrifice card not found in hand.');
  const card = player.hand[cardIdx];
  if (!card.type.startsWith('chelly')) return log(s, 'Only Chelly cards can be sacrificed.');

  // Remove from hand, move to discard, add EB
  const hand = player.hand.filter((_, i) => i !== cardIdx);
  player = { ...player, hand, discard: [...player.discard, card] };
  player = drawEBCard(player, 1); // +1 EB

  s = setPlayer(s, playerId, player);
  s = { ...s, turnFlags: { ...flags, sacrificesThisTurn: flags.sacrificesThisTurn + 1 } };
  s = log(s, `${player.name} sacrifices ${card.name} → +1 EB`);
  return s;
}

/** Skip Sacrifice Phase */
export function skipSacrifice(state: ChellyzGameState): ChellyzGameState {
  return { ...state, phase: 'evolution' };
}

/** Evolution Phase: evolve Active or a Bench Chelly using a card from hand */
export function evolve(
  state: ChellyzGameState,
  playerId: PlayerId,
  targetInstanceId: string,  // instanceId of Active or Bench card to evolve
  evoCardInstanceId: string, // instanceId of L2/L3 card in hand
): ChellyzGameState {
  let s = state;
  let player = getPlayer(s, playerId);
  const artFx = s.turnFlags.artifactActiveThisTurn;
  const discount = artFx?.evoDiscount ?? 0;

  // Find evo card in hand
  const evoIdx = player.hand.findIndex((c) => c.instanceId === evoCardInstanceId);
  if (evoIdx === -1) return log(s, 'Evolution card not in hand.');
  const evoCard = player.hand[evoIdx];
  if (!evoCard.type.startsWith('chelly_l')) return log(s, 'Not an evolvable Chelly.');

  // Find target in active or bench
  let target: ChellyzCard | null = null;
  let slot: 'active' | number = 'active';
  if (player.active?.instanceId === targetInstanceId) {
    target = player.active;
    slot = 'active';
  } else {
    const bIdx = player.bench.findIndex((b) => b?.instanceId === targetInstanceId);
    if (bIdx !== -1) {
      target = player.bench[bIdx];
      slot = bIdx;
    }
  }
  if (!target) return log(s, 'Target card not found on field.');

  // Validate level chain
  const targetLevel = (target.level as number) ?? 1;
  const evoLevel    = (evoCard.level as number) ?? 2;
  if (evoLevel !== targetLevel + 1) return log(s, 'Evolution must be next level in chain.');
  if (target.evolutionFamily !== evoCard.evolutionFamily) return log(s, 'Evolution family mismatch.');

  // Check EB cost
  const cost = evolutionCost(targetLevel, discount);
  const updatedPlayer = spendEB(player, cost);
  if (!updatedPlayer) return log(s, `Not enough EB. Need ${cost}.`);
  player = updatedPlayer;

  // Apply evolution: new card inherits current HP proportion
  const proportion = target.currentHp && target.stats ? target.currentHp / target.stats.maxHp : 1;
  const newHp = evoCard.stats ? Math.round(evoCard.stats.maxHp * proportion) : undefined;
  const evolvedCard: ChellyzCard = {
    ...evoCard,
    instanceId: target.instanceId, // preserve instanceId so UI tracks it
    currentHp: newHp,
  };

  // Remove evo card from hand, discard old card (as part of evolution)
  const hand = player.hand.filter((_, i) => i !== evoIdx);
  player = { ...player, hand, discard: [...player.discard, target] };

  if (slot === 'active') {
    player = { ...player, active: evolvedCard };
  } else {
    const bench = [...player.bench] as (ChellyzCard | null)[];
    bench[slot] = evolvedCard;
    player = { ...player, bench };
  }

  s = setPlayer(s, playerId, player);
  s = log(s, `${player.name} evolves ${target.name} → ${evoCard.name}! (cost: ${cost} EB)`);
  return s;
}

/** Skip Evolution Phase */
export function skipEvolution(state: ChellyzGameState): ChellyzGameState {
  return { ...state, phase: 'retreat' };
}

/** Retreat Phase: swap Active ↔ Bench slot. ENDS the turn. */
export function retreat(
  state: ChellyzGameState,
  playerId: PlayerId,
  benchSlotIndex: number,
): ChellyzGameState {
  let s = state;
  let player = getPlayer(s, playerId);
  if (!player.active) return log(s, 'No active Chelly to retreat.');
  const benchCard = player.bench[benchSlotIndex];
  if (!benchCard) return log(s, 'No Chelly in that bench slot.');

  const oldActiveName = player.active!.name;
  const newBench = [...player.bench] as (ChellyzCard | null)[];
  newBench[benchSlotIndex] = player.active;
  player = { ...player, active: benchCard, bench: newBench };

  s = setPlayer(s, playerId, player);
  s = { ...s, turnFlags: { ...s.turnFlags, hasRetreated: true } };
  s = log(s, `${player.name} retreats ${oldActiveName} and sends out ${benchCard.name}!`);
  // Retreat immediately ends the turn
  return endTurn(s, playerId);
}

/** Skip Retreat Phase */
export function skipRetreat(state: ChellyzGameState): ChellyzGameState {
  return { ...state, phase: 'bench_swap' };
}

/** Bench Swap: swap two bench cards or reorder bench (once per turn) */
export function benchSwap(
  state: ChellyzGameState,
  playerId: PlayerId,
  slotA: number,
  slotB: number,
): ChellyzGameState {
  let s = state;
  if (s.turnFlags.hasBenchSwapped) return log(s, 'Already swapped bench this turn.');
  let player = getPlayer(s, playerId);
  const bench = [...player.bench] as (ChellyzCard | null)[];
  [bench[slotA], bench[slotB]] = [bench[slotB], bench[slotA]];
  player = { ...player, bench };
  s = setPlayer(s, playerId, player);
  s = { ...s, turnFlags: { ...s.turnFlags, hasBenchSwapped: true }, phase: 'bench_fill' };
  s = log(s, `${player.name} swaps bench slots ${slotA} and ${slotB}.`);
  return s;
}

/** Skip Bench Swap */
export function skipBenchSwap(state: ChellyzGameState): ChellyzGameState {
  return { ...state, phase: 'bench_fill' };
}

/** Bench Fill: play a L1 Chelly from hand onto an empty bench slot */
export function benchFill(
  state: ChellyzGameState,
  playerId: PlayerId,
  handCardInstanceId: string,
  benchSlot: number,
): ChellyzGameState {
  let s = state;
  let player = getPlayer(s, playerId);
  if (player.bench[benchSlot] !== null) return log(s, 'Bench slot is occupied.');
  const idx = player.hand.findIndex((c) => c.instanceId === handCardInstanceId);
  if (idx === -1) return log(s, 'Card not in hand.');
  const card = player.hand[idx];
  if (card.type !== 'chelly_l1') return log(s, 'Only Level 1 Chellyz can fill the bench directly.');
  const bench = [...player.bench] as (ChellyzCard | null)[];
  bench[benchSlot] = card;
  const hand = player.hand.filter((_, i) => i !== idx);
  player = { ...player, bench, hand };
  s = setPlayer(s, playerId, player);
  s = { ...s, turnFlags: { ...s.turnFlags, hasBenchFilled: true }, phase: 'support_prep' };
  s = log(s, `${player.name} places ${card.name} on bench slot ${benchSlot}.`);
  return s;
}

/** Skip Bench Fill */
export function skipBenchFill(state: ChellyzGameState): ChellyzGameState {
  return { ...state, phase: 'support_prep' };
}

/** Support Prep: stage a Memory Artifact from hand (activates next turn) */
export function playSupport(
  state: ChellyzGameState,
  playerId: PlayerId,
  cardInstanceId: string,
): ChellyzGameState {
  let s = state;
  let player = getPlayer(s, playerId);
  const idx = player.hand.findIndex((c) => c.instanceId === cardInstanceId);
  if (idx === -1) return log(s, 'Support card not in hand.');
  const card = player.hand[idx];

  if (card.isFlashRelic) {
    // Flash Relic: instant effect this turn
    const hand = player.hand.filter((_, i) => i !== idx);
    player = { ...player, hand, discard: [...player.discard, card] };
    s = setPlayer(s, playerId, player);
    s = log(s, `${player.name} activates Flash Relic: ${card.name}!`);
    s = applyFlashRelic(s, playerId, card);
    s = { ...s, turnFlags: { ...s.turnFlags, hasStagedSupport: true }, phase: 'action' };
    return s;
  }

  if (card.type !== 'memory_artifact') return log(s, 'Not a support card.');
  // Memory Artifact: stage it (overrides existing staged support)
  const hand = player.hand.filter((_, i) => i !== idx);
  if (player.support) {
    player = { ...player, discard: [...player.discard, player.support] };
  }
  player = { ...player, hand, support: card };

  // Resolve what the artifact does next turn
  const effects = parseArtifactEffect(card);
  player = { ...player, pendingArtifact: effects };

  s = setPlayer(s, playerId, player);
  s = { ...s, turnFlags: { ...s.turnFlags, hasStagedSupport: true }, phase: 'action' };
  s = log(s, `${player.name} stages ${card.name} — activates next turn.`);
  return s;
}

function parseArtifactEffect(card: ChellyzCard): ArtifactEffects {
  // TODO: extend as new cards are added
  const fx: ArtifactEffects = initArtifactEffects();
  const text = card.effectText ?? '';
  if (text.includes('restore 30 HP'))         fx.hpRestore      = 30;
  if (text.includes('+15 ATK'))               fx.atkBonus       = 15;
  if (text.includes('+15 DEF'))               fx.defBonus       = 15;
  if (text.includes('+8 SPD'))                fx.spdBonus       = 8;
  if (text.includes('reduce evolution'))       fx.evoDiscount    = 1;
  if (text.includes('loses 2 energy bloom'))  fx.opponentDiscardEB = 2;
  return fx;
}

function applyFlashRelic(state: ChellyzGameState, playerId: PlayerId, card: ChellyzCard): ChellyzGameState {
  let s = state;
  const text = card.effectText ?? '';
  const pid = playerId;
  const oppId = opponent(pid);

  if (text.includes('draw 2 Energy Bloom')) {
    let player = drawEBCard(getPlayer(s, pid), 2);
    s = setPlayer(s, pid, player);
    s = log(s, `${getPlayer(s, pid).name} draws 2 EB cards!`);
  }
  if (text.includes('swap Active with any Bench')) {
    // Full Retreat relic — mark a special flag so ChellyzTab can show slot picker
    s = { ...s, turnFlags: { ...s.turnFlags, hasRetreated: false } }; // allow retreat this turn
  }
  if (text.includes('Opponent discards 2 energy bloom')) {
    const opp = getPlayer(s, oppId);
    const newOpp = spendEB(opp, Math.min(2, opp.energy.length));
    if (newOpp) {
      s = setPlayer(s, oppId, newOpp);
      s = log(s, `Disruption! ${newOpp.name} loses 2 EB.`);
    }
  }
  return s;
}

/** Skip Support Prep */
export function skipSupport(state: ChellyzGameState): ChellyzGameState {
  return { ...state, phase: 'action' };
}

// ─── ACTION PHASE ─────────────────────────────────────────────────────────────

/** Normal Attack */
export function normalAttack(state: ChellyzGameState, attackerId: PlayerId): ChellyzGameState {
  let s = state;
  if (s.turnFlags.hasAttackedThisTurn) return log(s, 'Already attacked this turn.');
  const flags = s.turnFlags;
  const artFx = flags.artifactActiveThisTurn;

  let attacker = getPlayer(s, attackerId);
  const defenderId = opponent(attackerId);
  let defender = getPlayer(s, defenderId);

  if (!attacker.active) return log(s, 'No active Chelly to attack with.');
  if (!defender.active) return log(s, 'Opponent has no active Chelly.');

  // Current DEF (check piercing override on player state)
  const defenseOverride = defender.piercingDefOverride ?? undefined;

  const dmg = calculateChellyDamage(
    attacker.active,
    defender.active,
    false,
    defenseOverride,
    artFx?.atkBonus ?? 0,
    artFx?.defBonus ?? 0,
  );

  const newHp = Math.max(0, (defender.active.currentHp ?? 0) - dmg);
  defender = { ...defender, active: { ...defender.active, currentHp: newHp } };

  s = setPlayer(s, defenderId, defender);
  s = { ...s, turnFlags: { ...flags, hasAttackedThisTurn: true }, phase: 'piercing_roll' };
  s = log(s, `${attacker.active.name} attacks ${defender.active?.name} for ${dmg} damage!`);

  if (newHp <= 0) {
    s = log(s, `${defender.active?.name} is KO'd!`);
    s = recordKO(s, defenderId);
  }

  return s;
}

/** Special Attack (costs EB) */
export function specialAttack(state: ChellyzGameState, attackerId: PlayerId): ChellyzGameState {
  let s = state;
  if (s.turnFlags.hasAttackedThisTurn) return log(s, 'Already attacked this turn.');
  const flags = s.turnFlags;
  const artFx = flags.artifactActiveThisTurn;

  let attacker = getPlayer(s, attackerId);
  const defenderId = opponent(attackerId);
  let defender = getPlayer(s, defenderId);

  if (!attacker.active?.stats) return log(s, 'No active Chelly.');
  if (!defender.active) return log(s, 'Opponent has no active Chelly.');

  // Capture before attacker is reassigned by spendEB
  const attackerCard = attacker.active;
  const defenderCard = defender.active;

  const cost = attackerCard.stats!.specialCost;
  const updatedAttacker = spendEB(attacker, cost);
  if (!updatedAttacker) return log(s, `Not enough EB for special. Need ${cost}.`);
  attacker = updatedAttacker;

  const defenseOverride = defender.piercingDefOverride ?? undefined;
  const dmg = calculateChellyDamage(
    attackerCard,
    defenderCard,
    true,
    defenseOverride,
    artFx?.atkBonus ?? 0,
    artFx?.defBonus ?? 0,
  );

  const newHp = Math.max(0, (defenderCard.currentHp ?? 0) - dmg);
  defender = { ...defender, active: { ...defenderCard, currentHp: newHp } };

  s = setPlayer(s, attackerId, attacker);
  s = setPlayer(s, defenderId, defender);
  s = { ...s, turnFlags: { ...flags, hasAttackedThisTurn: true }, phase: 'piercing_roll' };
  s = log(s, `${attackerCard.name} uses Special Attack on ${defenderCard.name} for ${dmg}!`);

  if (newHp <= 0) {
    s = log(s, `${defenderCard.name} is KO'd!`);
    s = recordKO(s, defenderId);
  }

  return s;
}

/** Piercing Roll: spend 1 EB, roll d6 — on 4+ reduce opponent DEF this attack */
export function piercingRoll(
  state: ChellyzGameState,
  attackerId: PlayerId,
): { newState: ChellyzGameState; roll: number } {
  let s = state;
  if (s.turnFlags.hasPiercingRolled) {
    return { newState: log(s, 'Already used piercing roll this turn.'), roll: 0 };
  }

  let attacker = getPlayer(s, attackerId);
  const updatedAttacker = spendEB(attacker, 1);
  if (!updatedAttacker) {
    return { newState: log(s, 'Not enough EB for piercing roll.'), roll: 0 };
  }
  attacker = updatedAttacker;

  const roll = _rollD6();
  const defenderId = opponent(attackerId);
  let defender = getPlayer(s, defenderId);

  let msg = `Piercing Roll: ${roll}! `;
  if (roll >= 6) {
    // Defender DEF = 0 for this attack
    defender = { ...defender, piercingDefOverride: 0 };
    msg += "Critical Piercing — opponent DEF set to 0!";
  } else if (roll >= 4) {
    // Defender DEF − 10
    const currentDef = defender.active?.stats?.def ?? 0;
    defender = { ...defender, piercingDefOverride: Math.max(0, currentDef - 10) };
    msg += `Opponent DEF reduced by 10 (${currentDef} → ${defender.piercingDefOverride}).`;
  } else {
    msg += "No effect (need 4+).";
  }

  s = setPlayer(s, attackerId, attacker);
  s = setPlayer(s, defenderId, defender);
  s = { ...s, turnFlags: { ...s.turnFlags, hasPiercingRolled: true } };
  s = log(s, msg);
  return { newState: s, roll };
}

/** Skip Piercing Roll */
export function skipPiercingRoll(state: ChellyzGameState): ChellyzGameState {
  return { ...state, phase: 'end' };
}

// ─── END TURN ─────────────────────────────────────────────────────────────────

export function endTurn(state: ChellyzGameState, playerId: PlayerId): ChellyzGameState {
  if (state.status === 'finished') return state;
  let s = state;
  const next = opponent(playerId);
  s = { ...s, currentTurn: next, turnNumber: s.turnNumber + 1 };
  s = log(s, `--- ${getPlayer(s, next).name}'s turn ---`);
  s = startTurn(s);
  return s;
}

// ─── AI OPPONENT ─────────────────────────────────────────────────────────────

/**
 * Simple heuristic AI for single-player vs AI.
 * Takes a complete turn and returns the final state.
 */
export function aiTakeTurn(state: ChellyzGameState, aiPlayerId: PlayerId): ChellyzGameState {
  let s = state;

  // Draw phase
  s = drawPhase(s);

  // Sacrifice: if fewer than 3 EB and have extra L1 Chellyz in hand, sacrifice one
  {
    const snap = getPlayer(s, aiPlayerId);
    const target = snap.hand.find((c) => c.type === 'chelly_l1' && c.instanceId !== snap.active?.instanceId);
    if (target && snap.energy.length < 3) {
      s = sacrifice(s, aiPlayerId, target.instanceId);
    }
    s = { ...s, phase: 'evolution' };
  }

  // Evolution: evolve if possible
  {
    const snap = getPlayer(s, aiPlayerId);
    const activeCard = snap.active;
    if (activeCard && activeCard.level !== 'universal') {
      const evoCard = getEvolutionCard(activeCard, snap.hand);
      if (evoCard) {
        const cost = evolutionCost((activeCard.level as number) ?? 1);
        if (snap.energy.length >= cost) {
          s = evolve(s, aiPlayerId, activeCard.instanceId, evoCard.instanceId);
        }
      }
    }
    s = { ...s, phase: 'retreat' };
  }

  // Skip retreat + bench swap
  s = { ...s, phase: 'bench_swap' };

  // Bench fill
  {
    const snap = getPlayer(s, aiPlayerId);
    const slot  = snap.bench.findIndex((b) => b === null);
    const card  = snap.hand.find((c) => c.type === 'chelly_l1');
    if (slot !== -1 && card) {
      s = benchFill(s, aiPlayerId, card.instanceId, slot);
    }
    s = { ...s, phase: 'support_prep' };
  }

  // Support
  {
    const snap = getPlayer(s, aiPlayerId);
    const artifact = snap.hand.find((c) => c.type === 'memory_artifact');
    if (artifact && !s.turnFlags.hasStagedSupport) {
      s = playSupport(s, aiPlayerId, artifact.instanceId);
    }
    s = { ...s, phase: 'action' };
  }

  // Piercing roll if opponent has high DEF
  {
    const oppId  = opponent(aiPlayerId);
    const oppSnap = getPlayer(s, oppId);
    const aiSnap  = getPlayer(s, aiPlayerId);
    if (
      oppSnap.active?.stats && aiSnap.active?.stats &&
      oppSnap.active.stats.def > 20 &&
      aiSnap.energy.length > 0 &&
      !s.turnFlags.hasPiercingRolled
    ) {
      const { newState } = piercingRoll(s, aiPlayerId);
      s = newState;
    }
  }

  // Attack
  if (!s.turnFlags.hasAttackedThisTurn && s.status !== 'finished') {
    const oppId       = opponent(aiPlayerId);
    const aiSnap      = getPlayer(s, aiPlayerId);
    const oppSnap     = getPlayer(s, oppId);
    const myCard      = aiSnap.active;
    const theirCard   = oppSnap.active;
    if (myCard && theirCard) {
      const canSpecial = myCard.stats
        ? aiSnap.energy.length >= myCard.stats.specialCost
        : false;
      s = canSpecial ? specialAttack(s, aiPlayerId) : normalAttack(s, aiPlayerId);
    }
  }

  if (s.status === 'finished') return s;

  // End turn
  s = endTurn(s, aiPlayerId);
  return s;
}

// ─── Re-exports for convenience ───────────────────────────────────────────────

export type { ChellyzCard, ChellyzElement, CardType, ChellyStats } from './chellyzCards';
