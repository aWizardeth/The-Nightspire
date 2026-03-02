# Architecture — aWizard GUI

> Hosting, authentication, and deployment design for the Discord embedded Activity.

---

## What gets hosted where?

```
┌─────────────────────────────────────────────────────────────────┐
│                        Vercel (Static)                          │
│  • Vite build output of awizard-gui                             │
│  • Serverless API route: /api/token  (OAuth2 code → token)      │
│  • Serverless API route: /api/nft/gate  (NFT verification)      │
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

### Do we need Vercel?

**Yes** — for the web portion of the Discord Activity. Here's why:

1. **Discord Activities are web pages** loaded in an iframe inside the Discord client. Discord requires a publicly accessible HTTPS URL.
2. Vercel provides instant HTTPS, global CDN, and zero-config deploys for Vite/React apps.
3. The **serverless functions** on Vercel handle the OAuth2 token exchange (so we never expose the Discord client secret in the browser).

### What does NOT go on Vercel?

| Component            | Where it runs            | Why                                            |
| -------------------- | ------------------------ | ---------------------------------------------- |
| aWizard Discord Bot  | VPS (e.g., Railway, Fly) | Needs a persistent WebSocket to Discord Gateway |
| gym-server           | VPS or local dev         | SQLite DB + Express, long-running process       |
| Chia node            | VPS                      | Blockchain daemon                               |

---

## Authentication Flow

### Option A: Discord OAuth2 (default)

Every Discord Activity automatically receives the user's identity through the Embedded App SDK. The flow:

```
1. Activity loads → SDK.ready()
2. SDK.commands.authorize() → returns `code`
3. Frontend POSTs `code` to /api/token (Vercel serverless)
4. Serverless exchanges code for access_token using client_secret
5. Frontend calls SDK.commands.authenticate({ access_token })
6. User identity available — store in Zustand (session-only)
```

**Scopes needed:** `identify`, `guilds`

### Option B: NFT-Gated Access (optional add-on)

After Discord auth, we can add a second gate:

```
1. User connects Chia wallet (WalletConnect via bow-app bridge)
2. Frontend calls /api/nft/gate?wallet=<address>
3. Server queries on-chain for NFTs from the approved cllection
4. If user holds ≥1 qualifying NFT → access granted
5. Otherwise → show "NFT Required" screen with mint link
```

**When to use this:**
- Exclusive content (early access, premium features)
- Tournament entry restricted to NFT holders
- Revenue model: require a BOW NFT to use advanced Activity features

### Option C: Discord Role Gate (simplest)

If NFT verification is too complex initially:

```
1. After Discord auth, check user's guild roles via Discord API
2. If user has a designated role (e.g., "Wizard") → access granted
3. Admins assign the role manually or via a role-react bot
```

---

## Environment Variables

### Vercel (production)

```env
DISCORD_CLIENT_ID=your_app_id
DISCORD_CLIENT_SECRET=your_app_secret
VITE_DISCORD_CLIENT_ID=your_app_id
VITE_AWIZARD_BOT_URL=https://bot.yourdomain.com
VITE_GYM_SERVER_URL=https://gym.yourdomain.com
VITE_BOW_APP_URL=https://bow.yourdomain.com
VITE_REQUIRE_NFT_GATE=false
```

### Local dev (`.env.local`, git-ignored)

```env
VITE_DISCORD_CLIENT_ID=your_app_id
VITE_AWIZARD_BOT_URL=http://localhost:4000
VITE_GYM_SERVER_URL=http://localhost:3001
VITE_BOW_APP_URL=http://localhost:3000
VITE_REQUIRE_NFT_GATE=false
VITE_TOKEN_EXCHANGE_URL=http://localhost:5173/.proxy/api/token
```

---

## Discord Developer Portal Setup

1. Go to https://discord.com/developers/applications
2. Create (or select) your application
3. Under **Activities → URL Mappings**, add:
   - **Root:** `https://your-vercel-domain.vercel.app` (production)
   - **Root:** `http://localhost:5173` (development, via Discord proxy)
4. Under **OAuth2**, set redirect URI to your Vercel domain
5. Enable the **Activities** feature flag

---

## Deployment Pipeline

```
git push main
  │
  ├─► Vercel auto-deploys awizard-gui (Vite build)
  │     • Static assets served from CDN
  │     • /api/token serverless function deployed
  │
  └─► (Separate) VPS deploys aWizard bot + gym-server
        • PM2 or Docker for process management
        • Reverse proxy (nginx/Caddy) for HTTPS
```

---

## Future: Cross-Platform Battles

The Discord Activity is the current focus, but the architecture must support a
future where **bow-app** (public web) and **awizard-gui** (Discord) players can
battle each other through the same Chia state channel.

```
┌─────────────────┐         ┌─────────────────┐
│  Discord User   │         │   Web App User  │
│ (awizard-gui)   │         │   (bow-app)     │
└────────┬────────┘         └────────┬────────┘
         │                           │
         │   WebSocket / REST        │   WebSocket / REST
         │                           │
    ┌────▼───────────────────────────▼────┐
    │         gym-server / pvp-server     │
    │      (matchmaking, lobby, relay)    │
    └────────────────┬───────────────────-┘
                     │
          ┌──────────▼──────────┐
          │   Chia Blockchain   │
          │   State Channel     │
          │  (platform-blind)   │
          └─────────────────────┘
```

**Design principle:** The battle API must never depend on *how* a player
authenticated (Discord OAuth2 vs WalletConnect). It only cares about a valid
wallet address and signed messages. Every API contract we build now should
follow this rule so cross-play requires zero protocol changes later.

See `docs/IDEAS.md` → "Cross-Platform Battles" for the full building-block list.

---

## Security Checklist

- [ ] `DISCORD_CLIENT_SECRET` only in server-side env (Vercel serverless), never in `VITE_*`
- [ ] Token exchange endpoint validates the `code` parameter
- [ ] Access tokens stored in memory only (Zustand), never localStorage
- [ ] NFT gate verification happens server-side
- [ ] CSP headers allow only Discord's iframe origins
- [ ] Rate-limit the token exchange endpoint
