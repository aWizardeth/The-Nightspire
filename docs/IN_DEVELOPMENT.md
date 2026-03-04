# In Development — The Nightspire (aWizard GUI)

> Active work log. Items move here from `TODO.md` when started, and back to TODO's **Completed** section when finished.

---

## Currently Active

### 🔌 Production Deploy & Wallet Flow Verification
**Started:** 2026-03-02  
**Status:** In Progress  
**Description:** WalletConnect v2 is working (relay patched, QR inline, namespace fixed, clipboard fallback). Next step is end-to-end testing with a real Sage wallet and pushing a clean production build to Vercel.

**Subtasks:**
- [x] Relay WebSocket patch in `index.html` (timing fix for isomorphic-ws)
- [x] `chia:mainnet` required-only namespace (testnet11 optional)
- [x] `execCommand('copy')` clipboard fallback for Discord iframe
- [x] WalletConnect flow in BattleTab (QR + copy + cancel)
- [ ] End-to-end test: Sage wallet scan → session → `chip0002_getNFTs`
- [ ] Verify `chip0002_signCoinSpends` and `chip0002_getAssetCoins`
- [ ] Discord Developer Portal URL mapping to Vercel prod URL
- [ ] Clean up `console.log` debug statements
- [ ] Bundle size reduction via dynamic imports (~1 MB → target <500 kB)

---

### ⚔️ Battle Commit/Reveal UI
**Started:** 2026-03-02  
**Status:** In Progress  
**Description:** All the game mechanics are now ported (`fighters.ts`, `battleEngine.ts`, `stateChannel.ts`, `trackerClient.ts`). Next is wiring them into an actual playable battle loop in the Activity.

**Subtasks:**
- [x] `fighters.ts` — authoritative damage formula, element table, APPROVED_COLLECTIONS
- [x] `tiers.ts` — 5 bosses, player stat caps
- [x] `trackerClient.ts` — announce/list rooms via Koba42Corp tracker
- [x] `battleEngine.ts` — wired to `calculateFighterDamage()` + `resolveTurnOrder()`
- [x] `stateChannel.ts` — Chia protocol types (PotatoSignatures, ChannelKeys, StateChannel, etc.)
- [ ] Move selection UI (SCRATCH, EMBER, BUBBLE… move grid)
- [ ] Commit move (hash + salt stored locally)
- [ ] Reveal phase — exchange and verify opponent move via PeerJS
- [ ] HP update + round log rendering
- [ ] Battle end screen with APS delta

---

## Recently Completed

### � Mobile / Desktop Responsive Layout (2026-03-03 — commit `8b139fd`)
Full responsive layout pass across the Activity. `useIsMobile` hook (ResizeObserver, 480px breakpoint) drives CSS variable card sizing in Chellyz GameBoard — no more hardcoded Tailwind `w-[101px]` overflows on Discord mobile WebView. NavShell dropdown now clamps to viewport width. Battle log collapses to a bottom toggle strip on mobile.

### 🃏 Chellyz PvP Lobby (2026-03-03 — commit `8b139fd`)
Full PvP lobby system for Chellyz: `chellyzLobbyStore.ts` (mirrors `lobbyStore` but uses `NFTData[]` decks), `ChellyzPvpLobbyPanel` component (browse public games, create/join by invite code, ready handshake), GameBoard settle/forfeit panel, and root auto-start useEffect. `api/lobbies.ts` extended with `gameType`, `partyADeck`, `partyBDeck` — backwards-compatible with existing Battle lobbies.

### ⚡ NFT Fetch Performance (2026-03-03 — commit `f945e53`)
`sessionStorage` cache with 5-min TTL prevents re-fetching NFTs on every panel open. Auto-loads on wallet connect so mobile users don't need to tap "Load Fighters." WalletConnect batch size raised 50 → 200.

### �🔌 WalletConnect v2 Integration (2026-03-01 → 2026-03-02)
Full WalletConnect v2 relay integration working inside Discord Activity iframe. QR displays inline, relay rewritten via `index.html` WebSocket patch, clipboard fallback added, namespace corrected to mainnet-only required.

### 🎴 NFT Fighter Selector (2026-03-02)
Full fighter selector UI in WalletTab with real NFT stat bars, element/rarity badges, and approved-collection-aware `nftToFighter()` mapper.

### ⚔️ Fighter & State Channel Mechanics Port (2026-03-02)
All core game mechanics ported from `bow-app` and `arcane-battle-protocol` into The Nightspire's `src/lib/`. Clean TypeScript build confirmed (commit `b67284d`).

---

## Log Format

When adding a new item:

```markdown
### 🔖 Short Title
**Started:** YYYY-MM-DD
**Status:** In Progress | Blocked | Under Review
**Description:** One-paragraph summary of the work.
**Subtasks:**
- [ ] step 1
- [ ] step 2
```
