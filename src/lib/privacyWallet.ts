import { useState, useEffect, useCallback } from "react";
import WalletConnect from "@walletconnect/client";
import QRCodeModal from "@walletconnect/qrcode-modal";
import useBowActivityStore from "../store/bowActivityStore";
import type { NFTData, Fighter } from "../store/bowActivityStore";

export interface WalletConnectConfig {
  projectId?: string;
  metadata: {
    name: string;
    description: string;
    url: string;
    icons: string[];
  };
}

const DEFAULT_CONFIG: WalletConnectConfig = {
  projectId:
    import.meta.env.VITE_WALLETCONNECT_PROJECT_ID ||
    "a7ee08ccf8d8de0c2b1b784a67c4e14f",
  metadata: {
    name: "Battle of Wizards",
    description: "Discord Activity for PvE/PvP battles with soulbound NFTs",
    url: "https://the-nightspire.vercel.app",
    icons: ["https://the-nightspire.vercel.app/wizard-icon.png"],
  },
};

// ─────────────────────────────────────────────────────────────────
//  Privacy-First Wallet  –  WalletConnect v1 API
// ─────────────────────────────────────────────────────────────────
export class PrivacyFirstWallet {
  private client: WalletConnect | null = null;
  private config: WalletConnectConfig;
  private userId: string;

  constructor(userId: string, config: Partial<WalletConnectConfig> = {}) {
    this.userId = userId;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async initialize(): Promise<void> {
    try {
      console.log(`[aWizard] Initializing wallet for user ${this.userId}`);

      this.client = new WalletConnect({
        bridge: "https://bridge.walletconnect.org",
        qrcodeModal: QRCodeModal,
        clientMeta: this.config.metadata,
      });

      this.client.on("connect", (_error: any, payload: any) => {
        console.log(
          `[aWizard] Wallet connected for user ${this.userId}:`,
          payload
        );
      });

      this.client.on("disconnect", (_error: any) => {
        console.log(`[aWizard] Wallet disconnected for user ${this.userId}`);
      });

      this.client.on("session_request", (_error: any, payload: any) => {
        console.log(
          `[aWizard] Session request for user ${this.userId}:`,
          payload
        );
      });

      console.log(
        `[aWizard] Wallet client initialized for user ${this.userId}`
      );
    } catch (error) {
      console.error(
        `[aWizard] Failed to initialize wallet for user ${this.userId}:`,
        error
      );
      throw error;
    }
  }

  async connect(): Promise<string> {
    if (!this.client) {
      await this.initialize();
    }

    try {
      console.log(
        `[aWizard] Starting wallet connection for user ${this.userId}`
      );

      // WalletConnect v1 — createSession triggers QR modal automatically
      if (!this.client!.connected) {
        await this.client!.createSession();
      }

      // Return a promise that resolves when the wallet connects
      return new Promise<string>((resolve, reject) => {
        this.client!.on("connect", (error: any, payload: any) => {
          if (error) {
            reject(error);
            return;
          }
          const chainId = String(payload?.params?.[0]?.chainId ?? "chia:mainnet");
          console.log(
            `[aWizard] Session established for user ${this.userId}, chain: ${chainId}`
          );
          resolve(chainId);
        });
      });
    } catch (error: any) {
      console.error(
        `[aWizard] Failed to connect wallet for user ${this.userId}:`,
        error
      );
      throw error;
    }
  }

  async disconnect(_topic?: string): Promise<void> {
    if (!this.client) return;

    try {
      await this.client.killSession();
      console.log(`[aWizard] Wallet disconnected for user ${this.userId}`);
    } catch (error: any) {
      console.error(
        `[aWizard] Failed to disconnect wallet for user ${this.userId}:`,
        error
      );
    }
  }

  async getUserNFTs(_session?: any): Promise<NFTData[]> {
    if (!this.client) {
      throw new Error("Wallet not connected");
    }

    try {
      const result = await this.client.sendCustomRequest({
        method: "chia_getNFTs",
        params: [
          {
            wallet_id: 1,
            start_index: 0,
            num_results: 100,
          },
        ],
      });

      const nfts: NFTData[] = (result?.nft_list ?? []).map((nft: any) => {
        const metadata = nft.off_chain_metadata || {};
        const attributes: any[] = metadata.attributes || [];
        const fighter = this.parseFighterFromAttributes(attributes);

        return {
          id: nft.nft_coin_id,
          tokenId: nft.launcher_id,
          name: metadata.name || "Unknown Fighter",
          image: metadata.image,
          attributes,
          fighter,
        } as NFTData;
      });

      console.log(
        `[aWizard] Loaded ${nfts.length} NFTs for user ${this.userId}`
      );
      return nfts;
    } catch (error) {
      console.error(
        `[aWizard] Failed to fetch NFTs for user ${this.userId}:`,
        error
      );
      return [];
    }
  }

  private parseFighterFromAttributes(attributes: any[]): Fighter | undefined {
    const getAttr = (trait: string) =>
      attributes.find((attr: any) => attr.trait_type === trait)?.value;

    const name = getAttr("Name");
    if (!name) return undefined;

    return {
      source: "user" as const,
      name: String(name),
      stats: {
        hp: Number(getAttr("HP")) || 100,
        atk: Number(getAttr("Attack")) || 15,
        def: Number(getAttr("Defense")) || 10,
        spd: Number(getAttr("Speed")) || 12,
      },
      strength: getAttr("Strength") || "Arcane",
      weakness: getAttr("Weakness") || "Shadow",
      rarity: getAttr("Rarity") || "Common",
      effect: getAttr("Special Effect"),
    };
  }
}

// ─────────────────────────────────────────────────────────────────
//  React Hook  –  usePrivacyFirstWallet
// ─────────────────────────────────────────────────────────────────
export function usePrivacyFirstWallet(userId: string) {
  const [wallet, setWallet] = useState<PrivacyFirstWallet | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);

