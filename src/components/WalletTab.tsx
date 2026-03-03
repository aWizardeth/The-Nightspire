import { useState, useEffect } from 'react';
import QRCode from 'react-qr-code';
import { useWalletConnect } from '../providers/WalletConnectProvider';
import useBowActivityStore from '../store/bowActivityStore';
import type { Fighter, NFTData } from '../store/bowActivityStore';
import { parseWalletNfts } from '../lib/nftToFighter';

interface WalletTabProps {
  userId: string;
}

// Collect iframe environment info for on-screen debug
function getDebugInfo() {
  const isIframe = window !== window.parent;
  const urlParams = new URLSearchParams(window.location.search);
  let ancestorOrigin = '(blocked)';
  try { ancestorOrigin = window.location.ancestorOrigins?.[0] || '(none)'; } catch { /* blocked */ }
  return {
    isIframe,
    origin: window.location.origin,
    hostname: window.location.hostname,
    protocol: window.location.protocol,
    referrer: document.referrer || '(empty)',
    frameId: urlParams.get('frame_id') || '(none)',
    instanceId: urlParams.get('instance_id') || '(none)',
    ancestorOrigin,
    wsAvailable: typeof WebSocket !== 'undefined',
    envProjectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID ? 'SET' : 'MISSING',
  };
}

// Toggle to true (or set VITE_DEBUG=true) to show the debug panel
const SHOW_DEBUG_PANEL = import.meta.env.VITE_DEBUG === 'true';

// Element → colour mapping for badges
const ELEMENT_COLOURS: Record<string, string> = {
  Fire:        '#ff6b35',
  Water:       '#00b4d8',
  Nature:      '#4caf50',
  Electric:    '#ffd600',
  Shadow:      '#9c27b0',
  Arcane:      '#00d9ff',
  Corruption:  '#e53935',
  Spirit:      '#f8bbd0',
  Ice:         '#b3e5fc',
};

const RARITY_COLOURS: Record<string, string> = {
  Common:    '#9e9e9e',
  Uncommon:  '#4caf50',
  Rare:      '#2196f3',
  Epic:      '#9c27b0',
  Legendary: '#ff9800',
};

