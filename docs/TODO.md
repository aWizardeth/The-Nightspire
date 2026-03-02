# TODO — aWizard GUI

> Single source of truth for planned work.
> Move items to `IN_DEVELOPMENT.md` when you start, then back here under **Completed** when done.

---

## Backlog

### 🔐 Authentication & Access
- [ ] Create Discord Application in Developer Portal & configure Activity URL mapping
- [ ] Server-side token exchange endpoint (or proxy via bow-app API)
- [ ] Set up `.env.local` with Discord client ID and API URLs
- [ ] NFT-gated access: verify user holds a specific collection NFT
- [ ] Fallback: Discord role-based access if NFT gate is disabled
- [ ] Session persistence (refresh without re-auth)

### 🧙 aWizard Chat Panel
- [ ] Connect to external aWizard bot API (`/api/wizard/chat`)
- [ ] Render bot responses as markdown
- [ ] Action buttons from `WizardAction[]` responses (navigate, toast, link)
- [ ] Typing indicator while waiting for bot reply

### ⚔️ Battle Dashboard
- [ ] Fetch battle state from gym-server `/gym/` endpoints
- [ ] Launch battle from within Discord Activity (deep link to bow-app or inline)

### 🎨 NFT Viewer
- [ ] Fetch via bow-app `/api/nft/:nftId` route
- [ ] Display NFT metadata, tier, APS

### 🏆 Leaderboard
- [ ] Fetch from tracker API
- [ ] Highlight current user's rank

### 🚀 Deployment
- [ ] Vercel project setup for static Vite build
- [ ] Environment variables on Vercel (Discord client ID, API URLs)
- [ ] Discord Developer Portal URL mapping to Vercel production URL
- [ ] CI: GitHub Actions to build + deploy on push to `main`

---

## Completed

### 🏗 Foundation (2026-03-01)
- [x] Initialize Vite + React 19 + TypeScript project
- [x] Install and configure Tailwind CSS 4
- [x] Set up Discord Embedded App SDK (`@discord/embedded-app-sdk`)
- [x] Zustand store scaffolding (`guiStore.ts`)
- [x] Project builds cleanly (`tsc && vite build`)
- [x] Dev server runs (`npm run dev` → localhost:5173)

### 🧭 Navigation & Shell (2026-03-01)
- [x] `NavShell.tsx` — tab bar for page navigation (Wizard, Battles, NFTs, Leaderboard)
- [x] Responsive layout for Discord's Activity frame
- [x] Dark theme matching Discord's palette (CSS custom properties)

### 🧙 aWizard Chat Panel (2026-03-01)
- [x] `WizardChat.tsx` component with message input and response area (stub)

### ⚔️ Battle Dashboard (2026-03-01)
- [x] `BattleDashboard.tsx` — placeholder cards for active/recent/quick-match

### 🎨 NFT Viewer (2026-03-01)
- [x] `NftViewer.tsx` — empty state with wallet connection prompt

### 🏆 Leaderboard (2026-03-01)
- [x] `Leaderboard.tsx` — placeholder table structure

### 📚 Documentation & Agent (2026-03-01)
- [x] aWizard VS Code agent with full tool belt (`.github/agents/awizard.agent.md`)
- [x] 11 skill files in `docs/skills/` (domain knowledge for agent)
- [x] ARCHITECTURE.md with hosting, auth, deployment, cross-platform vision
- [x] IDEAS.md with brainstorm backlog including cross-platform battles
- [x] `.vscode/settings.json` & `extensions.json` for cloneable dev experience
