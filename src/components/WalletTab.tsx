import { useState } from 'react';
import { useWalletConnect } from '../providers/WalletConnectProvider';
import QRCodeModal from './QRCodeModal';
import useBowActivityStore from '../store/bowActivityStore';

interface WalletTabProps {
  userId: string;
}

export default function WalletTab({ userId }: WalletTabProps) {
  const store = useBowActivityStore();
  const [showQRModal, setShowQRModal] = useState(false);
  
  const {
    session,
    pairingUri,
    fingerprint,
    walletAddress,
    connect,
    disconnect,
    getNFTs,
    isConnecting,
    error
  } = useWalletConnect();

  const handleConnect = async () => {
    await connect();
    if (pairingUri) {
      setShowQRModal(true);
    }
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
      {/* Show QR Code Modal */}
      {showQRModal && pairingUri && (
        <QRCodeModal 
          uri={pairingUri} 
          onClose={() => setShowQRModal(false)} 
        />
      )}

      {/* Header Banner */}
      <div
        className="rounded-lg p-6"
        style={{
          background: 'linear-gradient(135deg, rgba(0,217,255,0.15), rgba(255,102,0,0.15))',
          border: '1px solid var(--border-color)',
        }}
      >
        <h1 className="text-2xl font-bold mb-2 glow-text">🔐 Privacy-First Wallet</h1>
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
              disabled={isConnecting}
              className="glow-button w-full"
              style={{
                backgroundColor: isConnecting ? '#666' : 'var(--accent-primary)',
                color: '#000',
                opacity: isConnecting ? 0.7 : 1,
              }}
            >
              {isConnecting ? '⚡ Connecting...' : '🔗 Connect Sage Wallet'}
            </button>
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