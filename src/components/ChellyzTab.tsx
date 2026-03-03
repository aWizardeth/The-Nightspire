/**
 * ChellyzTab.tsx
 * Full Chellyz card game board UI for the Discord Activity.
 *
 * Board layout (local player = bottom):
 *   ┌─ opponent bench row (top) ─────────────────────────────┐
 *   │  [OBench0]  [OBench1]  [OBench2]   [EBDeck] [DrawDeck] │
 *   │  [OSupport] [OActive]  [OEnergy]                        │
 *   ├─ divider ──────────────────────────────────────────────┤
 *   │  [MySupport][MyActive] [MyEnergy]                       │
 *   │  [Bench0]   [Bench1]   [Bench2]    [EBDeck] [DrawDeck]  │
 *   ├─ hand ─────────────────────────────────────────────────┤
 *   │  scrollable hand cards                                  │
 *   ├─ actions ──────────────────────────────────────────────┤
 *   │  phase-aware buttons                                    │
 *   └─ log ──────────────────────────────────────────────────┘
 */

import { useState, useEffect, useRef } from 'react';
import {
  useChellyzStore,
  selectIsMyTurn,
  selectLocalPlayer,
  selectOpponent,
  selectPhase,
  selectWinner,
  selectLog,
} from '../store/chellyzStore';
import type { ChellyzCard } from '../lib/chellyzCards';
import type { TurnPhase } from '../lib/chellyzEngine';
import useBowActivityStore from '../store/bowActivityStore';

// ─── Prop types ───────────────────────────────────────────────────────────────

