import type { Fighter, MoveKind, BattleState } from '../store/bowActivityStore';
import { calculateFighterDamage, resolveTurnOrder } from './fighters';

// ─────────────────────────────────────────────────────────────────
//  Privacy-First Battle Engine
//  Handles move calculations, damage, and state synchronization
// ─────────────────────────────────────────────────────────────────

export interface MoveData {
  kind: MoveKind;
  name: string;
  damage: number;
  element: string;
  accuracy: number;
  description: string;
}

export const MOVES: Record<NonNullable<MoveKind>, MoveData> = {
  SCRATCH: {
    kind: 'SCRATCH',
    name: 'Scratch',
    damage: 12,
    element: 'Normal',
    accuracy: 1.0,
    description: 'A basic physical attack with claws or nails.',
  },
  EMBER: {
    kind: 'EMBER',
    name: 'Ember',
    damage: 16,
    element: 'Fire',
    accuracy: 0.9,
    description: 'Launch small flames at the opponent.',
  },
  BUBBLE: {
    kind: 'BUBBLE',
    name: 'Bubble',
    damage: 14,
    element: 'Water',
    accuracy: 0.95,
    description: 'Shoot pressurized water bubbles.',
  },
  VINE: {
    kind: 'VINE',
    name: 'Vine Whip',
    damage: 18,
    element: 'Nature',
    accuracy: 0.85,
    description: 'Strike with thorny vines from the earth.',
  },
  THUNDER: {
    kind: 'THUNDER',
    name: 'Thunder Bolt',
    damage: 20,
    element: 'Electric',
    accuracy: 0.8,
    description: 'Unleash a powerful bolt of lightning.',
  },
  SHADOW: {
    kind: 'SHADOW',
    name: 'Shadow Strike',
    damage: 22,
    element: 'Shadow',
    accuracy: 0.75,
    description: 'Attack from the shadows with dark energy.',
  },
  BLIZZARD: {
    kind: 'BLIZZARD',
    name: 'Blizzard',
    damage: 24,
    element: 'Ice',
    accuracy: 0.7,
    description: 'Summon a freezing blizzard of ice shards.',
  },
  SHIELD: {
    kind: 'SHIELD',
    name: 'Shield',
    damage: 0,
    element: 'Defensive',
    accuracy: 1.0,
    description: 'Create a protective barrier, reducing incoming damage by 50%.',
  },
};

// Element effectiveness is authoritative in fighters.ts
// Re-exported here for move-description tooltips
export { ELEMENT_EFFECTIVENESS } from './fighters';

export class PrivacyBattleEngine {
  private battleState: BattleState;
  
  constructor(battleState: BattleState) {
    this.battleState = battleState;
  }

  // Calculate damage for a move between fighters
  calculateDamage(
    attacker: Fighter,
    defender: Fighter,
    move: MoveKind,
    isShielded: boolean = false
  ): number {
    if (!move || move === 'SHIELD') return 0;

    const moveData = MOVES[move];

    // Use the authoritative damage formula from fighters.ts
    let damage = calculateFighterDamage(moveData.damage, attacker, defender);

    // Shield halves damage on top of the base formula
    if (isShielded) {
      damage = Math.floor(damage * 0.5);
    }

    // Small random variance (±10%)
    const variance = 0.9 + Math.random() * 0.2;
    return Math.max(1, Math.floor(damage * variance));
  }

  // Execute a battle round with two moves
  executeRound(player1Move: MoveKind, player2Move: MoveKind): {
    player1Damage: number;
    player2Damage: number;
    battleLog: string[];
  } {
    const { player1Fighter, player2Fighter } = this.battleState;
    if (!player1Fighter || !player2Fighter) {
      throw new Error('Battle requires both fighters');
    }

    const log: string[] = [];
    let player1Damage = 0;
    let player2Damage = 0;

    // Determine turn order based on speed
    const player1First = resolveTurnOrder(player1Fighter, player2Fighter) === 'player-first';

    // Check for shields
    const player1Shielded = player1Move === 'SHIELD';
    const player2Shielded = player2Move === 'SHIELD';

    if (player1First) {
      // Player 1 moves first
      if (player1Move && player1Move !== 'SHIELD') {
        player2Damage = this.calculateDamage(player1Fighter, player2Fighter, player1Move, player2Shielded);
        const moveName = MOVES[player1Move].name;
        log.push(`${player1Fighter.name} used ${moveName} for ${player2Damage} damage!`);
        
        if (player2Shielded) {
          log.push(`${player2Fighter.name}'s shield reduced the damage!`);
        }
      } else if (player1Shielded) {
        log.push(`${player1Fighter.name} raised a protective shield!`);
      }

      // Player 2 moves second (if still alive)
      if (this.battleState.player2Hp - player2Damage > 0) {
        if (player2Move && player2Move !== 'SHIELD') {
          player1Damage = this.calculateDamage(player2Fighter, player1Fighter, player2Move, player1Shielded);
          const moveName = MOVES[player2Move].name;
          log.push(`${player2Fighter.name} used ${moveName} for ${player1Damage} damage!`);
          
          if (player1Shielded) {
            log.push(`${player1Fighter.name}'s shield reduced the damage!`);
          }
        } else if (player2Shielded && !player1Shielded) {
          log.push(`${player2Fighter.name} raised a protective shield!`);
        }
      }
    } else {
      // Player 2 moves first
      if (player2Move && player2Move !== 'SHIELD') {
        player1Damage = this.calculateDamage(player2Fighter, player1Fighter, player2Move, player1Shielded);
        const moveName = MOVES[player2Move].name;
        log.push(`${player2Fighter.name} used ${moveName} for ${player1Damage} damage!`);
        
        if (player1Shielded) {
          log.push(`${player1Fighter.name}'s shield reduced the damage!`);
        }
      } else if (player2Shielded) {
        log.push(`${player2Fighter.name} raised a protective shield!`);
      }

      // Player 1 moves second (if still alive)
      if (this.battleState.player1Hp - player1Damage > 0) {
        if (player1Move && player1Move !== 'SHIELD') {
          player2Damage = this.calculateDamage(player1Fighter, player2Fighter, player1Move, player2Shielded);
          const moveName = MOVES[player1Move].name;
          log.push(`${player1Fighter.name} used ${moveName} for ${player2Damage} damage!`);
          
          if (player2Shielded) {
            log.push(`${player2Fighter.name}'s shield reduced the damage!`);
          }
        } else if (player1Shielded && !player2Shielded) {
          log.push(`${player1Fighter.name} raised a protective shield!`);
        }
      }
    }

    return { player1Damage, player2Damage, battleLog: log };
  }

