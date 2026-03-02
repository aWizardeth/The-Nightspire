# The Nightspire 🌟

> Discord Activity for Arcane Battle of Wizards — chat with aWizard, view battles, manage NFTs, and climb leaderboards.

---

## What is The Nightspire?

The Nightspire is a **Discord Embedded Activity** that brings the Arcane BOW ecosystem directly into Discord. Users can:

- **🧙 Chat with aWizard** — get help with battles, NFTs, and strategy
- **⚔️ Battle Dashboard** — launch battles, view match history
- **🎴 NFT Viewer** — browse your Magic BOW collection  
- **🏆 Leaderboard** — see APS rankings and your current rank

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Vercel (Static)                          │
│  • Vite build output of The Nightspire                          │
│  • Serverless API route: /api/token  (OAuth2 code → token)      │
│  • Public HTTPS URL Discord points to for the Activity iframe   │
└──────────────────────────┬──────────────────────────────────────┘
                           │
         ┌─────────────────┼──────────────────┐
         ▼                 ▼                  ▼
  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐
  │ aWizard Bot │  │  gym-server  │  │   bow-app     │
  │  (VPS)      │  │  (VPS/local) │  │  (Vercel)     │
  │  Discord.js │  │  Express     │  │  Next.js      │
  └─────────────┘  └──────────────┘  └───────────────┘
```

## Quick Start

### Development

```bash
git clone https://github.com/aWizardeth/The-Nightspire.git
cd The-Nightspire

# Install dependencies  
npm install

# Create environment file
cp .env.example .env.local
# Edit .env.local with your Discord Application ID

# Start dev server
npm run dev
```

### Discord Developer Portal Setup

1. Create Discord Application
2. **Activities** → **URL Mappings**:
   - Dev: `http://localhost:5173`
   - Prod: Your Vercel URL
3. **OAuth2** → **Redirect URIs**: Same URLs
4. Copy **Application ID** to `.env.local`

### Testing in Discord

- Desktop/Web Discord → Any server
- Text channel → `/activities` or Activities button  
- Launch "Battle of Wizards" Activity

## Environment Variables

```env
# Required
VITE_DISCORD_CLIENT_ID=your_application_id_here

# Optional - leave empty for local development
VITE_AWIZARD_BOT_URL=https://your-bot.example.com
VITE_GYM_SERVER_URL=http://localhost:3001
VITE_BOW_APP_URL=http://localhost:3000
VITE_REQUIRE_NFT_GATE=false
```

## Deployment

### Vercel (Recommended)

1. **Connect GitHub repo** to Vercel
2. **Add environment variables** in Vercel dashboard
3. **Deploy** — auto-builds on push to main
4. **Update Discord Portal** with Vercel URL

### Manual Build

```bash
npm run build
# Upload dist/ folder to your static host
```

## Features

### 🧙 aWizard Chat
- Interactive wizard that responds to questions about battles, NFTs, leaderboards
- Mock responses for local development
- Connects to external bot API in production

### ⚔️ Battle Dashboard  
- View active and recent battles
- Quick match functionality
- Integration with gym-server APIs

### 🎴 NFT Viewer
- Browse Magic BOW NFT collection
- Display metadata, tier, APS
- Wallet connection via Chia/WalletConnect

### 🏆 Leaderboard
- APS-based rankings
- Highlight current user rank
- Real-time updates

## Tech Stack

- **React 19** — UI framework
- **Vite 6** — build tool  
- **TypeScript 5** — type safety
- **Tailwind CSS 4** — styling
- **Zustand 5** — state management
- **Discord Embedded App SDK** — Discord integration

## Future: Cross-Platform Battles

The architecture supports future cross-platform battles where web users (bow-app) can battle Discord users (The Nightspire) through the same Chia state channels. The protocol is platform-agnostic by design.

## License

MIT

## Related Projects

- **[aWizard Familiar](https://github.com/aWizardeth/aWizard-Familiar)** — VS Code agent setup
- **[Arcane BOW](https://github.com/your-org/bow-app)** — Web battle client
- **[Battle Protocol](https://github.com/your-org/arcane-battle-protocol)** — Core game contracts