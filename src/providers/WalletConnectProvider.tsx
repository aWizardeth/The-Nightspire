import { createContext, useContext, useEffect, useRef, useState, useCallback, ReactNode } from 'react';
import SignClient from '@walletconnect/sign-client';
import type { SessionTypes } from '@walletconnect/types';

// Use the same WalletConnect Project ID as bow-app (verified working)
const WC_PROJECT_ID = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID ?? '219bfb172d753461929d17dacb9bec7e';
const WC_RELAY_URL = 'wss://relay.walletconnect.org';
const CHIA_CHAIN = 'chia:mainnet';
const CHIA_CHAINS = [CHIA_CHAIN, 'chia:mainnet', 'chia:testnet11'].filter(
  (v, i, a) => a.indexOf(v) === i,
);

// ------------------------------------------------------------------
//  Types matching Sage / chip0002 spec
// ------------------------------------------------------------------
export interface SpendableCoin {
  coin: { parent_coin_info: string; puzzle_hash: string; amount: number };
  /** coin ID (sha256 of parent+ph+amount), hex without 0x */
  coinName: string;
  /** puzzle reveal hex */
  puzzle: string;
  confirmedBlockIndex: number;
  locked: boolean;
}

export interface CoinSpend {
  coin: { parent_coin_info: string; puzzle_hash: string; amount: number };
  puzzle_reveal: string;
  solution: string;
}

export interface SpendBundle {
  coin_spends: CoinSpend[];
  aggregated_signature: string;
}

/** Shape of an NFT record returned by chip0002_getNFTs / chip0002_getAssetCoins(type:'nft') */
export interface WalletNft {
  /** NFT coin ID / launcher ID (hex) */
  nftId?:       string;
  launcherId?:  string;
  encodedId?:   string;
  /** bech32m NFT address (nft1…) */
  address?:     string;
  /** On-chain collection ID (col1…) */
  collectionId?: string;
  /** Display name */
  name?:        string;
  /** Metadata attributes / traits */
  attributes?:  { trait_type: string; value: string | number }[];
  /** Image / preview URI */
  imageUri?:    string;
  thumbnailUri?: string;
  dataUris?:    string[];
  /** Raw metadata JSON (some wallets nest it here) */
  metadata?:    Record<string, unknown>;
  /** Catch-all for extra fields */
  [key: string]: unknown;
}

export interface WalletConnectContextValue {
  /** The active WalletConnect session (null = disconnected) */
  session: SessionTypes.Struct | null;
  /** QR-code URI to display while pairing */
  pairingUri: string | null;
  /** Numeric wallet fingerprint from active session (session-level ID) */
  fingerprint: string | null;
  /** First BLS public key hex from chip0002_getPublicKeys — stable on-chain wallet identity */
  walletAddress: string | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  cancelConnect: () => void;
  /** chip0002_signCoinSpends — returns the aggregated BLS signature hex */
  signCoinSpends: (coinSpends: CoinSpend[], partial?: boolean) => Promise<string>;
  /** chip0002_sendTransaction — broadcasts a fully-signed SpendBundle */
  sendTransaction: (spendBundle: SpendBundle) => Promise<{ status: string; error?: string }>;
  /** chip0002_getAssetCoins — returns unlocked XCH UTXOs from the wallet */
  getAssetCoins: () => Promise<SpendableCoin[]>;
  /** chip0002_getNFTs — returns NFTs held by the wallet (with metadata) */
  getNFTs: () => Promise<WalletNft[]>;
  isConnecting: boolean;
  error: string | null;
}

const WalletConnectContext = createContext<WalletConnectContextValue | null>(null);

