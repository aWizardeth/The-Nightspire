import { useState, useEffect } from 'react';
import QRCode from 'react-qr-code';
import { useWalletConnect } from '../providers/WalletConnectProvider';
import useBowActivityStore from '../store/bowActivityStore';

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

export default function WalletTab({ userId }: WalletTabProps) {
  const store = useBowActivityStore();
  const [showQr, setShowQr] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
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
    navigator.clipboard.writeText(pairingUri).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleDisconnect = async () => {
    await disconnect();
    store.setSelectedFighter(null);
  };

  const loadNFTs = async () => {
    try {
      const nfts = await getNFTs();
      console.log('[aWizard Wallet] Loaded NFTs:', nfts.length);
      // TODO: Process NFTs and extract fighters
    } catch (err) {
      console.error('[aWizard Wallet] Failed to load NFTs:', err);
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

      {/* Relay probe status — always visible so we can diagnose relay issues without DevTools */}
      <div className="glow-card" style={{ fontSize: '0.75rem', fontFamily: 'monospace' }}>
        <div style={{ color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600 }}>🔌 Relay Probe</div>
        <div style={{ color: relayProbeStatus === true ? '#00ff88' : relayProbeStatus === null ? '#aaa' : '#ff6b6b', wordBreak: 'break-all' }}>
          {relayProbeStatus === null && '⏳ pending…'}
          {relayProbeStatus === true && '✅ WebSocket OPEN — proxy routing works'}
          {typeof relayProbeStatus === 'string' && relayProbeStatus}
        </div>
        <div style={{ color: '#888', marginTop: '4px', wordBreak: 'break-all' }}>
          relayUrl: wss://{typeof window !== 'undefined' ? window.location.hostname : '?'}/walletconnect
        </div>
        {typeof relayProbeStatus === 'string' && relayProbeStatus.includes('code=1006') && (
          <div style={{ color: '#ffaa00', marginTop: '6px', lineHeight: '1.5' }}>
            <strong>1006 on bare probe = normal.</strong> If publish still fails:<br/>
            Add <strong>{typeof window !== 'undefined' ? window.location.hostname : '?'}</strong> to WalletConnect Cloud → Allowed Domains
          </div>
        )}
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
                      className="px-4 py-2 rounded-lg text-xs font-semibold transition-colors"
                      style={{
                        backgroundColor: copied ? '#10b981' : 'var(--accent-secondary)',
                        color: copied ? '#fff' : '#000',
                      }}
                    >
                      {copied ? '✓ Copied' : 'Copy'}
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
                  className="w-full px-6 py-3 rounded-lg font-semibold transition-all"
                  style={{
                    background: (isConnecting || !clientReady)
                      ? 'rgba(100,100,100,0.5)' 
                      : 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
                    color: (isConnecting || !clientReady) ? 'var(--text-muted)' : '#000',
                    border: 'none',
                    cursor: (isConnecting || !clientReady) ? 'not-allowed' : 'pointer',
                    opacity: (isConnecting || !clientReady) ? 0.6 : 1,
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

      {/* Fighter Selection (placeholder for now) */}
      <div className="glow-card">
        <h2 className="text-lg font-semibold mb-4 glow-text">⚔️ Select Fighter</h2>
        <div
          className="rounded-lg p-4 text-center"
          style={{
            background: 'rgba(100,100,100,0.1)',
            border: '1px solid var(--border-color)',
          }}
        >
          <p style={{ color: 'var(--text-muted)' }}>
            📋 Connect wallet and load fighters to see your NFT collection
          </p>
        </div>
      </div>

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