  // Check if battle is finished and determine winner
  checkBattleEnd(player1Hp: number, player2Hp: number): 'player1' | 'player2' | 'draw' | null {
    if (player1Hp <= 0 && player2Hp <= 0) return 'draw';
    if (player1Hp <= 0) return 'player2';
    if (player2Hp <= 0) return 'player1';
    
    // Check for max rounds (20 rounds = draw)
    if (this.battleState.roundNumber >= 20) return 'draw';
    
    return null;
  }

  /** Returns a snapshot of the current battle state */
  getBattleState(): BattleState {
    return { ...this.battleState };
  }

  /**
   * Applies damage from executeRound, advances the round counter,
   * and checks for battle end. Returns the updated BattleState.
   * Call this immediately after executeRound().
   */
  applyRound(player1Damage: number, player2Damage: number): BattleState {
    const newP1Hp = Math.max(0, this.battleState.player1Hp - player1Damage);
    const newP2Hp = Math.max(0, this.battleState.player2Hp - player2Damage);

    this.battleState = {
      ...this.battleState,
      player1Hp:   newP1Hp,
      player2Hp:   newP2Hp,
      roundNumber: this.battleState.roundNumber + 1,
    };

    const winner = this.checkBattleEnd(newP1Hp, newP2Hp);
    if (winner !== null) {
      this.battleState = {
        ...this.battleState,
        status: 'finished',
        winner,
      };
    }

    return { ...this.battleState };
  }

  // Calculate APS (Arcane Power Score) change after battle
  calculateAPSChange(
    winner: 'player1' | 'player2' | 'draw' | null,
    player1Fighter: Fighter,
    player2Fighter: Fighter,
    isPlayer1: boolean
  ): number {
    if (!winner || winner === 'draw') return 0;
    
    const won = (winner === 'player1' && isPlayer1) || (winner === 'player2' && !isPlayer1);
    const myFighter = isPlayer1 ? player1Fighter : player2Fighter;
    const opponentFighter = isPlayer1 ? player2Fighter : player1Fighter;
    
    // Base APS change
    let apsChange = won ? 25 : -15;
    
    // Rarity bonus/penalty
    const rarityMultiplier = this.getRarityMultiplier(myFighter.rarity, opponentFighter.rarity);
    apsChange = Math.floor(apsChange * rarityMultiplier);
    
    return apsChange;
  }

  private getRarityMultiplier(myRarity: string, opponentRarity: string): number {
    const rarityValues = { Common: 1, Uncommon: 2, Rare: 3, Epic: 4, Legendary: 5 };
    const myValue = rarityValues[myRarity as keyof typeof rarityValues] || 1;
    const opponentValue = rarityValues[opponentRarity as keyof typeof rarityValues] || 1;
    
    if (myValue > opponentValue) return 0.8; // Less APS for beating weaker opponent
    if (myValue < opponentValue) return 1.3; // More APS for beating stronger opponent
    return 1.0; // Equal rarity
  }
}

// Utility functions for battle management
export function createBattle(
  player1Id: string,
  player2Id: string,
  player1Fighter: Fighter,
  player2Fighter: Fighter
): BattleState {
  return {
    battleId: `battle_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    player1Id,
    player2Id,
    player1Fighter,
    player2Fighter,
    currentTurn: 'player1',
    player1Hp: player1Fighter.stats.hp,
    player2Hp: player2Fighter.stats.hp,
    roundNumber: 1,
    status: 'commit',
    winner: null,
    moveHistory: [],
  };
}

export function getAvailableMoves(fighter: Fighter): MoveKind[] {
  // Basic moves available to all fighters
  const basicMoves: MoveKind[] = ['SCRATCH', 'SHIELD'];
  
  // Element-specific moves based on fighter strength
  const elementMoves: Record<string, MoveKind[]> = {
    Fire: ['EMBER'],
    Water: ['BUBBLE'],
    Nature: ['VINE'],
    Electric: ['THUNDER'],
    Shadow: ['SHADOW'],
    Ice: ['BLIZZARD'],
  };
  
  const strengthMoves = elementMoves[fighter.strength] || [];
  return [...basicMoves, ...strengthMoves];
}