  const store = useBowActivityStore();

  useEffect(() => {
    if (!userId || wallet) return;
    const walletInstance = new PrivacyFirstWallet(userId);
    setWallet(walletInstance);
  }, [userId, wallet]);

  const initializeWallet = useCallback(async () => {
    if (!wallet || isInitializing) return;

    setIsInitializing(true);
    try {
      await wallet.initialize();
      console.log(`[aWizard] Wallet initialized for user ${userId}`);
    } catch (error) {
      console.error(
        `[aWizard] Failed to initialize wallet for user ${userId}:`,
        error
      );
    } finally {
      setIsInitializing(false);
    }
  }, [wallet, userId, isInitializing]);

  const connectWallet = useCallback(async () => {
    if (!wallet) return;

    store.setWalletConnecting(true);
    try {
      const sessionTopic = await wallet.connect();
      store.setWalletSession({ topic: sessionTopic });

      // Load user's NFTs after connection
      const session = store.wallet.session;
      if (session) {
        const nfts = await wallet.getUserNFTs(session);
        store.setNfts(nfts);

        // Auto-select first NFT fighter if available
        const fighterNft = nfts.find((nft) => nft.fighter);
        if (fighterNft?.fighter) {
          store.setSelectedFighter(fighterNft.fighter);
        }
      }
    } catch (error) {
      console.error(
        `[aWizard] Wallet connection failed for user ${userId}:`,
        error
      );
    } finally {
      store.setWalletConnecting(false);
    }
  }, [wallet, store, userId]);

  const disconnectWallet = useCallback(async () => {
    if (!wallet || !store.wallet.session) return;

    try {
      await wallet.disconnect(store.wallet.session.topic);
      store.disconnectWallet();
    } catch (error) {
      console.error(
        `[aWizard] Wallet disconnect failed for user ${userId}:`,
        error
      );
    }
  }, [wallet, store, userId]);

  return {
    wallet,
    isInitializing,
    initializeWallet,
    connectWallet,
    disconnectWallet,
    isConnecting: store.wallet.isConnecting,
    isConnected: !!store.wallet.session,
    nfts: store.wallet.nfts,
    selectedFighter: store.wallet.selectedFighter,
  };
}
