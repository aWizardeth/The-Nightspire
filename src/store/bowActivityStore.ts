import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ─────────────────────────────────────────────────────────────────
//  Privacy-First Battle of Wizards Store
//  Each user gets isolated wallet/NFT data with shared battle state
// ─────────────────────────────────────────────────────────────────

export type MoveKind = 'SCRATCH' | 'EMBER' | 'BUBBLE' | 'VINE' | 'THUNDER' | 'SHADOW' | 'BLIZZARD' | 'SHIELD' | null;

export interface Fighter {
  source: 'user' | 'gym';
  name: string;
  stats: { hp: number; atk: number; def: number; spd: number };
  strength: 'Fire' | 'Water' | 'Nature' | 'Electric' | 'Shadow' | 'Ice' | 'Arcane' | 'Spirit' | 'Corruption';
  weakness: 'Fire' | 'Water' | 'Nature' | 'Electric' | 'Shadow' | 'Ice' | 'Arcane' | 'Spirit' | 'Corruption';
  rarity: 'Common' | 'Uncommon' | 'Rare' | 'Epic' | 'Legendary';
  effect?: string;
}

export interface NFTData {
  id: string;
  tokenId: string;
  name: string;
  image?: string;
  attributes: { trait_type: string; value: string | number }[];
  fighter?: Fighter;
}

// Private wallet state (isolated per user)
export interface WalletState {
  fingerprint: string | null;
  address: string | null;
  session: any; // WalletConnect session
  pairingUri: string | null;
  isConnecting: boolean;
  nfts: NFTData[];
  selectedFighter: Fighter | null;
}

// Shared battle state (synchronized between users)
export interface BattleState {
  battleId: string | null;
  player1Id: string | null; // Discord user ID
  player2Id: string | null; // Discord user ID
  currentTurn: 'player1' | 'player2' | null;
  player1Hp: number;
  player2Hp: number;
  player1Fighter: Fighter | null;
  player2Fighter: Fighter | null;
  roundNumber: number;
  status: 'waiting' | 'commit' | 'reveal' | 'battle' | 'finished';
  winner: 'player1' | 'player2' | 'draw' | null;
  moveHistory: Array<{
    round: number;
    player1Move: MoveKind;
    player2Move: MoveKind;
    damage: { player1: number; player2: number };
  }>;
}

// GUI state (navigation, UI states)
export interface GuiState {
  accessToken: string | null;
  currentPage: 'wallet' | 'gym' | 'battle' | 'nft' | 'leaderboard';
  selectedTier: number;
  isInBattle: boolean;
  battleLogs: string[];
}

interface BowActivityStore {
  // Private wallet state (never shared)
  wallet: WalletState;
  setWalletFingerprint: (fp: string | null) => void;
  setWalletSession: (session: any) => void;
  setPairingUri: (uri: string | null) => void;
  setWalletConnecting: (connecting: boolean) => void;
  setNfts: (nfts: NFTData[]) => void;
  setSelectedFighter: (fighter: Fighter | null) => void;

  // Shared battle state (synchronized)
  battle: BattleState | null;
  setBattle: (battle: BattleState | null) => void;
  updateBattle: (updates: Partial<BattleState>) => void;
  
  // GUI state (local to each user)
  gui: GuiState;
  setAccessToken: (token: string | null) => void;
  setCurrentPage: (page: GuiState['currentPage']) => void;
  setSelectedTier: (tier: number) => void;
  setIsInBattle: (inBattle: boolean) => void;
  addBattleLog: (log: string) => void;
  clearBattleLogs: () => void;

  // Actions
  disconnectWallet: () => void;
  resetBattle: () => void;
}

const DEFAULT_FIGHTER: Fighter = {
  source: 'user',
  name: 'Apprentice Wizard',
  stats: { hp: 100, atk: 15, def: 10, spd: 12 },
  strength: 'Arcane',
  weakness: 'Shadow',
  rarity: 'Common',
};

export const useBowActivityStore = create<BowActivityStore>()(
  persist(
    (set, get) => ({
      // Private wallet state
      wallet: {
        fingerprint: null,
        address: null,
        session: null,
        pairingUri: null,
        isConnecting: false,
        nfts: [],
        selectedFighter: DEFAULT_FIGHTER,
      },

      setWalletFingerprint: (fp) =>
        set((state) => ({
          wallet: { ...state.wallet, fingerprint: fp }
        })),

      setWalletSession: (session) =>
        set((state) => ({
          wallet: { ...state.wallet, session }
        })),

      setPairingUri: (uri) =>
        set((state) => ({
          wallet: { ...state.wallet, pairingUri: uri }
        })),

      setWalletConnecting: (connecting) =>
        set((state) => ({
          wallet: { ...state.wallet, isConnecting: connecting }
        })),

      setNfts: (nfts) =>
        set((state) => ({
          wallet: { ...state.wallet, nfts }
        })),

      setSelectedFighter: (fighter) =>
        set((state) => ({
          wallet: { ...state.wallet, selectedFighter: fighter }
        })),

      // Shared battle state
      battle: null,
      
      setBattle: (battle) => set({ battle }),
      
      updateBattle: (updates) =>
        set((state) => ({
          battle: state.battle ? { ...state.battle, ...updates } : null
        })),

      // GUI state
      gui: {
        accessToken: null,
        currentPage: 'wallet',
        selectedTier: 1,
        isInBattle: false,
        battleLogs: [],
      },

      setAccessToken: (token) =>
        set((state) => ({
          gui: { ...state.gui, accessToken: token }
        })),

      setCurrentPage: (page) =>
        set((state) => ({
          gui: { ...state.gui, currentPage: page }
        })),

      setSelectedTier: (tier) =>
        set((state) => ({
          gui: { ...state.gui, selectedTier: tier }
        })),

      setIsInBattle: (inBattle) =>
        set((state) => ({
          gui: { ...state.gui, isInBattle: inBattle }
        })),

      addBattleLog: (log) =>
        set((state) => ({
          gui: {
            ...state.gui,
            battleLogs: [log, ...state.gui.battleLogs].slice(0, 20)
          }
        })),

      clearBattleLogs: () =>
        set((state) => ({
          gui: { ...state.gui, battleLogs: [] }
        })),

      // Actions
      disconnectWallet: () =>
        set((state) => ({
          wallet: {
            ...state.wallet,
            fingerprint: null,
            address: null,
            session: null,
            pairingUri: null,
            isConnecting: false,
            nfts: [],
          }
        })),

      resetBattle: () => set({ battle: null }),
    }),
    {
      name: 'bow-activity-store',
      // Only persist non-sensitive data
      partialize: (state) => ({
        wallet: {
          ...state.wallet,
          session: null, // Don't persist wallet session for security
          pairingUri: null, // Don't persist pairing URI
        },
        gui: {
          ...state.gui,
          accessToken: null, // Don't persist Discord token
        }
      }),
    }
  )
);

export default useBowActivityStore;