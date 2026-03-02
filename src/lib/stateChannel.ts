import type { BattleState, Fighter, MoveKind } from '../store/bowActivityStore';

// ─────────────────────────────────────────────────────────────────
//  State Channel Relay Interface for Discord Activity
//  Handles communication with other battle relays and validation
// ─────────────────────────────────────────────────────────────────

export interface RelayMessage {
  type: 'BATTLE_CREATE' | 'BATTLE_JOIN' | 'MOVE_COMMIT' | 'MOVE_REVEAL' | 'BATTLE_END';
  channelId: string;
  discordUserId: string;
  battleId: string;
  timestamp: number;
  signature?: string;
  payload: any;
}

export interface StateChannelConfig {
  relayUrl?: string;
  discordGuildId?: string;
  channelTimeout: number;
  maxRetries: number;
}

const DEFAULT_CONFIG: StateChannelConfig = {
  relayUrl: 'https://relay.arcane-bow.com',
  channelTimeout: 30000, // 30 seconds
  maxRetries: 3,
};

export class DiscordStateChannel {
  private config: StateChannelConfig;
  private channelId: string;
  private participants: Set<string> = new Set();
  private messageHistory: RelayMessage[] = [];
  private isActive: boolean = false;

  constructor(channelId: string, config: Partial<StateChannelConfig> = {}) {
    this.channelId = channelId;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // Initialize state channel for Discord Activity battle
  async initialize(discordUserId: string, fighter: Fighter): Promise<void> {
    console.log(`[aWizard StateChannel] Initializing channel ${this.channelId} for user ${discordUserId}`);
    
    this.participants.add(discordUserId);
    this.isActive = true;

    // Send initialization message to relay
    await this.sendRelayMessage({
      type: 'BATTLE_CREATE',
      channelId: this.channelId,
      discordUserId,
      battleId: this.channelId,
      timestamp: Date.now(),
      payload: {
        fighter: {
          name: fighter.name,
          stats: fighter.stats,
          strength: fighter.strength,
          weakness: fighter.weakness,
          rarity: fighter.rarity,
          // Don't include NFT token IDs or wallet data
        },
        activityContext: 'discord',
        privacyLevel: 'relay-only',
      }
    });
  }

  // Join existing state channel
  async joinChannel(discordUserId: string, fighter: Fighter): Promise<boolean> {
    if (this.participants.has(discordUserId)) {
      console.log(`[aWizard StateChannel] User ${discordUserId} already in channel ${this.channelId}`);
      return true;
    }

    if (this.participants.size >= 2) {
      console.log(`[aWizard StateChannel] Channel ${this.channelId} is full`);
      return false;
    }

    console.log(`[aWizard StateChannel] User ${discordUserId} joining channel ${this.channelId}`);
    
    this.participants.add(discordUserId);

    await this.sendRelayMessage({
      type: 'BATTLE_JOIN',
      channelId: this.channelId,
      discordUserId,
      battleId: this.channelId,
      timestamp: Date.now(),
      payload: {
        fighter: {
          name: fighter.name,
          stats: fighter.stats,
          strength: fighter.strength,
          weakness: fighter.weakness,
          rarity: fighter.rarity,
        },
        activityContext: 'discord',
      }
    });

    return true;
  }

  // Commit move to state channel (privacy-preserving)
  async commitMove(discordUserId: string, move: MoveKind, round: number): Promise<string> {
    if (!this.participants.has(discordUserId)) {
      throw new Error('User not in channel');
    }

    // Create move commitment (hash for privacy)
    const moveCommitment = await this.createMoveCommitment(move, round, discordUserId);
    
    await this.sendRelayMessage({
      type: 'MOVE_COMMIT',
      channelId: this.channelId,
      discordUserId,
      battleId: this.channelId,
      timestamp: Date.now(),
      payload: {
        round,
        commitment: moveCommitment.hash,
        // Don't reveal actual move yet
      }
    });

    console.log(`[aWizard StateChannel] Move committed for user ${discordUserId} round ${round}`);
    return moveCommitment.nonce;
  }

  // Reveal move after both players have committed
  async revealMove(
    discordUserId: string, 
    move: MoveKind, 
    round: number, 
    nonce: string
  ): Promise<void> {
    await this.sendRelayMessage({
      type: 'MOVE_REVEAL',
      channelId: this.channelId,
      discordUserId,
      battleId: this.channelId,
      timestamp: Date.now(),
      payload: {
        round,
        move,
        nonce,
        // Relay can now verify the commitment
      }
    });

    console.log(`[aWizard StateChannel] Move revealed for user ${discordUserId}: ${move}`);
  }

  // End battle and finalize state
  async endBattle(
    winner: 'player1' | 'player2' | 'draw' | null,
    finalState: Partial<BattleState>
  ): Promise<void> {
    await this.sendRelayMessage({
      type: 'BATTLE_END',
      channelId: this.channelId,
      discordUserId: '', // System message
      battleId: this.channelId,
      timestamp: Date.now(),
      payload: {
        winner,
        finalState: {
          roundNumber: finalState.roundNumber,
          player1Hp: finalState.player1Hp,
          player2Hp: finalState.player2Hp,
          moveHistory: finalState.moveHistory,
          // Don't include fighter details or wallet info
        },
        participants: Array.from(this.participants),
      }
    });

    this.isActive = false;
    console.log(`[aWizard StateChannel] Battle ended in channel ${this.channelId}, winner: ${winner}`);
  }

  // Send message to relay network
  private async sendRelayMessage(message: RelayMessage): Promise<void> {
    try {
      // Add signature if needed (for production)
      const signedMessage = await this.signMessage(message);
      
      // Store in local history
      this.messageHistory.push(signedMessage);
      
      // Send to relay if configured
      if (this.config.relayUrl) {
        const response = await fetch(`${this.config.relayUrl}/api/state-channel`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(signedMessage),
        });

        if (!response.ok) {
          console.warn(`[aWizard StateChannel] Relay send failed: ${response.statusText}`);
        }
      }
    } catch (error) {
      console.error(`[aWizard StateChannel] Failed to send relay message:`, error);
    }
  }

