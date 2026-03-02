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

  // Create new battle
  const handleCreateBattle = async () => {
    if (!selectedFighter || !isConnected) {
      store.addBattleLog('❌ Connect wallet and select a fighter first');
      return;
    }

    try {
      const response = await fetch('/api/battle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'CREATE_BATTLE',
          userId,
          fighter: selectedFighter,
        }),
      });

      const result = await response.json();
      if (result.success) {
        store.setBattle(result.battle);
        setBattleId(result.battle.battleId);
        store.setIsInBattle(true);
        store.addBattleLog(`🏟️ Battle created! Share ID: ${result.battle.battleId}`);
        console.log(`[aWizard UI] Created battle with state channel integration`);
      } else {
        store.addBattleLog(`❌ Failed to create battle: ${result.error}`);
      }
    } catch (error) {
      store.addBattleLog('❌ Network error creating battle');
      console.error('[aWizard UI] Create battle error:', error);
    }
  };

  // Join existing battle
  const handleJoinBattle = async () => {
    if (!selectedFighter || !isConnected || !battleId.trim()) {
      store.addBattleLog('❌ Connect wallet, select fighter, and enter battle ID');
      return;
    }

    try {
      const response = await fetch('/api/battle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'JOIN_BATTLE',
          battleId: battleId.trim(),
          userId,
          fighter: selectedFighter,
        }),
      });

      const result = await response.json();
      if (result.success) {
        store.setBattle(result.battle);
        store.setIsInBattle(true);
        store.addBattleLog('⚔️ Joined battle! Prepare for combat!');
        console.log(`[aWizard UI] Joined battle with relay communication`);
      } else {
        store.addBattleLog(`❌ Failed to join battle: ${result.error}`);
      }
    } catch (error) {
      store.addBattleLog('❌ Network error joining battle');
      console.error('[aWizard UI] Join battle error:', error);
    }
  };

  // Submit battle move
  const handleSubmitMove = async () => {
    if (!selectedMove || !currentBattle || isSubmittingMove) return;

    setIsSubmittingMove(true);
    try {
      const response = await fetch('/api/battle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'SUBMIT_MOVE',
          battleId: currentBattle.battleId,
          userId,
          move: selectedMove,
        }),
      });

      const result = await response.json();
      if (result.success) {
        if (result.waiting) {
          store.addBattleLog(`✨ Move submitted: ${MOVES[selectedMove].name}`);
          store.addBattleLog('⏳ Waiting for opponent...');
        } else if (result.roundResult) {
          // Round completed
          const { battleLog, player1Damage, player2Damage } = result.roundResult;
          battleLog.forEach((log: any) => store.addBattleLog(log));
          
          if (player1Damage > 0) {
            store.addBattleLog(`💥 Player 1 took ${player1Damage} damage!`);
          }
          if (player2Damage > 0) {
            store.addBattleLog(`💥 Player 2 took ${player2Damage} damage!`);
          }
        }

        // Update battle state
        if (result.battle) {
          store.setBattle(result.battle);
          
          if (result.battle.status === 'finished') {
            const winner = result.battle.winner;
            const isWinner = (winner === 'player1' && currentBattle.player1Id === userId) ||
                            (winner === 'player2' && currentBattle.player2Id === userId);
            
            if (winner === 'draw') {
              store.addBattleLog('⚖️ Battle ended in a draw!');
            } else if (isWinner) {
              store.addBattleLog('🏆 Victory! You won the battle!');
            } else {
              store.addBattleLog('💀 Defeat... Better luck next time!');
            }
            
            store.setIsInBattle(false);
            console.log(`[aWizard UI] Battle finished, state channel notified`);
          }
        }

        setSelectedMove(null);
      } else {
        store.addBattleLog(`❌ Move failed: ${result.error}`);
      }
    } catch (error) {
      store.addBattleLog('❌ Network error submitting move');
      console.error('[aWizard UI] Submit move error:', error);
    } finally {
      setIsSubmittingMove(false);
    }
  };

  // Leave battle
  const handleLeaveBattle = async () => {
    if (!currentBattle) return;

    try {
      await fetch('/api/battle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'LEAVE_BATTLE',
          battleId: currentBattle.battleId,
          userId,
        }),
      });

      store.resetBattle();
      store.setIsInBattle(false);
      store.addBattleLog('🚪 Left battle');
      setBattleId('');
    } catch (error) {
      console.error('[aWizard UI] Leave battle error:', error);
    }
  };

  if (!isConnected) {
    return (
      <div className="p-6 text-center">
        <div className="bg-yellow-100 border border-yellow-400 rounded-lg p-4 mb-4">
          <h3 className="text-lg font-semibold text-yellow-800 mb-2">🔐 Wallet Required</h3>
          <p className="text-yellow-700">
            Connect your wallet in the Wallet tab to start battling with your NFT fighters!
          </p>
        </div>
      </div>
    );
  }

  if (!selectedFighter) {
    return (
      <div className="p-6 text-center">
        <div className="bg-blue-100 border border-blue-400 rounded-lg p-4 mb-4">
          <h3 className="text-lg font-semibold text-blue-800 mb-2">🧙 Choose Your Fighter</h3>
          <p className="text-blue-700">
            Select a fighter in the Wallet tab to enter battle!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg p-6">
        <h1 className="text-2xl font-bold mb-2">⚔️ Battle Arena</h1>
        <p className="text-purple-100">
          Privacy-first PvP battles with state channel relay integration
        </p>
      </div>

      {/* Fighter Display */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-lg font-semibold mb-4">🧙 Your Fighter</h2>
        <div className="flex items-center gap-4">
          <div className="bg-gray-100 rounded-lg p-4">
            <h3 className="font-bold text-lg">{selectedFighter.name}</h3>
            <p className="text-sm text-gray-600">{selectedFighter.rarity} • {selectedFighter.strength}</p>
            <div className="mt-2 text-sm">
              <span>HP: {selectedFighter.stats.hp}</span> • 
              <span> ATK: {selectedFighter.stats.atk}</span> • 
              <span> DEF: {selectedFighter.stats.def}</span> • 
              <span> SPD: {selectedFighter.stats.spd}</span>
            </div>
          </div>
          {selectedFighter.effect && (
            <div className="bg-yellow-50 rounded p-3">
              <p className="text-sm"><strong>Special:</strong> {selectedFighter.effect}</p>
            </div>
          )}
        </div>
      </div>

      {/* Battle Controls */}
      {!isInBattle ? (
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-semibold mb-4">🏟️ Create Battle</h2>
            <p className="text-gray-600 mb-4">
              Start a new battle and wait for an opponent to join via state channel relay.
            </p>
            <button
              onClick={handleCreateBattle}
              className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-semibold transition-colors"
            >
              Create Battle
            </button>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-semibold mb-4">🔍 Join Battle</h2>
            <p className="text-gray-600 mb-4">
              Enter a battle ID to join an existing battle.
            </p>
            <input
              type="text"
              placeholder="Enter Battle ID"
              value={battleId}
              onChange={(e) => setBattleId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              onClick={handleJoinBattle}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold transition-colors"
            >
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
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">📜 Battle Log</h2>
          <button
            onClick={store.clearBattleLogs}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Clear
          </button>
        </div>
        <div className="bg-gray-50 rounded p-4 max-h-64 overflow-y-auto">
          {store.gui.battleLogs.length === 0 ? (
            <p className="text-gray-500 text-center">No battle activity yet</p>
          ) : (
            store.gui.battleLogs.map((log: string, index: number) => (
              <div key={index} className="py-1 text-sm font-mono">
                {log}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

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
  battle,
  userId,
  selectedFighter,
  isMyTurn,
  selectedMove,
  setSelectedMove,
  onSubmitMove,
  onLeaveBattle,
  isSubmittingMove
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
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">⚔️ Round {battle.roundNumber}</h2>
          <div className="flex gap-2">
            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
              battle.status === 'waiting' ? 'bg-yellow-100 text-yellow-800' :
              battle.status === 'commit' ? 'bg-blue-100 text-blue-800' :
              battle.status === 'finished' ? 'bg-green-100 text-green-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {battle.status.toUpperCase()}
            </span>
            <button
              onClick={onLeaveBattle}
              className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm hover:bg-red-200"
            >
              Leave
            </button>
          </div>
        </div>

        {/* Fighters Display */}
        <div className="grid grid-cols-2 gap-6">
          <div className={`p-4 rounded-lg ${isPlayer1 ? 'bg-blue-50' : 'bg-gray-50'} border-2 ${isPlayer1 ? 'border-blue-200' : 'border-gray-200'}`}>
            <h3 className="font-bold text-lg">{myFighter?.name || 'You'}</h3>
            <div className="text-sm text-gray-600 mb-2">{myFighter?.rarity} • {myFighter?.strength}</div>
            <div className="bg-green-200 rounded-full h-4 overflow-hidden mb-2">
              <div
                className="bg-green-500 h-full transition-all duration-500"
                style={{ width: `${Math.max(0, (myHp / (myFighter?.stats.hp || 100)) * 100)}%` }}
              />
            </div>
            <div className="text-sm font-semibold">{Math.max(0, myHp)} / {myFighter?.stats.hp || 100} HP</div>
          </div>

          <div className={`p-4 rounded-lg ${!isPlayer1 ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'} border-2`}>
            <h3 className="font-bold text-lg">{opponentFighter?.name || 'Opponent'}</h3>
            <div className="text-sm text-gray-600 mb-2">{opponentFighter?.rarity} • {opponentFighter?.strength}</div>
            <div className="bg-red-200 rounded-full h-4 overflow-hidden mb-2">
              <div
                className="bg-red-500 h-full transition-all duration-500"
                style={{ width: `${Math.max(0, (opponentHp / (opponentFighter?.stats.hp || 100)) * 100)}%` }}
              />
            </div>
            <div className="text-sm font-semibold">{Math.max(0, opponentHp)} / {opponentFighter?.stats.hp || 100} HP</div>
          </div>
        </div>
      </div>

      {/* Move Selection */}
      {battle.status === 'commit' && isMyTurn && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold mb-4">🎯 Choose Your Move</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {availableMoves.map((move) => {
              if (!move) return null;
              const moveData = MOVES[move];
              return (
                <button
                  key={move}
                  onClick={() => setSelectedMove(move)}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    selectedMove === move
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className="font-semibold text-sm">{moveData.name}</div>
                  <div className="text-xs text-gray-600">{moveData.element}</div>
                  <div className="text-xs text-gray-500">DMG: {moveData.damage}</div>
                </button>
              );
            })}
          </div>

          {selectedMove && (
            <div className="bg-gray-50 rounded p-4 mb-4">
              <h3 className="font-semibold">{MOVES[selectedMove].name}</h3>
              <p className="text-sm text-gray-600 mt-1">{MOVES[selectedMove].description}</p>
            </div>
          )}

          <button
            onClick={onSubmitMove}
            disabled={!selectedMove || isSubmittingMove}
            className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white px-4 py-3 rounded-lg font-semibold transition-colors"
          >
            {isSubmittingMove ? '⏳ Submitting...' : '⚡ Submit Move'}
          </button>
        </div>
      )}

      {battle.status === 'commit' && !isMyTurn && (
        <div className="bg-yellow-50 rounded-lg p-6 text-center">
          <h3 className="font-semibold text-yellow-800 mb-2">⏳ Waiting for Opponent</h3>
          <p className="text-yellow-600">Your opponent is choosing their move...</p>
        </div>
      )}
    </div>
  );
}