interface ChellyzTabProps {
  userId: string;
  userName?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ELEMENT_COLOR: Record<string, string> = {
  Fire:        'bg-orange-500/80 border-orange-400',
  Water:       'bg-blue-500/80 border-blue-400',
  Nature:      'bg-green-500/80 border-green-400',
  Electric:    'bg-yellow-400/80 border-yellow-300',
  Shadow:      'bg-purple-700/80 border-purple-500',
  Ice:         'bg-cyan-400/80 border-cyan-300',
  Spirit:      'bg-pink-400/80 border-pink-300',
  Arcane:      'bg-indigo-500/80 border-indigo-400',
  Corruption:  'bg-red-900/80 border-red-700',
  Neutral:     'bg-zinc-600/80 border-zinc-500',
};

const PHASE_LABEL: Record<TurnPhase, string> = {
  draw:         'Draw Phase',
  sacrifice:    'Sacrifice Phase',
  evolution:    'Evolution Phase',
  retreat:      'Retreat Phase',
  bench_swap:   'Bench Swap Phase',
  bench_fill:   'Bench Fill Phase',
  support_prep: 'Support Prep Phase',
  action:       'Action Phase',
  piercing_roll:'Piercing Roll',
  end:          'End Turn',
  coin_flip:    'Coin Flip',
  finished:     'Game Over',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

interface CardSlotProps {
  card:       ChellyzCard | null;
  label?:     string;
  size?:      'sm' | 'md';
  highlight?: boolean;
  onClick?:   () => void;
  flipped?:   boolean;
}

function CardSlot({ card, label, size = 'md', highlight, onClick, flipped }: CardSlotProps) {
  const w = size === 'sm' ? 'w-12 h-16' : 'w-14 h-20';
  const colorCls = card ? (ELEMENT_COLOR[card.element] ?? ELEMENT_COLOR['Neutral']) : 'bg-zinc-800/60 border-zinc-600';
  const ringCls  = highlight ? 'ring-2 ring-yellow-400 ring-offset-1 ring-offset-zinc-900' : '';

  return (
    <div className="flex flex-col items-center gap-0.5">
      {label && <span className="text-[9px] text-zinc-400 uppercase tracking-wide">{label}</span>}
      <button
        onClick={onClick}
        disabled={!onClick}
        className={`${w} rounded border ${colorCls} ${ringCls} relative overflow-hidden flex flex-col items-center justify-between p-0.5 text-center cursor-pointer select-none transition-all hover:brightness-110 disabled:cursor-default`}
      >
        {flipped ? (
          <span className="text-zinc-500 text-[9px] m-auto">🂠</span>
        ) : card ? (
          <>
            {card.imageUri ? (
              <img src={card.imageUri} alt={card.name} className="w-full h-9 object-cover rounded-sm" />
            ) : (
              <span className="text-lg leading-none pt-1">
                {card.type === 'memory_artifact' ? '📜' : card.type === 'flash_relic' ? '⚡' : card.type === 'energy_bloom' ? '🌸' : '🔮'}
              </span>
            )}
            <div className="w-full">
              <p className="text-[7px] font-bold text-white leading-tight truncate">{card.name}</p>
              {card.stats && (
                <p className="text-[7px] text-zinc-200">
                  ❤{card.currentHp}/{card.stats.maxHp}
                </p>
              )}
            </div>
          </>
        ) : (
          <span className="text-zinc-600 text-[9px] m-auto">—</span>
        )}
      </button>
    </div>
  );
}

function HPBar({ current, max }: { current: number; max: number }) {
  const pct = Math.min(100, Math.round((current / max) * 100));
  const color = pct > 60 ? 'bg-green-500' : pct > 30 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className="w-full h-1 bg-zinc-700 rounded-full overflow-hidden mt-0.5">
      <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function EnergyZone({ count, max = 7 }: { count: number; max?: number }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-[9px] text-zinc-400 uppercase">EB</span>
      <div className="flex flex-wrap gap-0.5 w-14 justify-center">
        {Array.from({ length: max }).map((_, i) => (
          <div key={i} className={`w-2.5 h-2.5 rounded-full border ${i < count ? 'bg-emerald-400 border-emerald-300' : 'bg-zinc-700 border-zinc-600'}`} />
        ))}
      </div>
      <span className="text-[9px] text-emerald-400">{count}/{max}</span>
    </div>
  );
}

function DeckPile({ count, label, color = 'bg-zinc-700' }: { count: number; label: string; color?: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-[9px] text-zinc-400 uppercase">{label}</span>
      <div className={`w-10 h-14 rounded border border-zinc-600 ${color} flex items-center justify-center`}>
        <span className="text-xs font-bold text-white">{count}</span>
      </div>
    </div>
  );
}

// ─── Dice animation overlay ───────────────────────────────────────────────────

function DiceOverlay({ roll, onDone }: { roll: number; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 1600);
    return () => clearTimeout(t);
  }, [onDone]);
  const faces = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
  return (
    <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center z-50 gap-2 animate-fade-in">
      <span className="text-6xl animate-bounce">{faces[roll - 1]}</span>
      <p className="text-white font-bold text-lg">Rolled: {roll}</p>
      <p className="text-zinc-400 text-sm">{roll >= 6 ? 'Critical Piercing!' : roll >= 4 ? 'Piercing Hit!' : 'No Effect'}</p>
    </div>
  );
}

function CoinOverlay({ result, onDone }: { result: 'heads' | 'tails'; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 1600);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center z-50 gap-2">
      <span className="text-6xl animate-spin">{result === 'heads' ? '🟡' : '⚫'}</span>
      <p className="text-white font-bold text-xl capitalize">{result}!</p>
    </div>
  );
}

// ─── Lobby screen ─────────────────────────────────────────────────────────────

