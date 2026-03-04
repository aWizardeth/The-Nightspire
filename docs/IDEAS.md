# Ideas — aWizard GUI

> Brainstorm & backlog. Anything goes here. When an idea is promoted to real work, move it to `TODO.md`.

---

## 2026-03-01

### 💡 Battle Spectator Mode
Allow Discord users to watch an active battle in real-time inside the Activity. The GUI would subscribe to state-channel updates from gym-server via WebSocket and render a simplified battle view (turn log, HP bars, spell animations).

### 💡 Inline Tournament Registration
Users could sign up for BOW tournaments directly from the Discord Activity instead of navigating to a separate site. The aWizard bot would confirm registration and seed the bracket.

### 💡 Voice Channel Integration
When a PvP battle starts, auto-move both players into a shared voice channel for live trash talk. The Activity could display a "Go to Voice" button.

### 💡 NFT Showcase / Trading Post
A gallery where users display their best Magic BOW NFTs. Could include a "trade offer" flow where two Discord users propose a swap — mediated by the aWizard bot.

### 💡 Quest System
aWizard assigns daily/weekly quests (win 3 gym battles, reach APS 500, etc.). Completing quests earns cosmetic Discord badges or special NFT upgrades.

### 💡 Mini-Game Loading Screen
While waiting for a battle to start or a channel to open, show a small interactive mini-game (dodge-the-fireball, potion-mixing, etc.) to keep users engaged.

### 💡 Multi-Guild Leaderboard
Aggregate APS across multiple Discord servers running aWizard, creating a cross-server competitive ladder.

### ~~💡 Mobile-First Activity Layout~~ ✅ Shipped (2026-03-03)
~~Discord Activities render in a small window on mobile. Design a compact, touch-friendly layout that still surfaces battle stats, NFT info, and wizard chat in stacked cards.~~

Implemented via `useIsMobile` hook + CSS variable card sizing in Chellyz GameBoard, NavShell adaptive dropdown, and collapsible battle log. See commit `8b139fd`.

### 💡 Notifications & Reminders
aWizard sends DMs or channel messages when: your battle is ready, your tournament match is starting, a new gym tier unlocked, etc. The Activity settings panel would let users toggle notification categories.

### 💡 Theme Packs
Let guild admins choose a visual theme for their server's aWizard Activity — fire, ice, forest, void, etc. Theme files would be JSON + a handful of CSS variables.

### 💡 Cross-Platform Battles (bow-app ↔ awizard-gui)

A web app user (bow-app) should be able to create a lobby and battle a Discord
Activity user (awizard-gui) through the same Chia state channel.

**Building blocks (brick-by-brick):**
- [ ] Client-agnostic battle API in gym-server (wallet-addressed, platform-blind)
- [ ] Shared battle types in arcane-battle-protocol (consumed by both clients)
- [ ] Lobby system with shareable IDs (cross-platform join)
- [ ] Auth abstraction layer (Discord OAuth2 ↔ WalletConnect, unified to wallet address)
- [ ] State channel relay that accepts connections from any authenticated client

**Why this works:** The Chia state channel doesn't know about Discord or browsers.
It only knows two wallet addresses, signed state transitions, and a bond contract.
The protocol is already platform-agnostic — we just need the clients and
matchmaking layer to be platform-agnostic too.

**Current focus:** Discord Activity first. Web cross-play is a future quest —
but every brick we lay now should assume it's coming.

---

## Template

```markdown
### 💡 Idea Title
Brief description of the idea. What problem does it solve? Who benefits?
```