export default function WalletTab({ userId }: WalletTabProps) {
  const store = useBowActivityStore();
  const [showQr, setShowQr] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [isLoadingNfts, setIsLoadingNfts] = useState(false);
  const [nftError, setNftError] = useState<string | null>(null);
  const debugInfo = SHOW_DEBUG_PANEL ? getDebugInfo() : null;
  
  const {
    session,
    pairingUri,
    fingerprint,
    walletAddress,
    connect,
    disconnect,
    cancelConnect,
    getNFTs,
    isConnecting,
    clientReady,
    error,
    relayProbeStatus,
  } = useWalletConnect();

  // Auto-show QR when pairing URI is available
  useEffect(() => {
    console.log('[aWizard Wallet] pairingUri changed:', pairingUri);
    if (pairingUri) setShowQr(true);
    else setShowQr(false);
  }, [pairingUri]);

  useEffect(() => {
    console.log('[aWizard Wallet] State:', { showQr, pairingUri: !!pairingUri, isConnecting, clientReady, session: !!session, error });
  }, [showQr, pairingUri, isConnecting, clientReady, session, error]);

  const handleCopy = () => {
    if (!pairingUri) return;
    // navigator.clipboard is blocked in Discord's iframe — use execCommand fallback
    const tryExecCopy = () => {
      const ta = document.createElement('textarea');
      ta.value = pairingUri;
      ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      try { document.execCommand('copy'); } catch { /* ignore */ }
      document.body.removeChild(ta);
    };
    const finish = () => { setCopied(true); setTimeout(() => setCopied(false), 2000); };
    if (navigator.clipboard) {
      navigator.clipboard.writeText(pairingUri).then(finish).catch(() => { tryExecCopy(); finish(); });
    } else {
      tryExecCopy();
      finish();
    }
  };

  const handleDisconnect = async () => {
    await disconnect();
    store.setSelectedFighter(null);
  };

  const loadNFTs = async () => {
    setIsLoadingNfts(true);
    setNftError(null);
    try {
      const raw = await getNFTs();
      console.log('[aWizard Wallet] Raw NFTs:', raw.length, raw);
      const parsed = parseWalletNfts(raw);
      store.setNfts(parsed);
      console.log('[aWizard Wallet] Parsed fighters:', parsed.length);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[aWizard Wallet] Failed to load NFTs:', err);
      setNftError(msg);
    } finally {
      setIsLoadingNfts(false);
    }
  };

  const handleRefresh = () => {
    window.location.reload();
  };

  const handleConnect = async () => {
    console.log('[aWizard Wallet] 🔵 Connect button clicked!');
    console.log('[aWizard Wallet] Current state:', { isConnecting, pairingUri: !!pairingUri, session: !!session });
    try {
      await connect();
      console.log('[aWizard Wallet] ✅ Connect function completed');
    } catch (err) {
      console.error('[aWizard Wallet] ❌ Connect function error:', err);
    }
  };

  if (!userId) {
    return (
      <div className="p-6 text-center">
        <div className="glow-card" style={{ borderColor: '#ff4444' }}>
          <h3
            className="text-lg font-semibold mb-2"
            style={{ color: '#ff6b6b' }}
          >
            🚫 Discord User Required
          </h3>
          <p style={{ color: '#ff8a8a' }}>
            Discord Activity authentication is required to access wallet features.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">

      {/* Header Banner */}
      <div
        className="rounded-lg p-6"
        style={{
          background: 'linear-gradient(135deg, rgba(0,217,255,0.15), rgba(255,102,0,0.15))',
          border: '1px solid var(--border-color)',
        }}
      >
        <div className="flex justify-between items-start mb-2">
          <h1 className="text-2xl font-bold glow-text">🔐 Privacy-First Wallet</h1>
          <button
            onClick={handleRefresh}
            className="px-3 py-1 rounded text-sm transition-colors"
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              color: 'var(--text-color)',
            }}
            title="Refresh Activity"
          >
            🔄 Refresh
          </button>
        </div>
        <p style={{ color: 'var(--text-muted)' }}>
          Your wallet connection is private and isolated from other Activity users
        </p>
        <div
          className="mt-2 text-sm rounded p-2 font-mono"
          style={{
            background: 'rgba(0,0,0,0.3)',
            color: 'var(--text-color)',
          }}
        >
          <strong>User ID:</strong> {userId}
        </div>
      </div>

      {/* Relay status — always visible, shows errors from relay error hooks */}
      <div className="glow-card" style={{ fontSize: '0.75rem', fontFamily: 'monospace' }}>
        <div style={{ color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600 }}>🔌 Relay Status</div>
        <div style={{ color: relayProbeStatus === true ? '#00ff88' : relayProbeStatus === null ? '#aaa' : '#ff6b6b', wordBreak: 'break-all' }}>
          {relayProbeStatus === null && (clientReady ? '✅ relay connected (no errors)' : '⏳ initializing…')}
          {relayProbeStatus === true && '✅ relay connected'}
          {typeof relayProbeStatus === 'string' && relayProbeStatus}
        </div>
        <div style={{ color: '#888', marginTop: '4px', wordBreak: 'break-all' }}>
          proxy: /walletconnect → relay.walletconnect.org
        </div>
      </div>

      {/* Debug Panel — hidden by default, enable with VITE_DEBUG=true */}
      {SHOW_DEBUG_PANEL && debugInfo && (
      <div className="glow-card">
        <button
          onClick={() => setShowDebug(!showDebug)}
          className="w-full text-left text-sm font-semibold flex justify-between items-center"
          style={{ color: 'var(--text-muted)' }}
        >
          <span>🐛 Debug Info</span>
          <span>{showDebug ? '▼' : '▶'}</span>
        </button>
        {showDebug && (
          <div
            className="mt-3 text-xs font-mono space-y-1 rounded p-3"
            style={{ background: 'rgba(0,0,0,0.4)', color: '#aaa' }}
          >
            <div><span style={{ color: '#00d9ff' }}>isIframe:</span> {String(debugInfo.isIframe)}</div>
            <div><span style={{ color: '#00d9ff' }}>origin:</span> {debugInfo.origin}</div>
            <div><span style={{ color: '#00d9ff' }}>hostname:</span> {debugInfo.hostname}</div>
            <div><span style={{ color: '#00d9ff' }}>protocol:</span> {debugInfo.protocol}</div>
            <div><span style={{ color: '#00d9ff' }}>referrer:</span> {debugInfo.referrer}</div>
            <div><span style={{ color: '#00d9ff' }}>frame_id:</span> {debugInfo.frameId}</div>
            <div><span style={{ color: '#00d9ff' }}>instance_id:</span> {debugInfo.instanceId}</div>
            <div><span style={{ color: '#00d9ff' }}>ancestorOrigin:</span> {debugInfo.ancestorOrigin}</div>
            <div><span style={{ color: '#00d9ff' }}>WebSocket:</span> {String(debugInfo.wsAvailable)}</div>
            <div><span style={{ color: '#00d9ff' }}>ENV Project ID:</span> {debugInfo.envProjectId}</div>
            <div><span style={{ color: '#00d9ff' }}>clientReady:</span> {String(clientReady)}</div>
            <div><span style={{ color: '#00d9ff' }}>isConnecting:</span> {String(isConnecting)}</div>
            <div><span style={{ color: '#00d9ff' }}>session:</span> {session ? 'active' : 'none'}</div>
            <div><span style={{ color: '#00d9ff' }}>error:</span> {error || '(none)'}</div>
          </div>
        )}
      </div>
      )}

      {/* Wallet Connection Status */}
      <div className="glow-card">
        <h2 className="text-lg font-semibold mb-4 glow-text">🔗 Connection Status</h2>

        {error && (
          <div
            className="rounded-lg p-4 mb-4"
            style={{
              background: 'rgba(255,68,68,0.1)',
              border: '1px solid #ff4444',
            }}
          >
            <p style={{ color: '#ff6b6b' }}>⚠️ Error: {error}</p>
          </div>
        )}

        {!session ? (
          <div>
            {!clientReady ? (
              <div className="rounded-lg p-4 mb-4" style={{
                background: 'rgba(0,217,255,0.08)',
                border: '1px solid rgba(0,217,255,0.3)',
              }}>
                <p style={{ color: '#00d9ff' }} className="font-semibold">
                  ⚡ Initializing WalletConnect...
                </p>
                <p className="text-sm mt-1" style={{ color: 'rgba(0,217,255,0.7)' }}>
                  Connecting to relay server
                </p>
              </div>
            ) : isConnecting && !pairingUri ? (
              <div className="space-y-4">
                <div className="rounded-lg p-4" style={{
                  background: 'rgba(0,217,255,0.08)',
                  border: '1px solid rgba(0,217,255,0.3)',
                }}>
                  <p style={{ color: '#00d9ff' }} className="font-semibold">
                    ⚡ Generating pairing code...
                  </p>
                  <p className="text-sm mt-1" style={{ color: 'rgba(0,217,255,0.7)' }}>
                    Preparing QR code for wallet connection
                  </p>
                </div>

                {/* Cancel button */}
                <button
                  onClick={cancelConnect}
                  className="w-full px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                  style={{
                    background: 'transparent',
                    border: '1px solid rgba(255,100,100,0.5)',
                    color: '#ff6666',
                  }}
                >
                  Cancel
                </button>
              </div>
            ) : showQr && pairingUri ? (
              <div className="space-y-4">
                <p className="text-sm text-center" style={{ color: 'var(--text-muted)' }}>
                  Scan with <strong style={{ color: 'var(--accent-primary)' }}>Sage mobile</strong>, or copy the URI into <strong style={{ color: 'var(--accent-primary)' }}>Sage desktop</strong>
                </p>
                
                {/* QR Code */}
                <div className="flex justify-center">
                  <div className="bg-white p-4 rounded-lg">
                    <QRCode value={pairingUri} size={200} />
                  </div>
                </div>

                {/* Copy URI */}
                <div>
                  <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>WalletConnect URI</p>
                  <div className="flex items-center gap-2">
                    <input
                      readOnly
                      value={pairingUri}
                      className="flex-1 rounded-lg px-3 py-2 text-xs font-mono truncate"
                      style={{
                        background: 'rgba(0,0,0,0.3)',
                        border: '1px solid var(--border-color)',
                        color: 'var(--text-color)',
                        outline: 'none'
                      }}
                      onFocus={(e) => e.target.select()}
                    />
                    <button
                      onClick={handleCopy}
                      className="px-4 py-2 rounded-lg text-xs font-bold transition-all flex-shrink-0"
                      style={{
                        background: copied ? '#10b981' : 'linear-gradient(135deg, #00d9ff, #0099cc)',
                        color: '#fff',
                        border: copied ? '1px solid #10b981' : '1px solid rgba(0,217,255,0.6)',
                        boxShadow: copied ? '0 0 12px rgba(16,185,129,0.4)' : '0 0 12px rgba(0,217,255,0.3)',
                        textShadow: '0 1px 2px rgba(0,0,0,0.5)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {copied ? '✓ Copied!' : '📋 Copy URI'}
                    </button>
                  </div>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                    In Sage desktop → WalletConnect → Paste URI
                  </p>
                </div>

                {/* Cancel button */}
                <button
                  onClick={cancelConnect}
                  className="w-full px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                  style={{
                    background: 'transparent',
                    border: '1px solid rgba(255,100,100,0.5)',
                    color: '#ff6666',
                  }}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div>
                <div
                  className="rounded-lg p-4 mb-4"
                  style={{
                    background: 'rgba(255,255,0,0.08)',
                    border: '1px solid rgba(255,255,0,0.3)',
                  }}
                >
                  <p style={{ color: 'var(--text-color)' }}>
                    <strong>🔌 Disconnected</strong>
                  </p>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9em' }}>
                    No active wallet connection found. Connect with Sage to battle!
                  </p>
                </div>

                <button
                  onClick={handleConnect}
                  disabled={isConnecting || !clientReady}
                  className="w-full px-6 py-4 rounded-lg font-bold text-base transition-all"
                  style={{
                    background: (isConnecting || !clientReady)
                      ? 'rgba(60,60,60,0.6)'
                      : 'linear-gradient(135deg, #00d9ff, #ff6600)',
                    color: '#fff',
                    border: (isConnecting || !clientReady) ? '1px solid rgba(255,255,255,0.15)' : '2px solid rgba(255,255,255,0.3)',
                    cursor: (isConnecting || !clientReady) ? 'not-allowed' : 'pointer',
                    opacity: (isConnecting || !clientReady) ? 0.5 : 1,
                    boxShadow: (isConnecting || !clientReady) ? 'none' : '0 0 24px rgba(0,217,255,0.4), 0 0 48px rgba(255,102,0,0.2)',
                    textShadow: '0 1px 3px rgba(0,0,0,0.6)',
                    letterSpacing: '0.03em',
                  }}
                >
                  {!clientReady ? '⏳ Initializing...' : isConnecting ? '⚡ Connecting...' : '🔗 Connect Sage Wallet'}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div>
            <div
              className="rounded-lg p-4 mb-4"
              style={{
                background: 'rgba(0,255,0,0.08)',
                border: '1px solid rgba(0,255,0,0.3)',
              }}
            >
              <p style={{ color: 'var(--text-color)' }}>
                <strong>✅ Connected</strong>
              </p>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.9em' }} className="mt-2">
                {fingerprint && <p><strong>Wallet:</strong> {fingerprint}</p>}
                {walletAddress && (
                  <p><strong>Address:</strong> {walletAddress.slice(0, 16)}...</p>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={loadNFTs}
                className="glow-button flex-1"
                style={{
                  backgroundColor: 'var(--accent-secondary)',
                  color: '#000',
                }}
              >
                🎯 Load Fighters
              </button>
              <button
                onClick={handleDisconnect}
                className="glow-button"
                style={{
                  backgroundColor: 'transparent',
                  border: '1px solid #ff6666',
                  color: '#ff6666',
                }}
              >
                🔌 Disconnect
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Fighter Selection */}
      {session && (
        <FighterSelector
          nfts={store.wallet.nfts}
          selected={store.wallet.selectedFighter}
          onSelect={(f) => store.setSelectedFighter(f)}
          onLoad={loadNFTs}
          isLoading={isLoadingNfts}
          nftError={nftError}
        />
      )}

      {/* Privacy Notice */}
      <div
        className="rounded-lg p-4"
        style={{
          background: 'rgba(150,50,255,0.08)',
          border: '1px solid rgba(150,50,255,0.3)',
        }}
      >
        <h3 className="font-semibold mb-2" style={{ color: '#b388ff' }}>
          🛡️ Privacy Guarantee
        </h3>
        <ul className="text-sm space-y-1" style={{ color: 'rgba(179,136,255,0.8)' }}>
          <li>• Your wallet connection is isolated per Discord Activity session</li>
          <li>• Other users cannot see your wallet address or private keys</li>
          <li>• NFT data is only shared for battle display purposes</li>
          <li>• Wallet sessions are not persisted after Activity closes</li>
          <li>• State channels provide privacy-preserving battle proofs</li>
        </ul>
      </div>
    </div>
  );
}

// ─── Fighter Selector ─────────────────────────────────────────────────────────

interface FighterSelectorProps {
  nfts: NFTData[];
  selected: Fighter | null;
  onSelect: (f: Fighter) => void;
  onLoad: () => void;
  isLoading: boolean;
  nftError: string | null;
}

function StatBar({ label, value, max = 200, colour }: { label: string; value: number; max?: number; colour: string }) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-0.5" style={{ color: 'var(--text-muted)' }}>
        <span>{label}</span><span style={{ color: 'var(--text-color)' }}>{value}</span>
      </div>
      <div className="rounded-full overflow-hidden" style={{ height: 5, background: 'rgba(255,255,255,0.08)' }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${Math.min(100, (value / max) * 100)}%`, background: colour, boxShadow: `0 0 6px ${colour}` }}
        />
      </div>
    </div>
  );
}

function FighterSelector({ nfts, selected, onSelect, onLoad, isLoading, nftError }: FighterSelectorProps) {
  const isEmpty = nfts.length === 0;

  return (
    <div className="glow-card">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold glow-text">⚔️ Select Fighter</h2>
        <button
          onClick={onLoad}
          disabled={isLoading}
          className="px-4 py-2 rounded-lg text-sm font-bold transition-all"
          style={{
            background: isLoading ? 'rgba(60,60,60,0.5)' : 'linear-gradient(135deg, #00d9ff, #0099cc)',
            color: '#fff',
            border: '1px solid rgba(0,217,255,0.4)',
            boxShadow: isLoading ? 'none' : '0 0 10px rgba(0,217,255,0.3)',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            textShadow: '0 1px 2px rgba(0,0,0,0.5)',
          }}
        >
          {isLoading ? '⏳ Loading...' : '🔄 Load Fighters'}
        </button>
      </div>

      {nftError && (
        <div className="rounded-lg p-3 mb-4 text-sm" style={{ background: 'rgba(255,60,60,0.1)', border: '1px solid rgba(255,60,60,0.4)', color: '#ff8080' }}>
          ⚠️ {nftError}
        </div>
      )}

      {isEmpty ? (
        <div className="rounded-lg p-6 text-center" style={{ background: 'rgba(0,0,0,0.2)', border: '1px dashed var(--border-color)' }}>
          <div className="text-3xl mb-2">🧙</div>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>
            {isLoading ? 'Fetching your NFT collection…' : 'No fighters found in this wallet'}
          </p>
          {!isLoading && (
            <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.3)' }}>
              Click "Load Fighters" to fetch your Arcane BOW NFTs
            </p>
          )}
        </div>
      ) : (
        <>
          {selected && (
            <div
              className="rounded-lg p-3 mb-4 text-sm flex items-center gap-2"
              style={{ background: 'rgba(0,217,255,0.08)', border: '1px solid rgba(0,217,255,0.3)', color: '#00d9ff' }}
            >
              <span>✅</span>
              <div>
                <strong style={{ color: 'var(--text-color)' }}>{selected.name}</strong>
                <span className="ml-2" style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>
                  {selected.rarity} · {selected.strength}
                </span>
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {nfts.map((nft) => {
              const f = nft.fighter!;
              const isSelected = selected?.name === f.name && selected?.strength === f.strength;
              const elColour = ELEMENT_COLOURS[f.strength] ?? '#aaa';
              const rarityColour = RARITY_COLOURS[f.rarity] ?? '#aaa';
              return (
                <button
                  key={nft.id}
                  onClick={() => onSelect(f)}
                  className="rounded-xl p-4 text-left transition-all"
                  style={{
                    background: isSelected
                      ? `linear-gradient(135deg, rgba(0,217,255,0.15), rgba(0,217,255,0.05))`
                      : 'rgba(255,255,255,0.03)',
                    border: isSelected
                      ? '2px solid rgba(0,217,255,0.7)'
                      : '1px solid var(--border-color)',
                    boxShadow: isSelected ? '0 0 16px rgba(0,217,255,0.25)' : 'none',
                    cursor: 'pointer',
                  }}
                >
                  <div className="flex items-start gap-3 mb-3">
                    {nft.image ? (
                      <img
                        src={nft.image}
                        alt={nft.name}
                        className="rounded-lg object-cover flex-shrink-0"
                        style={{ width: 52, height: 52, border: `2px solid ${elColour}40` }}
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                      />
                    ) : (
                      <div
                        className="rounded-lg flex items-center justify-center text-2xl flex-shrink-0"
                        style={{ width: 52, height: 52, background: `${elColour}20`, border: `2px solid ${elColour}40` }}
                      >
                        🧙
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-bold truncate" style={{ color: 'var(--text-color)', fontSize: '0.9rem' }}>{f.name}</p>
                      <div className="flex gap-1.5 mt-1 flex-wrap">
                        <span
                          className="px-1.5 py-0.5 rounded text-xs font-bold"
                          style={{ background: `${rarityColour}25`, color: rarityColour, border: `1px solid ${rarityColour}50` }}
                        >
                          {f.rarity}
                        </span>
                        <span
                          className="px-1.5 py-0.5 rounded text-xs font-bold"
                          style={{ background: `${elColour}20`, color: elColour, border: `1px solid ${elColour}40` }}
                        >
                          {f.strength}
                        </span>
                      </div>
                    </div>
                    {isSelected && (
                      <span className="text-lg flex-shrink-0">✅</span>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <StatBar label="HP"  value={f.stats.hp}  max={250} colour="#4caf50" />
                    <StatBar label="ATK" value={f.stats.atk} max={60}  colour="#ff6b35" />
                    <StatBar label="DEF" value={f.stats.def} max={50}  colour="#2196f3" />
                    <StatBar label="SPD" value={f.stats.spd} max={40}  colour="#ffd600" />
                  </div>

                  {f.effect && (
                    <p className="mt-2 text-xs rounded px-2 py-1" style={{ background: 'rgba(240,178,50,0.1)', color: '#f0b232', border: '1px solid rgba(240,178,50,0.25)' }}>
                      ✨ {f.effect}
                    </p>
                  )}

                  <p className="mt-2 text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>
                    weak: {f.weakness}
                  </p>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}