function ChellyzLobby({ userName }: { userId: string; userName: string }) {
  const startNewGame = useChellyzStore((s) => s.startNewGame);
  const nfts = useBowActivityStore((s) => s.wallet.nfts);
  const [mode, setMode] = useState<'ai' | 'hot_seat'>('ai');

  const handleStart = () => {
    if (mode === 'ai') {
      startNewGame(userName, nfts.length ? nfts : null, 'AI Wizard', null, 'ai');
    } else {
      startNewGame('Player 1', nfts.length ? nfts : null, 'Player 2', null, 'hot_seat');
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 p-4 h-full">
      <h2 className="text-xl font-bold text-purple-300">🌸 Chellyz</h2>
      <p className="text-sm text-zinc-400 text-center">A card battle game of magic and strategy.</p>

      {nfts.length > 0 ? (
        <div className="bg-emerald-900/30 border border-emerald-700 rounded p-2 text-xs text-emerald-300 text-center w-full max-w-xs">
          ✨ {nfts.length} NFTs detected — your deck will use your collection!
        </div>
      ) : (
        <div className="bg-zinc-800 border border-zinc-700 rounded p-2 text-xs text-zinc-400 text-center w-full max-w-xs">
          No NFTs in wallet — you'll receive a Starter Deck.
        </div>
      )}

      <div className="flex gap-2">
        {(['ai', 'hot_seat'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`px-3 py-1.5 rounded text-sm font-medium border transition-all ${mode === m ? 'bg-purple-700 border-purple-500 text-white' : 'bg-zinc-800 border-zinc-600 text-zinc-300 hover:border-zinc-400'}`}
          >
            {m === 'ai' ? '🤖 vs AI' : '👥 Hot Seat'}
          </button>
        ))}
      </div>

      <button
        onClick={handleStart}
        className="mt-2 px-6 py-2 bg-purple-600 hover:bg-purple-500 rounded font-bold text-white text-sm transition-all"
      >
        Start Game
      </button>

      <div className="text-xs text-zinc-500 text-center max-w-xs mt-2">
        2-player card game · 50-card decks · First to 4 KOs wins
      </div>
    </div>
  );
}

// ─── Game Over screen ─────────────────────────────────────────────────────────

function GameOverScreen() {
  const winner   = useChellyzStore(selectWinner);
  const game     = useChellyzStore((s) => s.game);
  const resetGame = useChellyzStore((s) => s.resetGame);

  const winnerName = winner ? game?.players[winner].name : null;

  return (
    <div className="flex flex-col items-center gap-4 p-6 h-full justify-center">
      <span className="text-5xl">🏆</span>
      <h2 className="text-xl font-bold text-yellow-300">{winnerName} Wins!</h2>
      <button
        onClick={resetGame}
        className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded font-bold text-white text-sm"
      >
        Play Again
      </button>
    </div>
  );
}

// ─── Main game board ──────────────────────────────────────────────────────────

