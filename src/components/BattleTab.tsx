import { useState } from 'react';
import useBowActivityStore from '../store/bowActivityStore';
import { usePrivacyFirstWallet } from '../lib/privacyWallet';
import { MOVES, getAvailableMoves } from '../lib/battleEngine';
import type { MoveKind, BattleState } from '../store/bowActivityStore';

interface BattleTabProps {
  userId: string;
}

export default function BattleTab({ userId }: BattleTabProps) {
  const store = useBowActivityStore();
  const { selectedFighter, isConnected } = usePrivacyFirstWallet(userId);
  const [selectedMove, setSelectedMove] = useState<MoveKind>(null);
  const [isSubmittingMove, setIsSubmittingMove] = useState(false);
  const [battleId, setBattleId] = useState<string>('');

  const currentBattle = store.battle;
  const isInBattle = currentBattle && currentBattle.status !== 'finished';
  const isMyTurn = currentBattle && (
    (currentBattle.player1Id === userId && currentBattle.currentTurn === 'player1') ||
    (currentBattle.player2Id === userId && currentBattle.currentTurn === 'player2')
  );

  const handleCreateBattle = async () => {
    if (!selectedFighter || !isConnected) {
      store.addBattleLog('❌ Connect wallet and select a fighter first');
      return;
    }
    try {
      const response = await fetch('/api/battle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'CREATE_BATTLE', userId, fighter: selectedFighter }),
      });
      const result = await response.json();
      if (result.success) {
        store.setBattle(result.battle);
        setBattleId(result.battle.battleId);
        store.setIsInBattle(true);
        store.addBattleLog(`🏟️ Battle created! Share ID: ${result.battle.battleId}`);
      } else {
        store.addBattleLog(`❌ ${result.error}`);
      }
    } catch {
      store.addBattleLog('❌ Network error creating battle');
    }
  };

  const handleJoinBattle = async () => {
    if (!selectedFighter || !isConnected || !battleId.trim()) {
      store.addBattleLog('❌ Connect wallet, select fighter, and enter battle ID');
      return;
    }
    try {
      const response = await fetch('/api/battle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'JOIN_BATTLE', battleId: battleId.trim(), userId, fighter: selectedFighter }),
      });
      const result = await response.json();
      if (result.success) {
        store.setBattle(result.battle);
        store.setIsInBattle(true);
        store.addBattleLog('⚔️ Joined battle! Prepare for combat!');
      } else {
        store.addBattleLog(`❌ ${result.error}`);
      }
    } catch {
      store.addBattleLog('❌ Network error joining battle');
    }
  };

  const handleSubmitMove = async () => {
    if (!selectedMove || !currentBattle || isSubmittingMove) return;
    setIsSubmittingMove(true);
    try {
      const response = await fetch('/api/battle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'SUBMIT_MOVE', battleId: currentBattle.battleId, userId, move: selectedMove }),
      });
      const result = await response.json();
      if (result.success) {
        if (result.waiting) {
          store.addBattleLog(`✨ Move submitted: ${MOVES[selectedMove].name}`);
          store.addBattleLog('⏳ Waiting for opponent...');
        } else if (result.roundResult) {
          const { battleLog, player1Damage, player2Damage } = result.roundResult;
          battleLog.forEach((log: any) => store.addBattleLog(log));
          if (player1Damage > 0) store.addBattleLog(`💥 Player 1 took ${player1Damage} damage!`);
          if (player2Damage > 0) store.addBattleLog(`💥 Player 2 took ${player2Damage} damage!`);
        }
        if (result.battle) {
          store.setBattle(result.battle);
          if (result.battle.status === 'finished') {
            const winner = result.battle.winner;
            const isWinner = (winner === 'player1' && currentBattle.player1Id === userId) ||
                            (winner === 'player2' && currentBattle.player2Id === userId);
            if (winner === 'draw') store.addBattleLog('⚖️ Battle ended in a draw!');
            else if (isWinner) store.addBattleLog('🏆 Victory! You won the battle!');
            else store.addBattleLog('💀 Defeat... Better luck next time!');
            store.setIsInBattle(false);
          }
        }
        setSelectedMove(null);
      } else {
        store.addBattleLog(`❌ ${result.error}`);
      }
    } catch {
      store.addBattleLog('❌ Network error submitting move');
    } finally {
      setIsSubmittingMove(false);
    }
  };

  const handleLeaveBattle = async () => {
    if (!currentBattle) return;
    try {
      await fetch('/api/battle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'LEAVE_BATTLE', battleId: currentBattle.battleId, userId }),
      });
    } catch { /* ignore */ }
    store.resetBattle();
    store.setIsInBattle(false);
    store.addBattleLog('🚪 Left battle');
    setBattleId('');
  };

  /* ── Not connected state ────────────────────────────────── */
  if (!isConnected) {
    return (
      <div className="p-6 text-center">
        <div className="glow-card p-6 mb-4">
          <h3 className="glow-text text-lg font-semibold mb-2">🔐 Wallet Required</h3>
          <p style={{ color: 'var(--text-muted)' }}>
            Connect your wallet in the Wallet tab to start battling with your NFT fighters!
          </p>
        </div>
      </div>
    );
  }

  /* ── No fighter selected ────────────────────────────────── */
  if (!selectedFighter) {
    return (
      <div className="p-6 text-center">
        <div className="glow-card p-6 mb-4">
          <h3 className="glow-text text-lg font-semibold mb-2">🧙 Choose Your Fighter</h3>
          <p style={{ color: 'var(--text-muted)' }}>
            Select a fighter in the Wallet tab to enter battle!
          </p>
        </div>
      </div>
    );
  }

  /* ── Main battle view ───────────────────────────────────── */
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="glow-card p-6">
        <h1 className="glow-text text-2xl font-bold mb-2">⚔️ Battle Arena</h1>
        <p style={{ color: 'var(--text-muted)' }}>
          Privacy-first PvP battles with state channel relay integration
        </p>
      </div>

      {/* Fighter Display */}
      <div className="glow-card p-6">
        <h2 style={{ color: 'var(--text-color)' }} className="text-lg font-semibold mb-4">🧙 Your Fighter</h2>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="rounded-lg p-4" style={{ background: 'var(--bg-deep)', border: '1px solid var(--border-color)' }}>
            <h3 className="font-bold text-lg" style={{ color: 'var(--text-color)' }}>{selectedFighter.name}</h3>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{selectedFighter.rarity} &bull; {selectedFighter.strength}</p>
            <div className="mt-2 text-sm" style={{ color: 'var(--text-color)' }}>
              <span>HP: {selectedFighter.stats.hp}</span> &bull;{' '}
              <span>ATK: {selectedFighter.stats.atk}</span> &bull;{' '}
              <span>DEF: {selectedFighter.stats.def}</span> &bull;{' '}
              <span>SPD: {selectedFighter.stats.spd}</span>
            </div>
          </div>
          {selectedFighter.effect && (
            <div className="rounded p-3" style={{ background: 'rgba(240,178,50,0.15)', border: '1px solid var(--warning)' }}>
              <p className="text-sm" style={{ color: 'var(--warning)' }}><strong>Special:</strong> {selectedFighter.effect}</p>
            </div>
          )}
        </div>
      </div>

      {/* Battle Controls */}
      {!isInBattle ? (
        <div className="grid md:grid-cols-2 gap-6">
          <div className="glow-card p-6">
            <h2 style={{ color: 'var(--text-color)' }} className="text-lg font-semibold mb-4">🏟️ Create Battle</h2>
            <p style={{ color: 'var(--text-muted)' }} className="mb-4">
              Start a new battle and wait for an opponent to join.
            </p>
            <button onClick={handleCreateBattle} className="glow-btn w-full" style={{ color: 'var(--success)' }}>
              Create Battle
            </button>
          </div>

          <div className="glow-card p-6">
            <h2 style={{ color: 'var(--text-color)' }} className="text-lg font-semibold mb-4">🔍 Join Battle</h2>
            <p style={{ color: 'var(--text-muted)' }} className="mb-4">
              Enter a battle ID to join an existing match.
            </p>
            <input
              type="text"
              placeholder="Enter Battle ID"
              value={battleId}
              onChange={(e) => setBattleId(e.target.value)}
              className="glow-input w-full mb-3 text-sm"
            />
            <button onClick={handleJoinBattle} className="glow-btn w-full">
              Join Battle
            </button>
          </div>
        </div>
      ) : (
        <BattleInterface
          battle={currentBattle}
          userId={userId}
          selectedFighter={selectedFighter}
          isMyTurn={isMyTurn || false}
          selectedMove={selectedMove}
          setSelectedMove={setSelectedMove}
          onSubmitMove={handleSubmitMove}
          onLeaveBattle={handleLeaveBattle}
          isSubmittingMove={isSubmittingMove}
        />
      )}

      {/* Battle Log */}
      <div className="glow-card p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 style={{ color: 'var(--text-color)' }} className="text-lg font-semibold">📜 Battle Log</h2>
          <button onClick={store.clearBattleLogs} className="text-sm cursor-pointer" style={{ color: 'var(--text-muted)' }}>
            Clear
          </button>
        </div>
        <div className="rounded p-4 max-h-64 overflow-y-auto" style={{ background: 'var(--bg-deep)' }}>
          {store.gui.battleLogs.length === 0 ? (
            <p className="text-center text-sm" style={{ color: 'var(--text-muted)' }}>No battle activity yet</p>
          ) : (
            store.gui.battleLogs.map((log: string, index: number) => (
              <div key={index} className="py-1 text-sm font-mono" style={{ color: 'var(--text-color)' }}>
                {log}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Active battle sub-component ──────────────────────────── */
interface BattleInterfaceProps {
  battle: BattleState;
  userId: string;
  selectedFighter: any;
  isMyTurn: boolean;
  selectedMove: MoveKind;
  setSelectedMove: (move: MoveKind) => void;
  onSubmitMove: () => void;
  onLeaveBattle: () => void;
  isSubmittingMove: boolean;
}

function BattleInterface({
  battle, userId, selectedFighter, isMyTurn,
  selectedMove, setSelectedMove, onSubmitMove, onLeaveBattle, isSubmittingMove,
}: BattleInterfaceProps) {
  const isPlayer1 = battle.player1Id === userId;
  const myHp = isPlayer1 ? battle.player1Hp : battle.player2Hp;
  const opponentHp = isPlayer1 ? battle.player2Hp : battle.player1Hp;
  const myFighter = isPlayer1 ? battle.player1Fighter : battle.player2Fighter;
  const opponentFighter = isPlayer1 ? battle.player2Fighter : battle.player1Fighter;
  const availableMoves = selectedFighter ? getAvailableMoves(selectedFighter) : [];

  return (
    <div className="space-y-6">
      {/* Battle Status */}
      <div className="glow-card p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 style={{ color: 'var(--text-color)' }} className="text-lg font-semibold">⚔️ Round {battle.roundNumber}</h2>
          <div className="flex gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-semibold" style={{
              background: battle.status === 'waiting' ? 'rgba(240,178,50,0.2)' : 'rgba(0,217,255,0.2)',
              color: battle.status === 'waiting' ? 'var(--warning)' : 'var(--accent)',
              border: `1px solid ${battle.status === 'waiting' ? 'var(--warning)' : 'var(--accent)'}`,
            }}>
              {battle.status.toUpperCase()}
            </span>
            <button
              onClick={onLeaveBattle}
              className="px-3 py-1 rounded-full text-xs cursor-pointer"
              style={{ background: 'rgba(242,63,66,0.2)', color: 'var(--danger)', border: '1px solid var(--danger)' }}
            >
              Leave
            </button>
          </div>
        </div>

        {/* Fighters HP */}
        <div className="grid grid-cols-2 gap-6">
          <div className="p-4 rounded-lg" style={{ background: 'var(--bg-deep)', border: '2px solid var(--accent)' }}>
            <h3 className="font-bold" style={{ color: 'var(--text-color)' }}>{myFighter?.name || 'You'}</h3>
            <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>{myFighter?.rarity} &bull; {myFighter?.strength}</p>
            <div className="rounded-full h-3 overflow-hidden mb-1" style={{ background: 'rgba(74,222,128,0.2)' }}>
              <div className="h-full transition-all duration-500 rounded-full" style={{
                width: `${Math.max(0, (myHp / (myFighter?.stats.hp || 100)) * 100)}%`,
                background: 'var(--success)',
                boxShadow: '0 0 8px var(--success)',
              }} />
            </div>
            <span className="text-xs font-semibold" style={{ color: 'var(--success)' }}>{Math.max(0, myHp)} / {myFighter?.stats.hp || 100} HP</span>
          </div>

          <div className="p-4 rounded-lg" style={{ background: 'var(--bg-deep)', border: '2px solid var(--danger)' }}>
            <h3 className="font-bold" style={{ color: 'var(--text-color)' }}>{opponentFighter?.name || 'Opponent'}</h3>
            <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>{opponentFighter?.rarity} &bull; {opponentFighter?.strength}</p>
            <div className="rounded-full h-3 overflow-hidden mb-1" style={{ background: 'rgba(242,63,66,0.2)' }}>
              <div className="h-full transition-all duration-500 rounded-full" style={{
                width: `${Math.max(0, (opponentHp / (opponentFighter?.stats.hp || 100)) * 100)}%`,
                background: 'var(--danger)',
                boxShadow: '0 0 8px var(--danger)',
              }} />
            </div>
            <span className="text-xs font-semibold" style={{ color: 'var(--danger)' }}>{Math.max(0, opponentHp)} / {opponentFighter?.stats.hp || 100} HP</span>
          </div>
        </div>
      </div>

      {/* Move Selection */}
      {battle.status === 'commit' && isMyTurn && (
        <div className="glow-card p-6">
          <h2 style={{ color: 'var(--text-color)' }} className="text-lg font-semibold mb-4">🎯 Choose Your Move</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {availableMoves.map((move) => {
              if (!move) return null;
              const moveData = MOVES[move];
              return (
                <button
                  key={move}
                  onClick={() => setSelectedMove(move)}
                  className="p-3 rounded-lg transition-all cursor-pointer"
                  style={{
                    background: selectedMove === move ? 'var(--sel-fill)' : 'var(--bg-deep)',
                    color: selectedMove === move ? 'var(--sel-text)' : 'var(--text-color)',
                    border: `2px solid ${selectedMove === move ? 'var(--accent)' : 'var(--border-color)'}`,
                    boxShadow: selectedMove === move ? '0 0 12px var(--glow-outer)' : 'none',
                  }}
                >
                  <div className="font-semibold text-sm">{moveData.name}</div>
                  <div className="text-xs opacity-70">{moveData.element}</div>
                  <div className="text-xs opacity-50">DMG: {moveData.damage}</div>
                </button>
              );
            })}
          </div>

          {selectedMove && (
            <div className="rounded p-4 mb-4" style={{ background: 'var(--bg-deep)', border: '1px solid var(--border-color)' }}>
              <h3 className="font-semibold" style={{ color: 'var(--text-color)' }}>{MOVES[selectedMove].name}</h3>
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{MOVES[selectedMove].description}</p>
            </div>
          )}

          <button
            onClick={onSubmitMove}
            disabled={!selectedMove || isSubmittingMove}
            className="glow-btn w-full disabled:opacity-40"
          >
            {isSubmittingMove ? '⏳ Submitting...' : '⚡ Submit Move'}
          </button>
        </div>
      )}

      {battle.status === 'commit' && !isMyTurn && (
        <div className="glow-card p-6 text-center">
          <h3 className="font-semibold mb-2" style={{ color: 'var(--warning)' }}>⏳ Waiting for Opponent</h3>
          <p style={{ color: 'var(--text-muted)' }}>Your opponent is choosing their move...</p>
        </div>
      )}
    </div>
  );
}
