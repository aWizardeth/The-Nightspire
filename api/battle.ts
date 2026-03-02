// ─────────────────────────────────────────────────────────────────
//  Shared Battle State API
//  Handles battle synchronization between Activity users
// ─────────────────────────────────────────────────────────────────

import type { NextRequest } from 'next/server';
import type { BattleState, Fighter, MoveKind } from '../../src/store/bowActivityStore';
import { PrivacyBattleEngine, createBattle } from '../../src/lib/battleEngine';
import { stateChannelManager } from '../../src/lib/stateChannel';

// In-memory battle state storage (would use Redis/upstash in production)
const battleStates = new Map<string, BattleState>();
const userMoves = new Map<string, { battleId: string; userId: string; move: MoveKind; round: number }>();

export async function POST(request: NextRequest) {
  try {
    const { action, ...data } = await request.json();

    switch (action) {
      case 'CREATE_BATTLE':
        return handleCreateBattle(data);
      
      case 'JOIN_BATTLE':
        return handleJoinBattle(data);
      
      case 'SUBMIT_MOVE':
        return handleSubmitMove(data);
      
      case 'GET_BATTLE':
        return handleGetBattle(data);
      
      case 'LEAVE_BATTLE':
        return handleLeaveBattle(data);
      
      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
    }
  } catch (error) {
    console.error('[aWizard Battle API] Error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

async function handleCreateBattle(data: {
  userId: string;
  fighter: Fighter;
}) {
  const { userId, fighter } = data;
  
  // Create a new battle state waiting for opponent
  const battle = createBattle(userId, '', fighter, {
    source: 'user',
    name: 'Waiting...',
    stats: { hp: 100, atk: 15, def: 10, spd: 12 },
    strength: 'Arcane',
    weakness: 'Shadow',
    rarity: 'Common',
  });
  
  battle.status = 'waiting';
  battle.player2Id = null;
  battle.player2Fighter = null;
  
  battleStates.set(battle.battleId, battle);
  
  // Initialize state channel for relay communication
  try {
    const channel = stateChannelManager.getChannel(battle.battleId);
    await channel.initialize(userId, fighter);
    console.log(`[aWizard API] State channel initialized for battle ${battle.battleId}`);
  } catch (error) {
    console.warn(`[aWizard API] State channel init failed for ${battle.battleId}:`, error);
    // Continue without state channel - Discord Activity can work locally
  }
  
  console.log(`[aWizard API] Created battle ${battle.battleId} for user ${userId}`);
  
  return new Response(JSON.stringify({ 
    success: true, 
    battle: sanitizeBattleForUser(battle, userId) 
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

async function handleJoinBattle(data: {
  battleId: string;
  userId: string;
  fighter: Fighter;
}) {
  const { battleId, userId, fighter } = data;
  
  const battle = battleStates.get(battleId);
  if (!battle) {
    return new Response(JSON.stringify({ error: 'Battle not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  
  if (battle.status !== 'waiting') {
    return new Response(JSON.stringify({ error: 'Battle not available for joining' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  
  if (battle.player1Id === userId) {
    return new Response(JSON.stringify({ error: 'Cannot join your own battle' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  
  // Join as player 2
  battle.player2Id = userId;
  battle.player2Fighter = fighter;
  battle.player2Hp = fighter.stats.hp;
  battle.status = 'commit';
  battle.currentTurn = 'player1';
  
  battleStates.set(battleId, battle);
  
  // Join state channel for relay communication
  try {
    const channel = stateChannelManager.getChannel(battleId);
    await channel.joinChannel(userId, fighter);
    console.log(`[aWizard API] User ${userId} joined state channel for battle ${battleId}`);
  } catch (error) {
    console.warn(`[aWizard API] State channel join failed for ${battleId}:`, error);
    // Continue without state channel
  }
  
  console.log(`[aWizard API] User ${userId} joined battle ${battleId}`);
  
  return new Response(JSON.stringify({ 
    success: true, 
    battle: sanitizeBattleForUser(battle, userId) 
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

async function handleSubmitMove(data: {
  battleId: string;
  userId: string;
  move: MoveKind;
}) {
  const { battleId, userId, move } = data;
  
  const battle = battleStates.get(battleId);
  if (!battle) {
    return new Response(JSON.stringify({ error: 'Battle not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  
  if (battle.status === 'finished') {
    return new Response(JSON.stringify({ error: 'Battle already finished' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  
  // Commit move to state channel (privacy-preserving)
  let moveNonce: string | null = null;
  try {
    const channel = stateChannelManager.getChannel(battleId);
    moveNonce = await channel.commitMove(userId, move, battle.roundNumber);
    console.log(`[aWizard API] Move committed to state channel for ${userId}`);
  } catch (error) {
    console.warn(`[aWizard API] State channel move commit failed:`, error);
    // Continue with local battle
  }
  
  // Store the user's move locally
  const moveKey = `${battleId}_${userId}_${battle.roundNumber}`;
  userMoves.set(moveKey, { battleId, userId, move, round: battle.roundNumber });
  
  console.log(`[aWizard API] User ${userId} submitted move ${move} for battle ${battleId} round ${battle.roundNumber}`);
  
  // Check if both players have submitted moves
  const player1MoveKey = `${battleId}_${battle.player1Id}_${battle.roundNumber}`;
  const player2MoveKey = `${battleId}_${battle.player2Id}_${battle.roundNumber}`;
  
  const player1Move = userMoves.get(player1MoveKey);
  const player2Move = userMoves.get(player2MoveKey);
  
  if (player1Move && player2Move) {
    // Both moves submitted, reveal to state channel then execute
    try {
      const channel = stateChannelManager.getChannel(battleId);
      if (moveNonce) {
        await channel.revealMove(userId, move, battle.roundNumber, moveNonce);
      }
    } catch (error) {
      console.warn(`[aWizard API] State channel move reveal failed:`, error);
    }
    
    // Execute the round
    return executeRound(battle, player1Move.move, player2Move.move);
  } else {
    // Waiting for other player's move
    battle.status = 'commit';
    battleStates.set(battleId, battle);
    
    return new Response(JSON.stringify({ 
      success: true, 
      waiting: true,
      battle: sanitizeBattleForUser(battle, userId) 
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

function executeRound(battle: BattleState, player1Move: MoveKind, player2Move: MoveKind) {
  if (!battle.player1Fighter || !battle.player2Fighter) {
    throw new Error('Battle missing fighters');
  }
  
  const engine = new PrivacyBattleEngine(battle);
  const result = engine.executeRound(player1Move, player2Move);
  
  // Update battle state
  battle.player1Hp = Math.max(0, battle.player1Hp - result.player1Damage);
  battle.player2Hp = Math.max(0, battle.player2Hp - result.player2Damage);
  
  // Add to move history
  battle.moveHistory.push({
    round: battle.roundNumber,
    player1Move,
    player2Move,
    damage: { player1: result.player1Damage, player2: result.player2Damage },
  });
  
  // Check for battle end
  const winner = engine.checkBattleEnd(battle.player1Hp, battle.player2Hp);
  if (winner) {
    battle.status = 'finished';
    battle.winner = winner;
    
    // Notify state channel of battle completion
    try {
      const channel = stateChannelManager.getChannel(battle.battleId);
      channel.endBattle(winner, battle).catch(error => 
        console.warn(`[aWizard API] State channel end battle failed:`, error)
      );
    } catch (error) {
      console.warn(`[aWizard API] State channel not available for battle end`);
    }
    
    console.log(`[aWizard API] Battle ${battle.battleId} finished, winner: ${winner}`);
  } else {
    battle.roundNumber += 1;
    battle.status = 'commit';
    battle.currentTurn = battle.currentTurn === 'player1' ? 'player2' : 'player1';
  }
  
  battleStates.set(battle.battleId, battle);
  
  return new Response(JSON.stringify({ 
    success: true, 
    roundResult: {
      player1Move,
      player2Move,
      player1Damage: result.player1Damage,
      player2Damage: result.player2Damage,
      battleLog: result.battleLog,
    },
    battle: sanitizeBattleForUser(battle, '') // Don't sanitize for round results
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

async function handleGetBattle(data: {
  battleId: string;
  userId: string;
}) {
  const { battleId, userId } = data;
  
  const battle = battleStates.get(battleId);
  if (!battle) {
    return new Response(JSON.stringify({ error: 'Battle not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  
  return new Response(JSON.stringify({ 
    success: true, 
    battle: sanitizeBattleForUser(battle, userId) 
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

async function handleLeaveBattle(data: {
  battleId: string;
  userId: string;
}) {
  const { battleId, userId } = data;
  
  const battle = battleStates.get(battleId);
  if (!battle) {
    return new Response(JSON.stringify({ error: 'Battle not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  
  // Forfeit the battle
  if (battle.player1Id === userId) {
    battle.winner = 'player2';
  } else if (battle.player2Id === userId) {
    battle.winner = 'player1';
  }
  
  battle.status = 'finished';
  battleStates.set(battleId, battle);
  
  console.log(`[aWizard API] User ${userId} left battle ${battleId}`);
  
  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// Sanitize battle state for privacy (don't expose opponent's wallet data)
function sanitizeBattleForUser(battle: BattleState, userId: string): BattleState {
  return {
    ...battle,
    // Keep all battle data visible for gameplay
    // Wallet privacy is handled at the component level
  };
}

// Clean up old battles (run periodically)
function cleanupOldBattles() {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  
  for (const [battleId, battle] of battleStates.entries()) {
    const battleTime = parseInt(battleId.split('_')[1]);
    if (battleTime < oneHourAgo) {
      battleStates.delete(battleId);
      
      // Clean up associated moves
      for (const [moveKey] of userMoves.entries()) {
        if (moveKey.startsWith(battleId)) {
          userMoves.delete(moveKey);
        }
      }
    }
  }
}

// Run cleanup every 15 minutes
setInterval(cleanupOldBattles, 15 * 60 * 1000);

export { POST as GET }; // Allow GET requests for battle status