function GameBoard() {
  const store = useChellyzStore();
  const isMyTurn   = useChellyzStore(selectIsMyTurn);
  const myPlayer   = useChellyzStore(selectLocalPlayer);
  const oppPlayer  = useChellyzStore(selectOpponent);
  const phase      = useChellyzStore(selectPhase);
  const log        = useChellyzStore(selectLog);
  const { lastRoll, lastCoinFlip, showingAnimation, clearAnimation, opponentType } = store;

  const logRef = useRef<HTMLDivElement>(null);
  const [selectedHandCard, setSelectedHandCard] = useState<string | null>(null);
  const [pendingEvo, setPendingEvo] = useState<{ targetId: string | null }>({ targetId: null });

  // Auto-scroll log
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log]);

  // After AI turn triggers
  useEffect(() => {
    if (!isMyTurn && opponentType === 'ai' && phase !== 'finished' && phase) {
      const t = setTimeout(() => store.doAiTurn(), 600);
      return () => clearTimeout(t);
    }
  }, [isMyTurn, opponentType, phase]);

  if (!myPlayer || !oppPlayer) return null;

  const handleCardClick = (card: ChellyzCard) => {
    if (!isMyTurn) return;
    if (phase === 'sacrifice' && card.type.startsWith('chelly')) {
      store.doSacrifice(card.instanceId);
      return;
    }
    if (phase === 'evolution') {
      if (!pendingEvo.targetId) {
        // First click must be active or bench card — handled separately
        return;
      }
      // Second click: evo card from hand
      store.doEvolve(pendingEvo.targetId, card.instanceId);
      setPendingEvo({ targetId: null });
      return;
    }
    if (phase === 'bench_fill' && card.type === 'chelly_l1') {
      const emptySlot = myPlayer.bench.findIndex((b) => b === null);
      if (emptySlot !== -1) {
        store.doBenchFill(card.instanceId, emptySlot);
        return;
      }
    }
    if (phase === 'support_prep' && (card.type === 'memory_artifact' || card.isFlashRelic)) {
      store.doPlaySupport(card.instanceId);
      return;
    }
    setSelectedHandCard(card.instanceId === selectedHandCard ? null : card.instanceId);
  };

  const handleFieldCardClick = (card: ChellyzCard) => {
    if (!isMyTurn || !card) return;
    if (phase === 'evolution') {
      setPendingEvo({ targetId: card.instanceId });
      return;
    }
    if (phase === 'retreat') {
      const slot = myPlayer.bench.findIndex((b) => b?.instanceId === card.instanceId);
      if (slot !== -1) {
        store.doRetreat(slot);
      }
    }
  };

  const renderActionButtons = () => {
    if (!isMyTurn) {
      return <p className="text-zinc-500 text-xs italic">Waiting for {oppPlayer.name}…</p>;
    }
    switch (phase) {
      case 'draw':
        return <ActionBtn label="Draw Card 🂠" onClick={store.doDrawPhase} />;
      case 'sacrifice':
        return (
          <div className="flex gap-2 flex-wrap justify-center">
            <p className="text-xs text-zinc-400 w-full text-center">Tap a Chelly in hand to sacrifice → +1 EB (max 2)</p>
            <ActionBtn label="Skip Sacrifice" variant="ghost" onClick={store.doSkipSacrifice} />
          </div>
        );
      case 'evolution':
        return (
          <div className="flex gap-2 flex-wrap justify-center">
            <p className="text-xs text-zinc-400 w-full text-center">
              {pendingEvo.targetId ? 'Now tap an evolution card in your hand' : 'Tap Active/Bench Chelly to evolve, then tap evo card'}
            </p>
            <ActionBtn label="Skip Evolution" variant="ghost" onClick={() => { setPendingEvo({ targetId: null }); store.doSkipEvolution(); }} />
          </div>
        );
      case 'retreat':
        return (
          <div className="flex gap-2 flex-wrap justify-center">
            <p className="text-xs text-zinc-400 w-full text-center">Tap a Bench Chelly to retreat (ends turn)</p>
            <ActionBtn label="Skip Retreat" variant="ghost" onClick={store.doSkipRetreat} />
          </div>
        );
      case 'bench_swap':
        return <ActionBtn label="Skip Bench Swap" variant="ghost" onClick={store.doSkipBenchSwap} />;
      case 'bench_fill':
        return (
          <div className="flex gap-2 flex-wrap justify-center">
            <p className="text-xs text-zinc-400 w-full text-center">Tap a L1 Chelly in hand to fill an empty bench slot</p>
            <ActionBtn label="Skip Bench Fill" variant="ghost" onClick={store.doSkipBenchFill} />
          </div>
        );
      case 'support_prep':
        return (
          <div className="flex gap-2 flex-wrap justify-center">
            <p className="text-xs text-zinc-400 w-full text-center">Tap a Memory Artifact or Flash Relic to play</p>
            <ActionBtn label="Skip Support" variant="ghost" onClick={store.doSkipSupport} />
          </div>
        );
      case 'action':
        return (
          <div className="flex gap-2 flex-wrap justify-center">
            <ActionBtn label="⚔ Normal Attack" onClick={store.doNormalAttack} />
            <ActionBtn
              label={`✨ Special (${myPlayer.active?.stats?.specialCost ?? '?'}EB)`}
              onClick={store.doSpecialAttack}
              disabled={(myPlayer.active?.stats?.specialCost ?? 99) > myPlayer.energy.length}
            />
            <ActionBtn label="End Turn" variant="ghost" onClick={store.doEndTurn} />
          </div>
        );
      case 'piercing_roll':
        return (
          <div className="flex gap-2 flex-wrap justify-center">
            <ActionBtn
              label="🎲 Piercing Roll (1 EB)"
              onClick={store.doPiercingRoll}
              disabled={myPlayer.energy.length < 1}
            />
            <ActionBtn label="Skip & End Turn" variant="ghost" onClick={store.doSkipPiercing} />
          </div>
        );
      case 'end':
        return <ActionBtn label="End Turn" onClick={store.doEndTurn} />;
      default:
        return null;
    }
  };

  return (
    <div className="relative flex flex-col h-full bg-zinc-950 text-white overflow-hidden select-none">

      {/* Animation overlays */}
      {showingAnimation && lastRoll !== null && (
        <DiceOverlay roll={lastRoll} onDone={clearAnimation} />
      )}
      {showingAnimation && lastCoinFlip !== null && !lastRoll && (
        <CoinOverlay result={lastCoinFlip} onDone={clearAnimation} />
      )}

      {/* Coin flip screen */}
      {store.game?.status === 'coin_flip' && (
        <div className="absolute inset-0 bg-zinc-950 flex flex-col items-center justify-center gap-4 z-40">
          <h2 className="text-lg font-bold text-purple-300">Who goes first?</h2>
          <button
            onClick={store.doFlip}
            className="px-6 py-2 bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded"
          >
            🪙 Flip Coin!
          </button>
        </div>
      )}

      {/* === OPPONENT SIDE === */}
      <div className="flex flex-col gap-1 p-1.5 pb-0.5">
        {/* Opponent info bar */}
        <div className="flex items-center justify-between px-1">
          <span className="text-[10px] text-zinc-400">{oppPlayer.name} {oppPlayer.isNftDeck ? '✨' : ''}</span>
          <span className="text-[10px] text-zinc-400">KOs: {oppPlayer.kos}/4  |  Hand: {oppPlayer.hand.length}</span>
        </div>

        {/* Opponent bench row */}
        <div className="flex items-end gap-1 justify-center">
          {oppPlayer.bench.map((card, i) => (
            <CardSlot key={i} card={card} label={`B${i}`} size="sm" flipped />
          ))}
          {/* Opponent decks (right side) */}
          <div className="ml-auto flex gap-1">
            <DeckPile count={oppPlayer.deck.length} label="DK" />
            <DeckPile count={oppPlayer.ebDeck.length} label="EB" color="bg-emerald-900/60" />
          </div>
        </div>

        {/* Opponent active row */}
        <div className="flex items-start justify-center gap-2 py-0.5">
          <CardSlot card={oppPlayer.support} label="Support" size="sm" flipped />
          <div className="flex flex-col items-center">
            <CardSlot card={oppPlayer.active} label="Active" />
            {oppPlayer.active?.stats && (
              <HPBar current={oppPlayer.active.currentHp ?? 0} max={oppPlayer.active.stats.maxHp} />
            )}
          </div>
          <EnergyZone count={oppPlayer.energy.length} />
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-purple-900/60 mx-2" />

      {/* === LOCAL PLAYER SIDE === */}
      <div className="flex flex-col gap-1 p-1.5 pt-0.5">
        {/* My active row */}
        <div className="flex items-start justify-center gap-2 py-0.5">
          <CardSlot
            card={myPlayer.support}
            label="Support"
            size="sm"
            onClick={myPlayer.support ? undefined : undefined}
          />
          <div className="flex flex-col items-center">
            <CardSlot
              card={myPlayer.active}
              label="Active"
              highlight={phase === 'evolution' && !pendingEvo.targetId}
              onClick={() => myPlayer.active && handleFieldCardClick(myPlayer.active)}
            />
            {myPlayer.active?.stats && (
              <HPBar current={myPlayer.active.currentHp ?? 0} max={myPlayer.active.stats.maxHp} />
            )}
          </div>
          <EnergyZone count={myPlayer.energy.length} />
        </div>

        {/* My bench + decks */}
        <div className="flex items-end gap-1 justify-center">
          {myPlayer.bench.map((card, i) => (
            <CardSlot
              key={i}
              card={card}
              label={`B${i}`}
              size="sm"
              highlight={phase === 'retreat' && card !== null}
              onClick={() => card && handleFieldCardClick(card)}
            />
          ))}
          <div className="ml-auto flex gap-1">
            <DeckPile count={myPlayer.deck.length} label="DK" />
            <DeckPile count={myPlayer.ebDeck.length} label="EB" color="bg-emerald-900/60" />
          </div>
        </div>

        {/* Me info bar */}
        <div className="flex items-center justify-between px-1">
          <span className="text-[10px] text-zinc-400">{myPlayer.name} {myPlayer.isNftDeck ? '✨' : ''}</span>
          <span className="text-[10px] text-zinc-400">KOs: {myPlayer.kos}/4  |  Turn {store.game?.turnNumber ?? 1}</span>
        </div>
      </div>

      {/* === HAND === */}
      <div className="border-t border-zinc-800 mx-2" />
      <div className="flex gap-1 overflow-x-auto px-2 py-1.5 min-h-[88px] scrollbar-hide">
        {myPlayer.hand.map((card) => {
          const isSelected = selectedHandCard === card.instanceId;
          const colorCls = ELEMENT_COLOR[card.element] ?? ELEMENT_COLOR['Neutral'];
          return (
            <button
              key={card.instanceId}
              onClick={() => isMyTurn && handleCardClick(card)}
              className={`flex-shrink-0 w-14 h-20 rounded border ${colorCls} ${isSelected ? 'ring-2 ring-yellow-400 -translate-y-2' : ''} flex flex-col items-center justify-between p-0.5 transition-all`}
            >
              {card.imageUri ? (
                <img src={card.imageUri} alt={card.name} className="w-full h-9 object-cover rounded-sm" />
              ) : (
                <span className="text-lg pt-1">
                  {card.type === 'memory_artifact' ? '📜' : card.type === 'flash_relic' ? '⚡' : card.type === 'energy_bloom' ? '🌸' : '🔮'}
                </span>
              )}
              <div className="w-full">
                <p className="text-[7px] font-bold text-white leading-tight truncate">{card.name}</p>
                <p className="text-[7px] text-zinc-300">{card.element}</p>
                {card.stats && <p className="text-[7px] text-zinc-200">❤{card.stats.hp}</p>}
              </div>
            </button>
          );
        })}
        {myPlayer.hand.length === 0 && (
          <p className="text-zinc-600 text-xs italic m-auto">No cards in hand</p>
        )}
      </div>

      {/* === ACTIONS === */}
      <div className="border-t border-zinc-800 mx-2" />
      <div className="px-2 py-1.5 min-h-[40px] flex items-center justify-center">
        {phase && (
          <div className="flex flex-col items-center gap-1 w-full">
            <span className="text-[9px] text-purple-400 uppercase tracking-wide">
              {isMyTurn ? `Your turn — ${PHASE_LABEL[phase]}` : `${oppPlayer.name}'s turn`}
            </span>
            {renderActionButtons()}
          </div>
        )}
      </div>

      {/* === GAME LOG === */}
      <div className="border-t border-zinc-800 mx-2" />
      <div
        ref={logRef}
        className="flex-1 overflow-y-auto px-2 py-1 min-h-[48px] max-h-[72px] scrollbar-hide"
      >
        {log.slice(-8).map((entry, i) => (
          <p key={i} className="text-[9px] text-zinc-400 leading-relaxed">{entry}</p>
        ))}
      </div>
    </div>
  );
}

// ─── Action button ────────────────────────────────────────────────────────────

function ActionBtn({
  label, onClick, variant = 'primary', disabled = false,
}: {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'ghost';
  disabled?: boolean;
}) {
  const cls = variant === 'primary'
    ? 'bg-purple-700 hover:bg-purple-600 text-white border-purple-600'
    : 'bg-transparent hover:bg-zinc-800 text-zinc-400 border-zinc-700';
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-2 py-1 rounded text-[10px] font-medium border ${cls} disabled:opacity-40 disabled:cursor-not-allowed transition-all`}
    >
      {label}
    </button>
  );
}

// ─── Root export ──────────────────────────────────────────────────────────────

export default function ChellyzTab({ userId, userName = 'Wizard' }: ChellyzTabProps) {
  const game   = useChellyzStore((s) => s.game);
  const winner = useChellyzStore(selectWinner);

  if (!game) return <ChellyzLobby userId={userId} userName={userName} />;
  if (winner) return <GameOverScreen />;
  return <GameBoard />;
}
