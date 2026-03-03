# TODO — The Nightspire (aWizard GUI)

> Single source of truth for planned work.  
> Move items to `IN_DEVELOPMENT.md` when you start, then back here under **Completed** when done.

---

## Backlog

### 🔐 Authentication & Access
- [ ] NFT-gated access: verify user holds a specific collection NFT (`/api/nft/gate`)
- [ ] Fallback: Discord role-based access if NFT gate is disabled
- [ ] Session persistence (refresh without re-auth)

### 🧙 aWizard Chat Panel
- [ ] Connect to external aWizard bot REST API (`VITE_AWIZARD_BOT_URL/chat`)
- [ ] Render bot responses as markdown
- [ ] Action buttons from `WizardAction[]` responses (navigate, toast, link)
- [ ] Typing indicator while waiting for bot reply

### ⚔️ Battle System
- [ ] Implement commit/reveal move submission UI
- [ ] Wire `PrivacyBattleEngine` to live PvP round loop
- [ ] Connect to gym-server `/gym/` endpoints for PvE battles
- [ ] Deep-link from Activity → bow-app for wallet-heavy flows
- [ ] Show live HP bars, move log, round counter during battle
- [ ] Battle result screen (APS delta, winner, rematch button)

### 📡 Tracker / PvP Matchmaking
- [ ] Room list UI — browse open `TrackerClient` rooms
- [ ] Create room flow — announce to tracker, share room link
- [ ] Join room flow — select from list, update player 2 fields
- [ ] PeerJS connection setup after both players announce

### 🎨 NFT Viewer
- [ ] Fetch via bow-app `/api/nft/:nftId` route
- [ ] Display NFT metadata, tier, APS, effect
- [ ] Approved-collection badge (Chellyz genesis highlight)

### 🏆 Leaderboard
- [ ] Fetch rankings from tracker scrape endpoint
- [ ] Highlight current user's rank and APS
- [ ] Filter by game type / tier

### 🚀 Deployment
- [ ] Discord Developer Portal URL mapping (Vercel prod URL)
- [ ] CI: GitHub Actions build + deploy on push to `main`
- [ ] Clean up `console.log` debug statements for production
- [ ] Code-split large bundle (currently ~1 MB) via dynamic imports
- [ ] Test full wallet → fighter select → battle flow end-to-end

---

## Completed

### 🏗 Foundation (2026-03-01)
- [x] Initialize Vite + React 19 + TypeScript project
- [x] Install and configure Tailwind CSS 4
- [x] Set up Discord Embedded App SDK (`@discord/embedded-app-sdk`)
- [x] Zustand store scaffolding (`bowActivityStore.ts`)
- [x] Project builds cleanly (`tsc && vite build`)
- [x] Dev server runs (`npm run dev` → localhost:5173)

### 🧭 Navigation & Shell (2026-03-01)
- [x] `NavShell.tsx` — tab bar for page navigation
- [x] Responsive layout for Discord Activity frame
- [x] Dark theme matching Discord palette

### 🧙 aWizard Chat Panel (2026-03-01)
- [x] `WizardChat.tsx` with message input and stub responses

### ⚔️ Battle Dashboard (2026-03-01)
- [x] `BattleDashboard.tsx` — placeholder cards

### 🎨 NFT Viewer (2026-03-01)
- [x] `NftViewer.tsx` — empty state with wallet prompt

### 🏆 Leaderboard (2026-03-01)
- [x] `Leaderboard.tsx` — placeholder table structure

### 📚 Documentation & Agent (2026-03-01)
- [x] aWizard VS Code agent with full tool belt
- [x] 11 skill files in `docs/skills/`
- [x] `ARCHITECTURE.md`, `IDEAS.md`, `AWIZARD_AGENT.md`

### 🔌 WalletConnect v2 Full Integration (2026-03-01 → 2026-03-02)
- [x] Migrate to `@walletconnect/sign-client` v2.17.0
- [x] `index.html` inline WebSocket patch — rewrites `wss://relay.walletconnect.*` before module eval
- [x] Discord URL Mapping: `/walletconnect` → `relay.walletconnect.org`
- [x] Inline QR code display in WalletTab (no modal)
- [x] `chia:mainnet` required namespace, `testnet11` optional only
- [x] Clipboard copy with `execCommand` fallback for Discord iframe
- [x] WalletConnect flow in BattleTab (QR + copy + cancel)
- [x] Connect/copy buttons visibility fixed (white text, gradient glow)
- [x] `logo.png` as WalletConnect metadata icon
- [x] Relay status debug card hidden behind `SHOW_RELAY_STATUS = false` flag

### 🎴 NFT Fighter Selector (2026-03-02)
- [x] `FighterSelector` component — stat bars, element badge, rarity badge, NFT image
- [x] `nftToFighter.ts` — WalletNft → NFTData + Fighter mapper
- [x] `parseWalletNfts()` utility for bulk NFT loading in WalletTab

### ⚔️ Fighter & State Channel Mechanics Port (2026-03-02)
- [x] `fighters.ts` — `ElementType` (11 elements incl. Exile/None), `RarityTier` (incl. Epic),
  `APPROVED_COLLECTIONS` (Chellyz Genesis), `calculateFighterDamage()`, `resolveTurnOrder()`,
  `calculateAPSChange()`, `nftToFighter()` collection-aware mapper
- [x] `tiers.ts` — 5-tier PvE progression (Apprentice → Overlord), boss stats,
  player stat caps, difficulty labels
- [x] `trackerClient.ts` — Koba42Corp `TrackerClient`, `RoomRecord`/`AnnounceParams`/`AnnounceFilter`
  types, auto-reannounce every 60 s, singleton `tracker` export
- [x] `battleEngine.ts` — `calculateDamage()` wired to `calculateFighterDamage()`,
  speed check wired to `resolveTurnOrder()`, duplicate element table removed
- [x] `nftToFighter.ts` — APPROVED_COLLECTIONS fast path, `Exile`/`None` added to element maps
- [x] `stateChannel.ts` — `PotatoSignatures`, `ChannelKeys`, `CoinInfo`, `SpendBundle`,
  `CoinSpend`, `ChannelStatus`, `StateChannel` protocol types + `openChannel()`/
  `updateChannelState()` stubs
- [x] `bowActivityStore.ts` — `Fighter`/`RarityTier`/`ElementType` re-exported from `fighters.ts`
