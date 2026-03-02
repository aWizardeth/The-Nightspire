import { useEffect } from 'react';
import { usePrivacyFirstWallet } from '../lib/privacyWallet';
import useBowActivityStore from '../store/bowActivityStore';

interface WalletTabProps {
  userId: string;
}

export default function WalletTab({ userId }: WalletTabProps) {
  const store = useBowActivityStore();
  const {
    wallet,
    isInitializing,
    initializeWallet,
    connectWallet,
    disconnectWallet,
    isConnecting,
    isConnected,
    nfts,
    selectedFighter,
  } = usePrivacyFirstWallet(userId);

  // Initialize wallet on mount
  useEffect(() => {
    if (userId && !wallet) {
      console.log(`[aWizard Wallet] Preparing wallet for user ${userId}`);
    }
  }, [userId, wallet]);

  // Auto-initialize wallet when available
  useEffect(() => {
    if (wallet && !isInitializing && !isConnected && store.gui.accessToken) {
      initializeWallet();
    }
  }, [wallet, isInitializing, isConnected, store.gui.accessToken, initializeWallet]);

  const handleFighterSelect = (nftFighter: any) => {
    if (nftFighter.fighter) {
      store.setSelectedFighter(nftFighter.fighter);
      console.log(`[aWizard Wallet] Selected fighter: ${nftFighter.fighter.name}`);
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

        {isInitializing && (
          <div
            className="rounded-lg p-4"
            style={{
              background: 'rgba(0,217,255,0.08)',
              border: '1px solid rgba(0,217,255,0.3)',
            }}
          >
            <p style={{ color: '#00d9ff' }} className="font-semibold">
              🔄 Initializing wallet...
            </p>
            <p className="text-sm mt-1" style={{ color: 'rgba(0,217,255,0.7)' }}>
              Setting up WalletConnect for your private session
            </p>
          </div>
        )}

        {!isConnected && !isInitializing && !isConnecting && (
          <div className="space-y-4">
            <div
              className="rounded-lg p-4"
              style={{
                background: 'rgba(255,170,0,0.08)',
                border: '1px solid rgba(255,170,0,0.3)',
              }}
            >
              <p style={{ color: '#ffaa00' }} className="font-semibold">
                ⚠️ Wallet not connected
              </p>
              <p className="text-sm mt-1" style={{ color: 'rgba(255,170,0,0.7)' }}>
                Connect your Sage wallet to view NFTs and participate in battles
              </p>
            </div>
            <button onClick={connectWallet} className="w-full glow-btn">
              🔗 Connect Chia Wallet
            </button>
          </div>
        )}

        {isConnecting && (
          <div
            className="rounded-lg p-4"
            style={{
              background: 'rgba(0,217,255,0.08)',
              border: '1px solid rgba(0,217,255,0.3)',
            }}
          >
            <p style={{ color: '#00d9ff' }} className="font-semibold">
              📱 Connecting to wallet...
            </p>
            <p className="text-sm mt-1" style={{ color: 'rgba(0,217,255,0.7)' }}>
              Scan the QR code with your Sage wallet app
            </p>
            <div className="mt-3 text-xs" style={{ color: 'rgba(0,217,255,0.5)' }}>
              ⏳ Waiting for wallet approval...
            </div>
          </div>
        )}

        {isConnected && (
          <div className="space-y-4">
            <div
              className="rounded-lg p-4"
              style={{
                background: 'rgba(0,255,100,0.08)',
                border: '1px solid rgba(0,255,100,0.3)',
              }}
            >
              <p style={{ color: '#00ff64' }} className="font-semibold">
                ✅ Wallet connected
              </p>
              <p className="text-sm mt-1" style={{ color: 'rgba(0,255,100,0.7)' }}>
                Your wallet is privately connected to this Activity session
              </p>
              {store.wallet.fingerprint && (
                <div
                  className="mt-2 text-xs font-mono"
                  style={{ color: 'rgba(0,255,100,0.6)' }}
                >
                  Fingerprint: {store.wallet.fingerprint}
                </div>
              )}
            </div>
            <button
              onClick={disconnectWallet}
              className="px-4 py-2 rounded-lg font-semibold transition-colors cursor-pointer"
              style={{
                background: 'rgba(255,68,68,0.15)',
                color: '#ff6b6b',
                border: '1px solid rgba(255,68,68,0.3)',
              }}
            >
              🔓 Disconnect Wallet
            </button>
          </div>
        )}
      </div>

      {/* NFT Fighters */}
      {isConnected && (
        <div className="glow-card">
          <h2 className="text-lg font-semibold mb-4 glow-text">🧙 Your Fighter NFTs</h2>

          {nfts.length === 0 ? (
            <div
              className="rounded-lg p-6 text-center"
              style={{
                background: 'var(--bg-deep)',
                border: '1px solid var(--border-color)',
              }}
            >
              <div className="text-4xl mb-3">🎭</div>
              <p className="font-semibold mb-2" style={{ color: 'var(--text-color)' }}>
                No Fighter NFTs Found
              </p>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                You need a Battle of Wizards Fighter NFT to participate in battles.
                Check out the NFT marketplace or complete gym challenges to earn fighters!
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
                Found {nfts.length} NFT(s). Select a fighter to use in battles:
              </p>

              <div className="grid md:grid-cols-2 gap-4">
                {nfts.map((nft: any) => (
                  <NFTCard
                    key={nft.id}
                    nft={nft}
                    isSelected={selectedFighter?.name === nft.fighter?.name}
                    onSelect={() => handleFighterSelect(nft)}
                  />
                ))}
              </div>

              {/* Default Fighter Option */}
              <div
                className="pt-4"
                style={{ borderTop: '1px solid var(--border-color)' }}
              >
                <h3
                  className="text-sm font-semibold mb-2"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Or use the default fighter:
                </h3>
                <DefaultFighterCard
                  isSelected={selectedFighter?.name === 'Apprentice Wizard'}
                  onSelect={() =>
                    store.setSelectedFighter({
                      source: 'user',
                      name: 'Apprentice Wizard',
                      stats: { hp: 100, atk: 15, def: 10, spd: 12 },
                      strength: 'Arcane',
                      weakness: 'Shadow',
                      rarity: 'Common',
                    })
                  }
                />
              </div>
            </div>
          )}
        </div>
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

// ── NFT Card ─────────────────────────────────────────────────────

interface NFTCardProps {
  nft: any;
  isSelected: boolean;
  onSelect: () => void;
}

function NFTCard({ nft, isSelected, onSelect }: NFTCardProps) {
  const fighter = nft.fighter;

  if (!fighter) {
    return (
      <div
        className="rounded-lg p-4"
        style={{
          background: 'var(--bg-deep)',
          border: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        <h3 className="font-semibold" style={{ color: 'var(--text-color)' }}>
          {nft.name}
        </h3>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Not a battleable fighter NFT
        </p>
      </div>
    );
  }

  return (
    <div
      className="rounded-lg p-4 cursor-pointer transition-all"
      style={{
        background: isSelected ? 'rgba(0,217,255,0.1)' : 'var(--bg-card)',
        border: isSelected
          ? '2px solid var(--border-color)'
          : '2px solid rgba(255,255,255,0.1)',
      }}
      onClick={onSelect}
    >
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-semibold" style={{ color: 'var(--text-color)' }}>
          {fighter.name}
        </h3>
        {isSelected && (
          <div className="text-sm font-semibold" style={{ color: 'var(--border-color)' }}>
            ✓ SELECTED
          </div>
        )}
      </div>

      <div className="text-sm mb-3" style={{ color: 'var(--text-muted)' }}>
        <div>
          {fighter.rarity} • {fighter.strength}
        </div>
        <div className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
          Weakness: {fighter.weakness}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 text-xs">
        <div className="text-center">
          <div className="font-semibold" style={{ color: 'var(--text-color)' }}>HP</div>
          <div style={{ color: '#ff6b6b' }}>{fighter.stats.hp}</div>
        </div>
        <div className="text-center">
          <div className="font-semibold" style={{ color: 'var(--text-color)' }}>ATK</div>
          <div style={{ color: '#ff6600' }}>{fighter.stats.atk}</div>
        </div>
        <div className="text-center">
          <div className="font-semibold" style={{ color: 'var(--text-color)' }}>DEF</div>
          <div style={{ color: '#00d9ff' }}>{fighter.stats.def}</div>
        </div>
        <div className="text-center">
          <div className="font-semibold" style={{ color: 'var(--text-color)' }}>SPD</div>
          <div style={{ color: '#00ff64' }}>{fighter.stats.spd}</div>
        </div>
      </div>

      {fighter.effect && (
        <div
          className="mt-3 text-xs rounded p-2"
          style={{
            background: 'rgba(255,170,0,0.1)',
            color: '#ffaa00',
          }}
        >
          <strong>Special:</strong> {fighter.effect}
        </div>
      )}
    </div>
  );
}

// ── Default Fighter Card ─────────────────────────────────────────

interface DefaultFighterCardProps {
  isSelected: boolean;
  onSelect: () => void;
}

function DefaultFighterCard({ isSelected, onSelect }: DefaultFighterCardProps) {
  return (
    <div
      className="rounded-lg p-4 cursor-pointer transition-all max-w-sm"
      style={{
        background: isSelected ? 'rgba(0,217,255,0.1)' : 'var(--bg-card)',
        border: isSelected
          ? '2px solid var(--border-color)'
          : '2px solid rgba(255,255,255,0.1)',
      }}
      onClick={onSelect}
    >
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-semibold" style={{ color: 'var(--text-color)' }}>
          Apprentice Wizard
        </h3>
        {isSelected && (
          <div className="text-sm font-semibold" style={{ color: 'var(--border-color)' }}>
            ✓ SELECTED
          </div>
        )}
      </div>

      <div className="text-sm mb-3" style={{ color: 'var(--text-muted)' }}>
        <div>Common • Arcane</div>
        <div className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
          Weakness: Shadow
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 text-xs">
        <div className="text-center">
          <div className="font-semibold" style={{ color: 'var(--text-color)' }}>HP</div>
          <div style={{ color: '#ff6b6b' }}>100</div>
        </div>
        <div className="text-center">
          <div className="font-semibold" style={{ color: 'var(--text-color)' }}>ATK</div>
          <div style={{ color: '#ff6600' }}>15</div>
        </div>
        <div className="text-center">
          <div className="font-semibold" style={{ color: 'var(--text-color)' }}>DEF</div>
          <div style={{ color: '#00d9ff' }}>10</div>
        </div>
        <div className="text-center">
          <div className="font-semibold" style={{ color: 'var(--text-color)' }}>SPD</div>
          <div style={{ color: '#00ff64' }}>12</div>
        </div>
      </div>

      <div
        className="mt-3 text-xs rounded p-2"
        style={{
          background: 'rgba(255,255,255,0.05)',
          color: 'var(--text-muted)',
        }}
      >
        <strong>Basic:</strong> A starter fighter for new wizards entering the arena
      </div>
    </div>
  );
}