export function WalletConnectProvider({ children }: { children: ReactNode }) {
  const clientRef = useRef<InstanceType<typeof SignClient> | null>(null);
  const [session, setSession]           = useState<SessionTypes.Struct | null>(null);
  const [pairingUri, setPairingUri]     = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);

  // Fetch the first BLS public key from the wallet — stable on-chain identity.
  const fetchWalletAddress = useCallback(async (sess: SessionTypes.Struct) => {
    const client = clientRef.current;
    if (!client) return;
    const approvedMethods = sess.namespaces?.chia?.methods ?? [];
    if (!approvedMethods.includes('chip0002_getPublicKeys')) {
      console.info('[aWizard] chip0002_getPublicKeys not in session methods — skipping walletAddress fetch');
      return;
    }
    try {
      const chain = sess.namespaces?.chia?.chains?.[0] ?? CHIA_CHAIN;
      const keys = await client.request<string[]>({
        topic:   sess.topic,
        chainId: chain,
        request: { method: 'chip0002_getPublicKeys', params: { limit: 1, offset: 0 } },
      });
      if (Array.isArray(keys) && keys.length > 0) setWalletAddress(keys[0]);
    } catch (e) {
      console.info('[aWizard] getPublicKeys failed (non-fatal):', e);
    }
  }, []);

  // Initialise SignClient once on mount
  useEffect(() => {
    let mounted = true;
    SignClient.init({
      projectId: WC_PROJECT_ID,
      relayUrl:  WC_RELAY_URL,
      metadata:  {
        name:        'Battle of Wizards - Discord Activity',
        description: 'aWizard Discord Activity — PvE/PvP battles with soulbound NFTs',
        url:         typeof window !== 'undefined' ? window.location.origin : 'https://the-nightspire.vercel.app',
        icons:       [typeof window !== 'undefined' ? `${window.location.origin}/wizard-icon.png` : 'https://the-nightspire.vercel.app/wizard-icon.png'],
      },
    }).then((c) => {
      if (!mounted) return;
      clientRef.current = c;

      // Purge expired sessions
      const now = Math.floor(Date.now() / 1000);
      const allSessions = c.session.getAll();
      const activeSessions = allSessions.filter((s) => s.expiry > now);
      const staleSessions  = allSessions.filter((s) => s.expiry <= now);
      for (const s of staleSessions) {
        c.session.delete(s.topic, { code: 6000, message: 'Session expired' }).catch(() => null);
      }

      // Restore active session if exists
      if (activeSessions.length > 0) {
        const sess = activeSessions[0];
        setSession(sess);
        fetchWalletAddress(sess);
        console.log('[aWizard] Restored WalletConnect session:', sess.topic);
      }

      // Session event handlers
      c.on('session_event', ({ params }) => {
        console.log('[aWizard] Session event:', params);
      });

      c.on('session_update', ({ topic, params }) => {
        console.log('[aWizard] Session updated:', topic, params);
        const sess = c.session.get(topic);
        setSession(sess);
        fetchWalletAddress(sess);
      });

      c.on('session_delete', () => {
        console.log('[aWizard] Session deleted');
        setSession(null);
        setWalletAddress(null);
      });

    }).catch((err) => {
      console.error('[aWizard] Failed to initialize SignClient:', err);
      setError(`Failed to initialize WalletConnect: ${err.message}`);
    });

    return () => { mounted = false; };
  }, [fetchWalletAddress]);

  // Extract fingerprint from session
  const fingerprint = session?.namespaces?.chia?.accounts?.[0]?.split(':')?.[2] || null;

  const connect = useCallback(async () => {
    const client = clientRef.current;
    if (!client) { 
      console.error('[aWizard] WalletConnect client not ready');
      setError('WalletConnect client not ready'); 
      return; 
    }
    if (isConnecting) {
      console.log('[aWizard] Already connecting, ignoring');
      return;
    }
    
    console.log('[aWizard] Starting WalletConnect pairing...');
    setIsConnecting(true);
    setError(null);
    
    try {
      const { uri, approval } = await client.connect({
        requiredNamespaces: {
          chia: {
            methods: [
              'chip0002_signCoinSpends',
              'chip0002_sendTransaction', 
              'chip0002_getAssetCoins',
              'chip0002_getNFTs',
              'chip0002_getPublicKeys'
            ],
            chains: CHIA_CHAINS,
            events: []
          }
        }
      });

      if (uri) {
        console.log('[aWizard] WalletConnect pairing URI generated:', uri.substring(0, 50) + '...');
        setPairingUri(uri);
      } else {
        console.error('[aWizard] No pairing URI received');
        setError('Failed to generate pairing URI');
        setIsConnecting(false);
        return;
      }

      console.log('[aWizard] Waiting for wallet approval...');
      const sess = await approval();
      console.log('[aWizard] Wallet approved! Session topic:', sess.topic);
      
      setSession(sess);
      setPairingUri(null);
      await fetchWalletAddress(sess);
      console.log('[aWizard] WalletConnect session established');

    } catch (err: any) {
      console.error('[aWizard] WalletConnect connection failed:', err);
      setError(`Connection failed: ${err.message || String(err)}`);
      setPairingUri(null);
    } finally {
      setIsConnecting(false);
    }
  }, [isConnecting, fetchWalletAddress]);

  const disconnect = useCallback(async () => {
    const client = clientRef.current;
    if (!client || !session) return;

    try {
      await client.disconnect({
        topic: session.topic,
        reason: { code: 6000, message: 'User disconnected' }
      });
      setSession(null);
      setWalletAddress(null);
      console.log('[aWizard] WalletConnect disconnected');
    } catch (err: any) {
      console.error('[aWizard] Disconnect failed:', err);
    }
  }, [session]);

  const cancelConnect = useCallback(() => {
    setPairingUri(null);
    setIsConnecting(false);
    setError(null);
    console.log('[aWizard] WalletConnect pairing cancelled');
  }, []);

  const signCoinSpends = useCallback(async (coinSpends: CoinSpend[], partial = false): Promise<string> => {
    const client = clientRef.current;
    if (!client || !session) throw new Error('No active WalletConnect session');
    
    const chain = session.namespaces?.chia?.chains?.[0] ?? CHIA_CHAIN;
    return await client.request<string>({
      topic: session.topic,
      chainId: chain,
      request: {
        method: 'chip0002_signCoinSpends',
        params: { coinSpends, partial }
      }
    });
  }, [session]);

  const sendTransaction = useCallback(async (spendBundle: SpendBundle) => {
    const client = clientRef.current;
    if (!client || !session) throw new Error('No active WalletConnect session');
    
    const chain = session.namespaces?.chia?.chains?.[0] ?? CHIA_CHAIN;
    return await client.request<{ status: string; error?: string }>({
      topic: session.topic,
      chainId: chain,
      request: {
        method: 'chip0002_sendTransaction',
        params: { spendBundle }
      }
    });
  }, [session]);

  const getAssetCoins = useCallback(async (): Promise<SpendableCoin[]> => {
    const client = clientRef.current;
    if (!client || !session) throw new Error('No active WalletConnect session');
    
    const chain = session.namespaces?.chia?.chains?.[0] ?? CHIA_CHAIN;
    return await client.request<SpendableCoin[]>({
      topic: session.topic,
      chainId: chain,
      request: {
        method: 'chip0002_getAssetCoins',
        params: { type: 'xch', includeSpent: false }
      }
    });
  }, [session]);

  const getNFTs = useCallback(async (): Promise<WalletNft[]> => {
    const client = clientRef.current;
    if (!client || !session) throw new Error('No active WalletConnect session');
    
    const chain = session.namespaces?.chia?.chains?.[0] ?? CHIA_CHAIN;
    return await client.request<WalletNft[]>({
      topic: session.topic,
      chainId: chain,
      request: {
        method: 'chip0002_getNFTs',
        params: {}
      }
    });
  }, [session]);

  return (
    <WalletConnectContext.Provider value={{
      session,
      pairingUri,
      fingerprint,
      walletAddress,
      connect,
      disconnect,
      cancelConnect,
      signCoinSpends,
      sendTransaction,
      getAssetCoins,
      getNFTs,
      isConnecting,
      error
    }}>
      {children}
    </WalletConnectContext.Provider>
  );
}

export function useWalletConnect() {
  const context = useContext(WalletConnectContext);
  if (!context) {
    throw new Error('useWalletConnect must be used within WalletConnectProvider');
  }
  return context;
}