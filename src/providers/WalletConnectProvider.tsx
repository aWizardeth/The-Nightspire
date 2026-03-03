import { createContext, useContext, useEffect, useRef, useState, useCallback, ReactNode } from 'react';
import SignClient from '@walletconnect/sign-client';
import type { SessionTypes } from '@walletconnect/types';
import { patchUrlMappings } from '@discord/embedded-app-sdk';

// Project ID from Vercel env — dedicated to The Nightspire
const WC_PROJECT_ID = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID;
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
  /** true once SignClient has finished initializing */
  clientReady: boolean;
  error: string | null;
  /** Result of the relay WebSocket probe: null=pending, true=open, string=error/close reason */
  relayProbeStatus: null | true | string;
}

const WalletConnectContext = createContext<WalletConnectContextValue | null>(null);

export function WalletConnectProvider({ children }: { children: ReactNode }) {
  const clientRef = useRef<InstanceType<typeof SignClient> | null>(null);
  const [session, setSession]           = useState<SessionTypes.Struct | null>(null);
  const [pairingUri, setPairingUri]     = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [clientReady, setClientReady]   = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [relayProbeStatus, setRelayProbeStatus] = useState<null | true | string>(null);

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

    // ── Debug: Discord iframe environment ──
    const isIframe = window !== window.parent;
    const urlParams = new URLSearchParams(window.location.search);
    console.log('[aWizard] ═══ Environment Debug ═══');
    console.log('[aWizard] Platform: Discord Activity (iframe)');
    console.log('[aWizard] isIframe:', isIframe);
    console.log('[aWizard] location.origin:', window.location.origin);
    console.log('[aWizard] location.hostname:', window.location.hostname);
    console.log('[aWizard] location.protocol:', window.location.protocol);
    console.log('[aWizard] location.href:', window.location.href);
    console.log('[aWizard] referrer:', document.referrer || '(empty)');
    console.log('[aWizard] frame_id:', urlParams.get('frame_id') || '(none)');
    console.log('[aWizard] instance_id:', urlParams.get('instance_id') || '(none)');
    try {
      console.log('[aWizard] ancestorOrigins:', window.location.ancestorOrigins?.[0] || '(none/blocked)');
    } catch { console.log('[aWizard] ancestorOrigins: (access denied)'); }
    console.log('[aWizard] userAgent:', navigator.userAgent);
    console.log('[aWizard] WebSocket available:', typeof WebSocket !== 'undefined');
    console.log('[aWizard] ═══════════════════════');

    console.log('[aWizard] Initializing WalletConnect SignClient...');
    console.log('[aWizard] Env var VITE_WALLETCONNECT_PROJECT_ID:', import.meta.env.VITE_WALLETCONNECT_PROJECT_ID ? 'SET' : 'MISSING');
    console.log('[aWizard] Using Project ID:', WC_PROJECT_ID ? `${WC_PROJECT_ID.slice(0, 8)}... (${import.meta.env.VITE_WALLETCONNECT_PROJECT_ID ? 'from env' : 'fallback'})` : 'MISSING');

    if (!WC_PROJECT_ID) {
      const msg = 'WalletConnect Project ID is missing (both env var and fallback)';
      console.error('[aWizard]', msg);
      setError(msg);
      return;
    }

    // ── Discord Activity proxy: route WalletConnect relay through Discord's sandbox ──
    // Discord's CSP blocks all direct external WebSocket/fetch connections.
    // The Discord Developer Portal must have the URL Mapping:
    //   PREFIX: /walletconnect   TARGET: relay.walletconnect.com
    //
    // Additionally, WalletConnect Cloud project must allow origin: *.discordsays.com
    // (cloud.walletconnect.com → project → Explorer → Allowed Domains)
    let relayUrl: string | undefined;
    if (isIframe) {
      // patchUrlMappings rewrites the global WebSocket/fetch so any internal
      // call to relay.walletconnect.com is transparently proxied.
      patchUrlMappings([{ prefix: '/walletconnect', target: 'relay.walletconnect.com' }]);
      // Explicit relayUrl ensures SignClient never tries the direct host.
      relayUrl = `wss://${window.location.hostname}/walletconnect`;
      console.log('[aWizard] Discord iframe — relayUrl:', relayUrl);

      // ── Connectivity probe: raw WebSocket test before SignClient ──
      // Result is surfaced in relayProbeStatus for on-screen display.
      const probeWs = new WebSocket(relayUrl);
      const probeTimer = setTimeout(() => {
        probeWs.close();
        const msg = 'TIMEOUT — relay not responding after 5s';
        console.warn('[aWizard] ⚠️ Relay probe:', msg);
        setRelayProbeStatus(msg);
      }, 5000);
      probeWs.addEventListener('open', () => {
        clearTimeout(probeTimer);
        console.log('[aWizard] ✅ Relay probe: OPEN');
        setRelayProbeStatus(true);
        probeWs.close();
      });
      probeWs.addEventListener('error', () => {
        clearTimeout(probeTimer);
        const msg = 'WebSocket ERROR — proxy path unreachable (check URL Mapping in Discord Dev Portal)';
        console.error('[aWizard] ❌ Relay probe:', msg);
        setRelayProbeStatus(msg);
      });
      probeWs.addEventListener('close', (e) => {
        clearTimeout(probeTimer);
        if (e.code !== 1000 && relayProbeStatus === null) {
          const msg = `Closed code=${e.code} reason="${e.reason || 'none'}" — relay may be rejecting origin. Add *.discordsays.com to WalletConnect Cloud allowed domains.`;
          console.error('[aWizard] ❌ Relay probe:', msg);
          setRelayProbeStatus(msg);
        }
      });
    } else {
      console.log('[aWizard] Not in iframe — using default relay.walletconnect.com');
    }

    SignClient.init({
      projectId: WC_PROJECT_ID,
      relayUrl,   // proxied in Discord Activity, default (undefined) outside
      metadata:  {
        name:        'The Nightspire',
        description: 'Arcane BOW Discord Activity — PvE/PvP Chia battles',
        url:         'https://the-nightspire.vercel.app',
        icons:       ['https://the-nightspire.vercel.app/wizard-icon.png'],
      },
    }).then((c) => {
      if (!mounted) return;
      clientRef.current = c;
      setClientReady(true);
      console.log('[aWizard] ✅ SignClient initialized successfully');

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
      console.error('[aWizard] ❌ Failed to initialize SignClient:', err);
      setError(`Failed to initialize WalletConnect: ${err.message || 'Unknown error'}`);
    });

    return () => { mounted = false; };
  }, [fetchWalletAddress]);

  // Extract fingerprint from session
  const fingerprint = session?.namespaces?.chia?.accounts?.[0]?.split(':')?.[2] || null;

  const connect = useCallback(async () => {
    const client = clientRef.current;
    if (!client) { 
      console.error('[aWizard] WalletConnect client not ready - check VITE_WALLETCONNECT_PROJECT_ID env var');
      setError('WalletConnect client not ready. Check that VITE_WALLETCONNECT_PROJECT_ID is set in Vercel environment variables.'); 
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
              'chip0002_getPublicKeys',
              'chip0002_getAssetBalance',
              'chip0002_getAssetCoins',
              'chip0002_getNFTs',
            ],
            chains: CHIA_CHAINS,
            events: []
          }
        },
        optionalNamespaces: {
          chia: {
            methods: ['chip0002_signCoinSpends', 'chip0002_sendTransaction'],
            chains: CHIA_CHAINS,
            events: [],
          },
        },
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
      console.error('[aWizard] Error details:', JSON.stringify(err, Object.getOwnPropertyNames(err)));
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
      clientReady,
      error,
      relayProbeStatus,
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