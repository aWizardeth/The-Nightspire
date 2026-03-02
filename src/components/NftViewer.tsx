// ─────────────────────────────────────────────────────────────────
//  NftViewer — gallery of the user's Magic BOW NFTs
// ─────────────────────────────────────────────────────────────────

// TODO: Fetch NFTs via bow-app /api/nft/:nftId
// TODO: Display metadata (tier, APS, element, spell list)
// TODO: NFT detail modal

export default function NftViewer() {
  return (
    <div className="space-y-4">
      <h2 className="glow-text text-lg font-bold">🎴 Your NFTs</h2>
      <p style={{ color: 'var(--text-muted)' }} className="text-sm">
        Connect your wallet to see your Magic BOW collection.
      </p>

      {/* Empty state */}
      <div className="glow-card flex items-center justify-center h-48">
        <span style={{ color: 'var(--text-muted)' }} className="text-sm">No NFTs loaded</span>
      </div>
    </div>
  );
}