  // Create cryptographic commitment for move privacy
  private async createMoveCommitment(
    move: MoveKind, 
    round: number, 
    userId: string
  ): Promise<{ hash: string; nonce: string }> {
    const nonce = Math.random().toString(36).substring(2, 15);
    const data = `${move}:${round}:${userId}:${nonce}`;
    
    // Use Web Crypto API for hashing
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    return { hash, nonce };
  }

  // Sign message for relay verification
  private async signMessage(message: RelayMessage): Promise<RelayMessage> {
    // In production, this would use proper cryptographic signatures
    // For Discord Activity, we use a simple verification approach
    const messageStr = JSON.stringify({
      type: message.type,
      channelId: message.channelId,
      payload: message.payload,
    });
    
    const signature = btoa(messageStr).substring(0, 16);
    
    return {
      ...message,
      signature,
    };
  }

  // Get channel status for debugging
  getChannelStatus(): {
    channelId: string;
    participants: string[];
    messageCount: number;
    isActive: boolean;
  } {
    return {
      channelId: this.channelId,
      participants: Array.from(this.participants),
      messageCount: this.messageHistory.length,
      isActive: this.isActive,
    };
  }
}

// State channel manager for Discord Activity
export class ActivityStateChannelManager {
  private channels = new Map<string, DiscordStateChannel>();
  
  // Create or get channel for a Discord Activity battle
  getChannel(channelId: string, config?: Partial<StateChannelConfig>): DiscordStateChannel {
    if (!this.channels.has(channelId)) {
      const channel = new DiscordStateChannel(channelId, config);
      this.channels.set(channelId, channel);
      console.log(`[aWizard StateManager] Created channel ${channelId}`);
    }
    
    return this.channels.get(channelId)!;
  }

  // Clean up inactive channels
  cleanup(): void {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    
    for (const [channelId, channel] of this.channels.entries()) {
      const status = channel.getChannelStatus();
      if (!status.isActive && status.messageCount === 0) {
        this.channels.delete(channelId);
        console.log(`[aWizard StateManager] Cleaned up channel ${channelId}`);
      }
    }
  }

  // Get all active channels
  getActiveChannels(): string[] {
    const active: string[] = [];
    
    for (const [channelId, channel] of this.channels.entries()) {
      if (channel.getChannelStatus().isActive) {
        active.push(channelId);
      }
    }
    
    return active;
  }
}

export const stateChannelManager = new ActivityStateChannelManager();

// Clean up channels every 30 minutes
if (typeof window !== 'undefined') {
  setInterval(() => {
    stateChannelManager.cleanup();
  }, 30 * 60 * 1000);
}