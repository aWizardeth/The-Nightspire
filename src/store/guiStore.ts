// ─────────────────────────────────────────────────────────────────
//  guiStore — Zustand store for aWizard GUI global state
// ─────────────────────────────────────────────────────────────────
import { create } from 'zustand';

interface GuiState {
  /** Discord OAuth2 access token (session-only, never persisted) */
  accessToken: string | null;
  setAccessToken: (token: string) => void;

  /** Connected Chia wallet address (if linked) */
  walletAddress: string | null;
  setWalletAddress: (addr: string | null) => void;

  /** Whether the NFT gate check has passed */
  nftGatePassed: boolean;
  setNftGatePassed: (passed: boolean) => void;
}

export const useGuiStore = create<GuiState>((set) => ({
  accessToken: null,
  setAccessToken: (token) => set({ accessToken: token }),

  walletAddress: null,
  setWalletAddress: (addr) => set({ walletAddress: addr }),

  nftGatePassed: false,
  setNftGatePassed: (passed) => set({ nftGatePassed: passed }),
}));
