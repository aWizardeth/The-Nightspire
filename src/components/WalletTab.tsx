import React, { useEffect } from 'react';
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
        <div className="bg-red-100 border border-red-400 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-red-800 mb-2">🚫 Discord User Required</h3>
          <p className="text-red-700">
            Discord Activity authentication is required to access wallet features.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="bg-gradient-to-r from-green-600 to-blue-600 text-white rounded-lg p-6">
        <h1 className="text-2xl font-bold mb-2">🔐 Privacy-First Wallet</h1>
        <p className="text-green-100">
          Your wallet connection is private and isolated from other Activity users
        </p>
        <div className="mt-2 text-sm bg-blue-800/30 rounded p-2">
          <strong>User ID:</strong> {userId}
        </div>
      </div>

      {/* Wallet Connection Status */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-lg font-semibold mb-4">🔗 Connection Status</h2>
        
        {isInitializing && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-blue-700 font-semibold">🔄 Initializing wallet...</p>
            <p className="text-blue-600 text-sm mt-1">Setting up WalletConnect for your private session</p>
          </div>
        )}

        {!isConnected && !isInitializing && !isConnecting && (
          <div className="space-y-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-yellow-700 font-semibold">⚠️ Wallet not connected</p>
              <p className="text-yellow-600 text-sm mt-1">
                Connect your Sage wallet to view NFTs and participate in battles
              </p>
            </div>
            <button
              onClick={connectWallet}
              className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-3 rounded-lg font-semibold transition-colors"
            >
              🔗 Connect Chia Wallet
            </button>
          </div>
        )}

        {isConnecting && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-blue-700 font-semibold">📱 Connecting to wallet...</p>
            <p className="text-blue-600 text-sm mt-1">
              Scan the QR code with your Sage wallet app
            </p>
            <div className="mt-3 text-xs text-blue-500">
              ⏳ Waiting for wallet approval...
            </div>
          </div>
        )}

        {isConnected && (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-green-700 font-semibold">✅ Wallet connected</p>
              <p className="text-green-600 text-sm mt-1">
                Your wallet is privately connected to this Activity session
              </p>
              {store.wallet.fingerprint && (
                <div className="mt-2 text-xs text-green-600 font-mono">
                  Fingerprint: {store.wallet.fingerprint}
                </div>
              )}
            </div>
            <button
              onClick={disconnectWallet}
              className="bg-red-100 hover:bg-red-200 text-red-700 px-4 py-2 rounded-lg font-semibold transition-colors"
            >
              🔓 Disconnect Wallet
            </button>
          </div>
        )}
      </div>

      {/* NFT Fighters */}
      {isConnected && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold mb-4">🧙 Your Fighter NFTs</h2>
          
          {nfts.length === 0 ? (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
              <div className="text-4xl mb-3">🎭</div>
              <p className="text-gray-600 font-semibold mb-2">No Fighter NFTs Found</p>
              <p className="text-gray-500 text-sm">
                You need a Battle of Wizards Fighter NFT to participate in battles.
                Check out the NFT marketplace or complete gym challenges to earn fighters!
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 mb-4">
                Found {nfts.length} NFT(s). Select a fighter to use in battles:
              </p>
              
              <div className="grid md:grid-cols-2 gap-4">
                {nfts.map((nft) => (
                  <NFTCard
                    key={nft.id}
                    nft={nft}
                    isSelected={selectedFighter?.name === nft.fighter?.name}
                    onSelect={() => handleFighterSelect(nft)}
                  />
                ))}
              </div>
              
              {/* Default Fighter Option */}
              <div className="border-t pt-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Or use the default fighter:</h3>
                <DefaultFighterCard
                  isSelected={selectedFighter?.name === 'Apprentice Wizard'}
                  onSelect={() => store.setSelectedFighter({
                    source: 'user',
                    name: 'Apprentice Wizard',
                    stats: { hp: 100, atk: 15, def: 10, spd: 12 },
                    strength: 'Arcane',
                    weakness: 'Shadow',
                    rarity: 'Common',
                  })}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Privacy Notice */}
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
        <h3 className="text-purple-800 font-semibold mb-2">🛡️ Privacy Guarantee</h3>
        <ul className="text-purple-700 text-sm space-y-1">
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

interface NFTCardProps {
  nft: any;
  isSelected: boolean;
  onSelect: () => void;
}

function NFTCard({ nft, isSelected, onSelect }: NFTCardProps) {
  const fighter = nft.fighter;
  
  if (!fighter) {
    return (
      <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
        <h3 className="font-semibold text-gray-800">{nft.name}</h3>
        <p className="text-sm text-gray-600 mt-1">Not a battleable fighter NFT</p>
      </div>
    );
  }

  return (
    <div
      className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
        isSelected
          ? 'border-blue-500 bg-blue-50'
          : 'border-gray-200 bg-white hover:border-gray-300'
      }`}
      onClick={onSelect}
    >
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-semibold text-gray-800">{fighter.name}</h3>
        {isSelected && <div className="text-blue-500 text-sm font-semibold">✓ SELECTED</div>}
      </div>
      
      <div className="text-sm text-gray-600 mb-3">
        <div>{fighter.rarity} • {fighter.strength}</div>
        <div className="text-xs text-gray-500">Weakness: {fighter.weakness}</div>
      </div>
      
      <div className="grid grid-cols-4 gap-2 text-xs">
        <div className="text-center">
          <div className="font-semibold">HP</div>
          <div className="text-red-600">{fighter.stats.hp}</div>
        </div>
        <div className="text-center">
          <div className="font-semibold">ATK</div>
          <div className="text-orange-600">{fighter.stats.atk}</div>
        </div>
        <div className="text-center">
          <div className="font-semibold">DEF</div>
          <div className="text-blue-600">{fighter.stats.def}</div>
        </div>
        <div className="text-center">
          <div className="font-semibold">SPD</div>
          <div className="text-green-600">{fighter.stats.spd}</div>
        </div>
      </div>
      
      {fighter.effect && (
        <div className="mt-3 text-xs bg-yellow-50 rounded p-2">
          <strong>Special:</strong> {fighter.effect}
        </div>
      )}
    </div>
  );
}

interface DefaultFighterCardProps {
  isSelected: boolean;
  onSelect: () => void;
}

function DefaultFighterCard({ isSelected, onSelect }: DefaultFighterCardProps) {
  return (
    <div
      className={`border-2 rounded-lg p-4 cursor-pointer transition-all max-w-sm ${
        isSelected
          ? 'border-blue-500 bg-blue-50'
          : 'border-gray-200 bg-white hover:border-gray-300'
      }`}
      onClick={onSelect}
    >
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-semibold text-gray-800">Apprentice Wizard</h3>
        {isSelected && <div className="text-blue-500 text-sm font-semibold">✓ SELECTED</div>}
      </div>
      
      <div className="text-sm text-gray-600 mb-3">
        <div>Common • Arcane</div>
        <div className="text-xs text-gray-500">Weakness: Shadow</div>
      </div>
      
      <div className="grid grid-cols-4 gap-2 text-xs">
        <div className="text-center">
          <div className="font-semibold">HP</div>
          <div className="text-red-600">100</div>
        </div>
        <div className="text-center">
          <div className="font-semibold">ATK</div>
          <div className="text-orange-600">15</div>
        </div>
        <div className="text-center">
          <div className="font-semibold">DEF</div>
          <div className="text-blue-600">10</div>
        </div>
        <div className="text-center">
          <div className="font-semibold">SPD</div>
          <div className="text-green-600">12</div>
        </div>
      </div>
      
      <div className="mt-3 text-xs bg-gray-100 rounded p-2 text-gray-600">
        <strong>Basic:</strong> A starter fighter for new wizards entering the arena
      </div>
    </div>
  );
}