import { useState } from 'react';
import { useWalletConnect } from '../providers/WalletConnectProvider';
import useBowActivityStore from '../store/bowActivityStore';
import type { Fighter, NFTData } from '../store/bowActivityStore';
import { parseWalletNfts, fetchNftMetadata } from '../lib/nftToFighter';

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
// Toggle to true to show the relay status diagnostic card
const SHOW_RELAY_STATUS = false;

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

// Small component so each card has its own imgError state inside .map()
function NftImage({ src, alt, elColour }: { src: string | undefined; alt: string; elColour: string }) {
  const [imgError, setImgError] = useState(false);
  if (!src || imgError) {
    return (
      <div
        className="rounded-lg flex items-center justify-center text-xl flex-shrink-0"
        style={{ width: 36, height: 36, background: `${elColour}20`, border: `2px solid ${elColour}40` }}
      >
        🧙
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      className="rounded-lg object-cover flex-shrink-0"
      style={{ width: 36, height: 36, border: `2px solid ${elColour}40` }}
      onError={() => setImgError(true)}
    />
  );
}

export default function WalletTab({ userId }: WalletTabProps) {
  const store = useBowActivityStore();
  const [showDebug, setShowDebug] = useState(false);
  const [isLoadingNfts, setIsLoadingNfts] = useState(false);
  const [nftError, setNftError] = useState<string | null>(null);
  const debugInfo = SHOW_DEBUG_PANEL ? getDebugInfo() : null;

  const {
    session,
    getNFTs,
    isConnecting,
    clientReady,
    error,
    relayProbeStatus,
  } = useWalletConnect();

  const loadNFTs = async () => {
    setIsLoadingNfts(true);
    setNftError(null);
    try {
      const raw = await getNFTs();
      console.log('[aWizard Wallet] Raw NFTs:', raw.length, raw);
      // Enrich each NFT with metadata from metadataUris[0] (image + attributes)
      const enriched = await fetchNftMetadata(raw);
      console.log('[aWizard Wallet] Metadata fetched for', enriched.filter(n => n.metadata).length, '/', enriched.length, 'NFTs');
      const parsed = parseWalletNfts(enriched);
      store.setNfts(parsed);
      console.log('[aWizard Wallet] Parsed fighters:', parsed.length);
    } catch (err: unknown) {
      const msg = err instanceof Error
        ? err.message
        : (typeof err === 'object' && err !== null
            ? JSON.stringify(err)
            : String(err));
      console.error('[aWizard Wallet] Failed to load NFTs:', err);
      setNftError(msg);
    } finally {
      setIsLoadingNfts(false);
    }
  };

  if (!userId) {
    return (
      <div className="p-3 text-center">
        <p className="text-sm" style={{ color: '#ff8a8a' }}>🚫 Discord authentication required</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">

      {/* Relay status — enable SHOW_RELAY_STATUS to diagnose relay issues */}
      {SHOW_RELAY_STATUS && (
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
      )}

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

      {/* Not connected */}
      {!session && (
        <div className="rounded-xl p-4 text-center" style={{ background: 'rgba(0,217,255,0.06)', border: '1px dashed rgba(0,217,255,0.3)' }}>
          <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text-color)' }}>🔮 Wallet not connected</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Tap the <strong style={{ color: '#4ade80' }}>☰</strong> menu in the top-right to connect your Sage wallet
          </p>
        </div>
      )}

      {/* Fighter selector — only when connected */}
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
          <div className="grid grid-cols-2 gap-2">
            {nfts.map((nft) => {
              const f = nft.fighter!;
              const isSelected = selected?.name === f.name && selected?.strength === f.strength;
              const elColour = ELEMENT_COLOURS[f.strength] ?? '#aaa';
              const rarityColour = RARITY_COLOURS[f.rarity] ?? '#aaa';
              return (
                <button
                  key={nft.id}
                  onClick={() => onSelect(f)}
                  className="rounded-lg p-2 text-left transition-all"
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
                  <div className="flex items-start gap-2 mb-1.5">
                    <NftImage src={nft.image} alt={nft.name} elColour={elColour} />
                    <div className="min-w-0 flex-1">
                      <p className="font-bold truncate" style={{ color: 'var(--text-color)', fontSize: '0.75rem' }}>{f.name}</p>
                      <div className="flex gap-1 mt-0.5 flex-wrap">
                        <span
                          className="px-1 py-0.5 rounded font-bold"
                          style={{ fontSize: '0.6rem', background: `${rarityColour}25`, color: rarityColour, border: `1px solid ${rarityColour}50` }}
                        >
                          {f.rarity}
                        </span>
                        <span
                          className="px-1 py-0.5 rounded font-bold"
                          style={{ fontSize: '0.6rem', background: `${elColour}20`, color: elColour, border: `1px solid ${elColour}40` }}
                        >
                          {f.strength}
                        </span>
                      </div>
                    </div>
                    {isSelected && (
                      <span className="text-lg flex-shrink-0">✅</span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
                    <span style={{ fontSize: '0.65rem', color: '#4caf50' }}>❤ {f.stats.hp}</span>
                    <span style={{ fontSize: '0.65rem', color: '#ff6b35' }}>⚔ {f.stats.atk}</span>
                    <span style={{ fontSize: '0.65rem', color: '#2196f3' }}>🛡 {f.stats.def}</span>
                    <span style={{ fontSize: '0.65rem', color: '#ffd600' }}>💨 {f.stats.spd}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
